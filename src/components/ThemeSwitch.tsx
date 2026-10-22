/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一枚独立的悬浮玻璃轨道 + 一个会滑动的圆形滑块。
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 *
 *  图标是**静态**的：一条斜线，左上是太阳、右下是月亮。
 *  深浅状态由滑块的位置表达（靠左=浅色，靠右=深色），
 *  图标本身不随主题变化 —— 少一次颜色突变，就少一处可能闪的地方。
 * ========================================================================== */

import { useTheme } from '@/hooks/useTheme'
import './ThemeSwitch.css'

/** 静态图标：斜线分隔，左上太阳、右下月亮 */
function ThemeGlyph() {
  return (
    <svg
      className="theme-switch__glyph"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* 太阳：左上 */}
      <circle cx="7.6" cy="7.6" r="2.6" fill="currentColor" stroke="none" />
      <path d="M7.6 2.4v1.3M7.6 11.5v1.3M2.4 7.6h1.3M11.5 7.6h1.3" />
      {/* 月亮：右下 */}
      <path d="M18.6 14.6a4.4 4.4 0 0 1-5.6-5.6 4.6 4.6 0 1 0 5.6 5.6z" />
      {/* 斜线 */}
      <path d="M4.6 20.4L19.4 4.6" />
    </svg>
  )
}

export function ThemeSwitch() {
  const { mode, toggle } = useTheme()
  const isDark = mode === 'dark'
  const label = isDark ? '切换到浅色' : '切换到深色'

  return (
    <button
      type="button"
      className="theme-switch"
      data-on={isDark ? 'dark' : 'light'}
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={label}
      title={label}
      role="switch"
      aria-checked={isDark}
    >
      <span className="theme-switch__knob">
        <ThemeGlyph />
      </span>
    </button>
  )
}
