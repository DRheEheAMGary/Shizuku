/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  只有浅色 / 深色两态，没有「跟随系统」。
 *  首次访问按系统偏好定一次，之后就是用户自己选的那一态。
 *
 *  主题在 React 挂载前就写入 <html data-theme>，避免首屏亮暗闪烁 ——
 *  脚本内联在 index.html 中。
 *
 *  切换用 View Transitions API 做圆形揭示：从开关位置扩散开一个新主题的
 *  圆形裁切，旧快照垫在下面不动。拨动滑块有自己的快照组，全程可见。
 * ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'shizuku-theme'
const MODES: ThemeMode[] = ['light', 'dark']
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

/** 把模式应用到 DOM —— 供内联脚本与 React 共用 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = mode
  root.dataset.themeMode = mode
}

function clearTransitionVars() {
  const root = document.documentElement
  root.style.removeProperty('--vt-x')
  root.style.removeProperty('--vt-y')
  root.style.removeProperty('--vt-r')
  root.style.removeProperty('--knob-dir')
}

interface ThemeApi {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** 带揭示动画的切换。origin 是触发元素，决定圆形揭示的圆心。 */
  toggle: (origin?: HTMLElement | null) => void
  /**
   * 揭示动画进行中。
   *
   * 揭示期间整个根节点是一张静态快照 —— 真实 DOM 根本不画，
   * 所以图标的变化会被冻住，看到的是「啪一下换掉」而不是变形。
   * 图标要等这个变回 false 之后再切，变形动画才看得见。
   */
  revealing: boolean
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = useCallback(
    (origin?: HTMLElement | null) => {
      const doc = document as ViewTransitionDocument
      const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
      const root = document.documentElement

      // 系统里关掉了动画：不介入
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMode(next)
        return
      }

      // 不支持 View Transitions：退化成颜色渐变，滑块用 CSS 过渡拨动
      if (typeof doc.startViewTransition !== 'function') {
        root.classList.add('theme-transition')
        setMode(next)
        window.setTimeout(() => root.classList.remove('theme-transition'), FALLBACK_MS)
        return
      }

      // 圆心 = 触发开关中心，半径要能盖住整个视口
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
      root.style.setProperty('--knob-dir', next === 'dark' ? '1' : '-1')

      try {
        // 揭示期间不让图标跟着变 —— 快照里是静态的，改了也看不见，
        // 反而会在揭示结束的瞬间「啪」一下跳过去。
        flushSync(() => setRevealing(true))

        const vt = doc.startViewTransition(() => {
          // applyTheme 同步改 DOM，浏览器才能拍到新状态的快照；
          // flushSync 让 React 的状态也同步跟上，图标才不会慢半拍。
          applyTheme(next)
          flushSync(() => setMode(next))
        })

        if (vt.finished) {
          vt.finished.finally(() => {
            setRevealing(false)
            clearTransitionVars()
          })
        } else {
          setRevealing(false)
          clearTransitionVars()
        }
      } catch {
        // 出任何问题都退化成直接切换，绝不把开关点坏
        setRevealing(false)
        setMode(next)
        clearTransitionVars()
      }
    },
    [mode, setMode],
  )

  const value = useMemo<ThemeApi>(
    () => ({ mode, setMode, toggle, revealing }),
    [mode, setMode, toggle, revealing],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
