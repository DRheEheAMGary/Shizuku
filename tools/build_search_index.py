#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全域搜索索引器 —— 产出 search-index.json，供前端在浏览器里做全域搜索。

在**服务器上**运行，不在构建期跑：直接读服务器上的站点文件与博客数据库，
对需要服务端渲染的页面用 curl 走本机回环抓取，最后写出静态 JSON。
前端拉 `/search-index.json` 后在浏览器里按子串匹配，所以这套搜索不需要
给静态站加后端接口，也没有查询时的网络往返。

产物

    默认 DEFAULT_OUT = /www/wwwroot/shizuku/search-index.json，即站点根目录下，
    与前端 src/hooks/useSearchIndex.ts 里写死的 /search-index.json 对应。

索引结构（与 src/lib/search.ts 的 SearchIndex / SearchItem 字段一致）::

    {"generatedAt": "2026-10-17T21:10:00+08:00",
     "items": [{"site": "blog", "type": "post", "title": "...",
                "url": "https://blog.dreamgary.cn/slug/", "text": "...",
                "date": "2026-10-17", "author": "...",
                "tags": ["..."], "cats": ["..."]}]}

    site     站点 id，当前只有 "blog" / "mc"（前端 SITE_NAMES 用同一套 id）
    type     post / page / doc，需与 site 匹配（见 ALLOWED_TYPES）
    url      https 绝对地址，域名必须落在 SITES 的域名白名单内
    text     正文纯文本，截断到 TEXT_LIMIT
    date     YYYY-MM-DD 或 null
    author / tags / cats  只有博客文章写，其余条目整个字段省略（省体积）

用法::

    python3 tools/build_search_index.py                  # 写到 /www/wwwroot/shizuku/search-index.json
    python3 tools/build_search_index.py --dry-run        # 只打印统计，不写文件
    python3 tools/build_search_index.py --out /tmp/x.json
    python3 tools/build_search_index.py --site blog --site mc --no-verify
    python3 tools/build_search_index.py --self-test      # 离线自测文本清洗逻辑

只用标准库，Python 3.8+；curl 与 MySQL 客户端（mariadb / mysql）由系统提供。
数据库口令运行时从 wp-config.php 读取，不写死在代码里。

退出码：0 成功；1 写文件失败；2 自检不通过（此时不写文件）。
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

# ---- 常量与白名单 ----

# 写进 JSON 的正文上限；verify() 按同一上限复核截断结果。
TEXT_LIMIT = 1200

# 站点元信息的唯一来源，每条 = (site id, 展示名, 域名, 站点根目录, 抓取用 server_name)。
# 前端 src/lib/search.ts 的 SITE_NAMES 用同一套 site id。
#
# 只有列进 SITES 的站点会被采集：当前是 blog（WordPress）与 mc（VitePress 文档）。
# main / oitr / rdm 的采集函数与相关常量仍然保留，但没有列进这里 ——
# main() 只按 SITES 迭代，--site 的 choices 也取自 SITES，所以它们跑不到。
SITES = [
    ("blog", "博客", "blog.dreamgary.cn", "/www/wwwroot/blog", "blog.dreamgary.cn"),
    ("mc", "MC 文档", "mc.dreamgary.cn", "/www/wwwroot/mc", "mc.dreamgary.cn"),
]
SITE_MAP = dict((s[0], s) for s in SITES)
ALLOWED_DOMAINS = frozenset(s[2] for s in SITES)

# main 站（未接入 SITES）：条目对外 URL 的前缀固定用 www.dreamgary.cn。
# collect_main 抓取时按 server_name 走 --resolve 打到本机，重定向交给 curl -L。
MAIN_PUBLIC_DOMAIN = "www.dreamgary.cn"
MAIN_PUBLIC_ORIGIN = "https://" + MAIN_PUBLIC_DOMAIN

# 默认产物路径，以及 blog 的 wp-config.php（数据库口令运行时从这里读，不写死）。
DEFAULT_OUT = "/www/wwwroot/shizuku/search-index.json"
WP_CONFIG = "/www/wwwroot/blog/wp-config.php"

