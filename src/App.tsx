/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { SiteHeader } from '@/components/SiteHeader'
import { Home } from '@/pages/Home'
import './App.css'

export function App() {
  return (
    <>
      <SiteHeader />
      <Home />
    </>
  )
}
