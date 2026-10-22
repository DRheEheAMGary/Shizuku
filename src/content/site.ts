/* ============================================================================
 *  Shizuku · 站点与个人信息
 * ========================================================================== */

export const site = {
  /** 站名（页边竖排小字用） */
  mark: '雫',
  /** 罗马字 */
  markRomaji: 'shizuku',
  /** 浏览器标题后缀 */
  title: '个人主页',
  /** 副标题 */
  subtitle: 'OIer & 二次元',
  description: '高一生 | OIer | 二次元',
  keywords: 'DRheEheAM,DRheEheAM_Gary,个人主页,Shizuku,dreamgary,dreamgary.cn',
  author: 'DRheEheAM_Gary',
  url: 'https://dreamgary.cn',
  lang: 'zh-CN',
  avatar: 'https://r.dreamgary.cn/images/headround.jpg',
  favicon: 'https://r.dreamgary.cn/images/headround.png',
  icp: {
    text: '萌ICP备20260513号',
    url: 'https://icp.gov.moe/?keyword=20260513',
  },
  footerQuote: '愛してね♡',
} as const

export const profile = {
  name: 'DRheEheAM_Gary',
  mbti: 'ESFJ',
  location: 'JX-NC',
  description: '高一生 | OIer | 二次元',
  quote: '爱如果太猛烈/注定是要毁灭',
  about: [
    '欢迎来到我的主页(awa',
    '我是一名高一生，现居 JX-NC ，是一名 OIer & 二次元',
    '很开心与你做朋友!',
  ],
  /** 侧栏/首页的成分标签 */
  tags: [
    { icon: 'fa-user-graduate', text: '高一生' },
    { icon: 'fa-laptop-code', text: 'OIer' },
    { icon: 'fa-heart', text: '二次元' },
  ],
  /** 页脚的一行歌词 —— 二次元气质最好的一处，压到最轻 */
  lyric: 'せんりのみちも いっぽから',
} as const

/** 导航结构 —— 页面 id 与路由一一对应 */
export const nav = [
  { id: 'home', label: '首页', kana: 'ホーム' },
  { id: 'about', label: '关于', kana: 'について' },
  { id: 'links', label: '链接', kana: 'リンク' },
  { id: 'works', label: '项目', kana: '作品' },
  { id: 'contact', label: '联系', kana: '連絡先' },
] as const

export type NavItem = (typeof nav)[number]
