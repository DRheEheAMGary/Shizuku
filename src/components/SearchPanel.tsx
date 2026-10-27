/* ============================================================================
 *  Shizuku · 搜索结果面板
 * ----------------------------------------------------------------------------
 *  从顶栏胶囊底下拉出的一块玻璃。输入框本身在顶栏里，这里只负责列结果。
 *  结果按站点分组，组标题带命中条数；每条结果含标题、类型、日期、
 *  标签/作者等 facet 命中与正文摘要。
 * ========================================================================== */

import { useEffect, useMemo, useRef } from 'react'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import { SITE_NAMES, SITE_TYPES, searchItems } from '@/lib/search'
import type { Highlight } from '@/lib/search'
import './SearchPanel.css'

// 把命中的片段切出来，命中部分包一层 <mark>。
// hits 可能乱序，先按 start 排序再顺序拼接，避免重叠切片错位。
function highlight(text: string, hits: Highlight[]) {
  if (!hits.length) return text
  const sorted = [...hits].sort((a, b) => a.start - b.start)
  const out: React.ReactNode[] = []
  let at = 0
  sorted.forEach((h, i) => {
    if (h.start > at) out.push(text.slice(at, h.start))
    out.push(
      <mark className="search-hit" key={i}>
        {text.slice(h.start, h.end)}
      </mark>,
    )
    at = h.end
  })
  if (at < text.length) out.push(text.slice(at))
  return out
}

export function SearchPanel({
  query,
  onClose,
}: {
  query: string
  onClose: () => void
}) {
  const { index, failed } = useSearchIndex()
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(
    () => (index ? searchItems(index.items, query) : []),
    [index, query],
  )

  const groups = useMemo(() => {
    const map = new Map<string, typeof results>()
    for (const r of results) {
      const list = map.get(r.item.site)
      if (list) list.push(r)
      else map.set(r.item.site, [r])
    }
    return [...map.entries()]
  }, [results])

  // 查询词变化时把面板滚回顶部，避免停留在上一次的滚动位置
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query])

  if (failed) {
    return (
      <div className="search-panel" ref={listRef}>
        <p className="search-panel__note">搜索索引还没生成，稍后再来。</p>
      </div>
    )
  }

  if (!query.trim()) {
    return (
      <div className="search-panel" ref={listRef}>
        <p className="search-panel__note">全域搜索 (可能存在 30 min 延迟)</p>
        {index && (
          <p className="search-panel__note search-panel__note--dim">
            共 {index.items.length} 条索引
          </p>
        )}
      </div>
    )
  }

  if (!results.length) {
    return (
      <div className="search-panel" ref={listRef}>
        <p className="search-panel__note">没有找到「{query.trim()}」</p>
      </div>
    )
  }

  return (
    <div className="search-panel" ref={listRef} role="listbox" aria-label="搜索结果">
      {groups.map(([site, list]) => (
        <section className="search-group" key={site}>
          <h3 className="search-group__title">
            {SITE_NAMES[site] ?? site}
            <span className="search-group__count">{list.length}</span>
          </h3>
          <div className="search-group__rows">
            {list.map((r) => (
              <a
                key={r.item.url}
                className="search-hit-row"
                href={r.item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <span className="search-hit-row__title">
                  {highlight(r.item.title, r.titleHits)}
                </span>
                <span className="search-hit-row__meta">
                  <span className="search-hit-row__type">
                    {SITE_TYPES[r.item.type] ?? r.item.type}
                  </span>
                  {r.item.date && (
                    <span className="search-hit-row__date">{r.item.date}</span>
                  )}
                </span>
                {/* 作者 / 标签 / 分类命中：正文也命中时这一行不显示（内容优先） */}
                {!r.textHits.length && r.facets.length > 0 && (
                  <span className="search-hit-row__facets">
                    {r.facets.map((f, fi) => (
                      <span className="search-facet" data-kind={f.kind} key={fi}>
                        <span className="search-facet__label">{f.label}：</span>
                        {highlight(f.value, f.hits)}
                      </span>
                    ))}
                  </span>
                )}

                {r.snippet && (
                  <span className="search-hit-row__snippet">
                    {highlight(r.snippet, r.snippetHits)}
                  </span>
                )}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
