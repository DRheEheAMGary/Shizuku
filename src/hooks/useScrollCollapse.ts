/* ============================================================================
 *  Shizuku · 顶栏滚动收缩
 * ----------------------------------------------------------------------------
 *  滚过阈值后把顶栏收成更小的胶囊：站名字样、假名副标隐去，内边距收紧。
 *
 *  两个细节来自 MC 站的经验：
 *    1. 迟滞 —— 收起与展开用不同阈值，避免在临界点反复抖动
 *    2. 动画锁 —— 一次切换后等动画播完再允许反向，避免中途被拽回导致闪现
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'

interface Options {
  /** 触发阈值（px） */
  threshold?: number
  /** 迟滞区间（px） */
  hysteresis?: number
  /** 动画时长（ms），需与 CSS 的 --dur-base 对齐 */
  lockMs?: number
}

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
      const want = s.collapsed ? y > threshold - hysteresis : y > threshold + hysteresis

      if (want === s.collapsed) return

      const now = performance.now()
      if (now < s.lockedUntil) {
        // 动画还没播完：等它播完再按当时的位置决定
        s.raf = window.setTimeout(update, s.lockedUntil - now + 16)
        return
      }

      s.collapsed = want
      s.lockedUntil = now + lockMs
      setCollapsed(want)
    }

    const onScroll = () => {
      if (s.raf) return
      s.raf = window.requestAnimationFrame(() => {
        s.raf = 0
        update()
      })
    }

    // 首屏就可能已经在滚动位置（刷新 / 前进后退恢复），先对齐一次
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
