/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { SiteHeader } from '@/components/SiteHeader'
import { PageLoader } from '@/components/PageLoader'
import { About } from '@/pages/About'
import { Contact } from '@/pages/Contact'
import { Github } from '@/pages/Github'
import { Home } from '@/pages/Home'
import './App.css'

/** 统一路径：去掉末尾斜杠，根路径仍是 / */
function readPath() {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path || '/'
}

interface ViewTransition {
  finished?: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransition
}

export function App() {
  const [path, setPath] = useState(readPath)
  const pathRef = useRef(path)
  pathRef.current = path

  const navigate = (to: string, push = true) => {
    if (to === pathRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (push) window.history.pushState(null, '', to)

    const apply = () => {
      flushSync(() => {
        setPath(to)
        pathRef.current = to
        window.scrollTo(0, 0)
      })
    }

    const doc = document as ViewTransitionDocument
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof doc.startViewTransition !== 'function' || reduced) {
      apply()
      return
    }

    /*  旧页和新页各拍一张快照：
     *  顶栏、背景不参与（.page-view 单独命名），只让页面内容进退场。 */
    const root = document.documentElement
    const done = () => root.classList.remove('is-page-transition')
    root.classList.add('is-page-transition')

    try {
      const vt = doc.startViewTransition(apply)
      if (vt.finished) vt.finished.finally(done).catch(() => {})
      else window.setTimeout(done, 600)
    } catch {
      // 上一次过渡还没结束等异常：直接切，不把导航卡住
      done()
      apply()
    }
  }

  useEffect(() => {
    const onPopState = () => navigate(readPath(), false)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const page =
    path === '/about' ? (
      <About />
    ) : path === '/github' ? (
      <Github />
    ) : path === '/contact' ? (
      <Contact />
    ) : (
      <Home />
    )

  return (
    <>
      {/*  等背景图和磨砂都算完再揭开 */}
      <PageLoader />
      <SiteHeader path={path} onNavigate={navigate} />
      <div className="page-view">{page}</div>
    </>
  )
}
