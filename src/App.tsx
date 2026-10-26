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
type TransitionKind =
  | 'normal'
  | 'content'
  | 'main'
  | 'collect-split'
  | 'collect-shrink'

interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

const CONTENT_PATHS = new Set(['/about', '/github', '/contact'])

/** 各路由的卡片数量，普通过渡时用来决定哪些旧卡要退场 */
const CARD_COUNTS: Record<string, number> = {
  '/': 1,
  '/about': 3,
  '/github': 3,
  '/contact': 2,
}

const OUT_MS = 230
const MORPH_MS = 1160
const CONTENT_MS = 780
const MAIN_SPLIT_MS = 1260
const COLLECT_OUT_MS = 340
const COLLECT_SPLIT_MS = 1220
const COLLECT_SHRINK_MS = 1240
const COLLECT_HANDOFF_MS = 210
const BRIDGE_HOLD_MS = 0
const SHRINK_HOLD_MS = 0
const IN_MS = 230

/** 旧卡要走的距离越短，合并这一拍就越短；已经在同一位置时直接交棒 */
function collectOutMs(rects: CardRect[], union: CardRect | null) {
  if (!union) return COLLECT_OUT_MS

  const pieces = cardPieces(union, rects.length)
  let maxD = 0
  rects.forEach((r, i) => {
    const p = pieces[i]
    if (!p || !r.w || !r.h) return
    maxD = Math.max(maxD, Math.hypot(p.x - r.x, p.y - r.y), Math.hypot(p.w - r.w, p.h - r.h))
  })

  return Math.round(Math.max(COLLECT_HANDOFF_MS, Math.min(COLLECT_OUT_MS, 110 + maxD * 1.4)))
}

/** 内容文字淡入的时长（与 App.css 的 --content-fade 保持一致） */
const CONTENT_FADE_MS = 460

/** 卡片基本落位之后才浮出文字：延迟各自的形变收尾时刻 */
function contentDelayFor(kind: TransitionKind) {
  /* About ↔ Github 只换内容、卡片不动，保持即时淡入 */
  if (kind === 'content') return 0
  if (kind === 'collect-split') return 720
  if (kind === 'collect-shrink') return 740
  if (kind === 'main') return 760
  return 560
}

/** Main 的标题复制一份，换页后继续在原位淡出 */
function createTitleGhost() {
  const title = document.querySelector<HTMLElement>('.home-title-block')
  if (!title) return

  document.querySelectorAll('.home-title-ghost').forEach((el) => el.remove())

  const rect = title.getBoundingClientRect()
  title.style.opacity = '0'

  const ghost = title.cloneNode(true) as HTMLElement
  ghost.classList.add('home-title-ghost')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.left = `${rect.left}px`
  ghost.style.top = `${rect.top}px`
  ghost.style.width = `${rect.width}px`
  document.body.appendChild(ghost)

  window.setTimeout(() => ghost.remove(), 760)
}

