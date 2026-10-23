/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  三段式：左侧一枚独立悬浮的圆形头像 + 中间一枚居中胶囊 + 右侧的拨动开关。
 *  胶囊内左端是连笔手写体的署名，右侧是站名与副标题（两行，位置固定）。
 *  页面下滚后只折叠署名，Shizuku / 个人主页 两行的相对位置始终不变。
 *
 *  打开搜索时，顶栏自己变成搜索框：
 *  签名淡出、输入框浮现，左侧头像溶进顶栏，
 *  右侧那枚搜索钮的放大镜图标一路向左飞进胶囊里。
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'
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

  const iconRef = useRef<SVGSVGElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setSearching(false)
    setQuery('')
  }, [])

  const open = useCallback(() => {
    // 先量好放大镜图标要飞多远：胶囊里输入框左侧那个落点
    const from = iconRef.current?.getBoundingClientRect()
    const to = slotRef.current?.getBoundingClientRect()
    if (from && to && iconRef.current) {
      iconRef.current.style.setProperty(
        '--fly-x',
        `${to.left + to.width / 2 - (from.left + from.width / 2)}px`,
      )
      iconRef.current.style.setProperty(
        '--fly-y',
        `${to.top + to.height / 2 - (from.top + from.height / 2)}px`,
      )
    }
    setSearching(true)
    // 等输入框真的在页面上了再聚焦
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [])

  // ⌘K / Ctrl+K 开，Esc 关
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      } else if (e.key === 'Escape' && searching) {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, searching])

  return (
    <div
      className={`site-header-wrap${collapsed ? ' is-collapsed' : ''}`}
      data-search={searching}
    >
      {/* 左上角：圆形登录坞（绝对定位，不参与居中布局） */}
      <AuthDock />

      {/* 独立悬浮的圆形头像，后面垫一枚磨砂玻璃圆 */}
      <span className="site-header__avatar">
        <span className="site-header__avatar-halo" aria-hidden="true" />
        <img src={site.avatar} alt="" width={54} height={54} />
      </span>

      <header className="site-header glass">
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
      <SearchButton ref={iconRef} searching={searching} onOpen={open} />

      {/* 打开时的背景模糊遮罩 + 从胶囊底下拉出来的结果面板 */}
      {searching && (
        <>
          <div className="search-backdrop" onMouseDown={close} role="presentation" />
          <SearchPanel query={query} onClose={close} />
        </>
      )}
    </div>
  )
}
