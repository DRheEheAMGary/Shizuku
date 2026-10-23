#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全域搜索索引器 —— 产出 search-index.json（格式契约见仓库根 docs / 契约文档）。

在**服务器上**运行：读服务器上的站点文件、博客数据库，抓 PHP 渲染后的 HTML。

用法::

    python3 tools/build_search_index.py                  # 写到 /www/wwwroot/shizuku/search-index.json
    python3 tools/build_search_index.py --dry-run        # 只打印统计，不写文件
    python3 tools/build_search_index.py --out /tmp/x.json
    python3 tools/build_search_index.py --site blog --site mc --no-verify
    python3 tools/build_search_index.py --self-test      # 离线自测文本清洗逻辑

只用标准库，Python 3.8+。数据库口令运行时从 wp-config.php 读取，不写死。
"""

import argparse
import datetime
import html
import json
import os
import re
import subprocess
import sys
import tempfile

# ---------------------------------------------------------------------------
# 契约常量
# ---------------------------------------------------------------------------

TEXT_LIMIT = 1200

# site id -> (展示名, 域名)；前端按这份映射分组，新增站点两边都要改
SITES = [
    # (site, 展示名, 域名, 站点根, 抓取时用的 server_name)
    # 只索引博客和 MC 文档：主站以后要换成 shizuku，所以整站先不收。
    ("blog", "博客", "blog.dreamgary.cn", "/www/wwwroot/blog", "blog.dreamgary.cn"),
    ("mc", "MC 文档", "mc.dreamgary.cn", "/www/wwwroot/mc", "mc.dreamgary.cn"),
]
SITE_MAP = dict((s[0], s) for s in SITES)
ALLOWED_DOMAINS = frozenset(s[2] for s in SITES)

# main 站：契约写的是 dreamgary.cn，但该域名 301 到 www.dreamgary.cn，
# 契约的 domain_rules 也把 main 配成 www.dreamgary.cn —— 对外 URL 用 www，
# 抓取时用 dreamgary.cn 走 --resolve 也拿得到（会 301，curl -L 跟随）。
MAIN_PUBLIC_DOMAIN = "www.dreamgary.cn"
MAIN_PUBLIC_ORIGIN = "https://" + MAIN_PUBLIC_DOMAIN

DEFAULT_OUT = "/www/wwwroot/shizuku/search-index.json"
WP_CONFIG = "/www/wwwroot/blog/wp-config.php"

# blog：只收这两种 post_type，别的（revision/attachment/nav_menu_item/...）一律不收
BLOG_POST_TYPES = ("post", "page")
BLOG_TYPE_MAP = {"post": "post", "page": "page"}

# 每个站允许的 type（契约：post=文章、page=页面、doc=文档页）
ALLOWED_TYPES = {
    "blog": ("post", "page"),
    "main": ("page",),
    "oitr": ("page",),
    "mc": ("doc",),
    "rdm": ("page",),
}

# main：pages/*.php 是页面；includes/ components/ config.php README / cache 等都不是
MAIN_SKIP_FILES = re.compile(
    r"(^readme|^license|^changelog|^contributing|^todo|^config\.php$|^\.)", re.I
)

OITR_SKIP_DIRS = frozenset(
    ["assets", "lib", "node_modules", ".git", ".well-known", "fonts", "images", "img"]
)
OITR_SKIP_FILES = re.compile(
    r"(^404\.|^(?:readme|license|changelog|api_summary|zen)\b|^test-|-test\.html$)", re.I
)

MC_PRUNE_DIRS = frozenset(
    [".vitepress", "public", "node_modules", ".git", "scripts", "dist", "cache"]
)
MC_SKIP_NAMES = re.compile(r"^readme\b", re.I)

CURL_TIMEOUT = "25"

# ---------------------------------------------------------------------------
# 文本清洗
# ---------------------------------------------------------------------------

# annotation（MathML 的 TeX 源码）会和渲染出来的公式重复，整段丢掉
_DROP_TAGS = r"script|style|noscript|template|svg|iframe|object|embed|annotation"
_DROP_BLOCK = re.compile(r"<(%s)\b[^>]*>.*?</\1\s*>" % _DROP_TAGS, re.I | re.S)
_DROP_OPEN = re.compile(r"<(%s)\b[^>]*?/?>" % _DROP_TAGS, re.I | re.S)
_COMMENT = re.compile(r"<!--.*?-->", re.S)
_CDATA = re.compile(r"<!\[CDATA\[.*?\]\]>", re.S)
_DECL = re.compile(r"<![^>]*>")
_TAG = re.compile(r"</?[A-Za-z!][^>]*>")
_BLOCK_TAG = re.compile(
    r"</?(p|div|section|article|header|footer|main|aside|nav|h[1-6]|li|ul|ol|dl|dt|dd|tr|td|th"
    r"|table|thead|tbody|blockquote|pre|figure|figcaption|hr|br|form|fieldset)\b[^>]*>",
    re.I,
)
_WS = re.compile(r"\s+")


def strip_tags(markup, limit=None):
    """HTML 片段 -> 纯文本：丢 script/style/svg 整段、解实体、压缩空白。"""
    if not markup:
        return ""
    text = _DROP_BLOCK.sub(" ", markup)
    text = _DROP_OPEN.sub(" ", text)  # 未闭合的 <script ...> / <svg ...>
    text = _COMMENT.sub(" ", text)
    text = _CDATA.sub(" ", text)
    text = _DECL.sub(" ", text)
    # 块级标签换成空格，避免相邻段落粘连；行内的直接删掉避免把单词劈开
    text = _BLOCK_TAG.sub(" ", text)
    text = _TAG.sub("", text)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ").replace("\u3000", " ").replace("\u200b", "")
    text = _WS.sub(" ", text).strip()
    return truncate(text, limit)


def truncate(text, limit=None):
    """截断到 limit 个字符。

    limit 为 None 时不截。截断点尽量落在「语义边界」（空白 / 标点）上，
    避免把单词和数字（比如 URL、代码）切成半截。
    """
    if limit is None or len(text) <= limit:
        return text
    head = text[:limit]
    floor = int(limit * 0.7)
    cut = max(head.rfind(" "), head.rfind("，"), head.rfind("。"), head.rfind("、"))
    if cut >= floor:
        return head[:cut].rstrip(" ,;:，、")
    return head


_MD_FRONT = re.compile(r"\A---\s*\n.*?\n---\s*(?:\n|\Z)", re.S)
_MD_FENCE = re.compile(r"^\s*(```|~~~).*?^\s*\1[^\n]*$", re.S | re.M)
_MD_IMG = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_MD_LINK = re.compile(r"\[([^\]]*)\]\([^)\s]*(?:\s+\"[^\"]*\")?\)")
_MD_REF_LINK = re.compile(r"\[([^\]]*)\]\[[^\]]*\]")
_MD_REF_DEF = re.compile(r"^\s*\[[^\]]+\]:\s*\S+.*$", re.M)
_MD_HR = re.compile(r"^\s*([-*_])\s*(?:\1\s*){2,}$", re.M)
_MD_HTML = re.compile(r"^\s*</?[A-Za-z][^>]*>\s*$", re.M)
_MD_QUOTE = re.compile(r"^\s{0,3}>\s?", re.M)
_MD_HEAD = re.compile(r"^\s{0,3}#{1,6}\s*", re.M)
_MD_LIST = re.compile(r"^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+", re.M)
_MD_EMPH = re.compile(r"(\*\*|__|\*|_|~~|`)")
_MD_TABLE_SEP = re.compile(r"^\s*\|?[\s:|-]+\|[\s:|-]*$", re.M)
_MD_BADGE = re.compile(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)")


def strip_markdown(md):
    """Markdown -> 纯文本（足够用于检索与摘要，不做完整解析）。"""
    text = md
    front = _MD_FRONT.match(text)
    title = None
    if front:
        block = front.group(0)
        m = re.search(r"^title\s*:\s*(.+)$", block, re.M)
        if m:
            title = m.group(1).strip().strip("\"'")
        text = text[front.end():]
    text = _MD_FENCE.sub(" ", text)  # 代码块整段丢弃
    text = _MD_BADGE.sub(" ", text)
    text = _MD_IMG.sub(r"\1", text)
    text = _MD_REF_DEF.sub(" ", text)
    text = _MD_TABLE_SEP.sub(" ", text)
    text = _MD_HTML.sub(" ", text)
    text = _MD_REF_LINK.sub(r"\1", text)
    text = _MD_LINK.sub(r"\1", text)
    text = _MD_HR.sub(" ", text)
    text = _MD_QUOTE.sub("", text)
    text = _MD_HEAD.sub(" ", text)
    text = _MD_LIST.sub(" ", text)
    text = re.sub(r"^\s*\|", " ", text, flags=re.M)
    text = re.sub(r"\|\s*$", " ", text, flags=re.M)
    text = text.replace("|", " ")
    text = _MD_EMPH.sub("", text)
    text = strip_tags(text)  # 残留的内联 HTML
    return text, title


# 数组下标 a[i] / 数学区间 x[0,1) 前面紧贴字母数字，不能当 shortcode
# 注意：正则字符类里 ] 紧跟在 \] 后面会提前闭合字符类 —— 所以这里写成
#   (?<![A-Za-z0-9_$\]])
# 形式：\] 是转义的右方括号，外层方括号单独闭合。
# 「前一个字符不是字母/数字/_/$/\]」的负向后顾。
# 源码里多出来的一个 ] 是给 re 看的：字符类里 \] 优先解释为「转义的 ]」，
# 而它后面紧跟的那个 ] 才闭合字符类。
_BACKSLASH = chr(92)
_NOT_ARRAY_SUB = "(?<![A-Za-z0-9_$" + _BACKSLASH + _BACKSLASH + "]]" + _BACKSLASH + "])"
_CLOSE_SUB = _NOT_ARRAY_SUB
_SHORTCODE_ANY = re.compile(
    _NOT_ARRAY_SUB
    + r"(?:\[(/)?([a-zA-Z_][a-zA-Z0-9_-]*)([^\[\]\n]{0,200}?)\]"
    r"|\[/([a-zA-Z_][a-zA-Z0-9_-]*)\])"
)
_SHORTCODE_CLOSE = re.compile(_CLOSE_SUB + r"\[/([a-zA-Z_][a-zA-Z0-9_-]*)\]")
# 博客主题的 emoji shortcode：{hanser1_peach}
_EMOJI_SC = re.compile(r"\{\w+\}")  # 名字可能带中文，用 \w（str 模式下含 Unicode）
_FORM_TAG = re.compile(
    r"<(form|input|button|select|textarea|label|option|fieldset|legend)\b[^>]*>", re.I
)


def strip_shortcodes(text):
    """去掉 [gallery] / [caption id='x']...[/caption] 这类 WP shortcode。

    - 前面紧贴字母/数字/下划线/$ 的 `[xxx]`（数组下标 a[i]）不算；
    - 名字带下划线/连字符、或带 key=value 属性 => 一定是 shortcode；
    - 同名开/闭标签成对出现 => 是 shortcode（顺便去掉内容，如 [caption] 说明文字）；
    - 其余单个裸 `[word]`（可能是 markdown 残留链接）保留。
    """

    # [/name] 的 name 集合（re 返回 tuple，取第一个分组）
    closes = set(t[0] if isinstance(t, tuple) else t for t in _SHORTCODE_CLOSE.findall(text))

    def repl(m):
        if m.group(4):  # [/name]
            return " "
        closing, name, rest = m.group(1), m.group(2), m.group(3) or ""
        if closing:  # 裸的 [/name] 形式
            return " "
        if re.match(r"\s+[a-zA-Z_.-]+\s*=", rest):
            return " "
        if "_" in name or "-" in name:
            return " "
        if name in closes:
            return " "
        return m.group(0)

    # 前端表情包 shortcode，如 {hanser1_peach}
    text = _EMOJI_SC.sub(" ", text)
    # 先删成对 shortcode 之间的内容（[caption]说明文字[/caption] 整段不要）
    for name in closes:
        pair = re.compile(
            _NOT_ARRAY_SUB + r"\[%s\b[^\]\n]*\](?:(?!\[/%s\]).)*?\[/%s\]"
            % (re.escape(name), re.escape(name), re.escape(name)),
            re.S,
        )
        text = pair.sub(" ", text)
    return _WS.sub(" ", _SHORTCODE_ANY.sub(repl, text)).strip()


_BAD_TITLE = re.compile(
    r"^(?:untitled|no title|home|index|页面|未命名|无标题|404|403|500|"
    r"not found|forbidden|error|welcome to nginx!?)$",
    re.I,
)
_TITLE_WIDE_SEP = re.compile(r"\s*[|｜·•–—]\s*")
_TITLE_DASH_ROUNDS = 2


def clean_title(title, fallback):
    """标题清洗：去标签/实体/空白；「标题 - 站点名」后缀去掉；无意义标题退回 fallback。"""
    if title:
        title = strip_tags(title)
        if _TITLE_WIDE_SEP.search(title):  # 「标题 | 站点名」：留前半段
            title = _TITLE_WIDE_SEP.split(title)[0]
        title = title.strip()
        for _ in range(_TITLE_DASH_ROUNDS):  # 模板里常见「标题 - 站点名 - 站点名」
            head, sep, tail = title.rpartition(" - ")
            if not sep or not head.strip() or not tail.strip():
                break
            title = head.strip()
        title = title.strip()
        if title and not _BAD_TITLE.match(title) and len(title) >= 2:
            return title
    return fallback


def title_from_path(path, base_dir):
    """退回文件名 / URL 末段。"""
    rel = os.path.relpath(path, base_dir) if base_dir else path
    stem = re.sub(r"\.(?:md|markdown|html?|php)$", "", rel, flags=re.I)
    stem = stem.replace("\\", "/").strip("/")
    parts = [p for p in stem.split("/") if p]
    # index.md / index.html -> 用目录名；根目录 index 用站点根目录名
    if parts and parts[-1].lower() == "index":
        parts = parts[:-1]
    if not parts:
        parts = [os.path.basename(base_dir.rstrip("/")) or "index"]
    name = parts[-1]
    return name.replace("-", " ").replace("_", " ").strip() or "index"


def norm_date(value):
    """各种日期格式 -> YYYY-MM-DD / None。"""
    if not value:
        return None
    s = str(value).strip()
    if not s or s.lower() in ("none", "null", "0000-00-00", "0000-00-00 00:00:00"):
        return None
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", s)
    if not m:
        m = re.match(r"^(\d{4})(\d{2})(\d{2})$", s)
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    try:
        return datetime.date(y, mo, d).isoformat()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------


def warn(msg):
    sys.stderr.write("[warn] %s\n" % msg)


def info(msg):
    sys.stderr.write("[info] %s\n" % msg)


def read_text(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    for enc in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def make_item(site, itype, title, url, text, date):
    return {
        "site": site,
        "type": itype,
        "title": title,
        "url": url,
        "text": text,
        "date": norm_date(date),
    }


# ---------------------------------------------------------------------------
# 抓取工具：PHP 页面走本机 --resolve
# ---------------------------------------------------------------------------


def fetch(url, host, local="127.0.0.1"):
    """curl --resolve <host>:443:127.0.0.1 抓完整 HTML。失败返回 None。"""
    cmd = [
        "curl",
        "-sS",
        "-k",
        "-L",
        "--max-time",
        CURL_TIMEOUT,
        "--resolve",
        "%s:443:%s" % (host, local),
        "-H",
        "Accept: text/html,application/xhtml+xml",
        "-A",
        "shizuku-search-indexer/1.0",
        url,
    ]
    try:
        out = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        warn("curl 失败 %s: %s" % (url, exc))
        return None
    body = out.stdout.decode("utf-8", "replace")
    if out.returncode != 0:
        err = out.stderr.decode("utf-8", "replace").strip()
        warn("curl 返回 %s %s: %s" % (out.returncode, url, err))
        return None
    if not body.strip():
        warn("curl 拿到空响应 %s" % url)
        return None
    return body


def page_title(doc):
    m = re.search(r"<title[^>]*>(.*?)</title>", doc, re.I | re.S)
    if m:
        return m.group(1)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.I | re.S)
    return m.group(1) if m else None


def drop_html_noise(doc):
    """从整页 HTML 里摘出正文区域，丢掉页面骨架/导航/页脚等噪声。"""
    text = _DROP_BLOCK.sub(" ", doc)
    text = re.sub(r"<head\b[^>]*>.*?</head\s*>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<(nav|footer|aside)\b[^>]*>.*?</\1\s*>", " ", text, flags=re.I | re.S)
    text = _FORM_TAG.sub(" ", text)
    return text


def extract_main_region(doc, segments):
    """按 <section id="X"> 切分 main 站页面。"""
    regions = {}
    pattern = re.compile(
        r'<section[^>]*\bid\s*=\s*"(%s)"[^>]*>' % "|".join(re.escape(s) for s, _ in segments),
        re.I,
    )
    marks = list(pattern.finditer(doc))
    for idx, m in enumerate(marks):
        end = marks[idx + 1].start() if idx + 1 < len(marks) else len(doc)
        regions[m.group(1)] = doc[m.start():end]
    return regions


# ---------------------------------------------------------------------------
# 各站采集
# ---------------------------------------------------------------------------


def parse_wp_config(path):
    """从 wp-config.php 读 DB_* 常量（不写死口令）。"""
    try:
        src = read_text(path)
    except OSError as exc:
        raise RuntimeError("读不到 %s: %s" % (path, exc))
    cfg = {}
    for m in re.finditer(
        r"""define\s*\(\s*(['"])(DB_(?:NAME|USER|PASSWORD|HOST|CHARSET))\1\s*,\s*(['"])(.*?)\3\s*\)""",
        src,
        re.S,
    ):
        cfg[m.group(2)] = m.group(4)
    missing = [k for k in ("DB_NAME", "DB_USER", "DB_PASSWORD") if k not in cfg]
    if missing:
        raise RuntimeError("%s 缺少 %s" % (path, ", ".join(missing)))
    cfg.setdefault("DB_HOST", "127.0.0.1")
    cfg["DB_NAME"] = unescape_php_string(cfg["DB_NAME"])
    cfg["DB_USER"] = unescape_php_string(cfg["DB_USER"])
    cfg["DB_PASSWORD"] = unescape_php_string(cfg["DB_PASSWORD"])
    return cfg


def unescape_php_string(s):
    """PHP 单引号/双引号字符串里常见的转义。"""
    if "\\" not in s:
        return s
    return (
        s.replace("\\\\", "\x00")
        .replace("\\'", "'")
        .replace('\\"', '"')
        .replace("\\$", "$")
        .replace("\x00", "\\")
    )


def mysql_backend():
    """挑一个能连上 MariaDB 的客户端；**必须走 TCP**（socket 路径不对会 ERROR 2002）。"""
    for kind, cmd in (("mariadb", "mariadb"), ("mysql", "mysql")):
        try:
            subprocess.run([cmd, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return kind, cmd
        except OSError:
            continue
    raise RuntimeError("服务器上没有 mysql / mariadb 客户端")


def run_query(cfg, sql, backend):
    """用 --defaults-extra-file 传凭据，避免口令出现在进程参数里。"""
    kind, cmd = backend
    fd, cnf = tempfile.mkstemp(prefix=".search-index-", suffix=".cnf")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write("[client]\n")
            fh.write("user=%s\n" % cfg["DB_USER"])
            fh.write("password=%s\n" % cfg["DB_PASSWORD"].replace("\\", "\\\\"))
            fh.write("host=127.0.0.1\n")
            fh.write("protocol=TCP\n")
            fh.write("default-character-set=utf8mb4\n")
        os.chmod(cnf, 0o600)
        args = [cmd, "--defaults-extra-file=%s" % cnf, "--batch", "--raw", "--skip-column-names"]
        if kind == "mysql":
            args.append("--default-character-set=utf8mb4")
        args += ["--database=%s" % cfg["DB_NAME"], "-e", sql]
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", "replace").strip()
            raise RuntimeError("%s 查询失败: %s" % (cmd, err))
        return proc.stdout.decode("utf-8", "replace")
    finally:
        try:
            os.unlink(cnf)
        except OSError:
            pass


_RAW_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# 文本列一律用 HEX() 取原始字节、在 Python 侧解码：不依赖 mysql 客户端的转义
# （--batch 会把 \n 转成字面量、内容里还有裸 CR，行结构很容易被打乱）。
_COLS = (
    "ID, HEX(post_type), HEX(post_status), HEX(post_title), HEX(post_name), "
    "HEX(post_date), HEX(post_excerpt), HEX(post_content), post_parent"
)
_COL_COUNT = 9


def hex_to_text(value):
    if value is None or value == "" or value.upper() == "NULL":
        return ""
    try:
        return bytes.fromhex(value).decode("utf-8", "replace")
    except (ValueError, TypeError):
        return ""


def sql_escape(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def collect_blog(stat):
    """blog：直接读 post_content + post_excerpt。

    白名单写死在 SQL 里：post_type IN ('post','page') AND post_status='publish'，
    revision / attachment / auto-draft / nav_menu_item / micropost ... 全部不进结果集。
    """
    cfg = parse_wp_config(WP_CONFIG)
    backend = mysql_backend()
    types = "','".join(BLOG_POST_TYPES)
    sql = (
        "SELECT %s FROM wp_posts WHERE post_type IN ('%s') AND post_status = 'publish' "
        "AND (post_content IS NOT NULL OR post_excerpt IS NOT NULL) ORDER BY post_date DESC;"
        % (_COLS, types)
    )
    raw = run_query(cfg, sql, backend)
    rows = []
    for line in raw.split("\n"):
        if not line.strip():
            continue
        cells = line.split("\t")
        if len(cells) != _COL_COUNT:
            warn(
                "blog 结果行字段数不对（%d/%d），跳过: %r"
                % (len(cells), _COL_COUNT, line[:80])
            )
            continue
        rows.append(cells)

    site_meta = SITE_MAP["blog"]
    domain = site_meta[2]
    parsed = []
    for r in rows:
        pid = r[0].strip()
        ptype = hex_to_text(r[1])
        ptitle = hex_to_text(r[3])
        pname = hex_to_text(r[4])
        pdate = hex_to_text(r[5])
        pexcerpt = hex_to_text(r[6])
        pcontent = hex_to_text(r[7])
        pparent = r[8].strip()
        parsed.append((pid, ptype, ptitle, pname, pdate, pexcerpt, pcontent, pparent))

    # 已知的页面 slug（用于修正页面层级 URL）
    page_slugs = {}
    for pid, ptype, _t, pname, _d, _e, _c, pparent in parsed:
        if ptype == "page":
            page_slugs[pid] = (pname, pparent)

    items = []
    seen = set()
    for pid, ptype, ptitle, pname, pdate, pexcerpt, pcontent, pparent in parsed:
        stat["blog"]["rows"] += 1
        if ptype not in BLOG_POST_TYPES:
            continue
        url = wp_permalink(ptype, pname, pid, pparent, page_slugs, domain)
        if url in seen:
            continue
        seen.add(url)
        body = pcontent or ""
        excerpt = strip_tags(strip_shortcodes(pexcerpt or ""))
        text = strip_tags(strip_shortcodes(body))
        if excerpt and excerpt not in text:
            text = (excerpt + " " + text).strip()
        fallback = pname or ("%s-%s" % (ptype, pid))
        title = clean_title(ptitle, fallback)
        date = norm_date(pdate)
        if not text:
            stat["blog"]["skipped_empty"] += 1
            warn("blog#%s 正文为空，跳过（%s）" % (pid, url))
            continue
        items.append(
            make_item("blog", BLOG_TYPE_MAP[ptype], title, url, truncate(text, TEXT_LIMIT), date)
        )
    return items


def wp_permalink(ptype, slug, pid, parent, page_slugs, domain):
    slug = (slug or "").strip()
    if not slug:
        slug = "?p=%s" % pid
    if ptype == "post":
        return "https://%s/%s/" % (domain, slug)
    # page：按父级拼层级；父页面 slug 取不到时退回根目录
    trail = []
    cur_slug, cur_parent = slug, parent
    guard = 0
    while cur_parent and cur_parent != "0" and cur_parent in page_slugs and guard < 10:
        p_slug, p_parent = page_slugs[cur_parent]
        if not p_slug or p_slug in trail:
            break
        trail.insert(0, p_slug)
        cur_parent = p_parent
        guard += 1
    return "https://%s/%s/" % (domain, "/".join(trail + [slug]))


def collect_mc(stat):
    """mc：VitePress 文档页面 docs/**/*.md。

    站点根 /www/wwwroot/mc，docs 目录 = <root>/docs。
    排除 .vitepress/（配置目录）、public/、node_modules/、scripts/、README。
    """
    site_meta = SITE_MAP["mc"]
    domain = site_meta[2]
    docs_root = os.path.join(site_meta[3], "docs")
    if not os.path.isdir(docs_root):
        warn("mc 文档目录不存在: %s" % docs_root)
        return []

    # 侧边栏里配的文案（config.mts 的 text: 'xxx', link: '/xxx'）
    sidebar = read_sidebar(docs_root)

    files = []
    for dirpath, dirnames, filenames in os.walk(docs_root):
        dirnames[:] = sorted(d for d in dirnames if d not in MC_PRUNE_DIRS and not d.startswith("."))
        for fn in sorted(filenames):
            if not fn.lower().endswith((".md", ".markdown")):
                continue
            if MC_SKIP_NAMES.match(fn):
                continue
            files.append(os.path.join(dirpath, fn))

    items = []
    for path in files:
        rel = os.path.relpath(path, docs_root).replace(os.sep, "/")
        stat["mc"]["rows"] += 1
        try:
            src = read_text(path)
        except OSError as exc:
            warn("读不到 %s: %s" % (path, exc))
            continue
        body = _MD_FRONT.sub("", src, count=1)
        h1 = re.search(r"^\s{0,3}#\s+(.+?)\s*#*\s*$", body, re.M)
        fm = re.search(r"^title\s*:\s*(.+)$", src[:2000], re.M) if src.startswith("---") else None
        is_home = bool(re.search(r"^layout:\s*home\s*$", src[:2000], re.M | re.I))
        route = "/" + re.sub(r"\.(md|markdown)$", "", rel, flags=re.I)
        if route.endswith("/index"):
            route = route[: -len("index")]
        url = "https://%s%s" % (domain, route)
        if is_home:
            # VitePress 首页（layout: home）：body 是空的，内容全在 frontmatter 的
            # hero / features 里 —— 把 frontmatter 当正文，标题取 hero.name。
            text = strip_tags(frontmatter_text(src))
            hero = re.search(r"^\s*name\s*:\s*(.+)$", src[:4000], re.M)
            fallback = clean_title(hero.group(1) if hero else None, title_from_path(path, docs_root))
        else:
            text, _ = strip_markdown(src)
            fallback = title_from_path(path, docs_root)
        title = clean_title(sidebar.get(route.lower()), "")
        if not title:
            title = clean_title(h1.group(1) if h1 else None, "")
        if not title:
            title = clean_title(fm.group(1) if fm else None, fallback)
        if not text:
            stat["mc"]["skipped_empty"] += 1
            warn("mc %s 正文为空，跳过" % rel)
            continue
        items.append(make_item("mc", "doc", title, url, truncate(text, TEXT_LIMIT), page_date(path)))
    return items


_FM_LINE = re.compile(r"^\s*(?:-\s*)?([A-Za-z_][\w-]*)\s*:\s*(.*)$")


def frontmatter_text(src):
    """把 frontmatter 的键值对拼成可检索文本（首页 hero/features 用）。"""
    m = re.match(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", src, re.S)
    if not m:
        return ""
    parts = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        km = _FM_LINE.match(line)
        if km:
            key, value = km.group(1), km.group(2).strip().strip("\"'")
            if value and key.lower() not in ("src", "link", "image", "logo", "pattern"):
                parts.append(value)
        else:
            value = line.lstrip("-").strip().strip("\"'")
            if value and not re.match(r"^[a-z]+:\s*$", value):
                parts.append(value)
    return " ".join(parts)


def read_sidebar(docs_root):
    """从 config.mts / config.ts / config.js 里抠出 link -> 侧边栏文案。"""
    mapping = {}
    cfg_dir = os.path.join(docs_root, ".vitepress")
    for name in ("config.mts", "config.ts", "config.mjs", "config.js"):
        path = os.path.join(cfg_dir, name)
        if not os.path.isfile(path):
            continue
        try:
            src = read_text(path)
        except OSError:
            continue
        for m in re.finditer(r"""text\s*:\s*(['"])(.+?)\1[^{}]*?link\s*:\s*(['"])(/[^'"]*)\3""", src):
            mapping[m.group(4).rstrip("/").lower() or "/"] = m.group(2)
        break
    return mapping


def collect_main(stat):
    """main：pages/*.php 是页面（includes/ components/ config.php README cache 都不收）。

    所有 section 在同一页里服务端渲染 + 锚点切换，所以先抓一次整页，
    再按 <section id="X"> 切块，每块出一条。
    """
    site_meta = SITE_MAP["main"]
    root = site_meta[3]
    pages_dir = os.path.join(root, "pages")
    if not os.path.isdir(pages_dir):
        warn("main pages 目录不存在: %s" % pages_dir)
        return []

    segments = []
    for fn in sorted(os.listdir(pages_dir)):
        if not fn.lower().endswith(".php"):
            continue
        if MAIN_SKIP_FILES.match(fn):
            continue
        page_id = fn[:-4]
        segments.append((page_id, os.path.join(pages_dir, fn)))

    labels = read_tab_labels(root)
    stat["main"]["rows"] = len(segments)
    if not segments:
        return []

    home_url = MAIN_PUBLIC_ORIGIN + "/"
    # 对外 URL 用 www；抓取走 --resolve，用本站的 server_name（两个都 200）
    doc = fetch(home_url, site_meta[4])
    items = []
    if not doc:
        warn("main 抓取失败，整站跳过")
        stat["main"]["skipped_empty"] = len(segments)
        return items

    site_title = clean_title(page_title(doc), "")
    regions = extract_main_region(doc, segments)
    for page_id, path in segments:
        region = regions.get(page_id)
        if not region:
            stat["main"]["skipped_empty"] += 1
            warn("main files/pages/%s.php 在渲染结果里找不到 section#%s，跳过" % (page_id, page_id))
            continue
        text = strip_tags(drop_html_noise(region))
        label = labels.get(page_id)
        fallback = title_from_path(path, pages_dir)
        if label and site_title:
            default_title = "%s - %s" % (label, site_title)
        else:
            default_title = label or fallback
        title = clean_title(label, default_title)
        if text:
            title = default_title
        if not text:
            stat["main"]["skipped_empty"] += 1
            warn("main %s 正文为空，跳过" % page_id)
            continue
        items.append(
            make_item("main", "page", title, home_url + "#" + page_id, truncate(text, TEXT_LIMIT), page_date(path))
        )
    return items


def read_tab_labels(root):
    """导航文案来自 components/tab-bar.php 的 $tabs（只读，不索引它）。"""
    labels = {}
    for rel in ("components/tab-bar.php", "components/sidebar.php", "includes/header.php"):
        path = os.path.join(root, rel)
        if not os.path.isfile(path):
            continue
        try:
            src = read_text(path)
        except OSError:
            continue
        for m in re.finditer(r"""['"]id['"]\s*=>\s*['"]([a-z0-9_-]+)['"]\s*,\s*['"]label['"]\s*=>\s*['"]([^'"]+)['"]""", src):
            labels.setdefault(m.group(1), m.group(2))
        for m in re.finditer(r"""['"]label['"]\s*=>\s*['"]([^'"]+)['"]\s*,\s*['"]id['"]\s*=>\s*['"]([a-z0-9_-]+)['"]""", src):
            labels.setdefault(m.group(2), m.group(1))
        if labels:
            break
    return labels


def collect_oitr(stat):
    """oitr：静态 html 页面；资源文件、脚本、README、测试页、404 都不收。"""
    site_meta = SITE_MAP["oitr"]
    root = site_meta[3]
    domain = site_meta[2]
    items = []
    pages = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(
            d for d in dirnames if d not in OITR_SKIP_DIRS and not d.startswith(".")
        )
        for fn in sorted(filenames):
            if not fn.lower().endswith((".html", ".htm")):
                continue
            if OITR_SKIP_FILES.search(fn):
                continue
            pages.append(os.path.join(dirpath, fn))

    for path in pages:
        stat["oitr"]["rows"] += 1
        try:
            src = read_text(path)
        except OSError as exc:
            warn("读不到 %s: %s" % (path, exc))
            continue
        text = strip_tags(drop_html_noise(src))
        if not text:
            stat["oitr"]["skipped_empty"] += 1
            warn("oitr %s 正文为空，跳过" % path)
            continue
        route = os.path.relpath(path, root).replace(os.sep, "/")
        if route.lower().endswith("index.html") and "/" not in route:
            url = "https://%s/" % domain
        elif route.lower().endswith("index.html"):
            url = "https://%s/%s/" % (domain, route[: -len("index.html")].rstrip("/"))
        else:
            url = "https://%s/%s" % (domain, route)
        title = clean_title(page_title(src), title_from_path(path, root))
        items.append(make_item("oitr", "page", title, url, truncate(text, TEXT_LIMIT), page_date(path)))
    return items


def collect_rdm(stat):
    """rdm：urls.txt 里列的页面；其它（index.php 的重定向逻辑）不是页面。

    urls.txt 目前全部是 .webp 图片，图片不能索引 —— 只有条目本身是可读页面
    （html/htm 或路径末段像文章 slug）时才收，其余按「资源文件」跳过。
    """
    site_meta = SITE_MAP["rdm"]
    root = site_meta[3]
    domain = site_meta[2]
    path = os.path.join(root, "urls.txt")
    if not os.path.isfile(path):
        warn("rdm urls.txt 不存在: %s" % path)
        return []
    items = []
    seen = set()
    for line in read_text(path).splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        stat["rdm"]["rows"] += 1
        normalized = normalize_page_url(raw, domain)
        if not normalized:
            stat["rdm"]["skipped_asset"] += 1
            continue
        if normalized in seen:
            continue
        seen.add(normalized)

        url, host = normalized
        doc = fetch(url, host)
        if not doc:
            stat["rdm"]["skipped_empty"] += 1
            continue
        text = strip_tags(drop_html_noise(doc))
        if not text:
            stat["rdm"]["skipped_empty"] += 1
            continue
        title = clean_title(page_title(doc), title_from_url(url))
        items.append(make_item("rdm", "page", title, url, truncate(text, TEXT_LIMIT), None))
    return items


_ASSET_EXT = re.compile(
    r"\.(?:webp|jpe?g|png|gif|svg|ico|bmp|avif|mp4|webm|mp3|wav|zip|rar|7z|gz|pdf|txt|json|xml|css|js|jsx)$",
    re.I,
)


def normalize_page_url(raw, domain):
    """urls.txt 条目 -> (https 页面 URL, 抓取用的 host)；资源文件返回 None。"""
    url = raw.strip()
    if url.startswith("//"):
        url = "https:" + url
    elif not re.match(r"^https?://", url, re.I):
        url = "https://" + url.lstrip("/")
    m = re.match(r"^https?://([^/?#]+)(/.*)?$", url, re.I)
    if not m:
        return None
    host = m.group(1).split("@")[-1].split(":")[0].lower()
    path = m.group(2) or "/"
    path_only = path.split("?")[0].split("#")[0]
    if _ASSET_EXT.search(path_only):
        return None
    page = "https://%s%s" % (host, path)
    return page, host


def title_from_url(url):
    m = re.match(r"^https?://[^/]+/(.*)$", url)
    tail = (m.group(1) if m else "").strip("/")
    tail = tail.split("?")[0].split("#")[0]
    tail = tail.rsplit("/", 1)[-1] or "index"
    tail = re.sub(r"\.html?$", "", tail, flags=re.I)
    return tail.replace("-", " ").replace("_", " ")


def page_date(path):
    """文件日期 -> YYYY-MM-DD（作为 doc/page 的 date）。"""
    try:
        ts = os.path.getmtime(path)
    except OSError:
        return None
    return datetime.date.fromtimestamp(ts).isoformat()


# ---------------------------------------------------------------------------
# 自检
# ---------------------------------------------------------------------------


def verify(items, known_slugs=None):
    """按契约最后一节自检；返回问题列表（空 = 通过）。"""
    errors = []
    required = ("site", "title", "url", "text")
    valid_types = ("post", "page", "doc")
    for idx, it in enumerate(items):
        tag = "#%d" % idx
        if not isinstance(it, dict):
            errors.append("%s 不是对象" % tag)
            continue
        for key in required:
            if not isinstance(it.get(key), str) or not it.get(key).strip():
                errors.append("%s 缺少/为空字段 %s（site=%s）" % (tag, key, it.get("site")))
        if "type" not in it or it.get("type") not in valid_types:
            errors.append("%s type 非法: %r" % (tag, it.get("type")))
        elif it.get("type") not in ALLOWED_TYPES.get(it.get("site"), valid_types):
            # post 只来自 blog、doc 只来自 mc；main/rdm 是页面但不是 VitePress 文档
            errors.append(
                "%s type 与 site 不符: site=%s type=%s"
                % (tag, it.get("site"), it.get("type"))
            )
        if "date" not in it:
            errors.append("%s 缺少 date 字段" % tag)
        elif it["date"] is not None:
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(it["date"])) or norm_date(it["date"]) is None:
                errors.append("%s date 格式非法: %r" % (tag, it["date"]))
        url = it.get("url") or ""
        if not url.startswith("https://"):
            errors.append("%s url 不是 https: %s" % (tag, url))
            continue
        m = re.match(r"^https://([^/?#:]+)", url)
        if not m:
            errors.append("%s url 解析不出域名: %s" % (tag, url))
            continue
        domain = m.group(1).lower()
        if domain not in ALLOWED_DOMAINS:
            errors.append("%s url 域名不在允许列表: %s" % (tag, domain))
        if it.get("site") not in SITE_MAP:
            errors.append("%s site 非法: %r" % (tag, it.get("site")))
        elif SITE_MAP[it["site"]][2] != domain:
            errors.append("%s url 域名与 site 不符: site=%s domain=%s" % (tag, it["site"], domain))
        if it.get("site") == "blog":
            if it.get("type") not in ("post", "page"):
                errors.append("%s blog 条目 type=%r 不是 post/page" % (tag, it.get("type")))
            if known_slugs is not None and not is_blog_url_whitelisted(url, known_slugs):
                errors.append("%s blog url 对应不到 post/page: %s" % (tag, url))
        text = it.get("text") or ""
        # 契约要求「截断到 1200 字符」：检查的是截断语义，不是硬上限（首个词就可能超长）
        if text and truncate(text, TEXT_LIMIT) != text:
            errors.append("%s text 未截断到 %d 字符 (%d)" % (tag, TEXT_LIMIT, len(text)))
    # 重复 URL
    seen = {}
    for idx, it in enumerate(items):
        url = it.get("url") if isinstance(it, dict) else None
        if url in seen:
            errors.append("url 重复: %s (#%d 与 #%d)" % (url, seen[url], idx))
        else:
            seen[url] = idx
    return errors


def is_blog_url_whitelisted(url, known_slugs):
    stem = re.sub(r"^https://blog\.dreamgary\.cn/", "", url).strip("/")
    if stem.startswith("?p="):
        return True
    return stem in known_slugs


def blog_slug_set():
    """从 DB 取 post/page 的 slug 集合，用于核对 blog 条目来源。"""
    try:
        cfg = parse_wp_config(WP_CONFIG)
        backend = mysql_backend()
        raw = run_query(
            cfg,
            "SELECT post_type, post_name, post_parent, ID FROM wp_posts "
            "WHERE post_type IN ('post','page') AND post_status='publish';",
            backend,
        )
    except Exception as exc:  # noqa: BLE001 - 自检失败不该炸掉整次构建
        warn("拿不到 blog slug 列表，跳过来源核对: %s" % exc)
        return None
    slugs = set()
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[1].strip():
            slugs.add(parts[1].strip())
    slugs.add("?p=")  # 占位，真正的 ?p= 由 is_blog_url_whitelisted 放行
    return slugs


# ---------------------------------------------------------------------------
# 输出
# ---------------------------------------------------------------------------


def overall_date(items):
    dates = [it["date"] for it in items if it.get("date")]
    return max(dates) if dates else None


def print_report(items, per_site, out_path, dry_run, write_error=None):
    order = [s[0] for s in SITES]
    print("")
    print("== 各站收录 ==")
    total = 0
    for site in order:
        st = per_site.get(site, {})
        n = len(items_by_site(items, site))
        total += n
        extra = []
        if st.get("rows") and st["rows"] != n:
            extra.append("候选 %d" % st["rows"])
        if st.get("skipped_empty"):
            extra.append("空正文/取不到 %d" % st["skipped_empty"])
        if st.get("skipped_asset"):
            extra.append("非页面资源 %d" % st["skipped_asset"])
        tail = ("  (%s)" % ", ".join(extra)) if extra else ""
        print("  %-5s %-10s %4d 条%s" % (site, SITE_MAP[site][1], n, tail))
    print("  %-5s %-10s %4d 条" % ("合计", "", total))
    print("")
    print("== 站点根 ==")
    for site in order:
        meta = SITE_MAP[site]
        if site == "blog":
            continue  # DB 站点，不用扫文件
        print("  %-5s %-10s %s" % (site, meta[1], meta[3]))
    print("")
    if not dry_run:
        if write_error:
            print("== 输出 ==\n  写入失败: %s" % write_error)
        elif out_path and os.path.isfile(out_path):
            print(
                "== 输出 ==\n  %s  %d bytes (%.1f KB)"
                % (out_path, os.path.getsize(out_path), os.path.getsize(out_path) / 1024.0)
            )
    else:
        print("== 输出 ==\n  dry-run：未写文件（预计 %s）" % out_path)


def items_by_site(items, site):
    return [it for it in items if it.get("site") == site]


def write_index(out_path, items):
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    payload = {
        "generatedAt": generated_at(),
        "items": items,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    tmp = out_path + ".tmp.%d" % os.getpid()
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(raw)
        fh.write("\n")
    os.replace(tmp, out_path)
    return len(raw.encode("utf-8"))


def generated_at():
    return datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()


# ---------------------------------------------------------------------------
# 离线自测
# ---------------------------------------------------------------------------

SELF_TESTS = [
    (lambda: strip_tags("<p>hello <b>world</b></p><script>alert(1)</script>"), "hello world"),
    (
        lambda: strip_tags('<style>.a{color:red}</style><p>题面 &amp; 解法</p>'),
        "题面 & 解法",
    ),
    (
        lambda: strip_tags('<math><mi>x</mi></math><p>a<b>i</b> 与 a[i]</p>'),
        "x ai 与 a[i]",
    ),
    (lambda: strip_tags("<script>var a = '<p>';</script>after"), "after"),
    (lambda: strip_shortcodes("困死我了{hanser1_peach}"), "困死我了"),
    (lambda: strip_shortcodes("恭喜 {hanser1_亲亲}"), "恭喜"),
    (
        lambda: strip_tags(
            '<math data-latex="f(x)"><semantics><mrow><mi>f</mi><mi>x</mi></mrow>'
            "<annotation encoding=\"application/x-tex\">f(x)</annotation></semantics></math>后文"
        ),
        "fx 后文",
    ),
    (lambda: strip_shortcodes("[gallery ids='1,2']图[/gallery]"), ""),
    (lambda: strip_shortcodes("[caption]x[/caption]"), ""),
    (lambda: strip_shortcodes("[gallery]"), "[gallery]"),  # 裸单标签留着（可能是 md 残渣）
    (lambda: strip_shortcodes("a[i] 和 [vis]"), "a[i] 和 [vis]"),  # 数组下标不动
    (lambda: strip_shortcodes("[caption_x]a[/caption_x]"), ""),  # 带下划线的一定是 shortcode
    (lambda: strip_shortcodes("[embed url=\"x\"]"), ""),  # 带属性的一定是 shortcode
    (lambda: strip_markdown("---\ntitle: 标题\n---\n# 开篇\n\n![图](/a.png)\n\n- 条目 [链接](/x)")[0],
     "开篇 图 条目 链接"),
    (lambda: strip_markdown("```cpp\nint main(){}\n```\n正文")[0], "正文"),
    (lambda: strip_markdown("| a | b |\n|---|---|\n| 1 | 2 |")[0], "a b 1 2"),
    (lambda: norm_date("2026-10-17 21:10:00"), "2026-10-17"),
    (lambda: norm_date("20261017"), "2026-10-17"),
    (lambda: norm_date("0000-00-00 00:00:00"), None),
    (lambda: norm_date(""), None),
    (lambda: clean_title("随手记一道题 - DRheEheAM_Gary", "x"), "随手记一道题"),
    (lambda: clean_title("Home", "fallback"), "fallback"),
    (lambda: clean_title("", "fallback"), "fallback"),
    (lambda: title_from_path("/a/docs/docs/before.md", "/a/docs"), "before"),
    (lambda: title_from_path("/a/mc/docs/index.md", "/a/mc/docs"), "docs"),
    (lambda: normalize_page_url("https://r.dreamgary.cn/images/x (1).webp", "r.dreamgary.cn"), None),
    (lambda: normalize_page_url("rdm.dreamgary.cn/foo?x=1", "rdm.dreamgary.cn"),
     ("https://rdm.dreamgary.cn/foo?x=1", "rdm.dreamgary.cn")),
    (lambda: truncate("a" * 50 + " " + "b" * 60, 60)[-1:], "a"),
    (lambda: len(truncate("x" * 5000, 1200)), 1200),
    (lambda: (lambda md: (strip_markdown(md)[1], strip_markdown(md)[0]))(
        "---\ntitle: 服务器介绍\n---\n# 服务器介绍\n\n正文"
    ), ("服务器介绍", "服务器介绍 正文")),
    (lambda: wp_permalink("post", "abc", "1", "0", {}, "blog.x"), "https://blog.x/abc/"),
    (
        lambda: wp_permalink("page", "child", "2", "1", {"1": ("parent", "0")}, "b.x"),
        "https://b.x/parent/child/",
    ),
    (
        lambda: "多世界服务器" in frontmatter_text(
            "---\nlayout: home\nhero:\n  name: DRheEheAMServer\n  text: 多世界服务器\n---\n"
        ),
        True,
    ),
    (lambda: "src" not in frontmatter_text("---\nhero:\n  image:\n    src: /a.png\n---\n"), True),
    (lambda: verifier_probe(), "ok"),
]


def verifier_probe():
    good = [
        make_item("blog", "post", "t", "https://blog.dreamgary.cn/t/", "x" * 10, "2026-10-17"),
        make_item("main", "page", "t", "https://www.dreamgary.cn/#home", "x", None),
    ]
    if verify(good):
        return "valid items rejected: %r" % (verify(good),)
    bad_cases = [
        make_item("blog", "doc", "t", "https://blog.dreamgary.cn/t/", "x", None),
        make_item("main", "page", "t", "http://www.dreamgary.cn/", "x", None),
        make_item("main", "page", "t", "https://evil.example/x", "x", None),
        make_item("mc", "doc", "", "https://mc.dreamgary.cn/a", "x", None),
        make_item("mc", "doc", "t", "https://mc.dreamgary.cn/a", ("x" * 1199 + " ") * 3, None),
        make_item("mc", "doc", "t", "https://blog.dreamgary.cn/a", "x", None),  # site/域名不符
        # 下面几条绕过 make_item 直接构造，模拟坏字段
        {"site": "mc", "type": "doc", "title": "t", "url": "https://mc.dreamgary.cn/a",
         "text": "x", "date": "2026/10/17"},
        {"site": "mc", "type": "doc", "title": "t", "url": "https://mc.dreamgary.cn/a", "text": "x"},
        {"site": "mc", "type": "post", "title": "t", "url": "https://mc.dreamgary.cn/a",
         "text": "x", "date": None},
        {"site": "blog", "type": "doc", "title": "t", "url": "https://blog.dreamgary.cn/a",
         "text": "x", "date": None},
        {"site": "mc", "title": "t", "url": "https://mc.dreamgary.cn/a", "text": "x", "date": None},
    ]
    for b in bad_cases:
        if not verify([b]):
            return "invalid item accepted: %r" % (b,)
    # 重复 URL 必须报出来
    dup = make_item("mc", "doc", "t", "https://mc.dreamgary.cn/a", "x", None)
    if not verify([dup, dict(dup)]):
        return "duplicate url accepted"
    # blog 来源核对
    if verify(
        [make_item("blog", "post", "t", "https://blog.dreamgary.cn/ok/", "x", None)],
        known_slugs={"ok"},
    ):
        return "valid blog url rejected"
    if not verify(
        [make_item("blog", "post", "t", "https://blog.dreamgary.cn/bad/", "x", None)],
        known_slugs={"ok"},
    ):
        return "blog url outside whitelist accepted"
    return "ok"


def self_test():
    failed = 0
    for idx, (fn, expected) in enumerate(SELF_TESTS):
        try:
            got = fn()
        except Exception as exc:  # noqa: BLE001
            print("FAIL #%d raised %s" % (idx, exc))
            failed += 1
            continue
        if got != expected:
            print("FAIL #%d: got %r, want %r" % (idx, got, expected))
            failed += 1
    if failed:
        print("self-test: %d 项失败" % failed)
        return 1
    print("self-test: 全部通过（%d 项）" % len(SELF_TESTS))
    return 0


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

DEFAULT_COLLECTORS = {
    "blog": collect_blog,
    "main": collect_main,
    "oitr": collect_oitr,
    "mc": collect_mc,
    "rdm": collect_rdm,
}


def main(argv=None):
    ap = argparse.ArgumentParser(description="生成全域搜索索引 search-index.json")
    ap.add_argument("--out", default=DEFAULT_OUT, help="输出路径（默认 %s）" % DEFAULT_OUT)
    ap.add_argument("--dry-run", action="store_true", help="只打印统计，不写文件")
    ap.add_argument("--site", action="append", choices=[s[0] for s in SITES],
                    help="只跑指定站（可重复）")
    ap.add_argument("--no-verify", action="store_true", help="跳过自检")
    ap.add_argument("--self-test", action="store_true", help="离线自测文本清洗逻辑后退出")
    args = ap.parse_args(argv)

    if args.self_test:
        return self_test()

    sites = [s[0] for s in SITES]
    if args.site:
        sites = [s for s in sites if s in args.site]

    per_site = dict((s, {"rows": 0, "skipped_empty": 0, "skipped_asset": 0}) for s in sites)
    items = []
    for site in sites:
        info("采集 %s ..." % site)
        try:
            got = DEFAULT_COLLECTORS[site](per_site)
        except Exception as exc:  # noqa: BLE001 - 单站失败不影响其它站
            import traceback
            warn("%s 采集失败: %s" % (site, exc))
            traceback.print_exc()
            got = []
        info("  %s: %d 条" % (site, len(got)))
        items.extend(got)

    # 排序：站点顺序 -> 日期倒序 -> 标题
    site_order = dict((s[0], i) for i, s in enumerate(SITES))
    items.sort(key=lambda it: (site_order.get(it["site"], 99), neg_date(it.get("date")), it.get("title") or ""))

    known = blog_slug_set() if "blog" in sites else None
    errors = [] if args.no_verify else verify(items, known)
    if errors:
        print("")
        print("== 自检失败（%d 项）==" % len(errors))
        for e in errors[:50]:
            print("  - %s" % e)
        if len(errors) > 50:
            print("  ... 共 %d 项" % len(errors))
        print("")
        print("未写入文件。")
        return 2
    if not args.no_verify:
        print("自检通过：JSON 结构 / 字段 / https+白名单域名 / blog 来源 / text 长度 / url 去重")

    write_error = None
    if not args.dry_run:
        try:
            write_index(args.out, items)
        except OSError as exc:
            write_error = str(exc)
            warn("写入 %s 失败: %s" % (args.out, exc))

    print_report(items, per_site, args.out, args.dry_run, write_error)
    if write_error:
        return 1
    return 0


def neg_date(date):
    return date or "0000-00-00"


if __name__ == "__main__":
    sys.exit(main())
