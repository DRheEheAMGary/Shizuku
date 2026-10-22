/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { SiteHeader } from '@/components/SiteHeader'
import { ThemeVeil } from '@/components/ThemeVeil'
import '@/components/ThemeVeil.css'
import { Home } from '@/pages/Home'
import './App.css'

export function App() {
  return (
    <>
      <SiteHeader />
      <ThemeVeil />
      <Home />
    </>
  )
}
