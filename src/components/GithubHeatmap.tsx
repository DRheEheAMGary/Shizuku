/* ============================================================================
 *  Shizuku · GitHub 贡献热力图
 * ----------------------------------------------------------------------------
 *  GitHub 登录名来自 SSO 的 /userinfo（只有绑定了 GitHub 才有）。
 *  贡献数据走 **SSO 的 /api/contributions 代理**，不直连第三方：
 *  上游 jogruber 在国内网络下经常不可达，直连会一直卡在「加载中」。
 *
 *  未绑定时不请求、不报错 —— 直接渲染一整年的空格子，
 *  在上面盖一句提示，版式不会因为状态不同而跳动。
 *
 *  鼠标悬浮在格子上会浮出一块提示框（日期 + 贡献次数），做法参考 Gary-Homepage：
 *  挂到 body 上、fixed 定位、贴边收敛、上方放不下就翻到下方、滚动即收起。
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { createPortal } from 'react-dom'
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

  /** 最后一次悬浮的格子。收起时保留内容，才能完整淡出。 */
  const [tip, setTip] = useState<{ date: string; count: number; anchor: DOMRect } | null>(null)
  /** 渐入渐出开关：与内容分开，收起时不清空文字 */
  const [tipVisible, setTipVisible] = useState(false)
  /** 提示框落点：量完它自己的尺寸才算得出来 */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  /*  位置在绘制之前算好（useLayoutEffect 早于浏览器 paint），
   *  换格子时不会先闪一下旧位置。 */
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return
    const box = tipRef.current.getBoundingClientRect()
    const a = tip.anchor
    // 水平：与格子中心对齐，再收进视口内边距
    const left = Math.max(
      8,
      Math.min(window.innerWidth - box.width - 8, a.left + a.width / 2 - box.width / 2),
    )
    // 垂直：优先放上方；顶上放不下就翻到下方
    let top = a.top - box.height - 8
    if (top < 8) top = a.bottom + 8
    setPos({ left, top })
  }, [tip])

  /*  滚动 / 改窗口之后格子的位置就不准了，直接收起来（和 Gary-Homepage 一致） */
  useEffect(() => {
    if (!tipVisible) return
    const hide = () => setTipVisible(false)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [tipVisible])

  const showTip = (e: MouseEvent<HTMLSpanElement>, day: Contribution) => {
    setTip({
      date: day.date,
      count: day.count,
      anchor: e.currentTarget.getBoundingClientRect(),
    })
    setTipVisible(true)
  }

  const hideTip = () => setTipVisible(false)

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
                onMouseEnter={day ? (e) => showTip(e, day) : undefined}
                onMouseLeave={day ? hideTip : undefined}
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

      {/*  提示框挂到 body 上：坞的面板是 overflow:hidden，
          而且它带 backdrop-filter，会把 fixed 定位拉回面板自己身上 ——
          留在里面既会被裁，位置也会错。 */}
      {createPortal(
        <div
          ref={tipRef}
          className="heat__tip"
          data-visible={tipVisible && !!pos}
          style={pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : undefined}
          role="tooltip"
        >
          {tip ? `${tip.date} 共计 ${tip.count} 次贡献` : ''}
        </div>,
        document.body,
      )}
    </div>
  )
}