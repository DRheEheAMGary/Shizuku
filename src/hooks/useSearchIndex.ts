/* ============================================================================
 *  Shizuku · 搜索索引
 * ----------------------------------------------------------------------------
 *  索引是服务器上生成的一份静态 JSON，拉一次就缓存住。
 *  拉不到不报错 —— 搜索按钮照常在，只是打开后提示索引还没生成。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import type { SearchIndex } from '@/lib/search'

const INDEX_URL = '/search-index.json'

/** 模块级缓存：整个会话只拉一次 */
let cached: SearchIndex | null = null
let inflight: Promise<SearchIndex | null> | null = null

function fetchIndex(): Promise<SearchIndex | null> {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight

  inflight = fetch(INDEX_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: SearchIndex | null) => {
      if (data && Array.isArray(data.items)) {
        cached = data
        return data
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function useSearchIndex() {
  const [index, setIndex] = useState<SearchIndex | null>(cached)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchIndex().then((data) => {
      if (!alive) return
      if (data) setIndex(data)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return { index, failed }
}
