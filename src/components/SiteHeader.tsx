/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  一枚居中的胶囊。初始展示完整内容；页面下滚后收成更小的胶囊，
 *  隐去站名字样与假名副标，让出视觉空间。
 * ========================================================================== */

import { NavLink } from 'react-router'
import { nav, site } from '@/content/site'
import { Icon } from './Icon'
import { useTheme } from '@/hooks/useTheme'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

export function SiteHeader() {
  const { mode, resolved, cycle } = useTheme()
  const collapsed = useScrollCollapse()

  const themeLabel = mode === 'auto' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'

  return (
    <header className={`site-header glass${collapsed ? ' is-collapsed' : ''}`}>
      <div className="site-header__inner">
        <NavLink to="/" className="brand" aria-label="返回首页">
          <span className="brand__mark" lang="ja">
            {site.mark}
          </span>
          <span className="brand__text">
            <span className="brand__name">Shizuku</span>
            <span className="brand__sub">{site.title}</span>
          </span>
        </NavLink>

        <span className="site-header__rule" aria-hidden="true" />

        <nav className="site-nav" aria-label="主导航">
          {nav.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'home' ? '/' : `/${item.id}`}
              className={({ isActive }) => `site-nav__item${isActive ? ' is-active' : ''}`}
            >
              <span className="site-nav__label">{item.label}</span>
              <span className="site-nav__kana" lang="ja">
                {item.kana}
              </span>
            </NavLink>
          ))}
        </nav>

        <span className="site-header__rule" aria-hidden="true" />

        <button
          type="button"
          className="theme-toggle"
          onClick={cycle}
          aria-label={`主题：${themeLabel}，点击切换`}
          title={themeLabel}
        >
          <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={16} />
        </button>
      </div>
    </header>
  )
}
