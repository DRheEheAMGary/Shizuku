/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { useEffect, useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { PageLoader } from '@/components/PageLoader'
import { About } from '@/pages/About'
import { Github } from '@/pages/Github'
import { Home } from '@/pages/Home'
import './App.css'

/** 统一路径：去掉末尾斜杠，根路径仍是 / */
function readPath() {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path || '/'
}

export function App() {
  const [path, setPath] = useState(readPath)

  useEffect(() => {
    const onPopState = () => {
      setPath(readPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (to: string) => {
    if (to === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }

  const page = path === '/about' ? <About /> : path === '/github' ? <Github /> : <Home />

  return (
    <>
      {/*  等背景图和磨砂都算完再揭开 */}
      <PageLoader />
      <SiteHeader path={path} onNavigate={navigate} />
      {page}
    </>
  )
}
