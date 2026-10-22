/* ============================================================================
 *  Shizuku · 兴趣 / 项目
 * ----------------------------------------------------------------------------
 *  ⚠️ 内容已清空。类型保留，新布局定下来后直接往数组里加。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export const games: string[] = []

export const animeGenres: string[] = []

export const minecraft = ''

export const oshi = ''

export interface GameAccount {
  icon: IconName
  game: string
  uid: string
  level?: string
}

export const gameAccounts: GameAccount[] = []

export interface Character {
  icon: IconName
  name: string
  url?: string
}

export const vtubers: Character[] = []

export const genshinChars: Character[] = []

export const subPush: Character[] = []

export interface Project {
  icon: IconName
  name: string
  desc: string
  url: string
}

export const projects: Project[] = []
