/* ============================================================================
 *  Shizuku · 站外链接与联系方式（预留模块）
 * ----------------------------------------------------------------------------
 *  只定义数据结构，数组为空，当前没有任何页面引用这里。
 *
 *  页面实际使用的链接与联系方式在 content/site.ts 的 profile.links、
 *  profile.contacts 里；这个文件保留给以后需要独立维护的一批链接。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

/** 一条站外链接：icon 取自 IconName，desc 一般是域名 */
export interface LinkItem {
  /** 内联 SVG 图标名，见 components/Icon.tsx */
  icon: IconName
  name: string
  url: string
  desc: string
}

export const links: LinkItem[] = []

/** 一条联系方式：value 用于复制 / mailto，display 用于展示 */
export interface ContactItem {
  icon: IconName
  type: string
  value: string
  display: string
  /** 是否在界面上提供复制按钮 */
  copyable?: boolean
}

export const contacts: ContactItem[] = []
