/* ============================================================================
 *  Shizuku · 主题切换遮罩
 * ----------------------------------------------------------------------------
 *  从切换按钮的位置扩散出去的一枚圆形遮罩，盖住整屏后再换主题。
 *
 *  关键点有两个：
 *
 *  1. 用 clip-path: circle() 而不是 transform: scale()。
 *     scale 会把元素连同里面的背景一起缩放 —— 背景图会被放大变形。
 *     clip-path 只裁剪可见区域，背景保持原尺寸。
 *
 *  2. 遮罩的背景必须和页面背景逐像素一致，否则遮罩盖满的那一刻
 *     会「跳」一下。所以这里的背景堆叠与 base.css 的 body::before 完全相同，
 *     并且遮罩自身带上目标主题的 data-theme，取到那一套颜色变量。
 * ========================================================================== */

import type { CSSProperties } from 'react'
import type { ThemeMode } from '@/hooks/useTheme'
import './ThemeVeil.css'

export interface VeilState {
  /** 圆心 x（视口坐标） */
  x: number
  /** 圆心 y（视口坐标） */
  y: number
  /** 半径（px），取到最远的那个视口角 */
  r: number
  /** 目标主题 */
  target: ThemeMode
}

interface ThemeVeilProps {
  veil: VeilState | null
  /** 动画播完：换主题并摘掉遮罩 */
  onDone: () => void
}

export function ThemeVeil({ veil, onDone }: ThemeVeilProps) {
  if (!veil) return null

  const style = {
    '--veil-x': `${veil.x}px`,
    '--veil-y': `${veil.y}px`,
    '--veil-r': `${veil.r}px`,
  } as CSSProperties

  return (
    <div
      className="theme-veil"
      data-theme={veil.target}
      style={style}
      onAnimationEnd={onDone}
      aria-hidden="true"
    />
  )
}
