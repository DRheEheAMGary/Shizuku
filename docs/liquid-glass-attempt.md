# 液态玻璃折射：实现笔记

移植自 glisse（MIT，<https://github.com/0kzh/glisse>，`src/internal/refraction.ts`），
计算模型出自 <https://kube.io/blog/liquid-glass-css-svg/>。

## 管线

1. **边缘剖面**：按斯涅尔定律（折射率 1.5）对 128 个采样点求位移量，
   曲面用 `surface = (1-(1-t)^4)^0.25` 近似苹果那种方中带圆的倒角。
2. **位移图**：逐像素求圆角矩形的有符号距离（SDF）→ 法线方向 → 位移量，
   写进 R/G 通道（128 为中性），只有离边框 `bezel` 以内才有值，中间完全不动。
   同一趟循环顺带生成高光图（写 alpha），铺在玻璃表面当镜面反光。
3. **SVG 滤镜**：`feImage`(位移图) → `feDisplacementMap` → `feGaussianBlur(0.4)`
   （抹掉位移采样产生的台阶）。
4. **接到 CSS 变量**：把 `url("#id")` 写进 `--lg-filter`，由 CSS 用在 `backdrop-filter` 链上；
   高光图写进 `--lg-rim`，用在 `background-image`。
5. **缓存与失效**：按 `宽-高-圆角-参数` 缓存滤镜，同尺寸共用；
   `ResizeObserver` 防抖 120ms 重算；过渡进行中先摘滤镜，避免贴图尺寸和盒子对不上。

## 踩过的坑（重要）

**滤镜在 `backdrop-filter` 链里的先后顺序决定它有没有用。**

```css
/* ✗ 位移几乎被抹掉：只剩一片均匀的灰 */
backdrop-filter: blur(12px) saturate(1.8) url("#f");

/* ✓ 先掰弯、再模糊 —— 位移完整保留 */
backdrop-filter: url("#f") blur(12px) saturate(1.8);
```

原因：Chromium 给 backdrop 做降采样时按模糊半径决定采样面尺寸，模糊排在前头会把
位移映射压成亚像素级。实测 `blur(4px) + url` 或者 `url + blur(12px)` 都正常，
`blur(12px) + url` 就废了。

另外**材质本身必须够透、模糊够小**，否则折射被盖住：原先顶栏是 84% 白 + `blur(24px)`，
加了滤镜也和没加一样；改成 58% 混色 + `blur(12px)` 之后才看得出来。

## 怎么验证（别再用错方法）

- 对比要**只改一件事**：保持材质不变，只切 `data-liquid` 属性。
- 背景换成高对比条纹最直观：能折射时条纹会被压弯，且 `url` 在前时条纹不会被模糊吃掉。
- **不要**用「改 `feDisplacementMap` 的 scale 再截图」来判断——Chromium 不会因属性变更
  让滤镜失效重绘，前后两张会一模一样，看起来就像"位移无效"（这一步我误判过一次）。
- headless 与 headed 行为一致（Chrome 156 实测），不需要开窗口。

## 现状

- 只挂在顶栏胶囊上（`[data-liquid]`），Chromium 之外不写这个属性，自动退回纯模糊。
- 参数：`--lg-bezel: 12px`、`--lg-thickness: 20px`、`--lg-refraction: 1.4`，
  都在 `SiteHeader.css` 里调。
- 下一步可选：卡片、搜索面板、圆形按钮；注意大元素生成位移图的成本（527×56 约 24ms）。
