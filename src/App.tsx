/* ============================================================================
 *  Shizuku · 应用根组件
 * ----------------------------------------------------------------------------
 *  站点没有路由库：路径直接读 window.location，导航用 history.pushState。
 *  这里同时是跨页过渡的唯一调度中心，换页分四个阶段：
 *
 *    out    旧页退场：旧卡片开始位移 / 淡出
 *    morph  提交新路径并挂载新页，新卡片从旧卡片的位置与尺寸长到自己的位置
 *    in     过渡收尾，等待下一次导航
 *    idle   清理所有内联样式
 *
 *  过渡形态由 getTransitionKind 在宽屏下挑选（窄屏一律走 normal）：
 *
 *    main            Main → 内容页：主卡分裂成目标页的每张卡
 *    collect-split   内容页 → 内容页：旧卡先并成一块，再裂成新卡
 *    collect-shrink  内容页 → Main：旧卡并成一块后缩回主卡
 *    content         About ↔ Github：卡片不动，只换内容
 *    normal          其余情况：淡出淡入 + 轻微上浮
 *
 *  几何量都在换页前用 getBoundingClientRect 量好，新页挂载后反向算出起始
 *  transform，再用两帧 rAF 把过渡交还给 CSS —— 避免同帧读写样式导致跳变。
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { useGlassCards } from '@/hooks/useRefraction'
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

/** 换页阶段：退场 → 形变 → 收尾 → 静止 */
type Phase = 'idle' | 'out' | 'morph' | 'in'
/** 过渡形态，决定卡片怎么动 */
type TransitionKind =
  | 'normal'
  | 'content'
  | 'main'
  | 'collect-split'
  | 'collect-shrink'

/** 视口坐标系下的一块矩形，单位 px */
interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

/** 除 Main 之外的页面；过渡形态的判断都基于这份集合 */
const CONTENT_PATHS = new Set(['/about', '/github', '/contact'])

/** 各路由的卡片数量，normal 过渡时用来决定哪些旧卡要退场 */
const CARD_COUNTS: Record<string, number> = {
  '/': 1,
  '/about': 3,
  '/github': 3,
  '/contact': 2,
}

/* 各阶段的时长（ms）。拆成几个常量是为了让「立即退场」和「完整形变」分开调：
 * Main 的旧内容几乎不留，内容页之间的合并要留出足够的位移时间。 */
const OUT_MS = 230
const MAIN_OUT_MS = 90
const MORPH_MS = 1160
const CONTENT_MS = 780
const MAIN_SPLIT_MS = 740
const COLLECT_OUT_MS = 220
const COLLECT_SPLIT_MS = 700
const COLLECT_SHRINK_MS = 720
/** 合并的最短交棒时长：两张卡本来就贴在一起时也得走一小段，避免动画被吃掉 */
const COLLECT_HANDOFF_MS = 70
/** 桥接玻璃与收缩前的静止帧，0 表示不留停顿、直接接下一段 */
const BRIDGE_HOLD_MS = 0
const SHRINK_HOLD_MS = 0
const IN_MS = 140

/** 合并阶段时长按位移量取：走得越远给得越久，返回区间 [handoff, max] */
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
const CONTENT_FADE_MS = 300

/** 卡片基本落位之后才浮出文字：延迟各自的形变收尾时刻 */
function contentDelayFor(kind: TransitionKind) {
  /* About ↔ Github 只换内容、卡片不动，保持即时淡入 */
  if (kind === 'content') return 0
  if (kind === 'collect-split') return 360
  if (kind === 'collect-shrink') return 380
  if (kind === 'main') return 400
  return 560
}

/**
 * Main 的标题不是玻璃卡，没法参与卡片形变，
 * 所以复制一份 fixed 定位的副本留在原位继续淡出（真实标题立刻隐藏）。
 * 副本由 CSS 的 title-ghost-out 动画收尾，760ms 后移除。
 */
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

/**
 * 合并后再分裂时的桥接玻璃：一块铺在合并矩形上的空玻璃，
 * 用来盖住目标碎片之间的缝，让「先并成一块、再裂开」在视觉上连续。
 */
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

/** 求一组矩形的并集外框，作为合并阶段的目标位置 */
function unionRect(rects: CardRect[]): CardRect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

/**
 * 把一块矩形按目标卡片数量切成首尾相接的碎片，比例与内容页的 12 栅格一致：
 * 三张卡 → 上排 4/8 两列 + 下排通栏；两张卡 → 左右 4/8。
 * 碎片互不重叠是关键：透明玻璃叠在一起会明显发白。
 */
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

/** 按起止路径挑过渡形态；窄屏没有足够空间做卡片形变，统一退回 normal */
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

/**
 * normal 过渡里目标页卡片更少时，多出来的旧卡没有对应目标，
 * 直接标记退场，避免它们停在原地。特殊过渡由形变逻辑接管，不做标记。
 */
function markExitCards(cards: HTMLElement[], kind: TransitionKind, to: string) {
  cards.forEach((el) => el.classList.remove('is-card-exit'))
  if (kind !== 'normal') return

  const targetCount = CARD_COUNTS[to] ?? cards.length
  cards.forEach((el, i) => {
    if (i >= targetCount) el.classList.add('is-card-exit')
  })
}

