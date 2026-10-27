/* ============================================================================
 *  Shizuku · 页面骨架
 * ----------------------------------------------------------------------------
 *  统一页边留白、右缘竖排小字与页脚。
 *  wide 把正文区放宽到 --page-max，供 12 栏卡片栅格使用；
 *  阅读型页面保持默认的 --content-max。
 * ========================================================================== */

import type { ReactNode } from 'react'
import { site } from '@/content/site'
import { BgCredit } from './BgCredit'
import './PageShell.css'

interface PageShellProps {
  children?: ReactNode
  /** 页边竖排小字，如「ホーム」 */
  marginText?: string
  /** 页面主标题 */
  title?: string
  /** 标题下的副标题 */
  subtitle?: string
  /** 正文放宽到 --page-max（卡片栅格需要，阅读型页面用默认的 46rem） */
  wide?: boolean
}

/**
 * 页面骨架：页边竖排小字 + 正文区 + 页脚。
 * @param marginText 右缘竖排小字（日文），仅装饰，aria-hidden
 * @param title 正文顶部的主标题
 * @param subtitle 主标题下的副标题
 * @param wide 正文放宽到 --page-max（卡片栅格用），否则用 --content-max
 */
export function PageShell({ children, marginText, title, subtitle, wide }: PageShellProps) {
  return (
    <div className="page-shell">
      {marginText && (
        <div className="page-shell__margin" lang="ja" aria-hidden="true">
          {marginText}
        </div>
      )}

      <main className={`page-shell__main${wide ? ' is-wide' : ''}`}>
        {title && (
          <header className="page-head">
            <h1 className="page-head__title">{title}</h1>
            {subtitle && <p className="page-head__subtitle">{subtitle}</p>}
          </header>
        )}
        {children}
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          {/* 背景画师署名：页脚左侧，与右侧引语、备案同行；窄屏改为纵向排列 */}
          <BgCredit />
          {site.footerQuote && (
            <span className="site-footer__quote" lang="ja">
              {site.footerQuote}
            </span>
          )}
          <span className="site-footer__meta">
            © {new Date().getFullYear()} {site.author}
            {site.icp.text && (
              <>
                {' · '}
                <a href={site.icp.url} target="_blank" rel="noreferrer noopener">
                  {site.icp.text}
                </a>
              </>
            )}
          </span>
        </div>
      </footer>
    </div>
  )
}
