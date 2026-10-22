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
    text: '',
    url: 'https://example.com',
  },
  footerQuote: '',
} as const

export const profile = {
  name: 'DRheEheAM_Gary',
  /** 顶栏的连笔署名 */
  signature: 'DRheEheAM_Gary',

  /* ↓↓↓ 以下为页面正文内容，暂时留空，等新布局定下来再填 ↓↓↓ */
  mbti: '',
  location: '',
  description: '',
  quote: '',
  about: [] as string[],
  tags: [] as { icon: string; text: string }[],
  lyric: '',
}
