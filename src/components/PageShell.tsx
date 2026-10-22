/* ============================================================================
 *  Shizuku · 页面骨架
 * ----------------------------------------------------------------------------
 *  提供统一的页边留白、页边竖排小字、页脚。
 *  竖排文字是日式气质的关键细节：writing-mode: vertical-rl。
 * ========================================================================== */

import type { ReactNode } from 'react'
import { site } from '@/content/site'
import './PageShell.css'

interface PageShellProps {
  children: ReactNode
  /** 页边竖排小字，如「ホーム」 */
  marginText?: string
  /** 页面主标题 */
  title?: string
  /** 标题下的副标题 */
  subtitle?: string
  /** 正文放宽到 --page-max（卡片栅格需要，阅读型页面用默认的 46rem） */
  wide?: boolean
}

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
          <span className="site-footer__quote" lang="ja">
            {site.footerQuote}
          </span>
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