# blog：只收这两种 post_type；revision / attachment / auto-draft / nav_menu_item /
# micropost 等在 SQL 的白名单里就被排除，不进结果集。
BLOG_POST_TYPES = ("post", "page")
BLOG_TYPE_MAP = {"post": "post", "page": "page"}

# 各站允许的 type，verify() 用它检查 type 与 site 是否匹配：
# post=文章（blog）、page=页面（blog 与单页站）、doc=文档页（mc）。
# 未接入 SITES 的站也保留在这里，接入时不必再改校验逻辑。
ALLOWED_TYPES = {
    "blog": ("post", "page"),
    "main": ("page",),
    "oitr": ("page",),
    "mc": ("doc",),
    "rdm": ("page",),
}

# main：pages/*.php 视为页面；文件名命中这里的跳过
# （README / LICENSE / CHANGELOG / CONTRIBUTING / TODO、config.php、点开头文件）。
MAIN_SKIP_FILES = re.compile(
    r"(^readme|^license|^changelog|^contributing|^todo|^config\.php$|^\.)", re.I
)

# 以下两组是 oitr 的目录与文件过滤规则；collect_oitr 未接入 SITES，当前不会执行。
OITR_SKIP_DIRS = frozenset(
    ["assets", "lib", "node_modules", ".git", ".well-known", "fonts", "images", "img"]
)
OITR_SKIP_FILES = re.compile(
    r"(^404\.|^(?:readme|license|changelog|api_summary|zen)\b|^test-|-test\.html$)", re.I
)

# mc（VitePress）：配置目录、静态资源、依赖、脚本、构建产物、缓存与 README 都不是文档页。
MC_PRUNE_DIRS = frozenset(
    [".vitepress", "public", "node_modules", ".git", "scripts", "dist", "cache"]
)
MC_SKIP_NAMES = re.compile(r"^readme\b", re.I)

# curl 单次抓取的超时秒数，以字符串形式交给 --max-time。
CURL_TIMEOUT = "25"

# ---- 文本清洗 ----

# annotation（MathML 里的 TeX 源码）会和渲染出的公式重复，整段丢弃。
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
    """HTML 片段 -> 纯文本。

    整段丢弃 script / style / svg / iframe / object / embed / template 与
    annotation；未闭合的上述开标签、HTML 注释、CDATA、DOCTYPE 声明一并清掉。
    块级标签换成空格（避免相邻段落粘连），行内标签直接删除（避免把词劈开）。
    最后做实体反转义、NBSP / 全角空格归一、连续空白压缩。

    limit 不为 None 时按 truncate 的规则截断。
    返回清洗后的字符串；空输入返回 ""。
    """
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

    limit 为 None 或长度未超限时原样返回。超限时在 limit 的 70% 之后再找最近的
    空白或中文逗号 / 句号 / 顿号处下刀，避免把 URL、数字、代码切成半截；
    找不到可用的边界就在 limit 处硬截。
    返回截断后的字符串，不追加省略号。
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
    """Markdown -> 纯文本，只求够用（检索与摘要），不做完整解析。

    处理顺序是「先删整段、再拆结构、最后兜底」：frontmatter（从正文里剔除）、
    代码围栏、徽章、引用式链接定义、表格分隔行、独立 HTML 行、分隔线，然后是
    引用 / 标题 / 列表标记、表格竖线、强调符号，残留的内联 HTML 交给 strip_tags。

    返回 (纯文本, frontmatter 里的 title 或 None)。
    """
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


