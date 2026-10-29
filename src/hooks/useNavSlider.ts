/* ============================================================================
 *  Shizuku · 导航滑块（弹簧驱动 + 可拖动）
 * ----------------------------------------------------------------------------
 *  顶栏那枚激活态滑块由弹簧驱动，可以拿在手里拖着走，松手弹回最近的一项并切页。
 *  交互参照 glisse 的 TabBar（MIT，https://github.com/0kzh/glisse）：
 *    · 按下不立刻进入拖动 —— 先等指针挪过 6px，免得和「点一下跳页」抢；
 *    · 拖动时滑块跟着指针走，同时被"拎起来"（缩放 + 阴影）；
 *    · 松手用弹簧回弹到最近一项，然后触发这次导航；
 *    · 拖动过程中吞掉随之而来的 click。
 *
 *  三个独立的弹簧：x（横向位置）、w（宽度）、lift（抬起 0→1）。
 *  拖动时刚度调高（跟手），松手换回软一点的一档（有回弹）。
 * ========================================================================== */

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { createSpring } from '@/lib/spring'

/** 超过这个位移才算拖动，否则按点击处理 */
const SLOP = 6

/** 松手归位：略欠阻尼，尾巴上有一点点回弹 */
const REST_X: [number, number] = [760, 46]
const REST_W: [number, number] = [700, 48]
/** 拖动跟手：刚度拉高，几乎贴着指针 */
const DRAG_X: [number, number] = [1800, 88]
const DRAG_W: [number, number] = [1200, 76]
/** 抬起 / 放下 */
const LIFT: [number, number] = [520, 28]
/** 抬起时放大多少 */
const LIFT_SCALE = 0.06

/** 滑块左右各比文字区宽出这么多：不动导航布局，只是滑块自己探出去一点 */
const SLIDER_PAD = 5

interface Options {
  navRef: RefObject<HTMLElement | null>
  sliderRef: RefObject<HTMLElement | null>
  /** 当前激活的路由 */
  activeHref: string
  /** 拖动松手后要切到哪一项 */
  onSelect: (href: string) => void
}

interface Slot {
  left: number
  width: number
  center: number
  href: string
}

