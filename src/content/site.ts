/* ============================================================================
 *  Shizuku · 站点与个人信息
 * ----------------------------------------------------------------------------
 *  全站唯一的文案与数据来源，页面组件只读这里、不再各自写死内容。
 *
 *  分三块：
 *    · site      —— 站点级元信息、页脚、图片地址，以及三套背景的画师署名
 *    · profile   —— 个人信息，按 Main / About / Github / Contact 分段
 *    · bgArtists —— 背景插画作者，跟着 data-accent 切换
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export const site = {
  /** 站名的汉字写法（页边竖排小字） */
  mark: '雫',
  /** 站名的罗马字 */
  markRomaji: 'shizuku',
  /** 浏览器标题后缀 */
  title: '个人主页',
  /** 以下四项与 index.html 里的 meta 重复，目前由静态 HTML 直接提供 */
  subtitle: '',
  description: '',
  keywords: '',
  /** 版权署名，页脚使用 */
  author: 'DRheEheAM_Gary',
  url: 'https://example.com',
  lang: 'zh-CN',
  /** 顶栏头像，同时参与加载页的关键图预加载 */
  avatar: 'https://r.dreamgary.cn/images/headround.jpg',
  /** 图片预加载时会在后台预热，不阻塞首屏 */
  favicon: 'https://r.dreamgary.cn/images/headround.png',
  /** 页脚的一行备案信息；text 为空时整段不渲染 */
  icp: {
    text: '萌ICP备20260513号',
    url: 'https://icp.gov.moe/?keyword=20260513',
  },
  /** 页脚引文（日文），为空则不渲染 */
  footerQuote: '',
} as const

/** 三套背景插画各自的画师署名，随 data-accent 切换，由 BgCredit 渲染 */
export const bgArtists = {
  blue: {
    name: '花久花酒',
    url: 'https://space.bilibili.com/2394319',
  },
  yellow: {
    name: 'DAME_ovo_',
    url: 'https://space.bilibili.com/33461313',
  },
  purple: {
    name: 'DAME_ovo_',
    url: 'https://space.bilibili.com/33461313',
  },
} as const

/** 个人资料：Main 首屏、About、Github、Contact 四个页面的数据都来自这里 */
export const profile = {
  /** 首屏大字标题 */
  name: 'DRheEheAM_Gary',
  /** 顶栏的连笔署名（Pacifico） */
  signature: 'DRheEheAM_Gary',

  /* ---------- Main ---------- */
  /** 首屏卡片里的三个短字段 */
  mbti: 'ESFJ',
  location: 'JX-NC',
  description: 'Student/OIer | hanser 单推人',
  /** 首屏卡片底部的引文 */
  quote: '轻盈点 我们学习纸鸢 才飘得更远',
  /** 完整的自我介绍段落，供后续版式使用 */
  about: [
    '欢迎来到我的主页 (awa',
    '我是一名高一生，现居 JX-NC，是一名 OIer & 二次元',
    '很开心与你做朋友！',
  ],

  /* ---------- About ---------- */
  /** 游戏标签行 */
  games: ['Minecraft', '原神', '崩坏：星穹铁道', '饿殍：明末千里行'],
  /** MC 玩法说明，跟在「Minecraft ·」之后 */
  minecraft: '生存 / 冒险 / 建筑 /（微量）生电',
  /** 游戏账号行：icon 取自 IconName，level 为空则不显示等级 */
  gameAccounts: [
    { game: '原神', uid: '292261202', level: 'Lv.58', icon: 'gamepad' },
    { game: '星穹铁道', uid: '157154425', level: 'Lv.70', icon: 'gamepad' },
    { game: 'MC Java', uid: 'DRheEheAM', level: '', icon: 'cube' },
    { game: 'MC 基岩', uid: 'DreamGary513', level: '', icon: 'cube' },
  ] as { game: string; uid: string; level: string; icon: IconName }[],
  /** 站外链接卡片 */
  links: [
    {
      icon: 'blog',
      name: '博客',
      url: 'https://blog.dreamgary.cn',
      desc: 'blog.dreamgary.cn',
    },
    {
      icon: 'cube',
      name: '服务器介绍站',
      url: 'https://mc.dreamgary.cn',
      desc: 'mc.dreamgary.cn',
    },
    {
      icon: 'user',
      name: 'SSO 统一认证系统',
      url: 'https://sso.dreamgary.cn',
      desc: 'sso.dreamgary.cn',
    },
    {
      icon: 'folder',
      name: '资源站',
      url: 'https://r.dreamgary.cn',
      desc: 'r.dreamgary.cn',
    },
    {
      icon: 'star',
      name: 'Shizuku 预览站',
      url: 'https://shizuku.dreamgary.cn',
      desc: 'shizuku.dreamgary.cn',
    },
  ] as { icon: IconName; name: string; url: string; desc: string }[],

  /* ---------- Github ---------- */
  github: {
    /** 热力图与主页入口都按这个登录名取数 */
    username: 'DRheEheAMGary',
    url: 'https://github.com/DRheEheAMGary',
    /** 仓库卡片：owner 显示在卡片顶部，name 与 desc 是主体 */
    repos: [
      {
        owner: 'DRheEheAMGary',
        name: 'OI',
        desc: '信息学代码总结',
        url: 'https://github.com/DRheEheAMGary/OI',
      },
      {
        owner: 'qifanmaker',
        name: 'QFM-mcpvp',
        desc: 'Minecraft PvP 匹配 Mod · 12 种玩法',
        url: 'https://github.com/qifanmaker/QFM-mcpvp',
      },
      {
        owner: 'DRheEheAMGary',
        name: 'Shizuku',
        desc: '现在这个个人主页的源码',
        url: 'https://github.com/DRheEheAMGary/Shizuku',
      },
      {
        owner: 'DRheEheAMServer',
        name: 'HubSuite',
        desc: 'Minecraft 大厅 + 多子服 Fabric 模组',
        url: 'https://github.com/DRheEheAMServer/HubSuite',
      },
    ],
  },

  /* ---------- Contact ---------- */
  contacts: {
    qq: '2366574433',
    bilibili: {
      handle: 'DRheEheAM_Gary',
      url: 'https://space.bilibili.com/3493283116353785',
    },
    emails: [
      'dream20110513Gary@163.com',
      'dream20110513Gary@gmail.com',
      'gary0513hanser@gmail.com',
    ],
  },

  /* ---------- 预留 ---------- */
  /** 尚未接入页面：标签胶囊与歌词行，留待后续版式 */
  tags: [] as { icon: string; text: string }[],
  lyric: '',
}
