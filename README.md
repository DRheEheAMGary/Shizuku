# 雫 · Shizuku

DRheEheAM_Gary 的个人主页：磨砂玻璃材质、Apple 式过渡动效、日式排印的留白。

- 站点域名：<https://dreamgary.cn>
- 预览站：<https://shizuku.dreamgary.cn>

## 关于本站

纯静态单页应用，四个页面靠前端路径切换（点击不刷新，地址栏同步）：

| 路径 | 页面 | 内容 |
| --- | --- | --- |
| `/` | Main | 署名、简介、一句话签名 |
| `/about` | About | 在玩的游戏、游戏账号、站外链接 |
| `/github` | Github | GitHub 主页入口、贡献热力图、仓库卡片 |
| `/contact` | Contact | QQ、哔哩哔哩、邮箱（支持一键复制） |

主要功能：

- **明暗主题 + 三套主题色**：浅色 / 深色 / 跟随系统；青蓝、暖黄、紫罗兰三套配色各自成套（含对应背景插画）。切换时用 View Transitions 从触发按钮处圆形扩散揭示。
- **全域搜索**：⌘K / Ctrl+K 唤起，跨博客与 MC 文档检索静态索引；顶栏胶囊就地撑开成搜索框。
- **登录坞**：左上角圆形坞，接入独立 SSO（OIDC）。登录后展示头像、时钟问候、GitHub 贡献热力图与所在地天气。
- **跨页过渡**：卡片合并 / 分裂 / 缩放的过渡动画，全部基于 `transform`，不打断磨砂玻璃。
- **无障碍**：全站响应 `prefers-reduced-motion`，交互控件带 `:focus-visible` 与 ARIA 标注。

页面文案与个人数据集中在 [`src/content/site.ts`](src/content/site.ts)，改这一个文件即可更新全站内容。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建 | Vite 8（`target: es2022`） |
| 框架 | React 19 + TypeScript 5.9 |
| 样式 | 手写 CSS + 设计 token（[`src/styles/tokens.css`](src/styles/tokens.css)），无 CSS 框架 |
| 路由 | 自研：`history.pushState` + `popstate`，无路由库 |
| 数据 | 无后端、无数据库，构建产物为纯静态文件 |
| 运行时依赖 | 仅 `react`、`react-dom` |

站点能力全部来自浏览器原生 API 与自有服务：View Transitions 负责主题揭示，IntersectionObserver 负责入场，Web Crypto 负责 PKCE，`navigator.clipboard` 负责复制，天气取 Open-Meteo，身份、贡献热力图与逆地理编码由 SSO 侧代理。

## 目录结构

```
Shizuku/
├── index.html                  # 入口：首屏主题引导脚本、分享预览元信息
├── public/                     # 三套背景插画与自托管字体
├── src/
│   ├── App.tsx                 # 路由与跨页过渡的调度中心
│   ├── pages/                  # Main / About / Github / Contact
│   ├── components/             # 顶栏、登录坞、玻璃卡片、搜索、热力图等
│   ├── hooks/                  # 主题、登录、滚动收缩、搜索索引、天气
│   ├── auth/                   # OIDC 客户端与 PKCE
│   ├── lib/                    # 搜索算法、平台判断、图片预加载
│   ├── content/                # 站点文案与个人数据
│   └── styles/                 # token、基础样式、玻璃材质、字体
└── tools/
    └── build_search_index.py   # 服务器端搜索索引器（Python，仅标准库）
```

## 本地开发

需要 Node.js `^20.19.0 || >=22.12.0` 与 pnpm。

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5180
```

```bash
pnpm build      # 类型检查 + 构建，产物在 dist/
pnpm preview    # 预览构建结果
pnpm typecheck  # 只做类型检查
```

开发服务器固定监听 `127.0.0.1:5180`。访问时可带 `?theme=dark|light|auto`、`?accent=blue|yellow|purple` 强制预览某一套皮肤。

## 部署

### 1. 发布静态文件

```bash
pnpm install
pnpm build
```

把 `dist/` 的内容上传到站点根目录（例如 `/www/wwwroot/shizuku`），交给 Nginx / Apache 等任意静态服务器。

页面路径由前端接管，服务器需要把未匹配的路径回退到 `index.html`：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

站点根目录下需一并保留 `dist/` 里的静态资源：`fonts/`、`bg*.webp`，以及可选的 `search-index.json`。

### 2. 搜索索引（可选）

全域搜索读取站点根目录下的 `search-index.json`，该文件由 [`tools/build_search_index.py`](tools/build_search_index.py) 在服务器上生成（需能读取博客数据库与 MC 文档目录）：

```bash
# 在服务器上重建索引，默认输出 /www/wwwroot/shizuku/search-index.json
python3 tools/build_search_index.py

python3 tools/build_search_index.py --dry-run    # 只打印统计，不写文件
python3 tools/build_search_index.py --self-test  # 离线自测文本清洗
```

索引尚未生成时站点仍可正常运行，搜索面板会提示索引未就绪。可配一条计划任务定期重建。

### 3. 登录接入（可选）

登录坞使用独立身份提供方 `sso.dreamgary.cn`，走 Authorization Code + PKCE，前端不持有 `client_secret`。issuer、`client_id` 与各端点都在 [`src/auth/config.ts`](src/auth/config.ts)。

部署到新域名时，需要在 SSO 后台登记该客户端，并把回调地址 `https://<域名>/auth/callback` 加入白名单（协议、域名、端口必须完全一致）。未接入 SSO 时站点其余部分不受影响，登录坞只显示登录按钮。

## 版权声明

- **代码**：© 2026 DRheEheAM_Gary，保留所有权利。仓库未附开源许可协议，未经书面许可请勿复制、商用或再分发。
- **文案与个人信息**：同属作者所有。
- **背景插画**：版权归原画师所有 —— 青蓝配色为 **花久花酒**，暖黄与紫罗兰配色为 **DAME_ovo_**；仅授权本站展示，请勿转载或另作他用。页面左下角的画师署名请勿移除。
- **字体**：[Edu QLD Hand](https://fonts.google.com/specimen/Edu+QLD+Hand)、[Pacifico](https://fonts.google.com/specimen/Pacifico)、Florida Vibes 均来自 Google Fonts，以 SIL Open Font License 1.1 授权，已子集化后自托管。