# 数组下标 a[i]、数学区间 x[0,1) 不能当 shortcode。负向后顾在这里表达
# 「前面不是字母/数字/_/$，也不是两个连续右方括号」；反斜杠由 _BACKSLASH
# 拼出来，避免源码里多层转义难读。该断言实际拦的是「某字符 + ]]」这样的
# 三字符结尾，所以 a[i] 仍会进入匹配 —— 靠 repl 里的裸名称规则原样保留。
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
    """去掉 WP shortcode 与主题的 emoji shortcode。

    判定规则（宁可保留，不误删正文）：
    - 名字带下划线 / 连字符，或后面跟 key=value 属性 => 一定是 shortcode，删；
    - 同名开闭标签成对出现 => 是 shortcode，连中间内容一起删（如 [caption] 说明文字）；
    - 孤立的 [/name] => 删；
    - 其余裸单个 [word]（可能是 markdown 残留链接）原样保留。

    {hanser1_peach} 这类 emoji shortcode 无条件删掉。
    返回压缩空白后的字符串。
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
    """标题清洗。

    先去标签与实体；标题里出现 | ｜ · • – — 这类宽分隔符时只留前一段；
    再用 rpartition 最多去掉两段「 - xxx」尾巴（模板常见「标题 - 站点名 - 站点名」）。
    结果为空、命中 _BAD_TITLE（Home / Untitled / 404 / 未命名 等）或短于 2 个字符时
    退回 fallback。返回清洗后的标题或 fallback 本身。
    """
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
    """用相对路径的最后一段当标题。

    去掉扩展名（md / markdown / html / php）后按目录切开；末段是 index 时改用
    所在目录名，根目录的 index 用站点根目录名。下划线、连字符换成空格。
    返回至少为 "index" 的非空字符串。
    """
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
    """各种日期表示 -> "YYYY-MM-DD"，认不出或非法日期返回 None。

    接受 2026-10-17 / 2026/10/17 / 2026.10.17（可带时间部分）与 20261017；
    空值、"null"、"0000-00-00" 这类全零日期都归为 None。
    """
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


# ---- 通用工具 ----


def warn(msg):
    """告警写 stderr；stdout 只留给最终统计报告。"""
    sys.stderr.write("[warn] %s\n" % msg)


def info(msg):
    """进度写 stderr。"""
    sys.stderr.write("[info] %s\n" % msg)


def read_text(path):
    """读文本文件：按 utf-8-sig -> utf-8 -> gb18030 依次尝试。

    全都不行时用 utf-8 + replace 兜底，宁可留替换字符也不中断整次构建。
    返回解码后的字符串；文件不存在或不可读时抛 OSError。
    """
    with open(path, "rb") as fh:
        raw = fh.read()
    for enc in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def make_item(site, itype, title, url, text, date, author=None, tags=None, cats=None):
    """构造一条索引条目（dict）。

    date 一律经 norm_date 归一，非法值写成 null；author / tags / cats 只有博客文章传，
    为空时整个键都不写（mc 文档用不到，也省体积）。
    返回可直接交给 json.dumps 的 dict。
    """
    item = {
        "site": site,
        "type": itype,
        "title": title,
        "url": url,
        "text": text,
        "date": norm_date(date),
    }
    if author:
        item["author"] = author
    if tags:
        item["tags"] = list(tags)
    if cats:
        item["cats"] = list(cats)
    return item


# ---- 抓取工具：PHP 页面走本机 --resolve ----


def fetch(url, host, local="127.0.0.1"):
    """抓一份完整 HTML，失败返回 None。

    --resolve 把 <host>:443 钉到本机回环：不管域名对外解析到哪里，请求都落在
    本机 Nginx 上，同时仍用真实域名做 SNI / Host，能匹配到对应站点，拿到的是
    服务器当前真实渲染结果（而不是 CDN 缓存或外网版本）。
    -k 跳过证书校验，-L 跟随重定向，--max-time 是 curl 侧超时（CURL_TIMEOUT 秒），
    subprocess 再套 120 秒上限兜底。

    超时、curl 非 0 退出、空响应都只 warn 并返回 None，由调用方跳过该条；
    不抛异常，避免单页失败中断整站采集。
    """
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
    """整页 HTML -> 标题文本：优先 <title>，没有就退回第一个 <h1>，都没有返回 None。"""
    m = re.search(r"<title[^>]*>(.*?)</title>", doc, re.I | re.S)
    if m:
        return m.group(1)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.I | re.S)
    return m.group(1) if m else None


def drop_html_noise(doc):
    """从整页 HTML 里摘出正文区域。

    先丢掉 script / style / svg 等整段，再丢 <head>、<nav> / <footer> / <aside>，
    最后丢掉 form 与其控件标签。返回仍是 HTML 片段（标签由调用方交给 strip_tags 清）。
    """
    text = _DROP_BLOCK.sub(" ", doc)
    text = re.sub(r"<head\b[^>]*>.*?</head\s*>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<(nav|footer|aside)\b[^>]*>.*?</\1\s*>", " ", text, flags=re.I | re.S)
    text = _FORM_TAG.sub(" ", text)
    return text


def extract_main_region(doc, segments):
    """按 <section id="..."> 把 main 站单页切成多块。

    segments 是 [(segment_id, 文件路径)]，只用来生成 id 的 OR 正则；
    返回 {segment_id: 该 section 起点到下一个 section 起点的 HTML}。
    渲染结果里没有的 segment 不会出现在返回值里，由调用方记 skipped_empty。
    """
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


# ---- 各站采集 ----
# 采集函数都接收 per_site 里的统计 dict 并就地累加 rows / skipped_empty /
# skipped_asset，返回条目列表；单条失败只 warn + 计数，不抛异常。
# 当前只有 collect_blog 与 collect_mc 会被调用，其余三个保留未接入（见 SITES）。


def parse_wp_config(path):
    """从 wp-config.php 里读 DB_* 常量。

    只取 DB_NAME / DB_USER / DB_PASSWORD / DB_HOST / DB_CHARSET 这几个 define，
    口令不在代码里出现；三者缺任一项、或文件读不到时抛 RuntimeError，
    由 main() 捕获后跳过整站。
    返回 dict（DB_HOST 缺省 127.0.0.1，字符串已按 PHP 转义还原）。
    """
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
    """还原 PHP 字符串里的反斜杠转义（连写反斜杠、\\'、\\"、\\$）。

    没有反斜杠时原样返回。先把连续反斜杠换成占位符再处理其余转义，
    避免 \\\\' 被误判成「已转义的单引号」。
    """
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
    """挑一个可用的 MySQL 客户端命令：优先 mariadb，其次 mysql。

    返回 (kind, cmd)；两个都没有时抛 RuntimeError。
    """
    for kind, cmd in (("mariadb", "mariadb"), ("mysql", "mysql")):
        try:
            subprocess.run([cmd, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return kind, cmd
        except OSError:
            continue
    raise RuntimeError("服务器上没有 mysql / mariadb 客户端")


def run_query(cfg, sql, backend):
    """执行一条 SQL，返回 --batch --raw 的原始 stdout。

    凭据写在临时 .cnf 里用 --defaults-extra-file 传入：口令不进进程参数（ps 可见），
    文件权限 0600、查询结束即删除。连接固定走 TCP 127.0.0.1，避免 socket 路径
    与面板配置不一致时连不上。字符集统一 utf8mb4。
    查询失败抛 RuntimeError（带客户端 stderr）；不重试。
    """
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
# 文本列一律用 HEX() 取原始字节、在 Python 侧解码：正文里可能带换行、制表符
# 或裸 CR，直接取文本会把按行与按 \t 切分的表格结构打乱。
_COLS = (
    "ID, HEX(post_type), HEX(post_status), HEX(post_title), HEX(post_name), "
    "HEX(post_date), HEX(post_excerpt), HEX(post_content), post_parent, post_author"
)
_COL_COUNT = 10


def hex_to_text(value):
    """HEX() 列 -> 文本：NULL / 空串 / 非法十六进制都返回 ""。"""
    if value is None or value == "" or value.upper() == "NULL":
        return ""
    try:
        return bytes.fromhex(value).decode("utf-8", "replace")
    except (ValueError, TypeError):
        return ""


def sql_escape(s):
    """按 MySQL 字符串字面量转义：反斜杠、单引号、换行。

    用于把值拼进 -e 的 SQL（没有参数化通道）；拼完仍需由调用方加引号。
    """
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def collect_blog(stat):
    """blog（WordPress）：直接读 wp_posts 的 post_content 与 post_excerpt。

    SQL 白名单写死：post_type IN ('post','page') AND post_status='publish'，
    revision / attachment / auto-draft / nav_menu_item / micropost 等不进结果集。
    另查两次：wp_users 取作者（user_login 与 display_name 都收，搜哪个都能中）、
    wp_term_relationships 取分类与标签。正文与摘要都过 shortcode 与标签清洗，
    摘要不在正文里时前置拼接，保证摘要里的字同样能被搜到。

    就地累加 stat["blog"] 的 rows / skipped_empty；正文为空的条目只 warn 不产出。
    返回条目列表。数据库连不上、wp-config.php 缺项等异常向上抛，由 main() 跳过整站。
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
        pauthor = r[9].strip()
        parsed.append((pid, ptype, ptitle, pname, pdate, pexcerpt, pcontent, pparent, pauthor))

    # 作者：user_login / display_name 两个都收，搜哪个都能中
    authors = {}
    raw_users = run_query(cfg, "SELECT ID, HEX(user_login), HEX(display_name) FROM wp_users;", backend)
    for line in raw_users.split("\n"):
        if not line.strip():
            continue
        cells = line.split("\t")
        if len(cells) != 3:
            continue
        uid = cells[0].strip()
        login = hex_to_text(cells[1]).strip()
        disp = hex_to_text(cells[2]).strip()
        names = []
        for n in (disp, login):
            if n and n not in names:
                names.append(n)
        authors[uid] = " / ".join(names)

    # 分类与标签：按 post 归堆
    terms = {}
    raw_terms = run_query(
        cfg,
        "SELECT tr.object_id, HEX(tt.taxonomy), HEX(t.name) "
        "FROM wp_term_relationships tr "
        "JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id "
        "JOIN wp_terms t ON t.term_id = tt.term_id "
        "WHERE tt.taxonomy IN ('category','post_tag') ORDER BY tr.object_id;",
        backend,
    )
    for line in raw_terms.split("\n"):
        if not line.strip():
            continue
        cells = line.split("\t")
        if len(cells) != 3:
            continue
        oid = cells[0].strip()
        tax = hex_to_text(cells[1]).strip()
        name = hex_to_text(cells[2]).strip()
        if not name:
            continue
        bucket = terms.setdefault(oid, {"cats": [], "tags": []})
        key = "cats" if tax == "category" else ("tags" if tax == "post_tag" else None)
        if key and name not in bucket[key]:
            bucket[key].append(name)

    # 已知的页面 slug（用于修正页面层级 URL）
    page_slugs = {}
    for pid, ptype, _t, pname, _d, _e, _c, pparent, _a in parsed:
        if ptype == "page":
            page_slugs[pid] = (pname, pparent)

    items = []
    seen = set()
    for pid, ptype, ptitle, pname, pdate, pexcerpt, pcontent, pparent, pauthor in parsed:
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
            # 摘要没出现在正文里（主题手写摘要）时前置拼上，摘要里的字也能被搜到
            text = (excerpt + " " + text).strip()
        fallback = pname or ("%s-%s" % (ptype, pid))
        title = clean_title(ptitle, fallback)
        date = norm_date(pdate)
        if not text:
            stat["blog"]["skipped_empty"] += 1
            warn("blog#%s 正文为空，跳过（%s）" % (pid, url))
            continue
        facets = terms.get(pid, {})
        items.append(
            make_item(
                "blog",
                BLOG_TYPE_MAP[ptype],
                title,
                url,
                truncate(text, TEXT_LIMIT),
                date,
                author=authors.get(pauthor, ""),
                tags=facets.get("tags"),
                cats=facets.get("cats"),
            )
        )
    return items


