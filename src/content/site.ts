/* ============================================================================
 *  Shizuku · 站点与个人信息
 * ----------------------------------------------------------------------------
 *  ⚠️ 页面文案已清空，只保留顶栏与页脚要用的字段。
 *  新的布局定下来之后，把内容加回来即可。
 * ========================================================================== */

export const site = {
  /** 站名（页边竖排小字用） */
  mark: '雫',
  /** 罗马字 */
  markRomaji: 'shizuku',
  /** 浏览器标题后缀 */
  title: '个人主页',
  subtitle: '',
  description: '',
  keywords: '',
  author: 'DRheEheAM_Gary',
  url: 'https://example.com',
  lang: 'zh-CN',
  avatar: 'https://r.dreamgary.cn/images/headround.jpg',
  favicon: 'https://r.dreamgary.cn/images/headround.png',
  icp: {
    text: '萌ICP备20260513号',
    url: 'https://icp.gov.moe/?keyword=20260513',
  },
  footerQuote: '',
} as const

export const profile = {
  name: 'DRheEheAM_Gary',
  /** 顶栏的连笔署名 */
  signature: 'DRheEheAM_Gary',

  /* 正文内容：从 Gary-Homepage/data/profile.php 迁回 */
  mbti: 'ESFJ',
  location: 'JX-NC',
  description: '高一生 | OIer | 二次元',
  quote: '爱如果太猛烈 / 注定是要毁灭',
  about: [
    '欢迎来到我的主页 (awa',
    '我是一名高一生，现居 JX-NC，是一名 OIer & 二次元',
    '很开心与你做朋友！',
  ],
  /** 首页「去处」卡片的链接 */
  links: [
    { name: 'GitHub', url: 'https://github.com/DRheEheAMGary' },
    { name: '博客', url: 'https://blog.dreamgary.cn' },
    { name: '哔哩哔哩', url: 'https://space.bilibili.com/3493283116353785' },
  ],

  /* ↓↓↓ 还没用到的字段，等后续版式定了再填 ↓↓↓ */
  tags: [] as { icon: string; text: string }[],
  lyric: '',
}
