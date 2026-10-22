/* ============================================================================
 *  Shizuku · 兴趣 / 项目
 * ----------------------------------------------------------------------------
 *  ⚠️ 占位内容。
 * ========================================================================== */

import type { IconName } from '@/components/Icon'

export const games = ['游戏一', '游戏二', '游戏三', '游戏四']

export const animeGenres = ['作品一', '作品二', '作品三']

export const minecraft = '玩法一 / 玩法二 / 玩法三'

export const oshi = '推し'

export interface GameAccount {
  icon: IconName
  game: string
  uid: string
  level?: string
}

export const gameAccounts: GameAccount[] = [
  { icon: 'gamepad', game: '游戏一', uid: '000000000', level: 'Lv.00' },
  { icon: 'gamepad', game: '游戏二', uid: '000000000', level: 'Lv.00' },
  { icon: 'cube', game: '游戏三', uid: 'your-id' },
  { icon: 'cube', game: '游戏四', uid: 'your-id' },
]

export interface Character {
  icon: IconName
  name: string
  url?: string
}

export const vtubers: Character[] = [
  { icon: 'mic', name: '示例名字', url: 'https://example.com' },
]

export const genshinChars: Character[] = [
  { icon: 'wind', name: '角色一' },
  { icon: 'water', name: '角色二' },
  { icon: 'star', name: '角色三' },
]

export const subPush: Character[] = [
  { icon: 'gamepad', name: '角色四' },
  { icon: 'wheat', name: '角色五' },
  { icon: 'mic', name: '示例名字', url: 'https://example.com' },
]

export interface Project {
  icon: IconName
  name: string
  desc: string
  url: string
}

export const projects: Project[] = [
  { icon: 'github', name: 'owner/repo-one', desc: '一句话说明这个项目', url: 'https://github.com' },
  { icon: 'github', name: 'owner/repo-two', desc: '一句话说明这个项目', url: 'https://github.com' },
  { icon: 'github', name: 'owner/repo-three', desc: '一句话说明这个项目', url: 'https://github.com' },
]
