/* ============================================================================
 *  Shizuku · 背景画师署名
 * ----------------------------------------------------------------------------
 *  压在插画左下角的一行小字，跟着当前配色（data-accent）换人。
 *  留在页脚文档流里 —— 页脚本身沉在页面底部，所以它天然就在左下角；
 *  内容比视口高时也不会像 fixed 那样浮到卡片上面去。
 * ========================================================================== */

import { bgArtists } from '@/content/site'
import { useTheme } from '@/hooks/useTheme'
import './BgCredit.css'

export function BgCredit() {
  const { accent } = useTheme()
  const artist = bgArtists[accent] ?? bgArtists.blue

  return (
    <a
      className="bg-credit"
      href={artist.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`背景插画作者：${artist.name}`}
    >
      画师：bilibili@{artist.name}
    </a>
  )
}
