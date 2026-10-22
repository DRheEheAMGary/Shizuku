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
      <Reveal>
        <div className="works-rows rows">
          {projects.map((p) => (
            <a
              key={p.name}
              className="row"
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="row__icon">
                <Icon name={p.icon} size={18} />
              </span>
              <span className="row__body">
                <span className="row__title">{p.name}</span>
                <span className="row__sub">{p.desc}</span>
              </span>
              <span className="row__arrow">
                <Icon name="arrow-up-right" size={15} />
              </span>
            </a>
          ))}
        </div>
      </Reveal>

      {/* 贡献热力图：默认折叠，避免信息密度压垮页面 */}
      <Reveal className="works-heat" delay={80}>
        <details className="works-heat__box">
          <summary className="works-heat__summary">
            <span>GitHub 贡献热力图</span>
            <span className="works-heat__hint">展开</span>
          </summary>
          <div className="works-heat__body">
            <GithubHeatmap />
          </div>
        </details>
      </Reveal>
    </PageShell>
  )
}
