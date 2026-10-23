/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一条浅浅的轨道 + 一枚磨砂玻璃滑块（滑块本身就是玻璃，不另垫底座）。
 *
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 *
 *  图标是**静态**的：外圈细环 + 左侧粗弧 + 右侧实心半圆，
 *  也就是「左半描边、右半实心」—— 深浅各占一边，正是深浅色切换的意思。
 *  深浅状态由滑块的位置表达（靠左=浅色，靠右=深色），
 *  图标本身不随主题变化 —— 少一次颜色突变，就少一处可能闪的地方。
 * ========================================================================== */

import { useTheme } from '@/hooks/useTheme'
import './ThemeSwitch.css'

/** 主题图标：左半描边、右半实心的「半圆」符号 —— 深浅各占一边 */
const THEME_ICON =
  'M900.288 512A388.288 388.288 0 1 0 123.648 512a388.288 388.288 0 0 0 776.64 0zM729.6 512a217.6 217.6 0 0 0-179.2-214.208v428.288a217.536 217.536 0 0 0 115.52-60.16A217.6 217.6 0 0 0 729.6 512z m76.8 0A294.4 294.4 0 0 1 512 806.4a38.4 38.4 0 0 1-38.4-38.4V256a38.464 38.464 0 0 1 38.4-38.4A294.4 294.4 0 0 1 806.4 512z m170.688 0A465.088 465.088 0 1 1 46.912 511.936 465.088 465.088 0 0 1 977.088 512z'

function ThemeGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="theme-switch__glyph"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={THEME_ICON} />
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
