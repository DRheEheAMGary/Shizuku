/* ============================================================================
 *  Shizuku · 主题
 * ----------------------------------------------------------------------------
 *  两件彼此独立的事：
 *    1. 明暗：浅色 / 深色 / 自动（自动＝跟随系统，系统切换时实时跟）
 *    2. 主题色：青蓝（默认）/ 暖黄 / 紫罗兰，各自带一套配色与背景图
 *
 *  状态写到 <html> 上：
 *    data-theme      真正生效的明暗（light / dark），CSS 全靠它
 *    data-theme-mode 用户选的那一档（可能是 auto），图标靠它
 *    data-accent     主题色 id，配色与背景图靠它
 *
 *  首屏防闪烁靠 index.html 的内联脚本；这里负责运行期切换。
 *  切换用 View Transitions 做圆形揭示：从触发点扩散出新主题的圆形裁切，
 *  旧快照垫在下面不动。圆钮里的图标单独一组快照，全程可见。
 * ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type AccentId = 'blue' | 'yellow' | 'purple'

/** 三套主题色：色点颜色与展示名，供色板渲染 */
export const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'blue', label: '青蓝', color: '#3f9fb5' },
  { id: 'yellow', label: '暖黄', color: '#e3a83a' },
  { id: 'purple', label: '紫罗兰', color: '#9d76d8' },
]

const STORAGE_KEY = 'shizuku-theme'
const ACCENT_KEY = 'shizuku-accent'
const MODES: ThemeMode[] = ['light', 'dark', 'auto']
const ACCENT_IDS: AccentId[] = ['blue', 'yellow', 'purple']
/** 不支持 View Transitions 时的兜底渐变时长，与 CSS 里的过渡对齐 */
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

/** 实际生效的明暗：自动那一档交给系统决定 */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

/** 读取初始模式。优先级：?theme= → localStorage → 系统偏好（只取一次） */
export function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const fromQuery = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null
  if (fromQuery && MODES.includes(fromQuery)) return fromQuery

  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  if (stored && MODES.includes(stored)) return stored

  // 首次访问没有存过：按系统偏好定一次，此后就以存下来的为准
  return systemPrefersDark() ? 'dark' : 'light'
}

/** 读取初始主题色。优先级：?accent= → localStorage → 默认青蓝 */
export function getStoredAccent(): AccentId {
  if (typeof window === 'undefined') return 'blue'

  const fromQuery = new URLSearchParams(window.location.search).get('accent') as AccentId | null
  if (fromQuery && ACCENT_IDS.includes(fromQuery)) return fromQuery

  const stored = window.localStorage.getItem(ACCENT_KEY) as AccentId | null
  if (stored && ACCENT_IDS.includes(stored)) return stored

  return 'blue'
}

/** 把模式应用到 DOM —— index.html 的内联脚本与 React 共用同一套写法 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = resolveMode(mode)
  root.dataset.themeMode = mode
}

/** 把主题色应用到 DOM */
export function applyAccent(accent: AccentId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.accent = accent
}

/** 清掉揭示动画期间临时写在 <html> 上的圆心、半径与图标方向 */
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
 * 浏览器在这一步拍下「旧状态」和「新状态」两张快照，旧快照垫在下面不动，
 * 新快照用圆形裁切从 origin 扩散开（裁切的圆心与半径通过 CSS 变量传出去）。
 *
 * onStart / onEnd 用来在动画期间锁住交互：快照层 pointer-events: none，
 * 事件会直接穿透到真实 DOM，不锁的话动画期间点到什么都会有反应。
 *
 * 三条降级路径：系统关闭动画 → 直接切；不支持 View Transitions → 退化成颜色渐变；
 * API 抛错 → 直接切并清掉变量，绝不把开关点坏。
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

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply()
    onEnd?.()
    return
  }

  if (typeof doc.startViewTransition !== 'function') {
    root.classList.add('theme-transition')
    apply()
    window.setTimeout(() => {
      root.classList.remove('theme-transition')
      onEnd?.()
    }, FALLBACK_MS)
    return
  }

  // 圆心 = 触发点中心；半径取到视口最远的角，保证圆能盖满全屏
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

  // 图标拨动的方向：浅→深往右，深→浅往左。
  // 新旧两张快照都按同一方向平移，内容始终重合，旧的被新的完全盖住。
  if (knobDir) root.style.setProperty('--knob-dir', knobDir === 1 ? '1' : '-1')

  try {
    onStart?.()
    const vt = doc.startViewTransition(() => {
      // 同步改 DOM，浏览器才能拍到新状态的快照；
      // flushSync 让 React 状态同步跟上，图标才不会慢半拍。
      flushSync(apply)
    })

    if (vt.finished) vt.finished.finally(() => { clearTransitionVars(); onEnd?.() })
    else { clearTransitionVars(); onEnd?.() }
  } catch {
    apply()
    clearTransitionVars()
    onEnd?.()
  }
}

interface ThemeApi {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** 选一档明暗，带圆形揭示。origin 决定揭示的圆心（一般传那颗圆钮）。 */
  chooseMode: (mode: ThemeMode, origin?: HTMLElement | null) => void
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
  /** 一次只允许一个揭示动画在进行 */
  const busyRef = useRef(false)

  // 模式变化：写 DOM + 落盘。两者都在 effect 里，保证渲染先行
  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  /* 自动那一档：系统明暗变了要跟着变（静默跟随，不播揭示动画） */
  useEffect(() => {
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  useEffect(() => {
    applyAccent(accent)
    window.localStorage.setItem(ACCENT_KEY, accent)
  }, [accent])

  const chooseMode = useCallback(
    (next: ThemeMode, origin?: HTMLElement | null) => {
      if (busyRef.current || next === mode) return

      const from = resolveMode(mode)
      const to = resolveMode(next)

      /* 观感没变（比如「浅色 → 自动」而系统正是浅色）：
       * 没必要演一次揭示动画，换个状态和图标就行。 */
      if (from === to) {
        applyTheme(next)
        setMode(next)
        return
      }

      reveal(
        origin,
        () => {
          applyTheme(next)
          setMode(next)
        },
        to === 'dark' ? 1 : -1,
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
    () => ({ mode, setMode, chooseMode, accent, setAccent, transitioning }),
    [mode, setMode, chooseMode, accent, setAccent, transitioning],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
