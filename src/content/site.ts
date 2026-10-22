/* ============================================================================
 *  Shizuku · 站点与个人信息
 * ----------------------------------------------------------------------------
 *  ⚠️ 目前全部是占位内容，仅用于观察版式。换成真实内容即可。
 * ========================================================================== */

export const site = {
  /** 站名（顶栏与页边竖排用） */
  mark: '雫',
  /** 罗马字 */
  markRomaji: 'shizuku',
  /** 浏览器标题后缀 */
  title: '个人主页',
  subtitle: '示例副标题',
  description: '一句话介绍，示例文本',
  keywords: '示例,占位,Shizuku',
  author: 'Your Name',
  url: 'https://example.com',
  lang: 'zh-CN',
  avatar: 'https://r.dreamgary.cn/images/headround.jpg',
  favicon: 'https://r.dreamgary.cn/images/headround.png',
  icp: {
    text: '示例备案号',
    url: 'https://example.com',
  },
  footerQuote: 'ここに いちぎょう',
} as const

export const profile = {
  name: 'Your Name',
  /** 顶栏的连笔署名 */
  signature: 'DRheEheAM_Gary',
  mbti: 'XXXX',
  location: '城市',
  description: '身份标签 · 身份标签 · 身份标签',
  quote: '这里放一句你喜欢的话',
  about: [
    '第一段自我介绍。这是占位文本，用来观察正文的行高与留白节奏。',
    '第二段。可以写你现在在做什么、在哪里、对什么感兴趣。段落之间会自动留出间距。',
    '第三段。想写多少段都可以，版式会跟着内容走。',
  ],
  /** 首页的成分标签 */
  tags: [
    { icon: 'user-graduate', text: '标签一' },
    { icon: 'laptop-code', text: '标签二' },
    { icon: 'heart', text: '标签三' },
  ],
  /** 页脚的一行歌词 —— 压到最轻 */
  lyric: 'ここに いちぎょう の うた',
} as const

