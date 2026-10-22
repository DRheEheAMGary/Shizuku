/* ============================================================================
 *  Shizuku · 首页
 * ----------------------------------------------------------------------------
 *  ⚠️ 正文内容已清空，这里是画布。
 *
 *  顶栏、页面外壳、设计系统全部保留 —— 新布局直接在下面搭。
 *  可用的现成积木（都在 styles/content.css 与 styles/glass.css 里）：
 *
 *    .section                    小节
 *      .section-head             小节标题
 *        .section-head__title      主标题
 *        .section-head__kana       假名副标
 *    .rows > .row                分行列表（.row__icon / __body / __title /
 *                                  __sub / __meta / __arrow）
 *    .cols > div > .cols__title  分栏
 *    .facts > div > .fact__label 键值对
 *    .chips > .chip              胶囊标签
 *    .quote                      引用
 *    .prose > p                  段落
 *    <Reveal>                    滚动入场
 *    <Icon name="..." />          内联 SVG 图标
 * ========================================================================== */

import { PageShell } from '@/components/PageShell'

export function Home() {
  return (
    <PageShell marginText="しずく">
      {/* ↓ 新布局从这里开始 ↓ */}
      <section className="section" />
      {/* ↑ 新布局到这里结束 ↑ */}
    </PageShell>
  )
}