export function useNavSlider({ navRef, sliderRef, activeHref, onSelect }: Options) {
  /** 拖动刚结束时要吞掉一次 click */
  const swallow = useRef(false)
  /** 供外部（重排、字体就绪）触发重新对位 */
  const syncRef = useRef<(instant?: boolean) => void>(() => {})
  /*  回调放进 ref：否则父组件每次重渲染都会换掉 onSelect 身份，
   *  下面那个大 effect 就会重跑 —— 重跑的首件事是 sync(true)，
   *  滑块于是"瞬移"到目标位，弹簧根本来不及跑。 */
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  /*  同理：大 effect 只跑一次，里面读的 activeHref 必须是"最新的那个"，
   *  否则路由变了它还按挂载时的旧值对位。 */
  const activeRef = useRef(activeHref)
  activeRef.current = activeHref

  useEffect(() => {
    const nav = navRef.current
    const slider = sliderRef.current
    if (!nav || !slider) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const instant = () => reduced.matches

    const readSlots = (): Slot[] =>
      [...nav.querySelectorAll<HTMLAnchorElement>('.site-nav__link')].map((link) => ({
        left: link.offsetLeft,
        width: link.offsetWidth,
        center: link.offsetLeft + link.offsetWidth / 2,
        href: link.getAttribute('href') ?? '/',
      }))

    /* ---------- 三个弹簧共用一个绘制函数 ---------- */
    const state = { x: 0, w: 0, lift: 0 }
    const paint = () => {
      slider.style.transform = `translateX(${state.x}px)`
      slider.style.width = `${state.w}px`
      slider.style.scale = `${1 + LIFT_SCALE * state.lift}`
    }

    const x = createSpring(0, REST_X[0], REST_X[1], (value) => {
      state.x = value
      paint()
    })
    const w = createSpring(0, REST_W[0], REST_W[1], (value) => {
      state.w = value
      paint()
    })
    const lift = createSpring(0, LIFT[0], LIFT[1], (value) => {
      state.lift = value
      paint()
    })

    /** 把滑块对到当前激活项（首次绘制、路由变化、窗口尺寸变化都走这里） */
    const sync = (jump = false) => {
      const slots = readSlots()
      const active = slots.find((slot) => slot.href === activeRef.current) ?? slots[0]
      if (!active) {
        slider.style.opacity = '0'
        return
      }
      slider.style.opacity = '1'
      const now = jump || instant()
      x.set(active.left - SLIDER_PAD, now)
      w.set(active.width + SLIDER_PAD * 2, now)
      lift.set(0, true)
    }
    syncRef.current = sync

    slider.classList.add('is-spring')
    sync(true)
    //  字体加载完宽度会变，得再对一次
    document.fonts?.ready.then(() => sync(true)).catch(() => {})

    /* ---------- 拖动 ---------- */
    let gesture: { id: number; startX: number; moved: boolean; slots: Slot[] } | null = null

    /** 指针位置 → 滑块的目标位置与宽度（宽度在相邻两项之间插值） */
    const track = (clientX: number, slots: Slot[]) => {
      const box = nav.getBoundingClientRect()
      const first = slots[0]!
      const last = slots[slots.length - 1]!
      const center = Math.min(last.center, Math.max(first.center, clientX - box.left))

      let i = 0
      while (i < slots.length - 2 && center > slots[i + 1]!.center) i++
      const a = slots[i]!
      const b = slots[i + 1] ?? a
      const span = b.center - a.center
      const t = span > 0 ? Math.min(1, Math.max(0, (center - a.center) / span)) : 0

      const width = a.width + (b.width - a.width) * t + SLIDER_PAD * 2
      x.set(center - width / 2)
      w.set(width)
    }

    const stop = () => {
      gesture = null
      nav.classList.remove('is-dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }

    /** 松手：吸附到最近一项 */
    const settle = (slots: Slot[], clientX: number) => {
      const box = nav.getBoundingClientRect()
      const at = clientX - box.left
      let best = slots[0]!
      for (const slot of slots) {
        if (Math.abs(slot.center - at) < Math.abs(best.center - at)) best = slot
      }
      x.tune(REST_X[0], REST_X[1])
      w.tune(REST_W[0], REST_W[1])
      x.set(best.left - SLIDER_PAD)
      w.set(best.width + SLIDER_PAD * 2)
      lift.set(0)
      return best
    }

    const onMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      if (!gesture.moved) {
        if (Math.abs(event.clientX - gesture.startX) < SLOP) return
        gesture.moved = true
        nav.classList.add('is-dragging')
        x.tune(DRAG_X[0], DRAG_X[1])
        w.tune(DRAG_W[0], DRAG_W[1])
        lift.set(1)
        try {
          nav.setPointerCapture(event.pointerId)
        } catch {
          /* Safari 偶尔拒绝，忽略 */
        }
      }
      track(event.clientX, gesture.slots)
    }

    const onUp = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const { moved, slots } = gesture
      if (!moved) {
        stop()
        return
      }
      const best = settle(slots, event.clientX)
      swallow.current = true
      window.setTimeout(() => {
        swallow.current = false
      }, 320)
      stop()
      selectRef.current(best.href)
    }

    /** 指针被系统打断（原生拖拽之类）：只收尾，不导航 */
    const onCancel = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      x.tune(REST_X[0], REST_X[1])
      w.tune(REST_W[0], REST_W[1])
      lift.set(0)
      stop()
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (!(event.target as HTMLElement).closest('.site-nav__link')) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      gesture = { id: event.pointerId, startX: event.clientX, moved: false, slots: readSlots() }
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    }

    //  <a> 默认可拖：一旦浏览器开始原生链接拖拽，指针事件会被取消，
    //  拖出来的是链接幽灵而不是滑块。直接在导航里禁掉。
    const onDragStart = (event: DragEvent) => event.preventDefault()

    const onResize = () => sync(true)
    const resizeObserver = new ResizeObserver(() => sync(true))
    resizeObserver.observe(nav)
    window.addEventListener('resize', onResize)

    nav.addEventListener('pointerdown', onDown)
    nav.addEventListener('dragstart', onDragStart)

    return () => {
      nav.removeEventListener('pointerdown', onDown)
      nav.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      x.stop()
      w.stop()
      lift.stop()
      slider.classList.remove('is-spring')
    }
  }, [navRef, sliderRef])

  /*  路由一变就对位：此时滑块一般已经停在松手的落点上，
   *  再同步一次只是保险（外部改路由、浏览器前进后退也覆盖到）。 */
  useEffect(() => {
    syncRef.current(false)
  }, [activeHref])

  const shouldSwallowClick = useCallback(() => {
    if (!swallow.current) return false
    swallow.current = false
    return true
  }, [])

  return { shouldSwallowClick }
}
