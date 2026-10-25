/* ============================================================================
 *  Shizuku · 应用根组件
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

type Phase = 'idle' | 'out' | 'morph' | 'in'

interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

/** 各路由的卡片数量，用来决定旧卡里哪些要单独退场 */
const CARD_COUNTS: Record<string, number> = {
  '/': 1,
  '/about': 3,
  '/github': 3,
  '/contact': 2,
}

const OUT_MS = 40
const MORPH_MS = 420
const IN_MS = 80

export function App() {
  const [path, setPath] = useState(readPath)
  const [shownPath, setShownPath] = useState(path)
  const [phase, setPhase] = useState<Phase>('idle')
  const [hasNavigated, setHasNavigated] = useState(false)
  const pathRef = useRef(path)
  pathRef.current = path
  const busyRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const oldRectsRef = useRef<CardRect[]>([])

  const commit = (to: string) => {
    setHasNavigated(true)
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

    /* 换页前先记下当前卡片矩形。
     * 新页渲染后，卡片会从这个矩形形变到新布局的位置。 */
    const oldCards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    oldRectsRef.current = oldCards.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })

    /* 目标页没那么多卡：多出来的旧卡先向下收走 */
    const targetCount = CARD_COUNTS[to] ?? oldCards.length
    oldCards.forEach((el, i) => {
      if (i >= targetCount) el.classList.add('is-card-exit')
    })

    setPhase('out')

    window.setTimeout(() => {
      const target = pendingRef.current ?? to
      pendingRef.current = null
      commit(target)
      setPhase('morph')

      window.setTimeout(() => {
        setPhase('in')

        window.setTimeout(() => {
          setPhase('idle')
          busyRef.current = false

          const next = pendingRef.current
          pendingRef.current = null
          if (next && next !== pathRef.current) run(next)
        }, IN_MS)
      }, MORPH_MS)
    }, OUT_MS)
  }

  /* 新页挂载后、绘制前把卡片放回旧矩形，再在下一帧动画归位。
   * 只动 transform，绝不动卡片的 opacity / filter。 */
  useLayoutEffect(() => {
    if (phase !== 'morph') return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    const old = oldRectsRef.current

    cards.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return

      el.style.transition = 'none'
      el.style.transformOrigin = 'top left'

      const source = old[i]
      if (source) {
        const sx = (source.w / r.width) * 0.95
        const sy = (source.h / r.height) * 0.95
        const dx = source.x - r.x
        const dy = source.y - r.y + 18
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`
      } else {
        el.style.transform = 'translate3d(0, 36px, 0) scale(0.94)'
      }

      el.style.transitionDelay = `${i * 28}ms`
    })

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      cards.forEach((el) => {
        el.style.transition = ''
      })
      raf2 = requestAnimationFrame(() => {
        cards.forEach((el) => {
          el.style.transform = ''
        })
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [phase, shownPath])

  /* 动画结束后清掉临时内联样式 */
  useEffect(() => {
    if (phase !== 'idle') return
    document.querySelectorAll<HTMLElement>('.page-view [data-card]').forEach((el) => {
      el.style.transform = ''
      el.style.transition = ''
      el.style.transformOrigin = ''
      el.style.transitionDelay = ''
    })
    oldRectsRef.current = []
  }, [phase])

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

  const viewClass = `page-view${hasNavigated ? ' has-routed' : ''}${
    phase === 'out'
      ? ' is-card-out'
      : phase === 'morph'
        ? ' is-card-morph'
        : phase === 'in'
          ? ' is-card-in'
          : ''
  }`

  return (
    <>
      {/*  等背景图和磨砂都算完再揭开 */}
      <PageLoader />
      <SiteHeader path={path} onNavigate={navigate} />
      <div className={viewClass}>{page}</div>
    </>
  )
}
