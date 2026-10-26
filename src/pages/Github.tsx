/* ============================================================================
 *  Shizuku · Github
 * ----------------------------------------------------------------------------
 *  GitHub 主页入口 / 贡献热力图 / 仓库链接。
 * ========================================================================== */

import { GlassCard } from '@/components/GlassCard'
import { Icon } from '@/components/Icon'
import { GithubHeatmap } from '@/components/GithubHeatmap'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import './Subpage.css'

export function Github() {
  const { github } = profile

  return (
    <PageShell marginText="コード" wide>
      <div className="subpage subpage--paired">
        <div className="page-grid">
          <GlassCard span={4} title="GitHub" icon="github" className="span-4 github-card">
            <div className="github-profile">
              <span className="github-mark" aria-hidden="true">
                <Icon name="github" size={28} />
              </span>
              <div className="github-id">
                <strong>@{github.username}</strong>
                <span>GitHub 首页 · 开源项目与贡献</span>
              </div>
              <a
                className="page-cta"
                href={github.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                访问主页
                <Icon name="arrow-up-right" size={13} />
              </a>
            </div>
          </GlassCard>

          <GlassCard span={8} title="贡献热力图" icon="github" className="span-8">
            <GithubHeatmap login={github.username} />
          </GlassCard>

          <GlassCard span={12} title="仓库" icon="folder" className="span-12">
            <div className="repo-grid">
              {github.repos.map((repo) => (
                <a
                  className="repo-card"
                  key={repo.url}
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="repo-card__top">
                    <span>{repo.owner}</span>
                    <Icon name="arrow-up-right" size={13} />
                  </span>
                  <strong className="repo-name">{repo.name}</strong>
                  <p>{repo.desc}</p>
                </a>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageShell>
  )
}
