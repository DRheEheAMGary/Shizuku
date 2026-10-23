/* ============================================================================
 *  Shizuku · 全域搜索面板
 * ----------------------------------------------------------------------------
 *  索引是服务器上生成的一份静态 JSON（博客文章 + MC 文档），
 *  拉下来在浏览器里搜 —— 不给静态站加 PHP，搜索也没有网络往返。
 *
 *  面板是磨砂玻璃，键入即搜；↑↓ 选、Enter 打开、Esc 关闭。
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import { SITE_NAMES, SITE_TYPES, searchItems } from '@/lib/search'
import type { Highlight } from '@/lib/search'
import './SearchOverlay.css'

/** 把命中的片段切出来，命中部分单独包一层 */
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

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { index, failed } = useSearchIndex()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(
    () => (index ? searchItems(index.items, query) : []),
    [index, query],
  )

  /*  按站点分组，但排序仍按总分 —— 组内保持结果顺序 */
  const groups = useMemo(() => {
    const map = new Map<string, typeof results>()
    for (const r of results) {
      const key = r.item.site
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }
    return [...map.entries()]
  }, [results])

  // 打开时聚焦输入框、清空上一次的查询
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [open])

  // 查询变了，选中项回到第一条
  useEffect(() => {
    setActive(0)
  }, [query])

  // 键盘：↑↓ 移动、Enter 打开、Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((v) => (results.length ? (v + 1) % results.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((v) => (results.length ? (v - 1 + results.length) % results.length : 0))
      } else if (e.key === 'Enter') {
        const hit = results[active]
        if (hit) {
          e.preventDefault()
          window.open(hit.item.url, '_blank', 'noopener')
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, active, onClose])

  // 选中项滚进视野
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  if (!open) return null

  let flat = 0

  return (
    <div className="search-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="search-panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="全域搜索"
      >
        <div className="search-panel__bar">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className="search-panel__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索博客与文档…"
            spellCheck={false}
            autoComplete="off"
            aria-label="搜索"
          />
          <kbd className="search-panel__kbd">esc</kbd>
        </div>

        <div className="search-panel__body" ref={listRef}>
          {failed ? (
            <p className="search-panel__note">搜索索引还没生成，稍后再来。</p>
          ) : !query.trim() ? (
            <p className="search-panel__note">
              输入关键词，跨博客文章与 MC 文档搜索。
            </p>
          ) : !results.length ? (
            <p className="search-panel__note">没有找到「{query.trim()}」</p>
          ) : (
            groups.map(([site, list]) => (
              <section className="search-group" key={site}>
                <h3 className="search-group__title">
                  {SITE_NAMES[site] ?? site}
                  <span className="search-group__count">{list.length}</span>
                </h3>
                {list.map((r) => {
                  const i = flat++
                  const isActive = i === active
                  return (
                    <a
                      key={r.item.url}
                      className="search-hit-row"
                      data-active={isActive}
                      href={r.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setActive(i)}
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
                      {r.snippet && (
                        <span className="search-hit-row__snippet">
                          {highlight(r.snippet, r.snippetHits)}
                        </span>
                      )}
                    </a>
                  )
                })}
              </section>
            ))
          )}
        </div>

        <div className="search-panel__foot">
          <span>↑↓ 选择</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
          {index && (
            <span className="search-panel__foot-count">{index.items.length} 条索引</span>
          )}
        </div>
      </div>
    </div>
  )
}
