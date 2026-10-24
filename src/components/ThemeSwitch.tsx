/* ============================================================================
 *  Shizuku · 主题切换钮
 * ----------------------------------------------------------------------------
 *  总共只有三个选项，没有「触发钮 + 三个选项」的第四份重复内容。
 *  收起时只显示当前激活项；展开时它移动到自己在列表里的位置，
 *  另外两个选项淡入。再点激活项 / 点外面 / Esc 收回去。
 *
 *  展开方式仍学登录坞：整块玻璃从 37px 的圆向下长开，
 *  高度 420ms，圆角固定 28px，激活项随面板一起移动。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { ThemeMode } from '@/hooks/useTheme'
import './ThemeSwitch.css'

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'auto', label: '跟随系统' },
]

/** 主题图标：太阳 / 月牙 / 自动 */
function ThemeGlyph({ size = 20, mode }: { size?: number; mode: ThemeMode }) {
  /*  自动：一半实心的圆（镂空那半是"跟着系统走"的意思） */
  if (mode === 'auto') {
    return (
      <svg
        className="theme-switch__glyph"
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M900.288 512A388.288 388.288 0 1 0 123.648 512a388.288 388.288 0 0 0 776.64 0zM729.6 512a217.6 217.6 0 0 0-179.2-214.208v428.288a217.536 217.536 0 0 0 115.52-60.16A217.6 217.6 0 0 0 729.6 512zm76.8 0A294.4 294.4 0 0 1 512 806.4a38.4 38.4 0 0 1-38.4-38.4V256a38.464 38.464 0 0 1 38.4-38.4A294.4 294.4 0 0 1 806.4 512zm170.688 0A465.088 465.088 0 1 1 46.912 511.936 465.088 465.088 0 0 1 977.088 512z" />
      </svg>
    )
  }

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
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === 'dark' ? (
        /*  月牙：开口朝右上，比原来大一圈；
         *  墨迹重心偏左下，单独向右上补一点做光学居中 */
        <path
          className="theme-switch__moon"
          d="M18.29 14.3A8.6 8.6 0 1 1 9.11 3.45A8 8 0 0 0 18.29 14.3Z"
          transform="translate(1.5 -1)"
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
  const { mode, chooseMode, transitioning } = useTheme()
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

  const select = (next: ThemeMode) => {
    if (!open) {
      setOpen(true)
      return
    }
    chooseMode(next, rootRef.current)
    setOpen(false)
  }

  return (
    <div
      className="theme-switch"
      data-open={open}
      ref={rootRef}
      role="group"
      aria-label="明暗模式"
    >
      <div className="theme-switch__panel">
        {OPTIONS.map((o, index) => {
          const active = mode === o.id
          return (
            <button
              key={o.id}
              type="button"
              className="theme-switch__opt"
              data-on={active}
              data-icon={o.id}
              style={{ '--slot': `${index * 37 - 1}px` } as CSSProperties}
              tabIndex={open || active ? 0 : -1}
              aria-hidden={!open && !active}
              aria-pressed={active}
              aria-expanded={active ? open : undefined}
              aria-haspopup={active ? true : undefined}
              onClick={() => select(o.id)}
              aria-label={o.label}
              title={o.label}
            >
              {/*  view-transition-name 全页只能有一个，只给当前激活项 */}
              <span className={active ? 'theme-switch__knob' : 'theme-switch__icon'}>
                <ThemeGlyph mode={o.id} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}