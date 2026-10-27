/* ============================================================================
 *  Shizuku · 导航滑块拖动
 * ----------------------------------------------------------------------------
 *  顶栏那枚激活态滑块可以拿在手里拖着走，松手落到最近的一项并切过去。
 *  交互参照 glisse 的 TabBar（MIT，https://github.com/0kzh/glisse）：
 *    · 按下不立刻进入拖动 —— 先等指针挪过 6px，免得和「点一下跳页」抢；
 *    · 拖动时滑块跟着指针走，并抬起来一点（缩放 + 阴影），像被拎起来的玻璃；
 *    · 松手吸附到最近一项，然后触发这次导航；
 *    · 拖动过程中吞掉随之而来的 click，避免重复跳转。
 *
 *  为什么不照搬它那套弹簧：全站其它过渡都是 cubic-bezier，滑块松手用同一条
 *  缓动更统一；拖动期间则是逐帧直给（关掉过渡），手感更贴手。
 * ========================================================================== */

import { useCallback, useEffect, useRef, type RefObject } from 'react'

/** 超过这个位移才算拖动，否则按点击处理 */
const SLOP = 6

interface Options {
  navRef: RefObject<HTMLElement | null>
  sliderRef: RefObject<HTMLElement | null>
  /** 松手后切到这一项；href 为空表示不跳 */
  onSelect: (href: string) => void
}

interface Slot {
  left: number
  width: number
  center: number
  href: string
}

export function useNavDrag({ navRef, sliderRef, onSelect }: Options): () => boolean {
  /** 拖动刚结束时吞掉一次 click */
  const swallow = useRef(false)

  useEffect(() => {
    const nav = navRef.current
    const slider = sliderRef.current
    if (!nav || !slider) return

    let gesture: {
      id: number
      startX: number
      moved: boolean
      slots: Slot[]
    } | null = null

    const readSlots = (): Slot[] =>
      [...nav.querySelectorAll<HTMLAnchorElement>('.site-nav__link')].map((link) => ({
        left: link.offsetLeft,
        width: link.offsetWidth,
        center: link.offsetLeft + link.offsetWidth / 2,
        href: link.getAttribute('href') ?? '/',
      }))

    /** 把指针位置换算成滑块的 x / width：宽度在相邻两项之间插值 */
    const paint = (clientX: number, slots: Slot[]) => {
      const box = nav.getBoundingClientRect()
      const first = slots[0]!
      const last = slots[slots.length - 1]!
      const min = first.center
      const max = last.center
      const center = Math.min(max, Math.max(min, clientX - box.left))

      //  找到 center 落在哪两项之间，按比例插值宽度
      let i = 0
      while (i < slots.length - 2 && center > slots[i + 1]!.center) i++
      const a = slots[i]!
      const b = slots[i + 1] ?? a
      const span = b.center - a.center
      const t = span > 0 ? Math.min(1, Math.max(0, (center - a.center) / span)) : 0
      const width = a.width + (b.width - a.width) * t

      slider.style.transform = `translateX(${center - width / 2}px)`
      slider.style.width = `${width}px`
    }

    const stop = () => {
      gesture = null
      nav.classList.remove('is-dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    /** 松手：吸附到最近一项，并把内联样式交还给 CSS 变量做过过渡 */
    const settle = (slots: Slot[], clientX: number) => {
      const box = nav.getBoundingClientRect()
      const x = clientX - box.left
      let best = slots[0]!
      for (const slot of slots) {
        if (Math.abs(slot.center - x) < Math.abs(best.center - x)) best = slot
      }
      //  先让元素停在内联样式的当前位置上，再撤掉内联样式，
      //  否则清除 inline 的同一帧里会丢掉起点，过渡不会发生。
      const current = slider.style.transform
      const currentW = slider.style.width
      nav.classList.remove('is-dragging')
      slider.style.transform = current
      slider.style.width = currentW
      void slider.offsetWidth
      slider.style.removeProperty('transform')
      slider.style.removeProperty('width')
      slider.style.setProperty('--nav-x', `${best.left}px`)
      slider.style.setProperty('--nav-w', `${best.width}px`)
      return best
    }

    const onMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const dx = event.clientX - gesture.startX
      if (!gesture.moved) {
        if (Math.abs(dx) < SLOP) return
        gesture.moved = true
        nav.classList.add('is-dragging')
        try {
          nav.setPointerCapture(event.pointerId)
        } catch {
          /* Safari 上偶尔会拒绝，忽略即可 */
        }
      }
      paint(event.clientX, gesture.slots)
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
      //  下一轮事件循环再放开，确保这次 click 已经被吞掉
      window.setTimeout(() => {
        swallow.current = false
      }, 320)
      stop()
      onSelect(best.href)
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (!(event.target as HTMLElement).closest('.site-nav__link')) return
      //  键盘 / 修饰键走原生行为
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      gesture = { id: event.pointerId, startX: event.clientX, moved: false, slots: readSlots() }
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }

    nav.addEventListener('pointerdown', onDown)
    return () => {
      nav.removeEventListener('pointerdown', onDown)
      stop()
    }
  }, [navRef, sliderRef, onSelect])

  /** 给链接的 onClick 用：拖动刚结束 → 吞掉这次点击 */
  return useCallback(() => {
    if (!swallow.current) return false
    swallow.current = false
    return true
  }, [])
}
