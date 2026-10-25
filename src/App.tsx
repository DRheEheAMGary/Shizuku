/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
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

type Phase = 'idle' | 'out' | 'in'

const EXIT_MS = 200
const ENTER_MS = 320

export function App() {
  const [path, setPath] = useState(readPath)
  const [shownPath, setShownPath] = useState(path)
  const [phase, setPhase] = useState<Phase>('idle')
  const pathRef = useRef(path)
  pathRef.current = path
  const busyRef = useRef(false)
  const pendingRef = useRef<string | null>(null)

  const commit = (to: string) => {
    setPath(to)
    pathRef.current = to
    setShownPath(to)
    window.scrollTo(0, 0)
  }

  const run = (to: string) => {
    busyRef.current = true

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit(to)
      setPhase('idle')
      busyRef.current = false
      return
    }

    setPhase('out')

    window.setTimeout(() => {
      /*  退场期间如果又点了别的导航，直接落到最后一个目标，
       *  不要把中间页闪一下再走。 */
      const target = pendingRef.current ?? to
      pendingRef.current = null
      commit(target)
      setPhase('in')

      window.setTimeout(() => {
        setPhase('idle')
        busyRef.current = false

        const next = pendingRef.current
        pendingRef.current = null
        if (next && next !== pathRef.current) run(next)
      }, ENTER_MS)
    }, EXIT_MS)
  }

  const navigate = (to: string, push = true) => {
    if (to === pathRef.current && !busyRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (busyRef.current) {
      //  过渡中再点：记下最后一次目标，等这一轮播完再接上
      if (push) window.history.pushState(null, '', to)
      pendingRef.current = to
      return
    }

    if (push) window.history.pushState(null, '', to)
    run(to)
  }

  useEffect(() => {
    const onPopState = () => navigate(readPath(), false)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const page =
    shownPath === '/about' ? (
      <About />
    ) : shownPath === '/github' ? (
      <Github />
    ) : shownPath === '/contact' ? (
      <Contact />
    ) : (
      <Home />
    )

  return (
    <>
      {/*  等背景图和磨砂都算完再揭开 */}
      <PageLoader />
      <SiteHeader path={path} onNavigate={navigate} />
      <div className={`page-view${phase === 'out' ? ' is-out' : ''}${phase === 'in' ? ' is-in' : ''}`}>
        {page}
      </div>
    </>
  )
}
