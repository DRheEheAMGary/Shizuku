/* ============================================================================
 *  Shizuku · 玻璃卡片
 * ----------------------------------------------------------------------------
 *  主页的最小布局单元。所有内容都装在这里面，页面靠网格排布。
 *
 *    <GlassCard span={8} title="标题" icon="star" minH={220}>
 *      …
 *    </GlassCard>
 *
 *  span 是 12 栅格里的跨度：桌面端 12 列，平板 6 列，手机 1 列。
 *  不给 span 就默认 4（桌面三列之一）。
 * ========================================================================== */

import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import './GlassCard.css'

interface GlassCardProps {
  children?: ReactNode
  /** 12 栅格跨度，默认 4 */
  span?: number
  title?: string
  icon?: IconName
  /** 右上角操作区 */
  actions?: ReactNode
  /** 最小高度，让空卡片也有形状 */
  minH?: number
  className?: string
}

export function GlassCard({
  children,
  span = 4,
  title,
  icon,
  actions,
  minH,
  className = '',
}: GlassCardProps) {
  const style = {
    '--card-span': span,
    ...(minH ? { '--card-min-h': `${minH}px` } : null),
  } as CSSProperties

  return (
    <article className={`glass-card glass ${className}`.trim()} style={style} data-card>
      {(title || icon || actions) && (
        <header className="glass-card__head">
          <div className="glass-card__title">
            {icon && <Icon name={icon} size={15} />}
            {title && <span>{title}</span>}
          </div>
          {actions && <div className="glass-card__actions">{actions}</div>}
        </header>
      )}
      <div className="glass-card__body">{children}</div>
    </article>
  )
}
