/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  只有浅色 / 深色两态，没有「跟随系统」。
 *  首次访问按系统偏好定一次，之后就是用户自己选的那一态。
 *
 *  主题在 React 挂载前就写入 <html data-theme>，避免首屏亮暗闪烁 ——
 *  脚本内联在 index.html 中。
 *
 *  切换时用 View Transitions API 做圆形揭示：从按钮位置扩散开一个新主题的
 *  圆形裁切，旧快照垫在下面不动。
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'shizuku-theme'
const MODES: ThemeMode[] = ['light', 'dark']
/** 兜底颜色渐变的时长，和 CSS 里的 transition 对齐 */
const FALLBACK_MS = 520

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished?: Promise<void> }
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
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  return { mode, setMode }
}

/**
 * 带圆形揭示动画的主题切换。
 *
 * 优先 View Transitions API：浏览器拍下切换前后的两张快照，
 * 新快照用圆形裁切铺开 —— 整页（文字、顶栏、图片）都在过渡里。
 *
 * 不支持该 API 的浏览器退回「颜色渐变」：临时挂一个 class，
 * 让颜色属性平滑过渡 0.5s。
 */
export function useThemeTransition() {
  const { mode, setMode } = useTheme()
  const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'

  const toggle = useCallback(
    (origin?: HTMLElement | null) => {
      const doc = document as ViewTransitionDocument

      // 系统里关掉了动画：不介入
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMode(next)
        return
      }

      // 不支持 View Transitions：退化成颜色渐变
      if (typeof doc.startViewTransition !== 'function') {
        const root = document.documentElement
        root.classList.add('theme-transition')
        setMode(next)
        window.setTimeout(() => root.classList.remove('theme-transition'), FALLBACK_MS)
        return
      }

      // 圆心 = 触发按钮中心，半径要能盖住整个视口
      if (origin) {
        const rect = origin.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        )
        const root = document.documentElement
        root.style.setProperty('--vt-x', `${x}px`)
        root.style.setProperty('--vt-y', `${y}px`)
        root.style.setProperty('--vt-r', `${radius}px`)
      }

      try {
        const vt = doc.startViewTransition(() => {
          // applyTheme 同步改 DOM，浏览器才能拍到新状态的快照；
          // flushSync 让 React 的状态也同步跟上，图标才不会慢半拍。
          applyTheme(next)
          flushSync(() => setMode(next))
        })

        if (vt.finished) vt.finished.finally(clearTransitionVars)
        else clearTransitionVars()
      } catch {
        // 出任何问题都退化成直接切换，绝不把按钮点坏
        setMode(next)
        clearTransitionVars()
      }
    },
    [next, setMode],
  )

  return { mode, toggle }
}
