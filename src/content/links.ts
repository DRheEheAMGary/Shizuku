/* ============================================================================
 *  Shizuku · 链接 / 联系方式
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export interface LinkItem {
  /** 内联 SVG 图标名，见 components/Icon.tsx */
  icon: IconName
  name: string
  url: string
  desc: string
}

/** 站点链接 */
export const links: LinkItem[] = [
  { icon: 'blog', name: '博客', url: 'https://blog.dreamgary.cn', desc: 'blog.dreamgary.cn' },
  { icon: 'folder', name: '资源站', url: 'https://r.dreamgary.cn', desc: 'r.dreamgary.cn' },
  { icon: 'chess', name: 'OIerTrainer', url: 'https://oitr.dreamgary.cn', desc: 'oitr.dreamgary.cn' },
  {
    icon: 'bilibili',
    name: '哔哩哔哩',
    url: 'https://space.bilibili.com/3493283116353785',
    desc: 'DRheEheAM_Gary',
  },
  {
    icon: 'headphones',
    name: '毛怪俱乐部',
    url: 'https://2550505.com/space/36571',
    desc: 'DRheEheAM_Gary',
  },
  { icon: 'cube', name: 'Minecraft', url: 'https://www.minecraft.net', desc: 'minecraft.net' },
  { icon: 'gamepad', name: 'MiHoYo', url: 'https://www.mihoyo.com', desc: 'mihoyo.com' },
]

export interface ContactItem {
  icon: IconName
  type: string
  value: string
  /** 展示文案 */
  display: string
  /** 是否可一键复制 */
  copyable?: boolean
}

export const contacts: ContactItem[] = [
  {
    icon: 'mail',
    type: 'email',
    value: 'dream20110513Gary@163.com',
    display: 'dream20110513Gary@163.com',
    copyable: true,
  },
  {
    icon: 'mail',
    type: 'email',
    value: 'dream20110513Gary@gmail.com',
    display: 'dream20110513Gary@gmail.com',
    copyable: true,
  },
  {
    icon: 'mail',
    type: 'email',
    value: 'gary0513hanser@gmail.com',
    display: 'gary0513hanser@gmail.com',
    copyable: true,
  },
  { icon: 'qq', type: 'text', value: '2366574433', display: 'QQ: 2366574433', copyable: true },
  {
    icon: 'phone',
    type: 'text',
    value: '13177780513',
    display: '电话: 13177780513 (微信同号)',
    copyable: true,
  },
  {
    icon: 'bilibili',
    type: 'text',
    value: 'DRheEheAM_Gary',
    display: 'B站: DRheEheAM_Gary',
    copyable: true,
  },
]
