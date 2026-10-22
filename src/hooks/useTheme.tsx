/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  只有浅色 / 深色两态，没有「跟随系统」。
 *  首次访问按系统偏好定一次，之后就是用户自己选的那一态。
 *
 *  主题在 React 挂载前就写入 <html data-theme>，避免首屏亮暗闪烁 ——
 *  脚本内联在 index.html 中。
 *
 *  切换动画：一枚「旧主题的圆形遮罩」从开关位置收缩到无，
 *  露出已经切好的新主题。
 *
 *  为什么不用 View Transitions：滑块要「在揭示过程中滑动」，
 *  但浏览器给具名元素生成的快照组，盒子取的是「旧位置到新位置的并集」，
 *  22px 的快照会被拉伸去填满它（画面上就是滑块旁多出一个放大的圆或方块）。
 *  试过平移快照、关组动画、钉死快照尺寸，都会引入新瑕疵。
 *
 *  改用手搓遮罩后，滑块是普通 DOM + CSS 过渡，滑动全程可见且零瑕疵。
 * ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'shizuku-theme'
const MODES: ThemeMode[] = ['light', 'dark']
/** 动画时长，与 CSS 里的 --dur-reveal 保持一致 */
export const TRANSITION_MS = 500

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 读取初始模式（在任何 React 代码之前调用） */
export function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  // ?theme= 优先级最高：用于预览与分享时强制主题
  const fromQuery = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null
  if (fromQuery && MODES.includes(fromQuery)) return fromQuery

  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  if (stored && MODES.includes(stored)) return stored

  // 首次访问：按系统偏好定一次，此后固定
  return systemPrefersDark() ? 'dark' : 'light'
}

/** 把模式应用到 DOM —— 供内联脚本与 React 共用 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = mode
  root.dataset.themeMode = mode
}

/** 遮罩状态：显示「旧主题」的背景，从圆心收缩到无 */
export interface VeilState {
  x: number
  y: number
  r: number
  /** 遮罩要呈现的主题 —— 也就是切换前的那一态 */
  theme: ThemeMode
}

interface ThemeApi {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** 带遮罩动画的切换。origin 是触发元素，决定遮罩的圆心。 */
  toggle: (origin?: HTMLElement | null) => void
  /** 当前遮罩状态（由 ThemeVeil 渲染） */
  veil: VeilState | null
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)
  const [veil, setVeil] = useState<VeilState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = useCallback(
    (origin?: HTMLElement | null) => {
      const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
      const root = document.documentElement

      // 系统里关掉了动画：直接切
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMode(next)
        return
      }

      // 动画进行中：忽略重复点击
      if (timer.current) return

      // 圆心 = 触发开关中心，半径要能盖住整个视口
      let x = window.innerWidth / 2
      let y = 0
      if (origin) {
        const rect = origin.getBoundingClientRect()
        x = rect.left + rect.width / 2
        y = rect.top + rect.height / 2
      }
      const r = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      // 遮罩先铺满（呈现旧主题），主题立刻切到新的；
      // 再让遮罩收缩到无，露出新主题。
      setVeil({ x, y, r, theme: mode })
      root.classList.add('theme-transition')
      setMode(next)

      timer.current = window.setTimeout(() => {
        setVeil(null)
        root.classList.remove('theme-transition')
        timer.current = undefined
      }, TRANSITION_MS)
    },
    [mode, setMode],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = useMemo<ThemeApi>(
    () => ({ mode, setMode, toggle, veil }),
    [mode, setMode, toggle, veil],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
