/* ============================================================================
 *  Shizuku · 搜索结果面板
 * ----------------------------------------------------------------------------
 *  从顶栏胶囊底下拉出的一块玻璃。输入框本身在顶栏里，这里只负责列结果。
 *  开启 ✦ AI 后：已登录 SSO 用户可按 Enter 或点击按钮结合站内索引向 AI 提问。
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SSO_ISSUER } from '@/auth/config'
import { useAuth } from '@/hooks/useAuth'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import { SITE_NAMES, SITE_TYPES, searchItems } from '@/lib/search'
import type { Highlight } from '@/lib/search'
import './SearchPanel.css'

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

/** 将 AI 回复里的 [标题](https://...) 与裸 https:// 链接安全渲染为 React 节点 */
function renderAiText(text: string) {
  const re = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>()]+)/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const label = m[1] ?? m[3]
    const href = m[2] ?? m[3]
    nodes.push(
      <a
        key={key++}
        className="search-ai-box__link"
        href={href}
        target="_blank"
        rel="noreferrer noopener"
      >
        {label}
      </a>,
    )
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

interface AiState {
  status: 'idle' | 'loading' | 'done' | 'error'
  askedQuery: string
  answer: string
  error: string
  remaining?: number
  limit?: number
}

const INITIAL_AI: AiState = {
  status: 'idle',
  askedQuery: '',
  answer: '',
  error: '',
}

export function SearchPanel({
  query,
  aiGlow = false,
  aiSubmitCount = 0,
  onClose,
}: {
  query: string
  aiGlow?: boolean
  aiSubmitCount?: number
  onClose: () => void
}) {
  const { user, login } = useAuth()
  const { index, failed } = useSearchIndex()
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [aiState, setAiState] = useState<AiState>(INITIAL_AI)

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

  const askAi = useCallback(async () => {
    const q = query.trim()
    if (!q || !user) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setAiState({
      status: 'loading',
      askedQuery: q,
      answer: '',
      error: '',
    })

    const contexts = results.slice(0, 6).map((r) => ({
      title: r.item.title,
      site: SITE_NAMES[r.item.site] ?? r.item.site,
      url: r.item.url,
      snippet: r.snippet || r.item.text.slice(0, 200),
    }))

    try {
      const res = await fetch(`${SSO_ISSUER}/api/ai-search.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, contexts }),
        signal: ac.signal,
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        answer?: string
        remaining?: number
        limit?: number
        message?: string
      } | null

      if (!res.ok || !data?.ok || !data.answer) {
        setAiState({
          status: 'error',
          askedQuery: q,
          answer: '',
          error: data?.message || `请求失败（${res.status}）`,
        })
        return
      }

      setAiState({
        status: 'done',
        askedQuery: q,
        answer: data.answer,
        error: '',
        remaining: data.remaining,
        limit: data.limit,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setAiState({
        status: 'error',
        askedQuery: q,
        answer: '',
        error: '网络异常，暂时无法连接 AI 服务',
      })
    }
  }, [query, results, user])

  useEffect(() => {
    if (!aiGlow) {
      abortRef.current?.abort()
      setAiState(INITIAL_AI)
    }
  }, [aiGlow])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (aiGlow && aiSubmitCount > 0) {
      void askAi()
    }
  }, [aiGlow, aiSubmitCount, askAi])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query])

  let content: React.ReactNode
  let isListbox = false

  if (failed) {
    content = <p className="search-panel__note">搜索索引还没生成，稍后再来。</p>
  } else if (!query.trim()) {
    content = (
      <>
        <p className="search-panel__note">
          {aiGlow ? 'AI 搜索模式 · 输入问题后按 Enter 提问' : '全域搜索 (可能存在 30 min 延迟)'}
        </p>
        {index && (
          <p className="search-panel__note search-panel__note--dim">
            共 {index.items.length} 条索引
          </p>
        )}
      </>
    )
  } else if (!results.length) {
    content = aiGlow ? null : (
      <p className="search-panel__note">没有找到「{query.trim()}」</p>
    )
  } else {
    isListbox = true
    content = groups.map(([site, list]) => (
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
    ))
  }

  return (
    <div
      className={`search-panel${aiGlow ? ' is-ai-glow' : ''}`}
      role={isListbox ? 'listbox' : undefined}
      aria-label={isListbox ? '搜索结果' : undefined}
    >
      <div className="search-panel__scroll" ref={listRef}>
        {aiGlow && (
          <div className="search-ai-box">
            {!user ? (
              <div className="search-ai-box__row">
                <span className="search-ai-box__tip">
                  开启 AI 搜索需要登录 DRheEheAM SSO（将结合站内内容作答）
                </span>
                <button type="button" className="search-ai-box__btn" onClick={login}>
                  登录 SSO
                </button>
              </div>
            ) : (
              <>
                <div className="search-ai-box__row">
                  <span className="search-ai-box__tip">
                    {aiState.status === 'loading'
                      ? `正在思考「${aiState.askedQuery}」…`
                      : '按 Enter 或点击右侧按钮向 AI 提问'}
                  </span>
                  <button
                    type="button"
                    className="search-ai-box__btn"
                    disabled={!query.trim() || aiState.status === 'loading'}
                    onClick={() => void askAi()}
                  >
                    {aiState.status === 'loading' ? '思考中…' : '向 AI 提问'}
                  </button>
                </div>

                {aiState.status === 'error' && (
                  <p className="search-ai-box__error">{aiState.error}</p>
                )}

                {aiState.status === 'done' && (
                  <div className="search-ai-box__answer">
                    <div className="search-ai-box__text">{renderAiText(aiState.answer)}</div>
                    {typeof aiState.remaining === 'number' && typeof aiState.limit === 'number' && (
                      <div className="search-ai-box__quota">
                        今日剩余 {aiState.remaining} / {aiState.limit} 次
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {content}
      </div>
      <span className="search-panel__ai-aura" aria-hidden="true" />
    </div>
  )
}
