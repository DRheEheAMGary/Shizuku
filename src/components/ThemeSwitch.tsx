/* ============================================================================
 *  Shizuku · 主题拨动开关
 * ----------------------------------------------------------------------------
 *  一条浅浅的轨道 + 一枚磨砂玻璃滑块（滑块本身就是玻璃，不另垫底座）。
 *
 *  滑块有独立的 view-transition-name，所以在圆形揭示的动画里
 *  它不进快照、被抬到揭示层之上，全程可见并同步拨动。
 *
 *  图标是**太阳 ⇄ 月牙**，都是描边的空心图形，颜色跟着文字走。
 *  两者是**同一条路径**：一个整圆，右半边的圆弧半径变大、凹进去一块，
 *  就成了月牙 —— 中间没有换图，是真的形变。
 *  太阳的八条短线在变成月牙时收起来。
 *
 *  形变时机会卡在滑块动画之后：
 *  揭示期间整个根节点是一张静态快照，真实 DOM 根本不画 ——
 *  这时候改图标是看不见的，只会在揭示结束的瞬间「啪」一下跳过去。
 *  所以图标等 revealing 变回 false（揭示结束）再切，
 *  形变动画才演得出来。
 * ========================================================================== */

import { useTheme } from '@/hooks/useTheme'
import './ThemeSwitch.css'

/** 主题图标：太阳 ⇄ 月牙 */
function ThemeGlyph({
  size = 20,
  mode,
}: {
  size?: number
  mode: 'light' | 'dark'
}) {
  return (
    <svg
      className="theme-switch__glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/*  直接换，不做形变动画 —— 换的时候是硬切，干净利落 */}
      {mode === 'dark' ? (
        /* 月牙：一弯真的凹进去的月牙 */
        <path
          className="theme-switch__moon"
          d="M16 7.2A9 9 0 0 0 16 16.8A4.8 4.8 0 0 1 16 7.2Z"
        />
      ) : (
        /* 太阳：空心圆 + 八条短线 */
        <g className="theme-switch__sun">
          <circle cx="12" cy="12" r="4.8" />
          <g className="theme-switch__rays">
            <path d="M12 4.3V2.3M12 19.7v2M4.3 12H2.3M19.7 12h2M6.8 6.8 5.1 5.1M17.2 17.2l1.7 1.7M17.2 6.8l1.7-1.7M6.8 17.2l-1.7 1.7" />
          </g>
        </g>
      )}
    </svg>
  )
}

export function ThemeSwitch() {
  const { mode, toggle } = useTheme()
  const isDark = mode === 'dark'
  const label = isDark ? '切换到浅色' : '切换到深色'

  /*  图标直接跟着主题走。
   *
   *  滑块有独立的 view-transition-name，揭示动画期间它被抬到揭示层
   *  之上单独拍 —— 所以图标这一换，是跟整个揭示同步交叉淡入的，
   *  不会出现「点完半秒后图标才自己动一下」的卡顿。 */

  return (
    <button
      type="button"
      className="theme-switch"
      data-on={isDark ? 'dark' : 'light'}
      data-icon={mode}
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={label}
      title={label}
      role="switch"
      aria-checked={isDark}
    >
      <span className="theme-switch__knob">
        <ThemeGlyph mode={mode} />
      </span>
    </button>
  )
}
