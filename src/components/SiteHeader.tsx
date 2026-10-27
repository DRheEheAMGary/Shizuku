/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  三段式：左侧独立悬浮的圆形头像（左上角另挂登录坞）、中间居中胶囊、
 *  右侧工具组（搜索 / 明暗 / 主题色）。
 *  胶囊左端是连笔署名，右侧是站名；滚动或窄屏时把「细线 + 站名」折起，署名保留。
 *
 *  打开搜索时顶栏自己变成搜索框：署名淡出、输入框浮现，头像原地淡出，
 *  放大镜图标飞进胶囊左端的槽位，胶囊同时撑开，
 *  横跨头像左缘到搜索钮右缘之间的整段。
 * ========================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { profile, site } from '@/content/site'
import { AuthDock } from './AuthDock'
import { AccentPicker } from './AccentPicker'
import { SearchButton } from './SearchButton'
import { SearchPanel } from './SearchPanel'
import { ThemeSwitch } from './ThemeSwitch'
import { useNavDrag } from '@/hooks/useNavDrag'
import { useRefraction } from '@/hooks/useRefraction'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

/** 搜索框里的占位文字：逐字上浮，所以得自己渲染，不能用原生 placeholder */
const PLACEHOLDER = '搜索博客与文档…'

const NAV_ITEMS = [
  { href: '/', label: 'Main' },
  { href: '/about', label: 'About' },
  { href: '/github', label: 'Github' },
  { href: '/contact', label: 'Contact' },
] as const

interface SiteHeaderProps {
  path: string
  onNavigate: (to: string) => void
}

