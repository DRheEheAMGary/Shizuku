/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  两件独立的事：
 *    1. 浅色 / 深色（只有两态，没有「跟随系统」）
 *    2. 主题色：青蓝（默认）/ 暖黄 / 紫罗兰
 *
 *  两者在首屏渲染之前就写进 <html>，避免闪烁 ——
 *  脚本内联在 index.html 中。
 *
 *  切换都用 View Transitions API 做圆形揭示：从触发点扩散开新主题的圆形裁切，
 *  旧快照垫在下面不动。拨动滑块有自己的快照组，全程可见。
 * ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemeMode = 'light' | 'dark'
export type AccentId = 'blue' | 'yellow' | 'purple'

/** 三套主题色：主色、点缀色、背景图各自成套 */
export const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'blue', label: '青蓝', color: '#3f9fb5' },
  { id: 'yellow', label: '暖黄', color: '#e3a83a' },
  { id: 'purple', label: '紫罗兰', color: '#9d76d8' },
]

const STORAGE_KEY = 'shizuku-theme'
const ACCENT_KEY = 'shizuku-accent'
const MODES: ThemeMode[] = ['light', 'dark']
const ACCENT_IDS: AccentId[] = ['blue', 'yellow', 'purple']
/** 兜底颜色渐变的时长，和 CSS 里的 transition 对齐 */
const FALLBACK_MS = 500

interface ViewTransition {
  finished?: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransition
}

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

/** 读取初始主题色 */
export function getStoredAccent(): AccentId {
  if (typeof window === 'undefined') return 'blue'

  const fromQuery = new URLSearchParams(window.location.search).get('accent') as AccentId | null
  if (fromQuery && ACCENT_IDS.includes(fromQuery)) return fromQuery

  const stored = window.localStorage.getItem(ACCENT_KEY) as AccentId | null
  if (stored && ACCENT_IDS.includes(stored)) return stored

  return 'blue'
}

/** 把模式应用到 DOM —— 供内联脚本与 React 共用 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = mode
  root.dataset.themeMode = mode
}

/** 把主题色应用到 DOM */
export function applyAccent(accent: AccentId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.accent = accent
}

function clearTransitionVars() {
  const root = document.documentElement
  root.style.removeProperty('--vt-x')
  root.style.removeProperty('--vt-y')
  root.style.removeProperty('--vt-r')
  root.style.removeProperty('--knob-dir')
}

/**
 * 圆形揭示切换。
 *
 * 浏览器在切换时拍下「旧状态」和「新状态」两张快照，
 * 旧快照垫在下面不动，新快照用圆形裁切从 origin 扩散开。
 *
 * onStart / onEnd 用来在动画期间锁住交互 ——
 * 快照层不吃点击（::view-transition 是 pointer-events:none），
 * 事件会直接穿透到真实 DOM，不锁的话动画期间点到什么都会有反应。
 */
function reveal(
  origin: HTMLElement | null | undefined,
  apply: () => void,
  knobDir?: 1 | -1,
  onStart?: () => void,
  onEnd?: () => void,
) {
  const doc = document as ViewTransitionDocument
  const root = document.documentElement

  // 系统里关掉了动画：不介入
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply()
    onEnd?.()
    return
  }

  // 不支持 View Transitions：退化成颜色渐变
  if (typeof doc.startViewTransition !== 'function') {
    root.classList.add('theme-transition')
    apply()
    window.setTimeout(() => {
      root.classList.remove('theme-transition')
      onEnd?.()
    }, FALLBACK_MS)
    return
  }

  // 圆心 = 触发点中心，半径要能盖住整个视口
  if (origin) {
    const rect = origin.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    root.style.setProperty('--vt-x', `${x}px`)
    root.style.setProperty('--vt-y', `${y}px`)
    root.style.setProperty('--vt-r', `${radius}px`)
  }

  // 滑块拨动的方向：浅→深往右，深→浅往左。
  // 新旧两张快照都按这个方向平移，两者始终重合，旧的被新的完全盖住。
  if (knobDir) root.style.setProperty('--knob-dir', knobDir === 1 ? '1' : '-1')

  try {
    onStart?.()
    const vt = doc.startViewTransition(() => {
      // 同步改 DOM，浏览器才能拍到新状态的快照；
      // flushSync 让 React 的状态也同步跟上，图标才不会慢半拍。
      flushSync(apply)
    })

    if (vt.finished) vt.finished.finally(() => { clearTransitionVars(); onEnd?.() })
    else { clearTransitionVars(); onEnd?.() }
  } catch {
    // 出任何问题都退化成直接切换，绝不把开关点坏
    apply()
    clearTransitionVars()
    onEnd?.()
  }
}

interface ThemeApi {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** 带揭示动画的切换。origin 是触发元素，决定圆形揭示的圆心。 */
  toggle: (origin?: HTMLElement | null) => void
  /** 当前主题色 */
  accent: AccentId
  /** 切换主题色。origin 是色点按钮，揭示从色点扩散开。 */
  setAccent: (accent: AccentId, origin?: HTMLElement | null) => void
  /**
   * 切换动画进行中。
   *
   * 揭示期间快照层不吃点击，事件会穿透到真实 DOM ——
   * 这段时间里要锁住交互，否则点坞会把坞收了。
   */
  transitioning: boolean
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)
  const [accent, setAccentState] = useState<AccentId>(getStoredAccent)
  const [transitioning, setTransitioning] = useState(false)
  /** 一次只允许一个切换在进行 */
  const busyRef = useRef(false)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    applyAccent(accent)
    window.localStorage.setItem(ACCENT_KEY, accent)
  }, [accent])

  const toggle = useCallback(
    (origin?: HTMLElement | null) => {
      if (busyRef.current) return
      const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
      reveal(
        origin,
        () => {
          applyTheme(next)
          setMode(next)
        },
        next === 'dark' ? 1 : -1,
        () => {
          busyRef.current = true
          setTransitioning(true)
        },
        () => {
          busyRef.current = false
          setTransitioning(false)
        },
      )
    },
    [mode],
  )

  const setAccent = useCallback(
    (next: AccentId, origin?: HTMLElement | null) => {
      if (next === accent || busyRef.current) return
      reveal(
        origin,
        () => {
          applyAccent(next)
          setAccentState(next)
        },
        undefined,
        () => {
          busyRef.current = true
          setTransitioning(true)
        },
        () => {
          busyRef.current = false
          setTransitioning(false)
        },
      )
    },
    [accent],
  )

  const value = useMemo<ThemeApi>(
    () => ({ mode, setMode, toggle, accent, setAccent, transitioning }),
    [mode, setMode, toggle, accent, setAccent, transitioning],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
