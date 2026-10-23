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
   *  奇数次 = 开着，搜索栏是正常（撑开）的大小，图标偏在顶栏左侧；
   *  偶数次 = 关着，搜索栏回到原先菜单的大小，图标偏在右侧（按钮上）。
   *  每多点一次，图标开着时的偏移就更大一点。 */
  const clicksRef = useRef(0)
  const STEP = 16 // 每多一轮，图标多偏这么远
  const MAX_STEPS = 6
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

    const pillRect = pill.getBoundingClientRect()
    const avatarRect = avatar.getBoundingClientRect()
    const slotRect = slot.getBoundingClientRect()
    const iconRect = icon.getBoundingClientRect()

    // 按钮（连它那圈玻璃）在顶栏里的位置
    const btnRect = icon.closest('.search-btn')!.getBoundingClientRect()

    // 胶囊撑开后：从头像左缘一直铺到搜索钮右缘
    wrap.style.setProperty('--field-w', `${btnRect.right - avatarRect.left}px`)
    // 负外边距把胶囊拉到该在的位置，同时把右侧的东西原样拉回来
    wrap.style.setProperty('--field-ml', `${-(pillRect.left - avatarRect.left)}px`)
    wrap.style.setProperty('--field-mr', `${-(btnRect.right - pillRect.right)}px`)

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
      // 开着：图标落在顶栏左侧，越点越偏
      const base = baseRef.current
      const steps = Math.min(Math.floor((clicksRef.current - 1) / 2), MAX_STEPS)
      const offset = steps * STEP
      const targetX = base.avatarLeft + base.slotOffset + base.slotW / 2 - offset
      const targetY = base.pillTop + base.pillH / 2
      flyRef.current = { x: targetX - base.iconX, y: targetY - base.iconY }
      icon.style.setProperty('--fly-x', `${flyRef.current.x}px`)
      icon.style.setProperty('--fly-y', `${flyRef.current.y}px`)
      // 等输入框真的在页面上了再聚焦
      window.setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      icon.style.setProperty('--fly-x', '0px')
      icon.style.setProperty('--fly-y', '0px')
    }
  }, [searching])

  /*  首帧、字体就绪、窗口尺寸变化后都要重新量。
   *  手写字体是异步加载的，首帧量到的胶囊宽度是回退字体的，
   *  差个几像素，撑开的边缘就会对不齐。 */
  useEffect(() => {
    const remeasure = () => {
      // 只在收起状态下量：撑开后的尺寸是结果，不能拿来当基准
      if (!searchingRef.current) measure()
    }
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
              placeholder="搜索博客与文档…"
              spellCheck={false}
              autoComplete="off"
              aria-label="全域搜索"
              tabIndex={searching ? 0 : -1}
            />
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
