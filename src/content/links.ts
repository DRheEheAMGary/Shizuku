/* ============================================================================
 *  Shizuku · 链接 / 联系方式
 * ----------------------------------------------------------------------------
 *  ⚠️ 占位内容。替换为真实链接即可。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export interface LinkItem {
  icon: IconName
  name: string
  url: string
  desc: string
}

export const links: LinkItem[] = [
  { icon: 'blog', name: '示例站点一', url: 'https://example.com', desc: 'example.com' },
  { icon: 'folder', name: '示例站点二', url: 'https://example.com', desc: 'example.com' },
  { icon: 'chess', name: '示例站点三', url: 'https://example.com', desc: 'example.com' },
  { icon: 'bilibili', name: '示例站点四', url: 'https://example.com', desc: 'example.com' },
  { icon: 'headphones', name: '示例站点五', url: 'https://example.com', desc: 'example.com' },
  { icon: 'cube', name: '示例站点六', url: 'https://example.com', desc: 'example.com' },
]

export interface ContactItem {
  icon: IconName
  type: string
  value: string
  display: string
  copyable?: boolean
}

export const contacts: ContactItem[] = [
  { icon: 'mail', type: 'email', value: 'hello@example.com', display: 'hello@example.com', copyable: true },
  { icon: 'qq', type: 'text', value: '000000000', display: 'QQ: 000000000', copyable: true },
  { icon: 'phone', type: 'text', value: '00000000000', display: '电话: 00000000000', copyable: true },
  { icon: 'bilibili', type: 'text', value: 'your-id', display: 'B站: your-id', copyable: true },
]
