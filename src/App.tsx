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
type TransitionKind = 'normal' | 'split' | 'main'

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

const OUT_MS = 120
const MORPH_MS = 900
const SPLIT_MS = 1150
const MAIN_ZOOM_MS = 600
const MAIN_SPLIT_MS = 1000
const IN_MS = 180

/** Main → 子页：放大后分裂；About → Contact：普通分裂。手机上保持普通过渡 */
function getTransitionKind(from: string, to: string): TransitionKind {
  if (!window.matchMedia('(min-width: 981px)').matches) return 'normal'
  if (from === '/' && (to === '/about' || to === '/github' || to === '/contact')) {
    return 'main'
  }
  return from === '/about' && to === '/contact' ? 'split' : 'normal'
}

/** Main 卡放大后的舞台：接近子页内容栏的宽度，垂直居中 */
function getMainStageRect(): CardRect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(1024, vw - 96)
  const h = Math.min(560, Math.max(320, vh - 320))
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h }
}

/** 把舞台按目标卡片数量切成 4/8（+整行）的碎片 */
function stagePieces(stage: CardRect, count: number, gap = 16): CardRect[] {
  if (count >= 3) {
    const splitY = stage.h * 0.56
    const leftW = stage.w * (4 / 12) - gap / 2
    const rightW = stage.w * (8 / 12) - gap / 2
    return [
      { x: stage.x, y: stage.y, w: leftW, h: splitY - gap / 2 },
      { x: stage.x + stage.w * (4 / 12) + gap / 2, y: stage.y, w: rightW, h: splitY - gap / 2 },
      {
        x: stage.x,
        y: stage.y + splitY + gap / 2,
        w: stage.w,
        h: stage.h - splitY - gap / 2,
      },
    ]
  }

  const leftW = stage.w * (4 / 12) - gap / 2
  const rightW = stage.w * (8 / 12) - gap / 2
  return [
    { x: stage.x, y: stage.y, w: leftW, h: stage.h },
    { x: stage.x + stage.w * (4 / 12) + gap / 2, y: stage.y, w: rightW, h: stage.h },
  ]
}

/** 目标页放不下的旧卡先下沉；分裂时保留被拆的那张，其余先退场 */
function markExitCards(cards: HTMLElement[], kind: TransitionKind, to: string) {
  cards.forEach((el) => el.classList.remove('is-card-exit'))

  if (kind === 'split' && cards.length >= 3) {
    cards.forEach((el, i) => {
      if (i !== 2) el.classList.add('is-card-exit')
    })
    return
  }

  if (kind === 'main') return

  const targetCount = CARD_COUNTS[to] ?? cards.length
  cards.forEach((el, i) => {
    if (i >= targetCount) el.classList.add('is-card-exit')
  })
}

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
  const oldPathRef = useRef(shownPath)
  const kindRef = useRef<TransitionKind>('normal')
  const stageRef = useRef<CardRect | null>(null)

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

    const from = shownPath
    oldPathRef.current = from

    /* 换页前先记下当前卡片矩形。
     * 新页渲染后，卡片会从这个矩形形变到新布局的位置。 */
    const oldCards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    oldRectsRef.current = oldCards.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })

    const kind = getTransitionKind(from, to)
    kindRef.current = kind
    markExitCards(oldCards, kind, to)

    if (kind === 'main') {
      /* 先把 Main 的唯一卡片放大到舞台；内容稍后淡出 */
      const mainCard = oldCards[0]
      const stage = getMainStageRect()
      stageRef.current = stage
      if (mainCard) {
        const r = mainCard.getBoundingClientRect()
        mainCard.style.transition = `transform ${MAIN_ZOOM_MS}ms var(--ease-card)`
        mainCard.style.transformOrigin = 'top left'
        void mainCard.offsetWidth
        mainCard.style.transform = `translate3d(${stage.x - r.x}px, ${stage.y - r.y}px, 0) scale(${stage.w / r.width}, ${stage.h / r.height})`
      }
    }

    setPhase('out')

    window.setTimeout(() => {
      const target = pendingRef.current ?? to
      pendingRef.current = null

      /* 退场期间又换了目标：按最终目标重新决定哪些旧卡退场 */
      const finalKind = getTransitionKind(from, target)
      kindRef.current = finalKind
      markExitCards(oldCards, finalKind, target)

      commit(target)
      setPhase('morph')

      const morphMs =
        finalKind === 'main' ? MAIN_SPLIT_MS : finalKind === 'split' ? SPLIT_MS : MORPH_MS

      window.setTimeout(() => {
        setPhase('in')

        window.setTimeout(() => {
          setPhase('idle')
          busyRef.current = false

          const next = pendingRef.current
          pendingRef.current = null
          if (next && next !== pathRef.current) run(next)
        }, IN_MS)
      }, morphMs)
    }, kind === 'main' ? MAIN_ZOOM_MS : OUT_MS)
  }

  /* 新页挂载后、绘制前把卡片放回旧矩形，再在下一帧动画归位。
   * 只动 transform，绝不动卡片的 opacity / filter。 */
  useLayoutEffect(() => {
    if (phase !== 'morph') return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    const old = oldRectsRef.current
    const kind = kindRef.current
    const split = kind === 'split' && old.length >= 3
    const main = kind === 'main' && !!stageRef.current
    const mainPieces = main ? stagePieces(stageRef.current!, cards.length) : []
    const gap = 16

    cards.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return

      el.style.transition = 'none'
      el.style.transformOrigin = 'top left'

      let source: CardRect | undefined

      if (main) {
        source = mainPieces[i]
      } else if (split) {
        /* 一张全宽链接卡，在原来的位置先裂成 4/8 两半 */
        if (i < 2) {
          const base = old[2]
          const splitAt = base.x + base.w * (4 / 12)
          source =
            i === 0
              ? { x: base.x, y: base.y, w: base.w * (4 / 12) - gap / 2, h: base.h }
              : {
                  x: splitAt + gap / 2,
                  y: base.y,
                  w: base.w * (8 / 12) - gap / 2,
                  h: base.h,
                }
        }
      } else {
        source = old[i]
      }

      if (source) {
        const factor = main ? 1 : split ? 0.98 : 0.95
        const sx = (source.w / r.width) * factor
        const sy = (source.h / r.height) * factor
        const dx = source.x - r.x
        const dy = source.y - r.y + (main ? 0 : split ? 6 : 18)
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`
      } else {
        el.style.transform = 'translate3d(0, 36px, 0) scale(0.94)'
      }

      /* 分裂 / 放大分裂先让碎片停一下，形状看清楚了再移动 */
      const hold = main ? 180 : split ? 300 : 0
      el.style.setProperty(
        '--card-delay',
        `${hold + (main ? i * 40 : split ? 0 : i * 70)}ms`,
      )
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
      el.style.removeProperty('--card-delay')
    })
    oldRectsRef.current = []
    stageRef.current = null
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

  const kindClass =
    phase === 'idle'
      ? ''
      : kindRef.current === 'split'
        ? ' is-split'
        : kindRef.current === 'main'
          ? ' is-main'
          : ''

  const viewClass = `page-view${hasNavigated ? ' has-routed' : ''}${kindClass}${
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
