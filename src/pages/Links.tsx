/* ============================================================================
 *  Shizuku · 链接
 * ========================================================================== */

import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { links } from '@/content/links'
import './Links.css'

export function Links() {
  return (
    <PageShell marginText="リンク" title="链接" subtitle="我在网络上出现的那些地方。">
      <Reveal>
        <div className="links-rows rows">
          {links.map((item) => (
            <a
              key={item.name}
              className="row"
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="row__icon">
                <Icon name={item.icon} size={16} />
              </span>
              <span className="row__body">
                <span className="row__title">{item.name}</span>
                <span className="row__sub">{item.desc}</span>
              </span>
              <span className="row__arrow">
                <Icon name="arrow-up-right" size={15} />
              </span>
            </a>
          ))}
        </div>
      </Reveal>
    </PageShell>
  )
}
