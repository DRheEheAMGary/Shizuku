/* ============================================================================
 *  Shizuku · 主题色选择
 * ----------------------------------------------------------------------------
 *  总共只有三个色点。收起时只显示当前激活色；展开时它移动到自己的位置，
 *  另外两个色点淡入。再点激活项 / 点外面 / Esc 收回去。
 *
 *  激活态沿用以前的样式：小色点 + 后面一圈大一些的同色柔光；
 *  非激活态只留小色点。展开方式与明暗钮一致。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ACCENTS, useTheme } from '@/hooks/useTheme'
import type { AccentId } from '@/hooks/useTheme'
import './AccentPicker.css'

export function AccentPicker() {
  const { accent, setAccent, transitioning } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点外面 / Esc 收起
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      /*  揭示动画期间命中测试不落在真实 DOM 上（事件目标是 <html>），
       *  这里会误判成「点了外面」，动画期间直接忽略。 */
      if (transitioning) return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, transitioning])

  const select = (next: AccentId) => {
    if (!open) {
      setOpen(true)
      return
    }
    setAccent(next, rootRef.current)
    setOpen(false)
  }

  return (
    <div
      className="accent-picker"
      data-open={open}
      ref={rootRef}
      role="group"
      aria-label="主题色"
    >
      <div className="accent-picker__panel">
        {ACCENTS.map((a, index) => {
          const active = accent === a.id
          return (
            <button
              key={a.id}
              type="button"
              className="accent-picker__opt"
              data-on={active}
              style={{ '--dot': a.color, '--slot': `${index * 37 - 1}px` } as CSSProperties}
              tabIndex={open || active ? 0 : -1}
              aria-hidden={!open && !active}
              aria-pressed={active}
              aria-expanded={active ? open : undefined}
              aria-haspopup={active ? true : undefined}
              onClick={() => select(a.id)}
              aria-label={`主题色：${a.label}`}
              title={a.label}
            >
              <span className="accent-picker__swatch" />
            </button>
          )
        })}
      </div>
    </div>
  )
}