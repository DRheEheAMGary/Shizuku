/* ============================================================================
 *  Shizuku · 全域搜索
 * ----------------------------------------------------------------------------
 *  索引是一份静态 JSON（由 tools/build_search_index.py 在服务器上生成），
 *  前端拉下来在浏览器里搜 —— 静态站不用加 PHP，搜索也没有网络往返。
 *
 *  匹配规则：
 *    · 中文没有词边界，按子串匹配（忽略大小写）
 *    · 查询按空白拆成多个词，每个词都必须在标题 / 正文 / 作者 / 标签 / 分类
 *      之一命中，否则整条不算匹配
 *    · 排序：标题命中 > 附属项命中 > 正文命中，同分按日期新→旧、标题字典序
 * ========================================================================== */

export type SearchItemType = 'post' | 'page' | 'doc'

/** 索引里的一条记录，字段与索引器的输出契约一一对应 */
export interface SearchItem {
  /** 站点 id，见 SITE_NAMES */
  site: string
  type: SearchItemType
  title: string
  url: string
  /** 正文纯文本摘要 */
  text: string
  /** ISO 日期；没有日期的条目为 null */
  date: string | null
  /** 以下三项只有博客文章有（MC 文档不写这些字段） */
  author?: string
  tags?: string[]
  cats?: string[]
}

export interface SearchIndex {
  /** 索引生成时间 */
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

/** 找出 needle 在 haystack 里的全部出现位置（忽略大小写，不重叠） */
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

/** 摘要片段的上下文半径：向后多取一些，读起来更像一句话 */
const SNIPPET_RADIUS = 42

/**
 * 在本地索引里搜索。
 *
 * @param items 索引条目
 * @param rawQuery 用户输入，空白分隔多个词
 * @returns 按相关度降序排列的结果，附高亮位置与摘要
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

    /* 附属项：作者、每个标签、每个分类各算一条可以命中的「字段」 */
    const facetFields: { kind: FacetKind; value: string }[] = []
    if (item.author) facetFields.push({ kind: 'author', value: item.author })
    for (const v of item.tags ?? []) facetFields.push({ kind: 'tag', value: v })
    for (const v of item.cats ?? []) facetFields.push({ kind: 'cat', value: v })

    /** 字段下标 → 该字段上的命中位置 */
    const facetHits = new Map<number, Highlight[]>()

    for (const term of terms) {
      const t = findAll(titleHay, term)
      const x = findAll(textHay, term)
      /* 必须按「当前这个词」判断有没有命中附属项：
       * facetHits 是累积的，拿它判断会让后面的词白蹭前面词的命中。 */
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
      // 标题命中 10 分，正文命中 1 分；标题以该词开头再多给一点
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
      /* 省略号也算进片段长度：先补上首尾的 '…'，再按补完后的坐标系
       * 平移高亮位置，否则截中段时高亮会整体错位一个字。 */
      const head = start > 0 ? '…' : ''
      const tail = end < item.text.length ? '…' : ''
      snippet = head + item.text.slice(start, end) + tail
      const shift = head.length - start
      snippetHits = textHits
        .filter((h) => h.start >= start && h.end <= end)
        .map((h) => ({ start: h.start + shift, end: h.end + shift }))
    } else if (facets.length) {
      /* 正文没命中、但作者/标签/分类中了：不显示正文预览，
       * 那一行位置留给「作者：xxx」这类信息（内容命中时永远优先显示内容）。 */
      snippet = ''
      snippetHits = []
    } else {
      snippet = item.text.slice(0, SNIPPET_RADIUS * 2)
    }

    results.push({ item, score, titleHits, textHits, snippet, snippetHits, facets })
  }

  // 相关度优先；同分时日期新的在前，再按标题字典序兜底，保证顺序稳定
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const da = a.item.date ?? ''
    const db = b.item.date ?? ''
    if (da !== db) return db < da ? -1 : 1
    return a.item.title.localeCompare(b.item.title, 'zh-Hans-CN')
  })

  return results
}
