/* ============================================================================
 *  Shizuku · 玻璃卡片
 * ----------------------------------------------------------------------------
 *  子页面（About / Contact / Github）的内容容器：标题行（图标 + 标题 + 操作区）加正文。
 *
 *    <GlassCard span={8} title="标题" icon="star" minH={220}>
 *      …
 *    </GlassCard>
 *
 *  span 只写进 --card-span，供横向卡片排的宽度公式读取；
 *  当前放进 .page-grid 后宽度交给网格（Subpage.css 覆盖为 100%），
 *  实际栏位由调用方附加的 span-4 / span-8 / span-12 类决定。
 * ========================================================================== */

import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import './GlassCard.css'

interface GlassCardProps {
  children?: ReactNode
  /** 横向卡片排的 12 栅格跨度（写进 --card-span），默认 4 */
  span?: number
  title?: string
  icon?: IconName
  /** 右上角操作区 */
  actions?: ReactNode
  /** 最小高度，让空卡片也有形状 */
  minH?: number
  className?: string
}

/**
 * 玻璃卡片容器：标题行可选，正文放进 __body。
 * @param span 写进 --card-span；放进 .page-grid 时由网格接管宽度
 * @param title 标题文字，与 icon / actions 任一存在时渲染整行标题
 * @param icon 标题前的图标
 * @param actions 标题行右侧操作区
 * @param minH 最小高度（px），写进 --card-min-h，让空卡片也有形状
 */
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
