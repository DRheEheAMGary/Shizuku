/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  结构：左侧一枚独立悬浮的圆形头像 + 一枚居中胶囊。
 *  胶囊内左端是连笔手写体的署名，右侧是站名与副标题（两行，位置固定）。
 *  页面下滚后只折叠署名，Shizuku / 个人主页 两行的相对位置始终不变。
 * ========================================================================== */

import { profile, site } from '@/content/site'
import { Icon } from './Icon'
import { useTheme } from '@/hooks/useTheme'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

export function SiteHeader() {
  const { mode, resolved, cycle } = useTheme()
  const collapsed = useScrollCollapse()

  const themeLabel = mode === 'auto' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'

  return (
    <div className={`site-header-wrap${collapsed ? ' is-collapsed' : ''}`}>
      {/* 独立悬浮的圆形头像，后面垫一枚磨砂玻璃圆 */}
      <span className="site-header__avatar">
        <span className="site-header__avatar-halo" aria-hidden="true" />
        <img src={site.avatar} alt="" width={54} height={54} />
      </span>

      <header className="site-header glass">
        <div className="site-header__inner">
          <a href="#top" className="brand" aria-label="回到顶部">
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
    </div>
  )
}
