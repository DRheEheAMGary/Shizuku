/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  三段式：左侧一枚独立悬浮的圆形头像 + 中间一枚居中胶囊 + 右侧独立的拨动开关。
 *  胶囊内左端是连笔手写体的署名，右侧是站名与副标题（两行，位置固定）。
 *  页面下滚后只折叠署名，Shizuku / 个人主页 两行的相对位置始终不变。
 * ========================================================================== */

import { profile, site } from '@/content/site'
import { AuthDock } from './AuthDock'
import { SearchButton } from './SearchButton'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

export function SiteHeader() {
  const collapsed = useScrollCollapse()

  return (
    <div className={`site-header-wrap${collapsed ? ' is-collapsed' : ''}`}>
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
        </div>
      </header>

      {/* 平衡块：左边的搜索按钮和它是左右对称的一对占位。
          主题开关搬进坞里之后，中间这组会变窄、整体往右挪 37px；
          左边又多了搜索按钮，再加一块等宽的透明占位，
          胶囊和头像才会停在原来的位置。 */}
      <span className="site-header__balance" aria-hidden="true" />

      {/* 顶栏右侧的搜索按钮：独立的圆形玻璃钮 */}
      <SearchButton />

    </div>
  )
}