export function App() {
  //  所有卡片（data-card）都接上液态玻璃：路由切换后新冒出来的会自动补挂
  useGlassCards()

  /** 地址栏当前的路径（点击后立即更新，用于顶栏高亮） */
  const [path, setPath] = useState(readPath)
  /** 当前实际渲染的页面路径（过渡到 morph 阶段才更新） */
  const [shownPath, setShownPath] = useState(path)
  const [phase, setPhase] = useState<Phase>('idle')
  /** 首次加载不播放跨页过渡，只播放入场动画 */
  const [hasNavigated, setHasNavigated] = useState(false)
  /** 首页底部那层渐变遮罩，只在 Main 显示 */
  const [scrimVisible, setScrimVisible] = useState(path === '/')

  const pathRef = useRef(path)
  pathRef.current = path
  const shownPathRef = useRef(shownPath)
  shownPathRef.current = shownPath
  const navigateRef = useRef<(to: string, push?: boolean) => void>(() => {})
  /** 一次只跑一个过渡；false 才允许开启新的 */
  const busyRef = useRef(false)
  /** 过渡中又点了导航：记下来，等这一轮结束立刻接着跑 */
  const pendingRef = useRef<string | null>(null)
  const oldRectsRef = useRef<CardRect[]>([])
  const collectUnionRef = useRef<CardRect | null>(null)
  const bridgeRef = useRef<HTMLElement | null>(null)
  const kindRef = useRef<TransitionKind>('normal')

  /** 提交新路径：切换渲染的页面、把地址和滚动位置一起归位 */
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

  /** 跑一次完整的换页过渡 */
  const run = (to: string) => {
    busyRef.current = true
    document.querySelectorAll('.home-title-ghost').forEach((el) => el.remove())
    removeBridge()

    // 系统里关掉了动画：直接换页，不进入过渡状态机
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit(to)
      setPhase('idle')
      busyRef.current = false
      return
    }

    const from = shownPathRef.current
    // 离开 Main 时先收掉底部遮罩，避免它跟着页面一起被缩进卡片
    if (from === '/') setScrimVisible(false)

    const oldCards = Array.from(
      document.querySelectorAll<HTMLElement>('.page-view [data-card]'),
    )
    const oldRects = oldCards.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    oldRectsRef.current = oldRects

    // 先按「当前目标」预判形态；若过渡中又来了新目标，会在下面按最终目标重判
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
      const outFade = `${Math.max(40, collectOut - 30)}ms`
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
      // 过渡期间如果又点了别的页面，以最后一个目标为准
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
          }, 280)
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

          // 排队的目标与当前页不同才接着跑
          const next = pendingRef.current
          pendingRef.current = null
          if (next && next !== pathRef.current) run(next)
        }, IN_MS)
      }, morphPhaseMs)
    }, kind === 'collect-split' || kind === 'collect-shrink'
      ? collectOut
      : kind === 'main'
        ? MAIN_OUT_MS
        : OUT_MS)
  }

  /* 新页已经挂载（morph 阶段）：把每张新卡瞬移到它的「起点矩形」，
   * 下一帧放开过渡，让浏览器从起点补间到卡片自己的 layout 位置。 */
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

      // 只换内容：卡片本身不动，清掉可能残留的形变样式即可
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
        delay = '0ms'
      } else if (collectSplit) {
        source = collectPieces[i]
        delay = `${BRIDGE_HOLD_MS}ms`
      } else if (collectShrink) {
        source = union!
        delay = `${SHRINK_HOLD_MS}ms`
      } else {
        // normal：目标卡与旧卡按序号一一对应
        source = old[i]
      }

      if (source) {
        // 反向求逆变换：把卡片从 source 矩形搬到自己的位置
        const sx = source.w / r.width
        const sy = source.h / r.height
        const dx = source.x - r.x
        const dy = source.y - r.y
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`
      } else {
        // 没有对应的旧卡（目标页卡片更多）：从下方轻微上浮登场
        el.style.transform = 'translate3d(0, 36px, 0) scale(0.94)'
      }

      el.style.setProperty('--card-delay', delay)
    })

    // 两帧：第一帧让上面写入的起点样式生效并被绘制，第二帧再清掉 transform
    // 触发过渡。合并到一帧里浏览器会把首末状态视作同一帧，动画不播。
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

  /* 回到 idle：把过渡期间写在卡片上的内联样式全部清掉，
   * 否则会影响下一次过渡，也会污染正常状态下的卡片布局。 */
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
    // 已在目标页：不重复换页，滚回顶部当作反馈
    if (to === pathRef.current && !busyRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // 过渡进行中：只记下目标，等这一轮结束后由 run 接着跑
    if (busyRef.current) {
      if (push) window.history.pushState(null, '', to)
      pendingRef.current = to
      return
    }

    if (push) window.history.pushState(null, '', to)
    run(to)
  }

  // popstate 里读到的 navigate 可能已经过期，统一走 ref
  navigateRef.current = navigate

  // 浏览器前进 / 后退：不再 push，只按新路径重放过渡
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

  /* 过渡形态同时是 CSS 的钩子：App.css 按这些类名决定每类过渡怎么演 */
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
      {/* 首页底部的渐变遮罩：换页时由 scrimVisible 控制进出 */}
      <div
        className={`home-scrim${scrimVisible ? ' is-visible' : ''}`}
        aria-hidden="true"
      />
      <SiteHeader path={path} onNavigate={navigate} />
      <div className={viewClass}>{page}</div>
    </>
  )
}
