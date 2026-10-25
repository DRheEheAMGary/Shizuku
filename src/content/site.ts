/* ============================================================================
 *  Shizuku · 站点与个人信息
 * ----------------------------------------------------------------------------
 *  ⚠️ 页面文案已清空，只保留顶栏与页脚要用的字段。
 *  新的布局定下来之后，把内容加回来即可。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

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
  description: 'Student/OIer | hanser 单推人',
  quote: '轻盈点 我们学习纸鸢 才飘得更远',
  about: [
    '欢迎来到我的主页 (awa',
    '我是一名高一生，现居 JX-NC，是一名 OIer & 二次元',
    '很开心与你做朋友！',
  ],

  /* ---------- About ---------- */
  games: ['Minecraft', '原神', '崩坏：星穹铁道', '饿殍：明末千里行'],
  minecraft: '生存 / 冒险 / 建筑 /（微量）生电',
  gameAccounts: [
    { game: '原神', uid: '292261202', level: 'Lv.58', icon: 'gamepad' },
    { game: '星穹铁道', uid: '157154425', level: 'Lv.70', icon: 'gamepad' },
    { game: 'MC Java', uid: 'DRheEheAM', level: '', icon: 'cube' },
    { game: 'MC 基岩', uid: 'DreamGary513', level: '', icon: 'cube' },
  ] as { game: string; uid: string; level: string; icon: IconName }[],
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
    username: 'DRheEheAMGary',
    url: 'https://github.com/DRheEheAMGary',
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

  /* ↓↓↓ 还没用到的字段，等后续版式定了再填 ↓↓↓ */
  tags: [] as { icon: string; text: string }[],
  lyric: '',
}
