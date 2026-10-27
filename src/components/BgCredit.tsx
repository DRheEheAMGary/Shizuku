/* ============================================================================
 *  Shizuku · 背景画师署名
 * ----------------------------------------------------------------------------
 *  指向当前主题色画师 B 站空间的一行署名，配色（data-accent）变化时换人。
 *  留在页脚文档流里：页脚处在页面底部，它自然落在左下角；
 *  不用 position: fixed，内容比视口高时不会浮到卡片上面。
 * ========================================================================== */

import { bgArtists } from '@/content/site'
import { useTheme } from '@/hooks/useTheme'
import './BgCredit.css'

/**
 * 背景画师署名链接。
 * 作者与链接按当前主题色取自 site.bgArtists，没有对应配色时回退到 blue。
 */
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
