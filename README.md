# 雫 · Shizuku

> 一个留白优先的个人主页。磨砂玻璃、Apple 式动效、日式排印气质。

- **Vite 8 + React 19 + TypeScript**
- 无后端、无数据库、无 UI 框架、无路由库，构建产物是纯静态文件
- 全站只依赖 `react` / `react-dom`
- 单页长滚动，一个页面讲完所有事

> ⚠️ **正文内容已清空，当前是画布。**
> 顶栏、页面外壳、设计系统（tokens / glass / content）全部保留，
> `src/content/` 里的数据也清空了但类型还在 —— 新布局定下来直接往里填。
- 亮 / 暗双主题，切换时有一枚从按钮扩散出去的圆形遮罩
- 正文不用卡片，层次靠留白、细线、字重

> ⚠️ 当前所有内容都是**占位文本**，用于观察版式。填入真实内容即可。

---

## 登录（SSO）

左上角是一枚**圆形坞**：收起只是圆的头像按钮，点击后从圆形展开成玻璃面板，
面板顶部是「头像 + 主题开关」，下面是内容区（未登录＝登录/注册，
已登录＝账号中心 / 退出登录 / 绑定管理）。

展开动画靠容器自身从 46×46 长到面板尺寸：**圆角先收敛（200ms）、尺寸后长（420ms）**。
两者同长的话，很长一段时间它还是个 46px 高的胶囊，看起来像被拉长的圆球。

**头像图标本身必须一动不动**：头行内边距展开时会从 3px 变成 8/10px，
会把头像推走 (7,5)。面板反向 `translate` 同样多，两者逐帧抵消，
实测展开/收起全程坐标恒定为 `(76, 25.1)`。
内边距的过渡写在基础规则上，只写展开态的话收起时会瞬跳。

主题开关搬进坞里之后，中间那组会变窄、整体右移 37px。
右侧放一块与开关等宽的透明占位（`.site-header__balance`），头像才会停在原位。

坞接的是独立身份提供方 **sso.dreamgary.cn**（标准 OIDC）。
Shizuku 是纯前端 SPA，走 **Authorization Code + PKCE**，不持有 client_secret。

```
点登录 → /authorize（带 code_challenge）
       → SSO 完成登录 → 302 回 /auth/callback?code=&state=
       → 校验 state → POST /token（带 code_verifier）
       → GET /userinfo → 存本地快照 → 清掉 URL 参数
```

| 文件 | 职责 |
|---|---|
| `src/auth/config.ts` | issuer、client_id、回调、端点 —— 换环境只改这里 |
| `src/auth/pkce.ts` | verifier 生成、S256 challenge |
| `src/auth/client.ts` | 发起登录、消费回调、登出 |
| `src/hooks/useAuth.tsx` | 状态与回调消费（**只消费一次**，见下） |
| `src/components/AuthCorner.tsx` | 左上角胶囊与下拉菜单 |

**两个坑**：

1. `redirect_uri` 必须与 SSO 后台登记的完全一致，`localhost` 与 `127.0.0.1`
   是两个不同的 origin —— 开发时要统一用 `localhost`。
2. React `StrictMode` 会把 effect 跑两遍，而 OAuth 回调是一次性的：
   第一次已用掉 code 与 PKCE 中间态，第二次必然报「会话已过期」。
   所以 `useAuth` 用模块级标记保证只消费一次。

登录态只缓存 `sub / name / picture / email` 这类公开字段，**不存任何令牌** ——
access_token 仅在回调内用一次拿 userinfo，随后丢弃。

## 快速开始

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5180
```

```bash
pnpm build      # 产物在 dist/
pnpm preview    # 本地预览构建结果
pnpm typecheck  # 只做类型检查
```

部署：把 `dist/` 交给任意静态托管（Nginx / Vercel / Netlify / GitHub Pages）。
因为是单页应用，需要把未匹配的路径回退到 `index.html`：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 目录结构

```
Shizuku/
├── index.html              # 入口：主题预设脚本 + OG 标签
├── public/
│   ├── bg.webp             # 背景图 6000×3164
│   └── fonts/pacifico.woff2   # 连笔手写体（22KB，自托管）
└── src/
    ├── content/            # ★ 所有文案与数据（当前为占位内容）
    │   ├── site.ts         #   站点信息、导航、个人简介
    │   ├── links.ts        #   站点链接、联系方式
    │   └── interests.ts    #   兴趣 / 游戏 / 项目
    ├── styles/
    │   ├── fonts.css       # Pacifico 声明
    │   ├── tokens.css      # ★ 设计 token：颜色、间距、圆角、缓动
    │   ├── base.css        # reset、排版基线、背景层
    │   ├── content.css     # 正文版式：行列表、文本列、引用
    │   └── glass.css       # 玻璃材质、按钮、胶囊标签
    ├── components/         # SiteHeader / ThemeVeil / PageShell / Icon / GithubHeatmap
    ├── pages/              # Home（唯一的页面，⚠️ 正文已清空，是画布）
    └── hooks/              # useTheme / useReveal / useScrollCollapse
