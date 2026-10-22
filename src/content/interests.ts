/* ============================================================================
 *  Shizuku · 兴趣 / 二次元 / 项目
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

/** 玩的游戏 */
export const games = ['Minecraft', '原神', '崩坏：星穹铁道', '饿殍：明末千里行']

/** 二次元成分 */
export const animeGenres = ['原神', '崩坏：星穹铁道', 'vtb & Vocaloid']

/** Minecraft 成分 */
export const minecraft = '生存 / 冒险 / 建筑 /（微量）生电'

/** 主推（推し） */
export const oshi = 'hanser'

export interface GameAccount {
  icon: IconName
  game: string
  uid: string
  level?: string
}

export const gameAccounts: GameAccount[] = [
  { icon: 'gamepad', game: '原神', uid: '292261202', level: 'Lv.58' },
  { icon: 'gamepad', game: '星穹铁道', uid: '157154425', level: 'Lv.70' },
  { icon: 'cube', game: 'MC Java', uid: 'DRheEheAM' },
  { icon: 'cube', game: 'MC 基岩', uid: 'DreamGary513' },
]

export interface Character {
  icon: IconName
  name: string
  url?: string
}

/** 虚拟主播 */
export const vtubers: Character[] = [
  { icon: 'mic', name: 'hanser', url: 'https://space.bilibili.com/11073' },
]

/** 原神主推 */
export const genshinChars: Character[] = [
  { icon: 'wind', name: '温迪' },
  { icon: 'water', name: '妮露' },
  { icon: 'star', name: '茜特菈莉' },
]

/** 副推 */
export const subPush: Character[] = [
  { icon: 'gamepad', name: '银狼' },
  { icon: 'wheat', name: '满穗' },
  { icon: 'mic', name: '泠鸢yousa', url: 'https://space.bilibili.com/282994' },
  { icon: 'mic', name: '多多poi', url: 'https://space.bilibili.com/11253297' },
]

export interface Project {
  icon: IconName
  name: string
  desc: string
  url: string
}

export const projects: Project[] = [
  {
    icon: 'github',
    name: 'DRheEheAMGary/OI',
    desc: '信息学代码总结',
    url: 'https://github.com/DRheEheAMGary/OI',
  },
  {
    icon: 'github',
    name: 'DRheEheAMGary/Gary-homepage',
    desc: '个人主页源码（旧版）',
    url: 'https://github.com/DRheEheAMGary/Gary-homepage',
  },
  {
    icon: 'github',
    name: 'DRheEheAMServer/HubSuite',
    desc: 'Minecraft 大厅 + 多子服模组',
    url: 'https://github.com/DRheEheAMServer/HubSuite',
  },
]
