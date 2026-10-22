# 雫 · Shizuku

> 一个留白优先的个人主页。磨砂玻璃、Apple 式动效、日式排印气质。

- **Vite 8 + React 19 + TypeScript**
- 无后端、无数据库、无 UI 框架、无路由库，构建产物是纯静态文件
- 全站只依赖 `react` / `react-dom`
- 单页长滚动，一个页面讲完所有事
- 亮 / 暗双主题，跟随系统或手动切换
- 正文不用卡片，层次靠留白、细线、字重

> ⚠️ 当前所有内容都是**占位文本**，用于观察版式。填入真实内容即可。

---

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
│   ├── bg.jpg              # 背景图（横屏）
│   ├── bg-portrait.jpg     # 背景图（竖屏裁切）
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
    ├── components/         # SiteHeader / PageShell / Icon / GithubHeatmap
    ├── pages/              # Home（唯一的页面，所有区块都在里面）
    └── hooks/              # useTheme / useReveal / useScrollCollapse
```

★ 标记的位置是日常改动的入口。

---

## 修改内容

全部内容在 `src/content/` 下的 TypeScript 文件里，有类型约束——写错字段名编辑器会直接报错。

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

背景是四层叠加：

```css
/* base.css */
body::before {
  background:
    var(--bg-focus),                                 /* 文字区的焦点遮罩 */
    var(--bg-scrim),                                 /* 左实右透的方向性遮罩 */
    linear-gradient(var(--bg-mask), var(--bg-mask)), /* 整体压淡 */
    url('/bg.jpg') center / cover no-repeat;
}
```

原图对比度约 σ=79，直接铺在正文下面会让可读性随位置漂移。
遮罩按 `新对比度 = 原对比度 × (1 - α)` 等比压缩。

**换图时建议**：先做 8–10px 高斯模糊再保存为 82 质量 JPEG。
模糊后的图压缩率高得多（实测 883KB → 95KB），而且轻度模糊正是磨砂玻璃需要的前置。

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
