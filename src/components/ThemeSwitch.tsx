/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一枚独立的悬浮玻璃轨道 + 一个会滑动的圆形滑块，
 *  轨道下方再垫一条同样宽度的玻璃底座 —— 与左侧头像的「玻璃托底」呼应。
 *  两者叠起来的高度正好等于头像的直径，整条顶栏左右等高。
 *
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 *
 *  图标是**静态**的：左上太阳、右下月亮。
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
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* 太阳：左上，8 条放射线 */}
      <circle cx="7" cy="7" r="2.3" fill="currentColor" stroke="none" />
      <path d="M7 3.6V2M7 11v1.6M3.6 7H2M11 7h1.6M4.48 4.48L3.3 3.3M9.52 9.52l1.18 1.18M9.52 4.48l1.18-1.18M4.48 9.52l-1.18 1.18" />
      {/* 月亮：右下 */}
      <path d="M19.4 14.4a4.3 4.3 0 1 1-5.6 5.6 4.3 4.3 0 0 0 5.6-5.6z" />
    </svg>
  )
}

export function ThemeSwitch() {
  const { mode, toggle } = useTheme()
  const isDark = mode === 'dark'
  const label = isDark ? '切换到浅色' : '切换到深色'

  return (
    <span className="theme-switch-wrap">
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

      {/* 与轨道等宽的玻璃底座 */}
      <span className="theme-switch__base" aria-hidden="true" />
    </span>
  )
}
