/* ============================================================================
 *  Shizuku · 链接 / 联系方式
 * ----------------------------------------------------------------------------
 *  ⚠️ 内容已清空。类型保留，新布局定下来后直接往数组里加。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export interface LinkItem {
  /** 内联 SVG 图标名，见 components/Icon.tsx */
  icon: IconName
  name: string
  url: string
  desc: string
}

export const links: LinkItem[] = []

export interface ContactItem {
  icon: IconName
  type: string
  value: string
  display: string
  copyable?: boolean
}

export const contacts: ContactItem[] = []
