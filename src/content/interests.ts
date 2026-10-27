/* ============================================================================
 *  Shizuku · 兴趣 / 项目（预留模块）
 * ----------------------------------------------------------------------------
 *  只定义数据结构，数组与字符串都为空，当前没有任何页面引用这里。
 *
 *  页面实际使用的游戏与账号在 content/site.ts 的 profile.games、
 *  profile.gameAccounts 里；这个文件保留给需要细分兴趣维度的版式。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

/** 在玩的游戏名 */
export const games: string[] = []

/** 常看的番剧类型 */
export const animeGenres: string[] = []

/** MC 玩法描述 */
export const minecraft = ''

/** 主推的 vtuber / 角色 */
export const oshi = ''

/** 游戏账号：level 可选，没有等级的游戏留空 */
export interface GameAccount {
  icon: IconName
  game: string
  uid: string
  level?: string
}

export const gameAccounts: GameAccount[] = []

/** 角色卡：url 可选，指向角色主页或相关页面 */
export interface Character {
  icon: IconName
  name: string
  url?: string
}

export const vtubers: Character[] = []

export const genshinChars: Character[] = []

export const subPush: Character[] = []

/** 项目卡：name + desc + 仓库地址 */
export interface Project {
  icon: IconName
  name: string
  desc: string
  url: string
}

export const projects: Project[] = []
