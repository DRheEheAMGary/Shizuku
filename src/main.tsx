/* ============================================================================
 *  Shizuku · 入口
 * ========================================================================== */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'
import './styles/content.css'
import './styles/theme-transition.css'

import { App } from './App'
import { applyTheme, getStoredMode, ThemeProvider } from './hooks/useTheme'

// React 挂载前先把主题定下来，避免首屏亮暗闪烁
applyTheme(getStoredMode())

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}
