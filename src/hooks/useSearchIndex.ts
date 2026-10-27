/* ============================================================================
 *  Shizuku · 搜索索引
 * ----------------------------------------------------------------------------
 *  索引是站点根目录下的一份静态 JSON（由 tools/build_search_index.py 在服务器
 *  上生成），整个会话只拉一次并缓存。
 *
 *  拉取失败不抛错：搜索按钮照常可用，面板会提示索引未就绪。
 *  并发调用共用同一个 inflight Promise，避免重复请求。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import type { SearchIndex } from '@/lib/search'

const INDEX_URL = '/search-index.json'

/** 会话级缓存：成功后不再请求 */
let cached: SearchIndex | null = null
/** 进行中的请求，供并发调用复用 */
let inflight: Promise<SearchIndex | null> | null = null

function fetchIndex(): Promise<SearchIndex | null> {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight

  // no-cache：索引由服务器定期重建，允许命中协商缓存但必须回源验证
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

/** 返回索引与「加载失败」标记；失败只影响提示文案，不重试 */
export function useSearchIndex() {
  const [index, setIndex] = useState<SearchIndex | null>(cached)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // 组件卸载后不再 setState
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
