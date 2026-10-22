/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一枚胶囊轨道 + 一个会滑动的圆形滑块。
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 * ========================================================================== */

import { Icon } from './Icon'
import { useTheme } from '@/hooks/useTheme'
import './ThemeSwitch.css'

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
        <Icon name={isDark ? 'moon' : 'sun'} size={13} />
      </span>
    </button>
  )
}
