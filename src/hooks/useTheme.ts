/* ============================================================================
 *  Shizuku · 主题切换
 * ----------------------------------------------------------------------------
 *  auto / light / dark 三态。主题在 React 挂载前就写入 <html data-theme>，
 *  避免首屏亮暗闪烁 —— 脚本内联在 index.html 中。
 * ========================================================================== */

import { useEffect, useState } from 'react'

export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'shizuku-theme'
const MODES: ThemeMode[] = ['auto', 'light', 'dark']

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

/** 读取初始模式（在任何 React 代码之前调用） */
export function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  // ?theme= 优先级最高：用于预览与分享时强制主题
  const fromQuery = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null
  if (fromQuery && MODES.includes(fromQuery)) return fromQuery
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  return stored && MODES.includes(stored) ? stored : 'auto'
}

/** 把模式应用到 DOM —— 供内联脚本与 React 共用 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = resolve(mode)
  root.dataset.themeMode = mode
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)

  useEffect(() => {
    applyTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  // 跟随系统（仅 auto 模式下响应系统变化）
  useEffect(() => {
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const cycle = () => {
    setMode((prev) => MODES[(MODES.indexOf(prev) + 1) % MODES.length])
  }

  const resolved: 'light' | 'dark' =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light'

  return { mode, resolved, setMode, cycle }
}
