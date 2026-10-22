/* ============================================================================
 *  Shizuku · GitHub 贡献热力图
 * ----------------------------------------------------------------------------
 *  GitHub 登录名来自 SSO 的 /userinfo（只有绑定了 GitHub 才有）。
 *  贡献数据来自 github-contributions-api.jogruber.de（无需 token）。
 *
 *  未绑定时不请求、不报错 —— 直接渲染一整年的空格子，
 *  在上面盖一句提示，版式不会因为状态不同而跳动。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import './GithubHeatmap.css'

const API = (login: string) =>
  `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=last`

/** 未绑定时用来撑版式的空序列：一整年、全 0 */
function emptyYear(): Contribution[] {
  const days: Contribution[] = []
  const today = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push({ date: d.toISOString().slice(0, 10), count: 0, level: 0 })
  }
  return days
}

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

/** 取最后 N 周 */
function makeSlicer(weeks?: number) {
  return (all: Contribution[][]) => (weeks && weeks > 0 ? all.slice(-weeks) : all)
}

interface HeatmapProps {
  /** 绑定的 GitHub 登录名；为空表示未绑定 */
  login?: string
  /** 只显示最后 N 周（默认全部 53 周） */
  weeks?: number
  /** 紧凑模式：不显示底部的统计与图例 */
  compact?: boolean
}

export function GithubHeatmap({ login, weeks, compact = false }: HeatmapProps) {
  const sliceWeeks = makeSlicer(weeks)
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; weeks: Contribution[][]; total: number }
  >({ status: 'loading' })

  useEffect(() => {
    if (!login) return
    const controller = new AbortController()

    fetch(API(login), { signal: controller.signal })
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
  }, [login])

  // 未绑定：铺一整年的空格子，上面盖一句提示
  if (!login) {
    return (
      <div className="heat">
        <div className="heat__grid" aria-hidden="true">
          {sliceWeeks(toWeeks(emptyYear())).map((week, wi) => (
            <div className="heat__week" key={wi}>
              {week.map((day) => (
                <span key={day.date} className="heat__day" data-level={0} />
              ))}
            </div>
          ))}
        </div>
        <div className="heat__veil">
          <span>此账号暂未绑定 GitHub</span>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return <p className="heat__note">加载中…</p>
  }

  if (state.status === 'error') {
    return (
      <p className="heat__note">
        暂时拿不到数据 ——{' '}
        <a href={`https://github.com/${login}`} target="_blank" rel="noreferrer noopener">
          去 GitHub 看
        </a>
      </p>
    )
  }

  return (
    <div className="heat">
      <div className="heat__grid" role="img" aria-label={`过去一年共 ${state.total} 次贡献`}>
        {sliceWeeks(state.weeks).map((week, wi) => (
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

      {!compact && (
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
      )}
    </div>
  )
}
