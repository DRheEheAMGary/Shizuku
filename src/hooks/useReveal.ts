/* ============================================================================
 *  Shizuku · 入场动画
 * ----------------------------------------------------------------------------
 *  原生 IntersectionObserver，不依赖任何动画库。
 *  只动 opacity 与 transform —— 保证合成层性能与 prefers-reduced-motion 友好。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'

interface RevealOptions {
  /** 延迟（毫秒），用于相邻元素错开 */
  delay?: number
  /** 触发阈值 */
  threshold?: number
}

export function useReveal<T extends HTMLElement = HTMLElement>({
  delay = 0,
  threshold = 0.15,
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // 不支持 IntersectionObserver 时直接显示
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    // 已经进入视口（刷新时位置靠上）则立刻显示
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return {
    ref,
    visible,
    style: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: `opacity var(--dur-slow) var(--ease-apple) ${delay}ms, transform var(--dur-slow) var(--ease-apple) ${delay}ms`,
    },
  }
}
