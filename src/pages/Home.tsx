/* ============================================================================
 *  Shizuku · 首页
 * ----------------------------------------------------------------------------
 *  组件化 + 卡片化：正文由一块块玻璃卡片组成。
 *
 *  卡片排成**一横排**，可以横向滚动：
 *    - 鼠标滚轮纵向滚动 → 转成横向位移（到头了就把滚动交还给页面）
 *    - 触控板横向滑动 → 浏览器原生支持
 *
 *  宽度仍按原来的 12 栅格比例算：跨 8 列的卡就是宽，跨 4 列的就是窄，
 *  只是把它们从「上下堆叠」换成了「左右排开」。
 * ========================================================================== */

import { useEffect, useRef } from 'react'
import { PageShell } from '@/components/PageShell'
import { GlassCard } from '@/components/GlassCard'

export function Home() {
  const trackRef = useRef<HTMLDivElement>(null)

  // 滚轮 → 横向滚动。
  // React 17 起 onWheel 是被动监听，preventDefault 不生效，
  // 所以这里手动挂一个 passive: false 的监听。
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return

      const max = el.scrollWidth - el.clientWidth
      // 已经到头/到尾就把滚动还给页面，不然页面会被卡住滚不动
      if (e.deltaY < 0 && el.scrollLeft <= 0) return
      if (e.deltaY > 0 && el.scrollLeft >= max - 1) return

      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <PageShell marginText="しずく" wide>
      <div className="card-track">
        <div className="card-grid" ref={trackRef}>
          {/* 第一组：主卡 + 侧卡 */}
          <GlassCard span={8} minH={240} />
          <GlassCard span={4} minH={240} />

          {/* 第二组：三张等宽 */}
          <GlassCard span={4} minH={180} />
          <GlassCard span={4} minH={180} />
          <GlassCard span={4} minH={180} />

          {/* 第三组：一窄一宽 */}
          <GlassCard span={5} minH={200} />
          <GlassCard span={7} minH={200} />

          {/* 第四组：通栏 */}
          <GlassCard span={12} minH={160} />
        </div>
      </div>
    </PageShell>
  )
}
