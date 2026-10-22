/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  固定在顶部，磨砂玻璃。左侧是站名（雫），中间是导航，右侧是主题切换。
 *  导航项带片假名副标，悬停时淡入。
 * ========================================================================== */

import { NavLink } from 'react-router'
import { nav } from '@/content/site'
import { Icon } from './Icon'
import { useTheme } from '@/hooks/useTheme'
import './SiteHeader.css'

export function SiteHeader() {
  const { mode, resolved, cycle } = useTheme()

  const themeLabel =
    mode === 'auto' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'

  return (
    <header className="site-header glass">
      <div className="site-header__inner">
        <NavLink to="/" className="brand" aria-label="返回首页">
          <span className="brand__mark" lang="ja">
            雫
          </span>
          <span className="brand__text">
            <span className="brand__name">Shizuku</span>
            <span className="brand__sub">{nav[0].label}</span>
          </span>
        </NavLink>

        <nav className="site-nav" aria-label="主导航">
          {nav.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'home' ? '/' : `/${item.id}`}
              className={({ isActive }) =>
                `site-nav__item${isActive ? ' is-active' : ''}`
              }
            >
              <span className="site-nav__label">{item.label}</span>
              <span className="site-nav__kana" lang="ja">
                {item.kana}
              </span>
            </NavLink>
          ))}
        </nav>

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
