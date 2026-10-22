/* ============================================================================
 *  Shizuku · 项目
 * ========================================================================== */

import { GithubHeatmap } from '@/components/GithubHeatmap'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { projects } from '@/content/interests'
import './Works.css'

export function Works() {
  return (
    <PageShell marginText="作品" title="项目" subtitle="写过的、做过的一些东西。">
      <div className="works-list">
        {projects.map((p, i) => (
          <Reveal key={p.name} delay={i * 60}>
            <a
              className="glass glass--hover work-item"
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="work-item__icon">
                <Icon name={p.icon} size={20} />
              </span>
              <span className="work-item__body">
                <span className="work-item__name">{p.name}</span>
                <span className="work-item__desc">{p.desc}</span>
              </span>
              <span className="work-item__arrow">
                <Icon name="arrow-up-right" size={16} />
              </span>
            </a>
          </Reveal>
        ))}
      </div>

      {/* GitHub 贡献热力图 —— 默认折叠，避免信息密度压垮首屏 */}
      <Reveal className="works-heat" delay={120}>
        <details className="glass works-heat__box">
          <summary className="works-heat__summary">
            <span>GitHub 贡献热力图</span>
            <span className="works-heat__hint">点击展开</span>
          </summary>
          <div className="works-heat__body" id="gh-contributions">
            <GithubHeatmap />
          </div>
        </details>
      </Reveal>
    </PageShell>
  )
}