def wp_permalink(ptype, slug, pid, parent, page_slugs, domain):
    """拼出 blog 条目的对外 URL（固定 https、以 / 结尾）。

    post 直接用 slug；page 沿 post_parent 往上收集父级 slug，拼成层级路径，
    最多回溯 10 层，父级取不到或出现环就停在当前层级。
    slug 为空时退回 ?p=<id> 形式。
    """
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
    """mc（VitePress 文档）：扫 docs/**/*.md，一条文档一条索引。

    站点根取 SITES 里的 /www/wwwroot/mc，文档目录 = <root>/docs；
    跳过 MC_PRUNE_DIRS（.vitepress / public / node_modules / scripts / dist / cache 等）、
    点开头目录与 README。
    URL 由相对路径推出（去掉 index 后缀），date 取文件 mtime。
    标题优先级：侧边栏文案 > 正文第一个 h1 > frontmatter title > 路径末段；
    首页（layout: home）正文通常为空，改用 frontmatter 的 hero / features 当正文。

    就地累加 stat["mc"] 的 rows / skipped_empty；读不到或正文为空的条目只 warn。
    返回条目列表；docs 目录不存在时 warn 并返回空列表。
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
    """把 frontmatter 的键值对拼成一段可检索文本（首页 hero / features 用）。

    只取「值」不看键；src / link / image / logo / pattern 这些资源路径跳过，
    纯 `key:` 空行与注释行也跳过。没有 frontmatter 时返回 ""。
    """
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
    """读 VitePress 侧边栏配置，抠出「路由 -> 显示文案」。

    依次找 .vitepress/config.mts / config.ts / config.mjs / config.js，
    用第一个存在的文件；匹配 text 与 link 相邻出现的条目，
    键是 link 去掉尾斜杠再转小写后的路由。返回 dict，没有配置文件时为空。
    """
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
    """main：pages/*.php 各算一个页块（未接入 SITES，当前不会执行）。

    文件名命中 MAIN_SKIP_FILES（README / config.php / 点开头等）的跳过。
    所有 section 在同一页里服务端渲染 + 锚点切换，所以只抓一次整页，
    再按 <section id="..."> 切块，每块出一条，URL 是首页 + #锚点。
    标题用 components 里 $tabs 的导航文案，退回「文案 - 站点标题」或文件名。

    整页抓取失败时整站跳过；找不到对应 section 或正文为空记 skipped_empty。
    返回条目列表。
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
    """从导航模板里读 section id -> 导航文案（只读，模板本身不索引）。

    依次试 components/tab-bar.php、components/sidebar.php、includes/header.php，
    解析 $tabs 里成对的 id / label（两种书写顺序都认），第一个解析出结果的文件生效。
    返回 dict，取不到时为空。
    """
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
    """oitr：扫静态 html 页面（未接入 SITES，当前不会执行）。

    目录按 OITR_SKIP_DIRS 剪掉（assets / lib / node_modules / fonts / images 等），
    文件名按 OITR_SKIP_FILES 排除（404、README、测试页等）。
    首页 index.html 映射成站点根 URL，其余按相对路径拼；date 取文件 mtime。
    就地累加 stat["oitr"]，正文为空的跳过。返回条目列表。
    """
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
    """rdm：按 urls.txt 逐个抓取页面（未接入 SITES，当前不会执行）。

    urls.txt 一行一个地址，# 开头是注释。条目先归一成 https 页面：
    图片、视频、压缩包、css/js 等资源扩展名直接算「非页面资源」，记 skipped_asset；
    同一 URL 只抓一次。抓取失败或正文为空记 skipped_empty。
    这类条目没有可信日期，date 一律写 null。返回条目列表。
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
    """urls.txt 条目 -> (https 页面 URL, 抓取用的 host)。

    补全协议、去掉 userinfo 与端口得到 host；路径末段命中 _ASSET_EXT
    说明是资源文件，返回 None。domain 参数当前未参与拼接（保留签名）。
    """
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
    """网页 URL -> 标题：取末段，去掉 .html/.htm，下划线与连字符换成空格。"""
    m = re.match(r"^https?://[^/]+/(.*)$", url)
    tail = (m.group(1) if m else "").strip("/")
    tail = tail.split("?")[0].split("#")[0]
    tail = tail.rsplit("/", 1)[-1] or "index"
    tail = re.sub(r"\.html?$", "", tail, flags=re.I)
    return tail.replace("-", " ").replace("_", " ")


def page_date(path):
    """文件 mtime -> "YYYY-MM-DD"，作为无更好来源的 doc / page 的 date；取不到返回 None。"""
    try:
        ts = os.path.getmtime(path)
    except OSError:
        return None
    return datetime.date.fromtimestamp(ts).isoformat()


# ---- 自检 ----


def verify(items, known_slugs=None):
    """按字段契约检查整份索引，返回问题描述列表（空列表 = 通过）。

    检查项：必填字段非空、type 合法且与 site 匹配、date 缺失或为 YYYY-MM-DD、
    url 必须是 https 且域名在白名单内并与 site 对应、text 已截断、
    全局 url 不重复；known_slugs 不为 None 时再加一道 blog 来源核对。
    只读，不改动 items。
    """
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
            # 各站只出自己的 type：post/doc 分别只来自 blog/mc，单页站只出 page
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
        # text 必须已经是 truncate(text, TEXT_LIMIT) 的结果：
        # 检查的是截断语义，不是硬上限（截断点可能落在语义边界，长度不到 limit）
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
    """blog URL 的路径是否对应库里的 post/page。

    去掉域名后按整条路径查 known_slugs；?p=<id> 短链接形式直接放行。
    """
    stem = re.sub(r"^https://blog\.dreamgary\.cn/", "", url).strip("/")
    if stem.startswith("?p="):
        return True
    return stem in known_slugs


def blog_slug_set():
    """从数据库取已发布 post/page 的 slug 集合，供 verify 核对 blog 条目来源。

    取不到（wp-config 缺失、连不上库）时只 warn 并返回 None，
    调用方据此跳过来源核对，避免自检把整次构建打挂。
    """
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


# ---- 输出 ----


def overall_date(items):
    """条目里最新的 date；没有带日期的条目时返回 None。当前构建流程未调用。"""
    dates = [it["date"] for it in items if it.get("date")]
    return max(dates) if dates else None


def print_report(items, per_site, out_path, dry_run, write_error=None):
    """把各站收录数、站点根与输出情况打到 stdout。

    per_site 是采集阶段累计的统计；候选数与实际收录数不同、或有跳过项时括号里给出原因。
    dry_run 时只打印「预计写到哪」；write_error 非空时打印写入失败原因，不报文件大小。
    只写 stdout，不返回值。
    """
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
    """挑出属于某个 site 的条目（只做过滤，不改顺序）。"""
    return [it for it in items if it.get("site") == site]


def write_index(out_path, items):
    """写 JSON 产物，返回写入的字节数（UTF-8）。

    先写同目录下的 .tmp.<pid> 再 os.replace 原子替换，前端不会读到写了一半的文件；
    目录不存在会自动创建。JSON 用紧凑分隔符、不转义中文，减小体积。
    磁盘错误以 OSError 抛出，由调用方决定退出码。
    """
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
    """当前本地时区的 ISO 8601 时间（秒精度），写进 JSON 的 generatedAt。"""
    return datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()


# ---- 离线自测 ----

# 每条 = (无参 lambda, 期望值)。只覆盖纯函数（清洗 / 日期 / 标题 / permalink / 校验器），
# 不联网、不读站点文件，也不写产物，可以直接在任意机器上运行。
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
    """verify() 的正反用例：正常条目必须全部通过，各类坏字段必须被拒。

    返回 "ok"；否则返回第一处不符合预期的说明（供 SELF_TESTS 比对）。
    good 里那条 main 条目要求 main 在 SITES 中才能通过校验：
    main 未接入 SITES 时它会因「域名不在白名单 / site 非法」被判成问题。
    """
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
    """逐条跑 SELF_TESTS，打印失败项与期望值。

    返回退出码：全部通过 0，有失败 1。只读写 stdout，不碰文件与网络。
    """
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


# ---- main ----

# site id -> 采集函数。只有列在 SITES 里的站会被 main() 调用，
# 其余三个保留着，接入站点时直接加进 SITES 即可。
DEFAULT_COLLECTORS = {
    "blog": collect_blog,
    "main": collect_main,
    "oitr": collect_oitr,
    "mc": collect_mc,
    "rdm": collect_rdm,
}


def main(argv=None):
    """入口：采集 -> 排序 -> 自检 -> 写文件 -> 打印报告。

    argv 为 None 时取 sys.argv[1:]（方便测试传入参数列表）。
    --site 可重复，只跑其中列出的站；--dry-run 不写文件；--no-verify 跳过自检；
    --self-test 只跑离线自测后返回。

    单站采集抛异常时只 warn + 打 traceback 并跳过该站，不中断其它站。
    返回退出码：0 成功；1 写文件失败；2 自检不通过（此时不写文件）。
    """
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

    # 排序键：站点在 SITES 里的顺序 -> date 升序（None 用 0000-00-00 占位，排最前）-> 标题升序
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
    """排序用的 date 键：None 用 "0000-00-00" 占位以保证可比较，不做取负。"""
    return date or "0000-00-00"


if __name__ == "__main__":
    sys.exit(main())
