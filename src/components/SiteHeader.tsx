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
  // 图标飞行量：量一次，之后每次开合都用它
  const flyRef = useRef({ x: 0, y: 0 })

  const close = useCallback(() => {
    setSearching(false)
    setQuery('')
  }, [])

  const toggle = useCallback(() => {
    if (searching) close()
    else setSearching(true)
  }, [searching, close])

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

    // 飞行的落点：胶囊左内缘的槽位
    const slotOffset = slotRect.left - pillRect.left
    const targetX = avatarRect.left + slotOffset + slotRect.width / 2
    const targetY = pillRect.top + pillRect.height / 2
    flyRef.current = {
      x: targetX - (iconRect.left + iconRect.width / 2),
      y: targetY - (iconRect.top + iconRect.height / 2),
    }
  }, [])

  /*  打开 / 收起：图标飞过去 / 飞回来 */
  useLayoutEffect(() => {
    const icon = iconRef.current
    if (!icon) return
    if (searching) {
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

    // 胶囊尺寸变了（字体到位、窗口变化）就重量一次
    let ro: ResizeObserver | null = null
    if (pillRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(remeasure)
      ro.observe(pillRef.current)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [measure])

  // ⌘K / Ctrl+K 开，Esc 关
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
      } else if (e.key === 'Escape' && searching) {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, searching])

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