/** 合并阶段的桥接玻璃：先把源卡汇聚到这块矩形，再由它裂成目标卡 */
function createBridge(rect: CardRect) {
  const el = document.createElement('div')
  el.className = 'transition-bridge'
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${rect.x}px`
  el.style.top = `${rect.y}px`
  el.style.width = `${rect.w}px`
  el.style.height = `${rect.h}px`
  document.body.appendChild(el)
  return el
}

function unionRect(rects: CardRect[]): CardRect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

/** 把一块矩形按目标卡片数量切成首尾相接的碎片 */
function cardPieces(stage: CardRect, count: number): CardRect[] {
  if (count >= 3) {
    const splitY = stage.h * 0.56
    return [
      { x: stage.x, y: stage.y, w: stage.w * (4 / 12), h: splitY },
      { x: stage.x + stage.w * (4 / 12), y: stage.y, w: stage.w * (8 / 12), h: splitY },
      { x: stage.x, y: stage.y + splitY, w: stage.w, h: stage.h - splitY },
    ]
  }

  return [
    { x: stage.x, y: stage.y, w: stage.w * (4 / 12), h: stage.h },
    { x: stage.x + stage.w * (4 / 12), y: stage.y, w: stage.w * (8 / 12), h: stage.h },
  ]
}

function getTransitionKind(from: string, to: string): TransitionKind {
  if (!window.matchMedia('(min-width: 981px)').matches) return 'normal'

  if (from === '/' && CONTENT_PATHS.has(to)) return 'main'

  if (CONTENT_PATHS.has(from) && to === '/') return 'collect-shrink'

  if (
    (from === '/about' && to === '/github') ||
    (from === '/github' && to === '/about')
  ) {
    return 'content'
  }

  if (CONTENT_PATHS.has(from) && CONTENT_PATHS.has(to)) return 'collect-split'

  return 'normal'
}

function markExitCards(cards: HTMLElement[], kind: TransitionKind, to: string) {
  cards.forEach((el) => el.classList.remove('is-card-exit'))
  if (kind !== 'normal') return

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
  const [scrimVisible, setScrimVisible] = useState(path === '/')
  const pathRef = useRef(path)
  pathRef.current = path
  const shownPathRef = useRef(shownPath)
  shownPathRef.current = shownPath
  const navigateRef = useRef<(to: string, push?: boolean) => void>(() => {})
  const busyRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const oldRectsRef = useRef<CardRect[]>([])
  const collectUnionRef = useRef<CardRect | null>(null)
  const bridgeRef = useRef<HTMLElement | null>(null)
  const kindRef = useRef<TransitionKind>('normal')

  const commit = (to: string) => {
    setHasNavigated(true)
    setScrimVisible(to === '/')
    setPath(to)
    pathRef.current = to
    shownPathRef.current = to
    setShownPath(to)
    window.scrollTo(0, 0)
  }

  const removeBridge = () => {
    bridgeRef.current?.remove()
    bridgeRef.current = null
  }

  const run = (to: string) => {
    busyRef.current = true
    document.querySelectorAll('.home-title-ghost').forEach((el) => el.remove())
    removeBridge()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit(to)
      setPhase('idle')
      busyRef.current = false
      return
    }

    const from = shownPathRef.current
    if (from === '/') setScrimVisible(false)

    const oldCards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    const oldRects = oldCards.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    oldRectsRef.current = oldRects

    const kind = getTransitionKind(from, to)
    kindRef.current = kind
    markExitCards(oldCards, kind, to)

    if (from === '/' && CONTENT_PATHS.has(to)) createTitleGhost()

    /* 合并类过渡：旧卡先向共同矩形汇聚，视觉上并成一张卡 */
    let collectOut = COLLECT_OUT_MS
    if (kind === 'collect-split' || kind === 'collect-shrink') {
      const union = unionRect(oldRects)
      collectUnionRef.current = union
      collectOut = collectOutMs(oldRects, union)
      /* 文字退场要在交棒前走完，时长跟合并时长绑定 */
      const outFade = `${Math.max(160, collectOut - 30)}ms`
      oldCards.forEach((el) => el.style.setProperty('--out-fade', outFade))
      if (union) {
        /* 不要把所有卡缩到同一矩形：透明玻璃叠一起会明显发白。
         * 让每张旧卡拼到 union 的不同碎片上，彼此不重叠。 */
        const pieces = cardPieces(union, oldCards.length)
        oldCards.forEach((el, i) => {
          const r = oldRects[i]
          const piece = pieces[i]
          if (!r.w || !r.h || !piece) return
          el.style.transition = `transform ${collectOut}ms var(--ease-collect)`
          el.style.transformOrigin = 'top left'
          el.style.transform = `translate3d(${piece.x - r.x}px, ${piece.y - r.y}px, 0) scale(${piece.w / r.w}, ${piece.h / r.h})`
        })
      }
    }

    setPhase('out')

    window.setTimeout(() => {
      const target = pendingRef.current ?? to
      pendingRef.current = null
      const finalKind = getTransitionKind(from, target)
      kindRef.current = finalKind
      markExitCards(oldCards, finalKind, target)

      /* 合并后分裂：先把桥接玻璃放在合并矩形上，盖住目标碎片之间的缝 */
      if (finalKind === 'collect-split') {
        const union = collectUnionRef.current ?? unionRect(oldRectsRef.current)
        collectUnionRef.current = union
        if (union) {
          const bridge = createBridge(union)
          bridgeRef.current = bridge
          window.setTimeout(() => {
            bridge.remove()
            if (bridgeRef.current === bridge) bridgeRef.current = null
          }, 380)
        }
      }

      commit(target)
      setPhase('morph')

      const morphMs =
        finalKind === 'main'
          ? MAIN_SPLIT_MS
          : finalKind === 'content'
            ? CONTENT_MS
            : finalKind === 'collect-split'
              ? COLLECT_SPLIT_MS
              : finalKind === 'collect-shrink'
                ? COLLECT_SHRINK_MS
                : MORPH_MS

      /* 文字最后出现，所以形变阶段要等到文字淡完再结束 */
      const morphPhaseMs = Math.max(
        morphMs,
        contentDelayFor(finalKind) + CONTENT_FADE_MS + 40,
      )

      window.setTimeout(() => {
        setPhase('in')
        window.setTimeout(() => {
          setPhase('idle')
          busyRef.current = false

          const next = pendingRef.current
          pendingRef.current = null
          if (next && next !== pathRef.current) run(next)
        }, IN_MS)
      }, morphPhaseMs)
    }, kind === 'collect-split' || kind === 'collect-shrink' ? collectOut : OUT_MS)
  }

  useLayoutEffect(() => {
    if (phase !== 'morph') return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    const old = oldRectsRef.current
    const union = collectUnionRef.current
    const kind = kindRef.current
    const content = kind === 'content'
    const main = kind === 'main' && old.length >= 1
    const collectSplit = kind === 'collect-split' && !!union
    const collectShrink = kind === 'collect-shrink' && !!union
    const mainPieces = main ? cardPieces(old[0], cards.length) : []
    const collectPieces = collectSplit ? cardPieces(union!, cards.length) : []

    const contentDelay = `${contentDelayFor(kind)}ms`

    cards.forEach((el, i) => {
      el.style.setProperty('--content-delay', contentDelay)

      if (content) {
        el.style.transform = ''
        el.style.zIndex = ''
        el.style.removeProperty('--card-delay')
        return
      }

      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return

      el.style.transition = 'none'
      el.style.transformOrigin = 'top left'

      let source: CardRect | undefined
      let delay = '0ms'

      if (main) {
        source = mainPieces[i]
        delay = '100ms'
      } else if (collectSplit) {
        source = collectPieces[i]
        delay = `${BRIDGE_HOLD_MS}ms`
      } else if (collectShrink) {
        source = union!
        delay = `${SHRINK_HOLD_MS}ms`
      } else {
        source = old[i]
      }

      if (source) {
        const sx = source.w / r.width
        const sy = source.h / r.height
        const dx = source.x - r.x
        const dy = source.y - r.y
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`
      } else {
        el.style.transform = 'translate3d(0, 36px, 0) scale(0.94)'
      }

      el.style.setProperty('--card-delay', delay)
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

  useEffect(() => {
    if (phase !== 'idle') return
    document.querySelectorAll<HTMLElement>('.page-view [data-card]').forEach((el) => {
      el.style.transform = ''
      el.style.transition = ''
      el.style.transformOrigin = ''
      el.style.removeProperty('--card-delay')
      el.style.removeProperty('--content-delay')
      el.style.removeProperty('--out-fade')
      el.style.zIndex = ''
    })
    removeBridge()
    oldRectsRef.current = []
    collectUnionRef.current = null
  }, [phase])

  const navigate = (to: string, push = true) => {
    if (to === pathRef.current && !busyRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (busyRef.current) {
      if (push) window.history.pushState(null, '', to)
      pendingRef.current = to
      return
    }

    if (push) window.history.pushState(null, '', to)
    run(to)
  }

  navigateRef.current = navigate

  useEffect(() => {
    const onPopState = () => navigateRef.current(readPath(), false)
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
      : kindRef.current === 'content'
        ? ' is-content'
        : kindRef.current === 'main'
          ? ' is-main'
          : kindRef.current === 'collect-split'
            ? ' is-collect-split'
            : kindRef.current === 'collect-shrink'
              ? ' is-collect-shrink'
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
      <PageLoader />
      <div
        className={`home-scrim${scrimVisible ? ' is-visible' : ''}`}
        aria-hidden="true"
      />
      <SiteHeader path={path} onNavigate={navigate} />
      <div className={viewClass}>{page}</div>
    </>
  )
}