export function SiteHeader({ path, onNavigate }: SiteHeaderProps) {
  const collapsed = useScrollCollapse()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  // 搜索状态的同步镜像：ref 不受闭包快照影响，异步回调里读到的是最新值
  const searchingRef = useRef(false)
  searchingRef.current = searching

  const wrapRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<SVGSVGElement>(null)
  const pillRef = useRef<HTMLElement>(null)
  //  顶栏胶囊的液态玻璃折射（只在 Chromium 生效，其余浏览器保持纯模糊）
  useRefraction(pillRef)
  //  头像那枚磨砂圆也一起做折射（同一套滤镜，尺寸不同各生成一份）
  const haloRef = useRef<HTMLSpanElement>(null)
  useRefraction(haloRef)
  const avatarRef = useRef<HTMLSpanElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 图标相对按钮原位的位移，每次打开时按最新基准重算
  const flyRef = useRef({ x: 0, y: 0 })
  // 量好的基准位置：落点槽位、图标当前位置
  const baseRef = useRef({ slotOffset: 0, slotW: 16, avatarLeft: 0, pillTop: 0, pillH: 0, iconX: 0, iconY: 0 })
  const navRef = useRef<HTMLElement>(null)
  /*  点击时先把滑块挪到目标上，不等路由提交并重渲染 —— 否则会晚一拍才动 */
  const [hopeful, setHopeful] = useState<string | null>(null)
  const activeHref = hopeful ?? path
  const sliderRef = useRef<HTMLSpanElement>(null)

  const measureRef = useRef<() => void>(() => {})

  /*  导航激活态：一枚半透明的主题色滑块，在四个链接之间平移。
   *  位置量的是链接相对 .site-nav 的 offset —— 所以 .site-nav 必须是定位父级。
   *  animate=false 用于首次绘制和窗口尺寸变化：直接归位，不滑。 */
  const placeSlider = useCallback((animate: boolean) => {
    const nav = navRef.current
    const slider = sliderRef.current
    if (!nav || !slider) return

    const active = nav.querySelector<HTMLElement>('.site-nav__link.is-active')
    if (!active) {
      slider.style.opacity = '0'
      return
    }

    if (!animate) slider.classList.add('is-instant')
    slider.style.setProperty('--nav-x', `${active.offsetLeft}px`)
    slider.style.setProperty('--nav-w', `${active.offsetWidth}px`)
    slider.style.opacity = '1'
    if (!animate) {
      // 先让这一帧按新位置渲染，再打开过渡
      void slider.offsetWidth
      requestAnimationFrame(() => slider.classList.remove('is-instant'))
    }
  }, [])

  /*  滑块可以拖着走：松手落到最近一项并切过去（参照 glisse 的 TabBar） */
  const selectByDrag = useCallback(
    (href: string) => {
      if (!href) return
      setHopeful(href)
      onNavigate(href)
    },
    [onNavigate],
  )
  const swallowClick = useNavDrag({ navRef, sliderRef, onSelect: selectByDrag })

  const close = useCallback(() => {
    setSearching(false)
    setQuery('')
  }, [])

  // 打开搜索；测量由调用方在打开前完成（此时布局还是收起态，量得准）
  const open = useCallback(() => {
    setSearching(true)
  }, [])

  /*  开 / 关以 DOM 上的 data-search 为准，不用 state。
   *
   *  同一次交互里回调若被重复触发（事件合成或冒泡），读 state 时两次都可能
   *  拿到旧值，导致「开一次又关一次」，合并渲染后等于没反应；
   *  读 DOM 属性则两次读到同一个值，操作天然幂等。
   *
   *  也不用计数器：背景遮罩、结果条目、Esc、⌘K 都能关闭搜索，
   *  计数未必同步，奇偶一旦错位就会出现「关掉之后要点两下才能再打开」。 */
  const toggle = useCallback(() => {
    const isOpen = wrapRef.current?.dataset.search === 'true'
    if (isOpen) {
      close()
    } else {
      measureRef.current() // 开之前量：这时布局是稳的
      setSearching(true)
    }
  }, [close])

  /*  量出四组几何，全部在收起态下取得，量完写进 CSS 变量：
   *    · --pill-w  胶囊的自然宽度（由内容推算，见下）
   *    · --field-w / --field-ml / --field-mr
   *                撑开后的宽度与左右外边距：以胶囊原中心为基准向两边等量扩展，
   *                左缘对齐头像左缘、右缘对齐搜索钮右缘
   *    · --field-left  结果面板的左缘（相对容器边距盒）
   *    · baseRef   放大镜的落点槽位与图标当前位置
   *
   *  只有「开着」的时候才把胶囊临时还原成收起态尺寸再量：那时胶囊是撑开的，
   *  直接量中心和外边距基准全是错的。还原与恢复都在同一个 JS 任务里同步完成，
   *  浏览器还没绘制，不会闪。
   *
   *  收起态一律不动胶囊：这里改样式会污染紧接着的展开过渡，把动画吃掉。
   *  收起时需要的自然宽度改用内容推算。 */
  const measure = useCallback(() => {
    const wrap = wrapRef.current
    const icon = iconRef.current
    const pill = pillRef.current
    const avatar = avatarRef.current
    const slot = slotRef.current
    if (!wrap || !icon || !pill || !avatar || !slot) return

    const opened = wrap.dataset.search === 'true'
    const savedCss = pill.style.cssText
    if (opened) {
      // 过渡也临时关掉，否则同步读到的是补间中的中间值
      pill.style.transition = 'none'
      pill.style.width = 'fit-content'
      pill.style.marginLeft = '0px'
      pill.style.marginRight = '0px'
    }

    const wrapRect = wrap.getBoundingClientRect()
    const pillRect = pill.getBoundingClientRect()
    const avatarRect = avatar.getBoundingClientRect()
    const slotRect = slot.getBoundingClientRect()
    const iconRect = icon.getBoundingClientRect()
    /*  按钮也要在「还原成收起态」的时候读：它是胶囊后面的 flex 项，
     *  胶囊一撑开就被推向右边。这一行如果写在恢复样式之后，
     *  量到的是撑开后的位置 —— 开着缩放时 --field-w 会一次比一次大。 */
    const btnRect = icon.closest('.search-btn')!.getBoundingClientRect()

    if (opened) pill.style.cssText = savedCss

    /*  撑开：以胶囊原来的中心为基准，向两边等量扩展，
     *  宽度取「头像左缘 ↔ 搜索钮右缘」那么宽。
     *  头像和按钮都留在原地不动，只是被扩开的玻璃盖过去
     *  （它们各自淡出，但位置一点没变）。
     *  左右外边距取一样的负值，扩展才是对称的；
     *  外边距的总和又跟原来的相等，整组的宽度不变，居中不跑。 */
    const fieldW = btnRect.right - avatarRect.left
    const center = (pillRect.left + pillRect.right) / 2
    const half = fieldW / 2
    /*  收起时的宽度：不能读胶囊自己的宽度 —— 那正是 --pill-w 渲染出来的值，
     *  会自我锁定（首帧手写体没加载时量到偏窄，之后永远纠正不过来）。
     *  改用内容推算：签名宽 + 目标 gap + 站名块自然宽，再加内层内边距与边框。
     *  这样收起态完全不用碰胶囊。 */
    const brand = pill.querySelector('.brand') as HTMLElement | null
    const nav = pill.querySelector('.site-nav') as HTMLElement | null
    const inner = pill.firstElementChild as HTMLElement | null
    let naturalW = pillRect.width
    if (brand && inner) {
      const ics = getComputedStyle(inner)
      const padX = (parseFloat(ics.paddingLeft) || 0) + (parseFloat(ics.paddingRight) || 0)
      const borX = (parseFloat(ics.borderLeftWidth) || 0) + (parseFloat(ics.borderRightWidth) || 0)
      const gap = parseFloat(ics.columnGap) || 0
      const navInFlow = nav ? getComputedStyle(nav).position !== 'absolute' : false

      /*  这里不能读 .brand 的 getBoundingClientRect：
       *  收缩/展开的瞬间，brand 还在 420ms 的过渡中间，
       *  量到的是旧宽度 —— 收缩时会留出一大截空位，展开时又会溢出。
       *  直接按目标状态算：签名宽 + 目标 gap + 站名块的自然宽。 */
      const sig = brand.querySelector('.brand__sig') as HTMLElement | null
      const tail = brand.querySelector('.brand__tail-inner') as HTMLElement | null
      const tailName = brand.querySelector('.brand__name') as HTMLElement | null
      const tailDivider = brand.querySelector('.brand__divider') as HTMLElement | null
      const brandGap = parseFloat(getComputedStyle(brand).columnGap) || 0
      const collapsed =
        wrap.classList.contains('is-collapsed') ||
        window.matchMedia('(max-width: 720px)').matches
      const sigW = sig ? sig.getBoundingClientRect().width : brand.getBoundingClientRect().width
      /*  不用 tail.scrollWidth：站名块被 0fr 裁切时它可能读到裁后的值。
       *  细线 + 内部 gap + 文字宽度相加才是稳定的自然宽度。 */
      const tailGap = tail ? parseFloat(getComputedStyle(tail).columnGap) || 0 : 0
      const tailW = tailName
        ? tailName.getBoundingClientRect().width +
          (tailDivider ? tailDivider.getBoundingClientRect().width : 0) +
          tailGap
        : 0
      const brandW = sigW + (collapsed ? 0 : brandGap + tailW)

      naturalW =
        brandW + (nav && navInFlow ? nav.getBoundingClientRect().width + gap : 0) + padX + borX
    }
    wrap.style.setProperty('--pill-w', `${naturalW}px`)
    wrap.style.setProperty('--field-w', `${fieldW}px`)
    wrap.style.setProperty('--field-ml', `${center - half - pillRect.left}px`)
    wrap.style.setProperty('--field-mr', `${center + half - (pillRect.left + fieldW)}px`)
    /*  结果面板的位置：不能用「容器居中」，那会跟展开后的胶囊差几像素
     *  （胶囊以原中心为基准，容器居中的是视口中心）。直接记展开后的左缘，
     *  相对容器边距盒，面板就跟胶囊严丝合缝。 */
    wrap.style.setProperty('--field-left', `${center - half - wrapRect.left}px`)

    // 落点的基准：胶囊左内缘的槽位
    baseRef.current = {
      slotOffset: slotRect.left - pillRect.left,
      slotW: slotRect.width,
      avatarLeft: avatarRect.left,
      pillTop: pillRect.top,
      pillH: pillRect.height,
      iconX: iconRect.left + iconRect.width / 2,
      iconY: iconRect.top + iconRect.height / 2,
    }
  }, [])

  measureRef.current = measure

  /*  打开 / 收起：图标飞过去 / 飞回来 */
  useLayoutEffect(() => {
    const icon = iconRef.current
    if (!icon) return
    if (searching) {
      // 开着：图标落在顶栏左侧的槽位上（固定落点）
      const base = baseRef.current
      const targetX = base.avatarLeft + base.slotOffset + base.slotW / 2
      const targetY = base.pillTop + base.pillH / 2
      flyRef.current = { x: targetX - base.iconX, y: targetY - base.iconY }
      icon.style.setProperty('--fly-x', `${flyRef.current.x}px`)
      icon.style.setProperty('--fly-y', `${flyRef.current.y}px`)
      // 等输入框真的在页面上了再聚焦
      window.setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      /*  回来不做动画：先把过渡关掉，图标瞬间落回按钮原位，
       *  下一帧再把过渡还回去 —— 只废掉「飞回来」，飞出去照旧。 */
      icon.style.transition = 'none'
      icon.style.setProperty('--fly-x', '0px')
      icon.style.setProperty('--fly-y', '0px')
      requestAnimationFrame(() => {
        icon.style.transition = ''
      })
      /*  这里刻意不测量：收起瞬间胶囊正在回缩，measure() 会关掉 transition
       *  并把宽度直接按到收起值，回缩动画会消失。
       *  基准由「点开之前」和视口变化时的测量保证，已经够用。 */
    }
  }, [searching])

  /*  收紧状态一变，胶囊宽度就变了（折起了「细线 + 站名」），
   *  基准要跟着更新，否则搜索展开时会按旧宽度算外边距。 */
  useEffect(() => {
    measureRef.current()
  }, [collapsed])

  /*  乐观值到期：路由已经跟上，清掉即可 */
  useEffect(() => {
    if (hopeful && hopeful === path) setHopeful(null)
  }, [path, hopeful])

  /*  目标变化：滑块滑过去 */
  useLayoutEffect(() => {
    placeSlider(true)
  }, [activeHref, placeSlider])

  /*  首次绘制 / 字体就绪 / 尺寸变化：直接归位，不滑 */
  useEffect(() => {
    placeSlider(false)
    document.fonts?.ready.then(() => placeSlider(false)).catch(() => {})
    const onResize = () => placeSlider(false)
    window.addEventListener('resize', onResize)
    const nav = navRef.current
    const ro = nav ? new ResizeObserver(() => placeSlider(false)) : null
    if (nav && ro) ro.observe(nav)
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [placeSlider])

  /*  首帧、字体就绪、窗口尺寸变化后都要重新量。
   *  手写字体是异步加载的，首帧量到的胶囊宽度是回退字体的，
   *  差个几像素，撑开的边缘就会对不齐。 */
  useEffect(() => {
    const remeasure = () => measure()
    remeasure()
    document.fonts?.ready.then(remeasure).catch(() => {})

    const onResize = () => remeasure()
    window.addEventListener('resize', onResize)

    /*  这里不挂 ResizeObserver：胶囊在展开/收起的过渡里会不停改变尺寸，
     *  观察者会在动画中途触发，量到的是动画中间值（宽、外边距全是歪的）。
     *  真正需要重新量的时机：首帧、字体到位、窗口变化、以及每次点开之前。 */

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [measure])

  // ⌘K / Ctrl+K 开，Esc 关
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!searching) {
          measureRef.current()
          open()
        }
      } else if (e.key === 'Escape' && searching) {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, open, searching])

  return (
    <div
      ref={wrapRef}
      className={`site-header-wrap${collapsed ? ' is-collapsed' : ''}`}
      data-search={searching}
    >
      {/* 左上角：圆形登录坞（绝对定位，不参与居中布局） */}
      <AuthDock />

      {/* 左侧透明占位：右侧工具组比左侧重，补一块 88px 的等宽占位，
          让头像与胶囊停在原来的居中位置（窄屏由 CSS 撤掉） */}
      <span className="site-header__lead" aria-hidden="true" />

      {/* 独立悬浮的圆形头像，后面垫一枚磨砂玻璃圆 */}
      <span className="site-header__avatar" ref={avatarRef}>
        <span className="site-header__avatar-halo" aria-hidden="true" ref={haloRef} />
        <img src={site.avatar} alt="" width={54} height={54} />
      </span>

      <header className="site-header glass" ref={pillRef}>
        <div className="site-header__inner">
          <a
            href="/"
            className="brand"
            aria-label="回到首页"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              onNavigate('/')
            }}
          >
            {/* 署名：连笔手写体，主题色，始终保留（收紧时折的是右边那道线加站名） */}
            <span className="brand__sig">
              <span>{profile.signature}</span>
            </span>

            {/* 站名：跟署名之间隔一道细线；滚动或窄屏收紧时整块折起 */}
            <span className="brand__tail">
              <span className="brand__tail-inner">
                <span className="brand__divider" aria-hidden="true" />
                <span className="brand__name">Shizuku</span>
              </span>
            </span>
          </a>

          <nav className="site-nav" aria-label="主导航" ref={navRef}>
            <span className="site-nav__slider" aria-hidden="true" ref={sliderRef} />
            {NAV_ITEMS.map((item) => {
              const active = activeHref === item.href
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`site-nav__link${active ? ' is-active' : ''}`}
                  //  允许按住拖动滑块，所以要关掉 <a> 的原生拖拽
                  draggable={false}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                    //  刚拖完滑块的那一下点击不算数，否则会又跳一次
                    if (swallowClick()) {
                      e.preventDefault()
                      return
                    }
                    e.preventDefault()
                    setHopeful(item.href)
                    onNavigate(item.href)
                  }}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* 搜索时顶栏自己变成输入框：签名淡出，这里浮现 */}
          <div className="site-header__search">
            {/* 放大镜图标的落点（图标飞过来就停在这儿） */}
            <span className="site-header__search-slot" ref={slotRef} aria-hidden="true" />
            <input
              ref={inputRef}
              className="site-header__search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-label="搜索博客与文档"
              tabIndex={searching ? 0 : -1}
            />

            {/* 占位文字：一个字一个 i，逐个上浮登场 */}
            {!query && (
              <span className="site-header__search-ph" aria-hidden="true">
                {[...PLACEHOLDER].map((ch, i) => (
                  <i key={i} style={{ '--i': i } as React.CSSProperties}>
                    {ch}
                  </i>
                ))}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 右侧透明平衡块：微调两侧配重，中间的头像 + 胶囊保持居中 */}
      <span className="site-header__balance" aria-hidden="true" />

      {/* 右侧工具组：搜索钮 → 明暗钮 → 主题色板 */}
      <SearchButton ref={iconRef} searching={searching} onToggle={toggle} />
      <ThemeSwitch />
      <AccentPicker />

      {/* 背景的模糊遮罩（一直在，只是开着才不透明、才拦得住鼠标） */}
      <div className="search-backdrop" onMouseDown={close} role="presentation" />

      {/* 从胶囊底下拉出来的结果面板 */}
      {searching && <SearchPanel query={query} onClose={close} />}
    </div>
  )
}
