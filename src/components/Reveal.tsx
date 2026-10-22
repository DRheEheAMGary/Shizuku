/* ============================================================================
 *  Shizuku · Reveal —— 滚动入场包装器
 * ========================================================================== */

import type { CSSProperties, ReactNode } from 'react'
import { useReveal } from '@/hooks/useReveal'

interface RevealProps {
  children: ReactNode
  /** 错开延迟（毫秒） */
  delay?: number
  className?: string
  style?: CSSProperties
  as?: 'div' | 'section' | 'li' | 'article' | 'header'
}

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
