/* ============================================================================
 *  Shizuku · 主题色选择
 * ----------------------------------------------------------------------------
 *  三个圆点，分别对应青蓝 / 暖黄 / 紫罗兰，排成一排共用一块玻璃底座，
 *  挂在顶栏右侧（明暗切换钮的右边）。
 *
 *  样式就一个色点：激活的那个在后面垫一圈大一圈的半透明同色圆，
 *  像是色点沉在了一层柔光里。
 * ========================================================================== */

import type { CSSProperties } from 'react'
import { ACCENTS, useTheme } from '@/hooks/useTheme'
import './AccentPicker.css'

export function AccentPicker() {
  const { accent, setAccent } = useTheme()

  return (
    <div className="accent-picker" role="group" aria-label="主题色">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          className="accent-picker__dot"
          data-on={accent === a.id}
          style={{ '--dot': a.color } as CSSProperties}
          onClick={(e) => setAccent(a.id, e.currentTarget)}
          aria-label={`主题色：${a.label}`}
          aria-pressed={accent === a.id}
          title={a.label}
        >
          <span className="accent-picker__ink" />
        </button>
      ))}
    </div>
  )
}
