/* ============================================================================
 *  Shizuku · GitHub 贡献热力图
 * ----------------------------------------------------------------------------
 *  数据来自 github-contributions-api.jogruber.de（无需 token）。
 *  失败时静默降级为一行提示，不阻塞页面。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import './GithubHeatmap.css'

const USERNAME = 'DRheEheAMGary'
const API = `https://github-contributions-api.jogruber.de/v4/${USERNAME}?y=last`

interface Contribution {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

interface ApiResponse {
  total: Record<string, number>
  contributions: Contribution[]
}

/** 把日期序列按「周」切成列 */
function toWeeks(days: Contribution[]): Contribution[][] {
  const weeks: Contribution[][] = []
  let current: Contribution[] = []

  for (const day of days) {
    const weekday = new Date(day.date + 'T00:00:00').getDay() // 0=周日
    if (weekday === 0 && current.length) {
      weeks.push(current)
      current = []
    }
    current.push(day)
  }
  if (current.length) weeks.push(current)
  return weeks
}

export function GithubHeatmap() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; weeks: Contribution[][]; total: number }
  >({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch(API, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<ApiResponse>
      })
      .then((data) => {
        const total = Object.values(data.total ?? {}).reduce((a, b) => a + b, 0)
        setState({ status: 'ready', weeks: toWeeks(data.contributions ?? []), total })
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setState({ status: 'error' })
      })

    return () => controller.abort()
  }, [])

  if (state.status === 'loading') {
    return <p className="heat__note">加载中…</p>
  }

  if (state.status === 'error') {
    return (
      <p className="heat__note">
        暂时拿不到数据 ——{' '}
        <a href={`https://github.com/${USERNAME}`} target="_blank" rel="noreferrer noopener">
          去 GitHub 看
        </a>
      </p>
    )
  }

  return (
    <div className="heat">
      <div className="heat__grid" role="img" aria-label={`过去一年共 ${state.total} 次贡献`}>
        {state.weeks.map((week, wi) => (
          <div className="heat__week" key={wi}>
            {week.map((day) => (
              <span
                key={day.date}
                className="heat__day"
                data-level={day.level}
                title={`${day.date}：${day.count} 次`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="heat__foot">
        <span>过去一年共 {state.total} 次贡献</span>
        <span className="heat__legend">
          少
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="heat__day" data-level={l} />
          ))}
          多
        </span>
      </div>
    </div>
  )
}
