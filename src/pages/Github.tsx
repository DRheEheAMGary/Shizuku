/* ============================================================================
 *  Shizuku · Github
 * ----------------------------------------------------------------------------
 *  三张卡片：GitHub 主页入口、贡献热力图、仓库列表。
 *  数据取 profile.github，热力图自己按登录名去 SSO 代理取数。
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
          {/*  按钮放进标题行右侧：整张卡因此矮了一截，也和右侧热力图对齐 */}
          <GlassCard
            span={4}
            title="GitHub"
            icon="github"
            className="span-4 github-card"
            actions={
              <a
                className="page-cta"
                href={github.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                访问主页
                <Icon name="arrow-up-right" size={13} />
              </a>
            }
          >
            <div className="github-profile">
              <span className="github-mark" aria-hidden="true">
                <Icon name="github" size={28} />
              </span>
              <div className="github-id">
                <strong>@{github.username}</strong>
                <span>GitHub 首页 · 开源项目与贡献</span>
              </div>
            </div>
          </GlassCard>

          {/* 热力图自带加载 / 失败 / 未绑定三种降级，这里不需要额外包状态 */}
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
