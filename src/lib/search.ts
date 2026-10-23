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
  /** 以下三项只有博客文章有（MC 文档不写这些字段） */
  author?: string
  tags?: string[]
  cats?: string[]
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

/** 博客文章上可以命中的附属项 */
export type FacetKind = 'author' | 'tag' | 'cat'

/** 命中了哪一项：作者 / 标签 / 分类 */
export interface FacetMatch {
  kind: FacetKind
  /** 展示用的前缀：作者 / 标签 / 分类 */
  label: string
  /** 项本身的值，命中处高亮 */
  value: string
  hits: Highlight[]
}

const FACET_LABELS: Record<FacetKind, string> = {
  author: '作者',
  tag: '标签',
  cat: '分类',
}

/** 附属项命中一次的权重：比正文重，比标题轻 */
const FACET_WEIGHT = 6

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
  /** 命中的作者 / 标签 / 分类 */
  facets: FacetMatch[]
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

    /*  附属项：作者、每个标签、每个分类各算一条可以命中的「字段」 */
    const facetFields: { kind: FacetKind; value: string }[] = []
    if (item.author) facetFields.push({ kind: 'author', value: item.author })
    for (const v of item.tags ?? []) facetFields.push({ kind: 'tag', value: v })
    for (const v of item.cats ?? []) facetFields.push({ kind: 'cat', value: v })

    const facetHits = new Map<number, Highlight[]>()

    for (const term of terms) {
      const t = findAll(titleHay, term)
      const x = findAll(textHay, term)
      /*  必须按「当前这个词」判断有没有命中附属项：
       *  facetHits 是累积的，拿它判断会让后续的词白蹭前面的命中，
       *  多词查询里只要第一个词中了，后面的词不中也会放行。 */
      let termViaFacet = false
      facetFields.forEach((f, fi) => {
        const h = findAll(f.value.toLowerCase(), term)
        if (h.length) {
          termViaFacet = true
          const prev = facetHits.get(fi) ?? []
          facetHits.set(fi, prev.concat(h))
        }
      })
      if (!t.length && !x.length && !termViaFacet) {
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

    const facets: FacetMatch[] = []
    facetFields.forEach((f, fi) => {
      const h = facetHits.get(fi)
      if (h && h.length) {
        facets.push({ kind: f.kind, label: FACET_LABELS[f.kind], value: f.value, hits: h })
        score += h.length * FACET_WEIGHT
      }
    })

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
    } else if (facets.length) {
      /*  正文没命中、但作者/标签/分类中了：不显示正文预览，
       *  那一行位置留给「作者：xxx」这类信息（内容命中时永远优先显示内容）。 */
      snippet = ''
      snippetHits = []
    } else {
      snippet = item.text.slice(0, SNIPPET_RADIUS * 2)
    }

    results.push({ item, score, titleHits, textHits, snippet, snippetHits, facets })
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
