/* ============================================================================
 *  Shizuku · GitHub 贡献热力图
 * ----------------------------------------------------------------------------
 *  GitHub 登录名来自 SSO 的 /userinfo（只有绑定了 GitHub 才有）。
 *  贡献数据走 **SSO 的 /api/contributions 代理**，不直连第三方：
 *  上游 jogruber 在国内网络下经常不可达，直连会一直卡在「加载中」。
 *
 *  未绑定时不请求、不报错 —— 直接渲染一整年的空格子，
 *  在上面盖一句提示，版式不会因为状态不同而跳动。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import { SSO_ISSUER } from '@/auth/config'
import './GithubHeatmap.css'

const API = (login: string) =>
  `${SSO_ISSUER}/api/contributions?login=${encodeURIComponent(login)}`

/** 超时兜底：上游慢的时候别一直转圈 */
const TIMEOUT_MS = 15_000

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

/** 经 SSO 代理后 total 已经是汇总好的数字 */
interface ApiResponse {
  total: number | Record<string, number>
  contributions: Contribution[]
}

/** 空位：补齐首尾残缺周用的占位，渲染成透明格子 */
type Slot = Contribution | null

/**  把日期序列按「周」切成列，并补齐成 7 行。
 *
 *  不补的话首尾那一列只有 1~2 个格子，视觉上像「没渲染完的小竖条」。
 *  补成全高之后每一列都是 7 格，右边缘齐平。 */
function toWeeks(days: Contribution[]): Slot[][] {
  if (days.length === 0) return []

  const weeks: Slot[][] = []
  let current: Slot[] = []

  // 首列对齐到周日
  const firstWeekday = new Date(days[0].date + 'T00:00:00').getDay()
  for (let i = 0; i < firstWeekday; i++) current.push(null)

  for (const day of days) {
    current.push(day)
    if (current.length === 7) {
      weeks.push(current)
      current = []
    }
  }

  // 末列补满
  if (current.length > 0) {
    while (current.length < 7) current.push(null)
    weeks.push(current)
  }

  return weeks
}

/** 取最后 N 周 */
function makeSlicer(weeks?: number) {
  return (all: Slot[][]) => (weeks && weeks > 0 ? all.slice(-weeks) : all)
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
    | { status: 'ready'; weeks: Slot[][]; total: number }
  >({ status: 'loading' })

  useEffect(() => {
    if (!login) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)

    fetch(API(login), { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<ApiResponse>
      })
      .then((data) => {
        const raw = data.total
        const total =
          typeof raw === 'number'
            ? raw
            : Object.values(raw ?? {}).reduce((a, b) => a + b, 0)
        setState({ status: 'ready', weeks: toWeeks(data.contributions ?? []), total })
      })
      .catch(() => setState({ status: 'error' }))
      .finally(() => window.clearTimeout(timer))

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [login])

  // 未绑定：铺一整年的空格子，上面盖一句提示
  if (!login) {
    return (
      <div className="heat">
        <div className="heat__grid" aria-hidden="true">
          {sliceWeeks(toWeeks(emptyYear())).map((week, wi) => (
            <div className="heat__week" key={wi}>
              {week.map((day, di) =>
                day ? (
                  <span key={day.date} className="heat__day" data-level={0} />
                ) : (
                  <span key={`blank-${wi}-${di}`} className="heat__day is-blank" />
                ),
              )}
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
            {week.map((day, di) => (
              <span
                key={day?.date ?? `blank-${wi}-${di}`}
                className={`heat__day${day ? '' : ' is-blank'}`}
                data-level={day?.level ?? 0}
                title={day ? `${day.date}：${day.count} 次` : undefined}
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
