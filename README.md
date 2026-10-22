# 雫 · Shizuku

> 一个留白优先的个人主页。磨砂玻璃材质、Apple 式动效、日式排印气质。

- **Vite 8 + React 19 + TypeScript**
- 无后端、无数据库、无 UI 框架，构建产物是纯静态文件
- 首屏入场动画纯 CSS，全站只依赖 `react` / `react-dom` / `react-router`
- 亮 / 暗双主题，跟随系统或手动切换

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
│   └── bg-portrait.jpg     # 背景图（竖屏裁切）
└── src/
    ├── content/            # ★ 所有文案与数据
    │   ├── site.ts         #   站点信息、导航、个人简介
    │   ├── links.ts        #   站点链接、联系方式
    │   └── interests.ts    #   游戏 / 二次元 / 项目
    ├── styles/
    │   ├── tokens.css      # ★ 设计 token：颜色、间距、圆角、缓动
    │   ├── base.css        # reset、排版基线、背景层
    │   └── glass.css       # 玻璃材质、按钮、胶囊标签
    ├── components/         # SiteHeader / PageShell / Icon / LinkCard / GithubHeatmap
    ├── pages/              # Home / About / Links / Works / Contact
    ├── hooks/              # useTheme / useReveal
    └── lib/                # 预留
```

★ 标记的两个位置是日常改动的入口。

---

## 修改内容

全部内容都在 `src/content/` 下的 TypeScript 文件里，有类型约束——写错字段名编辑器会直接报错。

```ts
// src/content/links.ts —— 加一个链接
export const links: LinkItem[] = [
  { icon: 'blog', name: '博客', url: 'https://blog.dreamgary.cn', desc: 'blog.dreamgary.cn' },
  { icon: 'folder', name: '新站点', url: 'https://example.com', desc: 'example.com' }, // ← 新增
]
```

`icon` 取自 `src/components/Icon.tsx` 里的 `IconName` 联合类型，新增图标时在那里加一条 SVG 路径即可。

改完提交、重新构建、部署。

---

## 修改设计

所有视觉决策集中在 `src/styles/tokens.css`。改一个变量，全站跟着变：

```css
:root {
  --primary: #3f7d8c;        /* 主色：浅葱 */
  --accent: #d99429;         /* 点缀：琥珀 */
  --glass-blur: 24px;        /* 毛玻璃模糊半径 */
  --ease-apple: cubic-bezier(0.32, 0.72, 0, 1);  /* 全局缓动 */
  --lh-base: 1.75;           /* 正文行高，日式排版的呼吸感 */
}
```

暗色主题在 `:root[data-theme='dark']` 里覆盖同名变量。

### 背景图

背景是两层叠加：

```css
/* base.css */
body::before {
  background:
    var(--bg-focus),                              /* 文字区的焦点遮罩 */
    var(--bg-scrim),                              /* 从左到右的方向性遮罩 */
    linear-gradient(var(--bg-mask), var(--bg-mask)), /* 整体压淡 */
    url('/bg.jpg') center / cover no-repeat;
}
```

三层遮罩的意义：原图对比度约 78（σ），直接铺在玻璃卡片下面会让文字可读性随位置漂移。
遮罩按 `新对比度 = 原对比度 × (1 - α)` 等比压缩，加上 `--bg-focus` 在文字列擦出一池干净的白。

**换图时建议**：先用高斯模糊 20px 以上处理，再保存为 80 质量 JPEG。
模糊后的图压缩率高得多（实测 88KB → 49KB），而且模糊正是磨砂玻璃需要的前置。

---

## 设计约定

| 项 | 规则 |
|---|---|
| 缓动 | 统一用 `--ease-apple`，不用 `ease` / `linear` |
| 时长 | 快速 200ms / 标准 350ms / 强调 500ms |
| 可动画属性 | 只动 `transform` 和 `opacity` |
| 按压缩放 | `scale(0.97)`，不改颜色 |
| 滚动 | 原生滚动，不劫持滚轮 |
| 圆角 | 卡片 20px，按钮胶囊 999px |
| 无障碍 | 全站响应 `prefers-reduced-motion` 与 `:focus-visible` |

---

## 技术取舍

**为什么不用 Next/Astro**：站点只有五页静态内容，框架带来的约定成本大于收益。
预渲染的收益（首屏、分享预览）用 `index.html` 里的 OG 标签 + 静态背景层就能覆盖大半。

**为什么不用 Tailwind**：磨砂玻璃是 `backdrop-filter` + 多层背景 + 发丝边 + 极轻阴影的组合，
写成工具类可读性很差，且设计 token 会被稀释成散落的类名。

**为什么不用动画库**：全站动效都是「淡入 + 位移」和「缩放」，CSS 足够；
引入 motion 会让包体从 88KB 涨到 132KB（gzip），不划算。

**字体**：全部使用系统无衬线字体栈（`-apple-system` / `PingFang SC`）。
零加载成本，中英文混排表现最好，也避免了 CJK 字体动辄上百 KB 的问题。

---

## 致谢

旧版基于 React 19 + Vite 的个人主页，以及由它重构出的 PHP 服务端渲染版本。
本项目是第三次重写，视觉与结构均为全新。
