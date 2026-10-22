/* ============================================================================
 *  Shizuku · 链接
 * ========================================================================== */

import { LinkCard } from '@/components/LinkCard'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { links } from '@/content/links'
import './Links.css'

export function Links() {
  return (
    <PageShell marginText="リンク" title="链接" subtitle="我在网络上留下的那些地方。">
      <div className="links-grid">
        {links.map((item, i) => (
          <Reveal key={item.name} delay={i * 45}>
            <LinkCard item={item} />
          </Reveal>
        ))}
      </div>
    </PageShell>
  )
}
