/* ============================================================================
 *  Shizuku · 应用入口
 * ----------------------------------------------------------------------------
 *  样式按依赖顺序引入：字体 → 设计 token → 基础样式 → 玻璃材质 → 正文版式
 *  → 主题切换过渡。后面的文件依赖前面的变量，顺序不能调换。
 *
 *  Provider 嵌套：主题在外、登录在内 —— 登录坞等组件要读主题，
 *  而登录状态与主题互不依赖，外层先定主题可以让首帧就用对配色。
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
import { AuthProvider } from './hooks/useAuth'

// 与 index.html 内联脚本同一套取值逻辑，在挂载前再应用一次：
// 保证 <html> 上的 data-theme / data-theme-mode 与 ThemeProvider 的初始
// 状态完全一致，不会出现「DOM 一套、React state 另一套」。
applyTheme(getStoredMode())

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
