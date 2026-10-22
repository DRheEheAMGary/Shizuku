/* ============================================================================
 *  Shizuku · 顶部栏
 * ----------------------------------------------------------------------------
 *  结构：左侧一枚独立悬浮的圆形头像 + 一枚居中胶囊。
 *  胶囊内左端是连笔手写体的署名，右侧是站名与副标题（两行，位置固定）。
 *  页面下滚后只折叠署名，Shizuku / 个人主页 两行的相对位置始终不变。
 * ========================================================================== */

import { useState } from 'react'
import { profile, site } from '@/content/site'
import { Icon } from './Icon'
import { ThemeVeil } from './ThemeVeil'
import type { VeilState } from './ThemeVeil'
import { useTheme } from '@/hooks/useTheme'
import { useScrollCollapse } from '@/hooks/useScrollCollapse'
import './SiteHeader.css'

export function SiteHeader() {
  const { mode, setMode } = useTheme()
  const collapsed = useScrollCollapse()
  const [veil, setVeil] = useState<VeilState | null>(null)

  const themeLabel = mode === 'dark' ? '深色' : '浅色'

  /** 以按钮为圆心放出一枚遮罩，盖满整屏后再换主题 */
  function onToggleTheme(e: React.MouseEvent<HTMLButtonElement>) {
    if (veil) return

    const btn = e.currentTarget.getBoundingClientRect()
    const x = btn.left + btn.width / 2
    const y = btn.top + btn.height / 2
    // 半径取到最远的那个视口角，保证能盖满
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    setVeil({ x, y, r, target: mode === 'dark' ? 'light' : 'dark' })
  }

  /** 遮罩播完：换主题，摘掉遮罩（此刻两者颜色一致，看不出接缝） */
  function onVeilDone() {
    if (!veil) return
    setMode(veil.target)
    setVeil(null)
  }

  return (
    <>
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
              onClick={onToggleTheme}
              aria-label={`主题：${themeLabel}，点击切换`}
              title={themeLabel}
            >
              <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={16} />
            </button>
          </div>
        </header>
      </div>

      <ThemeVeil veil={veil} onDone={onVeilDone} />
    </>
  )
}