```

★ 标记的位置是日常改动的入口。

---

## 修改内容

全部内容在 `src/content/` 下的 TypeScript 文件里，有类型约束——写错字段名编辑器会直接报错。
现在这几个文件都是空的（只留了类型），新布局定下来往里填即可。

```ts
// src/content/links.ts
export const links: LinkItem[] = [
  { icon: 'blog', name: '示例站点一', url: 'https://example.com', desc: 'example.com' },
]
```

`icon` 取自 `src/components/Icon.tsx` 里的 `IconName` 联合类型。
新增图标时在 `PATHS`（描边）或 `SOLID_PATHS`（实心，用于品牌标志）里加一条 SVG 路径即可。

---

## 修改设计

所有视觉决策集中在 `src/styles/tokens.css`：

```css
:root {
  --primary: #3f7d8c;        /* 主色：浅葱 */
  --accent: #d99429;         /* 点缀：琥珀 */
  --glass-blur: 24px;        /* 毛玻璃模糊半径 */
  --ease-apple: cubic-bezier(0.32, 0.72, 0, 1);
  --lh-base: 1.75;           /* 正文行高，日式排版的呼吸感 */
  --content-max: 46rem;      /* 正文列宽，留白的主要来源 */
}
```

暗色主题在 `:root[data-theme='dark']` 里覆盖同名变量。

### 主题切换

只有浅色 / 深色两态，**没有「跟随系统」**。
首次访问按系统偏好定一次，之后就固定在用户自己选的那一态。

切换时从按钮位置放出一枚圆形遮罩，盖满整屏后换主题：

```css
clip-path: circle(0 at var(--veil-x) var(--veil-y));
animation: theme-veil-in 620ms var(--ease-apple) forwards;
```

两个关键点：

1. **用 `clip-path` 而不是 `transform: scale()`** —— scale 会把元素连同背景一起缩放，
   背景图会被放大变形；clip-path 只裁剪可见区域，背景保持原尺寸。
2. **遮罩的背景必须和页面背景逐像素一致**，否则遮罩盖满的那一刻会「跳」一下。
   所以 `ThemeVeil.css` 的背景堆叠与 `base.css` 的 `body::before` 完全相同，
   且遮罩自身带上目标主题的 `data-theme`，取到那一套颜色变量。

遮罩的 `z-index` 是 40，**压在顶栏（50）之下** —— 顶栏是常驻元素，不该被吞掉。

### 顶栏

结构是**一枚独立悬浮的圆形头像 + 一枚居中胶囊**：

```
(头像) │  DRheEheAM_Gary   Shizuku   │  ☀
        │  个人主页                    │
