/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  只有浅色 / 深色两态，没有「跟随系统」。
 *  首次访问按系统偏好定一次，之后就是用户自己选的那一态。
 *
 *  主题在 React 挂载前就写入 <html data-theme>，避免首屏亮暗闪烁 ——
 *  脚本内联在 index.html 中。
 * ========================================================================== */

import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'shizuku-theme'
const MODES: ThemeMode[] = ['light', 'dark']

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

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return { mode, setMode, toggle }
}
