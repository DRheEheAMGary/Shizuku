/* ============================================================================
 *  Shizuku · 链接卡片
 * ========================================================================== */

import { Icon } from './Icon'
import type { LinkItem } from '@/content/links'
import './LinkCard.css'

export function LinkCard({ item }: { item: LinkItem }) {
  return (
    <a
      className="link-card glass glass--hover"
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
    >
      <span className="link-card__icon">
        <Icon name={item.icon} size={18} />
      </span>
      <span className="link-card__body">
        <span className="link-card__name">{item.name}</span>
        <span className="link-card__desc">{item.desc}</span>
      </span>
      <span className="link-card__arrow">
        <Icon name="arrow-up-right" size={15} />
      </span>
    </a>
  )
}
