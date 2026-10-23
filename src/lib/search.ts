/* ============================================================================
 *  Shizuku · 全域搜索
 * ----------------------------------------------------------------------------
 *  索引是一份静态 JSON（由服务器上的 build_search_index.py 生成），
 *  前端拉下来在浏览器里搜 —— 不给静态站加 PHP，搜索也没有网络往返。
 *
 *  中文没有词边界，所以按子串匹配；多词用空格分开，全部命中才算。
 * ========================================================================== */

export type SearchItemType = 'post' | 'page' | 'doc'

export interface SearchItem {
  site: string
  type: SearchItemType
  title: string
  url: string
  /** 正文纯文本摘要 */
  text: string
  date: string | null
}

export interface SearchIndex {
  generatedAt: string
  items: SearchItem[]
}

/** 站点 id → 展示名（与索引器契约保持一致） */
export const SITE_NAMES: Record<string, string> = {
  blog: '博客',
  mc: 'MC 文档',
}

export const SITE_TYPES: Record<string, string> = {
  post: '文章',
  page: '页面',
  doc: '文档',
}

/** 命中的位置，用来高亮 */
export interface Highlight {
  start: number
  end: number
}

export interface SearchResult {
  item: SearchItem
  score: number
  titleHits: Highlight[]
  textHits: Highlight[]
  /** 摘要片段：正文里第一处命中的前后文 */
  snippet: string
  snippetHits: Highlight[]
}

/** 找出 needle 在 haystack 里的全部出现位置（忽略大小写） */
function findAll(haystack: string, needle: string): Highlight[] {
  if (!needle) return []
  const hay = haystack.toLowerCase()
  const out: Highlight[] = []
  let from = 0
  for (;;) {
    const at = hay.indexOf(needle, from)
    if (at < 0) break
    out.push({ start: at, end: at + needle.length })
    from = at + needle.length
  }
  return out
}

const SNIPPET_RADIUS = 42

/**
 * 搜索。
 *
 * - 标题命中权重远高于正文：博客里标题就是文章名，正文命中只是补充
 * - 多个词必须都命中（标题或正文任一处），否则视为不匹配
 * - 同分按时间新的排前面
 */
export function searchItems(items: SearchItem[], rawQuery: string): SearchResult[] {
  const terms = rawQuery.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []

  const results: SearchResult[] = []

  for (const item of items) {
    const titleHay = item.title.toLowerCase()
    const textHay = item.text.toLowerCase()

    let score = 0
    let ok = true
    const titleHits: Highlight[] = []
    const textHits: Highlight[] = []

    for (const term of terms) {
      const t = findAll(titleHay, term)
      const x = findAll(textHay, term)
      if (!t.length && !x.length) {
        ok = false
        break
      }
      titleHits.push(...t)
      textHits.push(...x)
      // 标题命中 10 分，正文命中 1 分；标题开头的再多给一点
      score += t.length * 10 + x.length
      if (titleHay.startsWith(term)) score += 12
    }
    if (!ok) continue

    // 摘要：截第一处正文命中的前后文；正文没命中就取开头
    let snippet = item.text
    let snippetHits: Highlight[] = []
    if (textHits.length) {
      const first = textHits[0].start
      const start = Math.max(0, first - SNIPPET_RADIUS)
      const end = Math.min(item.text.length, first + SNIPPET_RADIUS * 2)
      /*  省略号也算进片段长度里：先在前面补上 '…'，再按补完之后的
       *  坐标系算高亮位置。之前是先算位置再补 '…'，所有命中都往前串了一个字
       *  （截中段的结果里，高亮会盖到命中词左边那个字上）。 */
      const head = start > 0 ? '…' : ''
      const tail = end < item.text.length ? '…' : ''
      snippet = head + item.text.slice(start, end) + tail
      const shift = head.length - start
      snippetHits = textHits
        .filter((h) => h.start >= start && h.end <= end)
        .map((h) => ({ start: h.start + shift, end: h.end + shift }))
    } else {
      snippet = item.text.slice(0, SNIPPET_RADIUS * 2)
    }

    results.push({ item, score, titleHits, textHits, snippet, snippetHits })
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const da = a.item.date ?? ''
    const db = b.item.date ?? ''
    if (da !== db) return db < da ? -1 : 1
    return a.item.title.localeCompare(b.item.title, 'zh-Hans-CN')
  })

  return results
}
