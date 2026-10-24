/* ============================================================================
 *  Shizuku · 首页
 * ----------------------------------------------------------------------------
 *  组件化 + 卡片化：正文由一块块玻璃卡片组成。
 *
 *  布局：左侧用户名大胶囊，右侧一张「关于我」玻璃卡片。
 *  下面的 .card-grid 骨架留着：横排、滚轮可横向滚动的逻辑都还在，
 *  以后想加横向卡片排时，把卡片放回 grid 里就能直接用。
 *
 *  卡片排成**一横排**，可以横向滚动：
 *    - 鼠标滚轮纵向滚动 → 转成横向位移（到头了就把滚动交还给页面）
 *    - 触控板横向滑动 → 浏览器原生支持
 *
 *  宽度仍按 12 栅格比例算：跨 8 列的卡就是宽，跨 4 列的就是窄，
 *  只是把它们从「上下堆叠」换成了「左右排开」。
 * ========================================================================== */

import { useEffect, useRef } from 'react'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import './Home.css'

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
      {/*  下方 1/3 的渐隐遮罩：给下沉的大名和页脚垫一层底 */}
      <div className="home-scrim" aria-hidden="true" />

      {/*  首屏分栏：左侧用户名大名，右侧一列玻璃卡片 */}
      <div className="home-hero">
        <h1
          className="home-title intro"
          data-text={profile.name}
          style={{ '--i': 0 } as React.CSSProperties}
        >
          {profile.name}
        </h1>

        <div className="home-side">
          <section className="glass home-card intro" style={{ '--i': 1 } as React.CSSProperties}>
            <h2 className="home-card__title">About</h2>
            <p className="home-card__line">{profile.description}</p>
            <p className="home-card__meta">
              {profile.mbti} · {profile.location}
            </p>
            <p className="home-card__quote">{profile.quote}</p>
          </section>
        </div>
      </div>

      {/*  横向卡片排骨架留着：版式定了再往里放卡片 */}
      <div className="card-track">
        <div className="card-grid" ref={trackRef} />
      </div>
    </PageShell>
  )
}
