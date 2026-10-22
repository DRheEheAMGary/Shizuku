/* ============================================================================
 *  Shizuku · 主题切换遮罩
 * ----------------------------------------------------------------------------
 *  切换瞬间铺满一层「旧主题背景」的圆，再从开关位置收缩到无，
 *  露出已经切好的新主题。
 *
 *  为什么是「收缩旧主题」而不是「扩散新主题」：
 *  扩散的话遮罩必须盖在顶栏之上，顶栏会被吞掉、它下面的滑块也看不到；
 *  收缩的话遮罩压在顶栏之下（z-index 40 < 50），顶栏全程可见，
 *  颜色靠 CSS 过渡平滑变化，滑块也能实时拨动。
 *
 *  背景堆叠与 base.css 的 body::before 完全相同，
 *  再用 background-attachment: fixed 让它对齐视口，
 *  遮罩收缩时露出的边缘才不会错位。
 * ========================================================================== */

import type { CSSProperties } from 'react'
import { useTheme } from '@/hooks/useTheme'

export function ThemeVeil() {
  const { veil } = useTheme()
  if (!veil) return null

  const style = {
    '--veil-x': `${veil.x}px`,
    '--veil-y': `${veil.y}px`,
    '--veil-r': `${veil.r}px`,
  } as CSSProperties

  return <div className="theme-veil" data-theme={veil.theme} style={style} aria-hidden="true" />
}
