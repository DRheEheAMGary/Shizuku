/* ============================================================================
 *  Shizuku · 滚动入场
 * ----------------------------------------------------------------------------
 *  元素首次进入视口时触发一次，随后断开观察者，不做「滚出去再回来重播」。
 *  只动 opacity 与 transform（走合成层），不改布局属性。
 *
 *  由 components/Reveal.tsx 包装使用；当前四个页面都还没有接这个包装器。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'

interface RevealOptions {
  /** 延迟（毫秒），用于相邻元素错开 */
  delay?: number
  /** 触发阈值，0~1，表示元素露出多少比例才算进入 */
  threshold?: number
}

/**
 * 返回 ref、可见标记与一组过渡样式。
 * 不支持 IntersectionObserver、或元素挂载时已经在视口内，都直接置为可见。
 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  delay = 0,
  threshold = 0.15,
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    // 刷新时元素可能本来就在首屏，不必等观察者回调
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true)
      return
    }

    // rootMargin 底部内收 8%：元素真正露出一点再播，避免贴边就触发
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