```

- 头像在胶囊**外面**，是一个单独的圆，带一圈细边和投影
- 胶囊两端是完整半圆（圆角取到高度的一半）
- 署名用**连笔手写体 Pacifico**（旧站首页同款），与站名并排
- `Shizuku` / `个人主页` 两行的相对位置**始终不变**

页面下滚过 32px 后收窄，折起「Shizuku / 个人主页」那块（宽高同时归零），签名保留：

| | 展开 | 收起 |
|---|---|---|
| 胶囊高度 | 56px | 46px |
| 署名 | 显示（154px，主题蓝） | 保留 |
| Shizuku / 个人主页 | 两行 | 整块折起（宽高同时归零） |

折叠用 `grid-template-columns: 1fr → 0fr`（比动画 `width` 稳），假名副标用 `max-height`。

窄屏（< 720px）下署名会隐藏：实测 390px 宽时，署名会把胶囊挤到放不下。

`src/hooks/useScrollCollapse.ts` 里有两个关键处理：

- **迟滞**：收起阈值 32px，展开阈值 14px。单阈值会让滚轮在临界点抖动时反复跨线
- **动画锁**：一次切换后等动画播完才允许反向，避免中途被拽回导致闪现

### 背景图

背景是原图 + 一层 35% 的薄纱（光晕、模糊都去掉了）：

```css
/* base.css */
body::before {
  background:
    linear-gradient(var(--bg-veil), var(--bg-veil)),
    url('/bg.jpg') center / cover no-repeat;
}
```

`--bg-veil` 亮色是 35% 白、暗色是 35% 暗底（`rgba(14,20,24,.35)`）。

原图 8192×4320，压到 **6000×3164 的 WebP（836KB）**。
WebP 在同画质下只有 JPEG 的 40%，6000 宽覆盖了从 1440@2x 到 4K 的所有视口，
浏览器始终在降采样，不会放大。

只有一张图：`cover` 本身就按视口裁切，竖屏不需要单独的版本。

### 暗色模式的玻璃

暗色下玻璃是**深色 tint**（`rgba(10,15,19,.45/.58)`）而不是白色 tint ——
白色 tint 罩不住亮背景，顶栏会变成一条亮带，浅色字直接糊掉（实测 1.16:1）。
现在顶栏文字对比度 4.97:1，正文 9.94:1。

---

## 设计约定

| 项 | 规则 |
|---|---|
| 缓动 | 统一用 `--ease-apple`，不用 `ease` / `linear` |
| 时长 | 快速 200ms / 标准 350ms / 强调 500ms |
| 可动画属性 | 只动 `transform` 和 `opacity`（折叠类除外） |
| 按压缩放 | `scale(0.97)`，不改颜色 |
| 滚动 | 原生滚动，不劫持滚轮 |
| 层次 | 留白 + 1px 细线 + 字重，不用投影堆叠 |
| 圆角 | 胶囊 999px，其余一律小圆角 |
| 无障碍 | 全站响应 `prefers-reduced-motion` 与 `:focus-visible` |

---

## 技术取舍

**为什么不用 Next/Astro**：站点只有一页静态内容，框架的约定成本大于收益。
预渲染的收益（首屏、分享预览）用 `index.html` 里的 OG 标签 + 静态背景层就能覆盖大半。

**为什么不用路由库**：全站是一个长页面，没有分页，也就没有路由。
去掉 react-router 后包体从 89KB 降到 75KB（gzip）。

**为什么不用 Tailwind**：磨砂玻璃是 `backdrop-filter` + 多层背景 + 发丝边的组合，
写成工具类可读性很差，且设计 token 会被稀释成散落的类名。

**为什么不用动画库**：全站动效都是「淡入 + 位移」「缩放」「折叠」，CSS 足够。
引入 motion 会让包体从 88KB 涨到 132KB（gzip），不划算。

**为什么正文不用 Web 字体**：正文全部使用系统字体栈（`-apple-system` / `PingFang SC`）。
零加载成本，中英文混排表现最好，也避免 CJK 字体动辄上百 KB 的问题。
和风不靠明朝体承载，靠假名、竖排、宽字距与留白。

**顶栏的连笔手写体例外**：署名用 Pacifico（旧站首页也用它做标题）。
不自托管前先确认过：`fonts.gstatic.com` 的 latin 子集只有 22KB，
直接放进 `public/` 比引 Google Fonts CDN 更可靠——国内访问 `fonts.googleapis.com` 不稳定。

**为什么正文不用卡片**：卡片容易变成「什么内容都装一个盒子」的偷懒版式。
这里只在顶栏保留玻璃，正文用细线分行的方式排列，视觉更安静。

---

## 致谢

旧版基于 React 19 + Vite 的个人主页，以及由它重构出的 PHP 服务端渲染版本。
本项目是第三次重写，视觉与结构均为全新。

---

## 可用的积木

新布局直接在 `src/pages/Home.tsx` 里搭。这些积木都已经在设计系统里了：

| 类名 / 组件 | 用途 |
|---|---|
| `.section` + `.section-head` | 小节与标题（`__title` 主标、`__kana` 假名副标） |
| `.rows` > `.row` | 分行列表（`__icon` `__body` `__title` `__sub` `__meta` `__arrow`） |
| `.cols` + `.cols__title` | 分栏 |
| `.facts` + `.fact__label` / `.fact__value` | 键值对 |
| `.chips` + `.chip` | 胶囊标签（`chip--accent` 是琥珀色变体） |
| `.quote` | 引用（左侧一道主色竖线） |
| `.prose` > `p` | 段落（行高 1.75） |
| `.btn` / `.btn--primary` | 按钮（胶囊形） |
| `<Reveal>` | 滚动入场（`delay` 毫秒可错开） |
| `<Icon name="..." />` | 内联 SVG 图标，见 `components/Icon.tsx` 的 `IconName` |
| `<GithubHeatmap />` | GitHub 贡献热力图（自带降级） |

设计 token 全在 `src/styles/tokens.css`：颜色、间距、圆角、缓动、玻璃参数。
改一个变量全站跟着变。
