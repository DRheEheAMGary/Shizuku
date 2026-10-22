/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { Home } from '@/pages/Home'
import { About } from '@/pages/About'
import { Links } from '@/pages/Links'
import { Works } from '@/pages/Works'
import { Contact } from '@/pages/Contact'
import './App.css'

/** 路由切换时回到顶部，并更新文档标题 */
function RouteEffects() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}

export function App() {
  return (
    <>
      <RouteEffects />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/links" element={<Links />} />
        <Route path="/works" element={<Works />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
