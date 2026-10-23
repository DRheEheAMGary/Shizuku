/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  三段式：左侧一枚独立悬浮的圆形头像 + 中间一枚居中胶囊 + 右侧的搜索钮。
 *  胶囊内左端是连笔手写体的署名，右侧是站名与副标题（两行，位置固定）。
 *  页面下滚后只折叠署名，Shizuku / 个人主页 两行的相对位置始终不变。
 *
 *  打开搜索时，顶栏自己变成搜索框：
 *  签名淡出、输入框浮现，左侧头像溶进顶栏，
 *  放大镜图标一路向左飞进胶囊，
 *  胶囊同时横向撑开，横跨头像左缘到搜索钮右缘之间的整段。
 * ========================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { profile, site } from '@/content/site'
import { AuthDock } from './AuthDock'
import { SearchButton } from './SearchButton'
import { SearchPanel } from './SearchPanel'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

/** 搜索框里的占位文字：逐字上浮，所以得自己渲染，不能用原生 placeholder */
const PLACEHOLDER = '搜索博客与文档…'

export function SiteHeader() {
  const collapsed = useScrollCollapse()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  // 异步回调（字体就绪、尺寸观察）里要用最新的状态，
  // 闭包里的 searching 可能是旧的
  const searchingRef = useRef(false)
  searchingRef.current = searching

  const wrapRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<SVGSVGElement>(null)
  const pillRef = useRef<HTMLElement>(null)
  const avatarRef = useRef<HTMLSpanElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 图标飞行量：开的时候现算（偏移要跟着点击次数走）
  const flyRef = useRef({ x: 0, y: 0 })
  // 量好的基准位置：落点槽位、图标当前位置
  const baseRef = useRef({ slotOffset: 0, slotW: 16, avatarLeft: 0, pillTop: 0, pillH: 0, iconX: 0, iconY: 0 })

  /*  点击次数：点开并关上算一轮。
   *  奇数次 = 开着，搜索栏是正常（撑开）的大小，图标落在顶栏左侧；
   *  偶数次 = 关着，搜索栏回到原先菜单的大小，图标落回右侧的按钮。
   *  落点是固定的：不随着点击次数往外跑。 */
  const clicksRef = useRef(0)
  const measureRef = useRef<() => void>(() => {})

  const close = useCallback(() => {
    setSearching(false)
    setQuery('')
  }, [])

  /*  任何一次开合都记一次数：奇偶始终跟开着/关着对得上 */
  const open = useCallback(() => {
    clicksRef.current += 1
    setSearching(true)
  }, [])

  const toggle = useCallback(() => {
    clicksRef.current += 1
    if (clicksRef.current % 2 === 1) {
      measureRef.current() // 开之前量：这时布局是稳的
      setSearching(true)
    } else {
      setSearching(false)
      setQuery('')
    }
  }, [])

  /*  量两件事（都在收起状态下量，量完存起来）：
   *    · 胶囊撑开后的宽度与左右外边距
   *      —— 左缘对齐头像左缘、右缘对齐搜索钮右缘，
   *         整组的总宽不变，居中关系就不会跑
   *    · 放大镜图标要飞多远（落到胶囊左内缘的槽位上）
   */
  const measure = useCallback(() => {
    const wrap = wrapRef.current
    const icon = iconRef.current
    const pill = pillRef.current
    const avatar = avatarRef.current
    const slot = slotRef.current
    if (!wrap || !icon || !pill || !avatar || !slot) return

    /*  要量的都是「收起态」的几何：胶囊的自然宽度、它原来的中心等等。
     *  所以每次都先把内联样式还原成收起态（width: fit-content、外边距归零），
     *  量完立刻清掉 —— 整个过程在同一个 JS 任务里同步完成，
     *  浏览器还没绘制，不会闪。
     *
     *  这一步不能只在「开着」的时候做：收起的那一刻胶囊还在过渡中途
     *  （宽度正从撑开的 403px 动画回 85px），那时量到的是中间值，
     *  会把 --pill-w 写坏，之后每开合一次就偏一点。 */
    const savedCss = pill.style.cssText
    /*  只在「开着」的时候强制还原：这时胶囊是撑开的，直接量到的是撑开态几何。
     *  收起态本来就是收起态，不用动它 —— 而且不能动：
     *  一在这里按回收起宽度，关闭时的回缩动画就没了。 */
    const opened = wrap.dataset.search === 'true'
    if (opened) {
      // 过渡也要临时关掉，否则同步读到的是补间中的中间值
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
    // 收起时的宽度也要写成具体长度，不然 fit-content → 长度值过渡不了
    wrap.style.setProperty('--pill-w', `${pillRect.width}px`)
    wrap.style.setProperty('--field-w', `${fieldW}px`)
    wrap.style.setProperty('--field-ml', `${center - half - pillRect.left}px`)
    wrap.style.setProperty('--field-mr', `${center + half - (pillRect.left + fieldW)}px`)
    /*  结果卡片的位置：不能用「容器居中」，那会跟展开后的胶囊差几像素
     *  （胶囊以原中心为基准，容器居中的是视口中心）。直接记展开后的左缘，
     *  相对容器边距盒，卡片就跟胶囊严丝合缝。 */
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
      icon.style.setProperty('--fly-x', '0px')
      icon.style.setProperty('--fly-y', '0px')
      /*  这里刻意不测量。收起的那一刻胶囊正在回缩途中：measure() 会把
       *  transition 关掉、把宽度直接按到收起值，回缩动画就没了
       *  （实测关闭瞬间宽度从 415 直接跳到 278，没有任何中间帧）。
       *  基准由「点开之前」和「缩放时」两次测量保证，够了。 */
    }
  }, [searching])

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
        clicksRef.current += 1
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

      {/* 独立悬浮的圆形头像，后面垫一枚磨砂玻璃圆 */}
      <span className="site-header__avatar" ref={avatarRef}>
        <span className="site-header__avatar-halo" aria-hidden="true" />
        <img src={site.avatar} alt="" width={54} height={54} />
      </span>

      <header className="site-header glass" ref={pillRef}>
        <div className="site-header__inner">
          <a href="#top" className="brand" aria-label="回到首页">
            {/* 署名：连笔手写体，主题色，始终保留 */}
            <span className="brand__sig">
              <span>{profile.signature}</span>
            </span>

            {/* 站名与副标题：两行，位置固定不动；滚动时整块折起 */}
            <span className="brand__text">
              <span className="brand__text-inner">
                <span className="brand__name">Shizuku</span>
                <span className="brand__sub">{site.title}</span>
              </span>
            </span>
          </a>

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

      {/* 平衡块：左下角的坞和它是左右对称的一对占位。
          主题开关搬进坞里之后，中间这组会变窄、整体往右挪 37px；
          放一块与开关等宽的透明占位，头像才会停在原来的位置。 */}
      <span className="site-header__balance" aria-hidden="true" />

      {/* 顶栏右侧的搜索按钮：点开，顶栏自己变成搜索框 */}
      <SearchButton ref={iconRef} searching={searching} onToggle={toggle} />

      {/* 背景的模糊遮罩（一直在，只是开着才不透明、才拦得住鼠标） */}
      <div className="search-backdrop" onMouseDown={close} role="presentation" />

      {/* 从胶囊底下拉出来的结果面板 */}
      {searching && <SearchPanel query={query} onClose={close} />}
    </div>
  )
}
