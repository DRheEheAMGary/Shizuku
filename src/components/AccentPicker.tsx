/* ============================================================================
 *  Shizuku · 主题色选择
 * ----------------------------------------------------------------------------
 *  收起时缩成一枚圆形玻璃钮，正中一颗色点＝当前激活色。
 *  点一下向下展开三个色点，选中即应用并收起；再点按钮本身也能收起。
 *
 *  和明暗钮同一套玻璃、同样的展开方式（见 ThemeSwitch.css）。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ACCENTS, useTheme } from '@/hooks/useTheme'
import './AccentPicker.css'

export function AccentPicker() {
  const { accent, setAccent, transitioning } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const active = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]

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

  return (
    <div className="accent-picker" data-open={open} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="accent-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`主题色：${active.label}`}
        title={`主题色：${active.label}`}
      >
        <span
          className="accent-picker__ink"
          style={{ '--dot': active.color } as CSSProperties}
        />
      </button>

      <div className="accent-picker__menu" aria-hidden={!open}>
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="accent-picker__opt"
            data-on={accent === a.id}
            tabIndex={open ? 0 : -1}
            style={{ '--dot': a.color } as CSSProperties}
            onClick={() => {
              setAccent(a.id, triggerRef.current)
              setOpen(false)
            }}
            aria-label={`主题色：${a.label}`}
            aria-pressed={accent === a.id}
            title={a.label}
          >
            <span className="accent-picker__swatch" />
          </button>
        ))}
      </div>
    </div>
  )
}