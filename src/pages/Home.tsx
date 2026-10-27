/* ============================================================================
 *  Shizuku · Main（首页）
 * ----------------------------------------------------------------------------
 *  首屏分两栏：左侧是大字署名与副标题，右侧一张「关于我」玻璃卡片。
 *  卡片带 data-card，跨页过渡时由 App 统一驱动形变。
 *
 *  下方 .card-track / .card-grid 是横向卡片排的骨架，目前为空：
 *  滚轮横向滚动的监听已经挂好，往 grid 里放卡片即可生效 ——
 *    · 鼠标滚轮纵向滚动 → 转成横向位移，到头了把滚动交还给页面
 *    · 触控板横向滑动 → 浏览器原生支持
 * ========================================================================== */

import { useEffect, useRef } from 'react'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import './Home.css'

export function Home() {
  const trackRef = useRef<HTMLDivElement>(null)

  // 滚轮 → 横向滚动。
  // 需要 preventDefault，所以不能用 React 的 onWheel（被动监听，拦不住），
  // 手动挂一个 passive: false 的监听。
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return

      const max = el.scrollWidth - el.clientWidth
      // 滚动到两端就把事件放开，否则页面纵向滚动会被这里吃掉
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
      {/* 分栏：左标题区，右卡片区 */}
      <div className="home-hero">
        <div className="home-title-block">
          {/* --i 是入场动画的序号，.intro 按它逐个错开 */}
          <h1
            className="home-title intro"
            data-text={profile.name}
            style={{ '--i': 0 } as React.CSSProperties}
          >
            {profile.name}
          </h1>
          <p className="home-subtitle intro" style={{ '--i': 1 } as React.CSSProperties}>
            love hanser forever
          </p>
        </div>

        <div className="home-side">
          {/* data-card 供 App 在换页时测量起始形变矩形 */}
          <section
            className="glass home-card intro"
            style={{ '--i': 2 } as React.CSSProperties}
            data-card
          >
            <h2 className="home-card__title">About</h2>
            <p className="home-card__line">{profile.description}</p>
            <p className="home-card__meta">
              {profile.mbti} · {profile.location}
            </p>
            <p className="home-card__quote">{profile.quote}</p>
          </section>
        </div>
      </div>

      {/* 横向卡片排的容器：当前为空，滚动逻辑已就位 */}
      <div className="card-track">
        <div className="card-grid" ref={trackRef} />
      </div>
    </PageShell>
  )
}
