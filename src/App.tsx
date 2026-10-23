/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { SiteHeader } from '@/components/SiteHeader'
import { PageLoader } from '@/components/PageLoader'
import { Home } from '@/pages/Home'
import './App.css'

export function App() {
  return (
    <>
      {/*  等背景图和磨砂都算完再揭开 */}
      <PageLoader />
      <SiteHeader />
      <Home />
    </>
  )
}
