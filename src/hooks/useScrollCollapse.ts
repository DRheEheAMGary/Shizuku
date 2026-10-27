/* ============================================================================
 *  Shizuku · 顶栏滚动收缩
 * ----------------------------------------------------------------------------
 *  滚过阈值后把顶栏收成更小的胶囊（收起态下品牌区只留署名）。
 *
 *  两个必要的处理：
 *    1. 迟滞 —— 收起与展开用不同阈值，避免滚动停在临界点时反复抖动
 *    2. 动画锁 —— 一次切换后等过渡播完才允许反向，避免中途被拽回
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'

interface Options {
  /** 触发阈值（px） */
  threshold?: number
  /** 迟滞区间（px）：收起要滚过 threshold + hysteresis，展开要回到 threshold - hysteresis 以内 */
  hysteresis?: number
  /** 动画锁时长（ms），需与 CSS 的顶栏过渡时长对齐 */
  lockMs?: number
}

/** 返回顶栏是否处于收起态 */
export function useScrollCollapse({
  threshold = 32,
  hysteresis = 18,
  lockMs = 360,
}: Options = {}) {
  const [collapsed, setCollapsed] = useState(false)
  const state = useRef({ collapsed: false, lockedUntil: 0, raf: 0 })

  useEffect(() => {
    const s = state.current

    const update = () => {
      const y = window.scrollY
      // 两套阈值：已经收起时要回得更深才展开，已经展开时要滚得更远才收起
      const want = s.collapsed ? y > threshold - hysteresis : y > threshold + hysteresis

      if (want === s.collapsed) return

      const now = performance.now()
      if (now < s.lockedUntil) {
        // 动画还没播完：等它播完再按当时的位置重新判断
        s.raf = window.setTimeout(update, s.lockedUntil - now + 16)
        return
      }

      s.collapsed = want
      s.lockedUntil = now + lockMs
      setCollapsed(want)
    }

    // 滚动事件每个 rAF 只处理一次
    const onScroll = () => {
      if (s.raf) return
      s.raf = window.requestAnimationFrame(() => {
        s.raf = 0
        update()
      })
    }

    // 首屏就可能已经在滚动位置（刷新、前进后退恢复），先对齐一次
    s.collapsed = window.scrollY > threshold
    setCollapsed(s.collapsed)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.clearTimeout(s.raf)
    }
  }, [threshold, hysteresis, lockMs])

  return collapsed
}
