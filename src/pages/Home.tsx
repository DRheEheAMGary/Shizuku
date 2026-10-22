/* ============================================================================
 *  Shizuku · 首页
 * ----------------------------------------------------------------------------
 *  组件化 + 卡片化：正文由一块块玻璃卡片组成，靠 12 栅格排布。
 *
 *  当前是**版式样张**：卡片全空，只看间距、圆角、玻璃质感与栅格节奏。
 *  确认版式后再往里填内容。
 *
 *  栅格规则（见 GlassCard.css）：
 *    桌面 12 列 · 平板 6 列 · 手机 1 列
 *    span 是卡片跨的列数，最宽 12
 * ========================================================================== */

import { PageShell } from '@/components/PageShell'
import { GlassCard } from '@/components/GlassCard'
export function Home() {
  return (
    <PageShell marginText="しずく" wide>
      <div className="card-grid">
        {/* 第一行：主卡 + 侧卡 */}
        <GlassCard span={8} minH={240} />
        <GlassCard span={4} minH={240} />

        {/* 第二行：三张等宽 */}
        <GlassCard span={4} minH={180} />
        <GlassCard span={4} minH={180} />
        <GlassCard span={4} minH={180} />

        {/* 第三行：一窄一宽 */}
        <GlassCard span={5} minH={200} />
        <GlassCard span={7} minH={200} />

        {/* 第四行：通栏 */}
        <GlassCard span={12} minH={160} />
      </div>
    </PageShell>
  )
}
