/* ============================================================================
 *  Shizuku · Reveal 入场包装器
 * ----------------------------------------------------------------------------
 *  把 useReveal 的 IntersectionObserver 观察结果套到任意标签上，
 *  用 opacity + translateY 过渡做滚动入场。
 *  当前没有被任何页面引用，作为通用包装器保留。
 * ========================================================================== */

import type { CSSProperties, ReactNode } from 'react'
import { useReveal } from '@/hooks/useReveal'

interface RevealProps {
  children: ReactNode
  /** 入场过渡的延迟（毫秒），用于同组元素错开 */
  delay?: number
  className?: string
  style?: CSSProperties
  as?: 'div' | 'section' | 'li' | 'article' | 'header'
}

/**
 * 滚动进入视口时让 children 淡入上移的包装器。
 * @param delay 入场过渡的延迟（毫秒），用于同组元素错开
 * @param as 渲染标签，默认 div
 * @param className 透传给标签
 * @param style 调用方样式，合并顺序在 revealStyle 之后，可覆盖过渡
 * data-visible 反映当前可见状态，供 CSS 追加样式。
 */
export function Reveal({ children, delay = 0, className, style, as: Tag = 'div' }: RevealProps) {
  const { ref, visible, style: revealStyle } = useReveal<HTMLDivElement>({ delay })

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{ ...revealStyle, ...style }}
      data-visible={visible}
    >
      {children}
    </Tag>
  )
}
