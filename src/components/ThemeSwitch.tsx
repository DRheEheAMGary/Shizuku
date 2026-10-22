/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一条浅浅的轨道 + 一枚磨砂玻璃滑块（滑块本身就是玻璃，不另垫底座）。
 *
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 *
 *  图标是**静态**的：左上太阳（8 条放射线）、右下月亮。
 *  深浅状态由滑块的位置表达（靠左=浅色，靠右=深色），
 *  图标本身不随主题变化 —— 少一次颜色突变，就少一处可能闪的地方。
 * ========================================================================== */

import { useTheme } from '@/hooks/useTheme'
import './ThemeSwitch.css'

/** 静态图标：左上太阳（8 条放射线）、右下月亮 */
function ThemeGlyph() {
  return (
    <svg
      className="theme-switch__glyph"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* 太阳：左上，8 条放射线 */}
      <circle cx="7.1" cy="7.1" r="1.95" fill="currentColor" stroke="none" />
      <path d="M7.1 4.3V2.9M7.1 9.9v1.4M4.3 7.1H2.9M9.9 7.1h1.4M5.12 5.12L4.13 4.13M9.08 9.08l.99.99M9.08 5.12l.99-.99M5.12 9.08l-.99.99" />
      {/* 月亮：右下 */}
      <path d="M19.5 15.5a3.7 3.7 0 1 1-4 4 3.7 3.7 0 0 0 4-4z" />
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
