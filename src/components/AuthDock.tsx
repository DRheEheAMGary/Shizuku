/* ============================================================================
 *  Shizuku · 左上角登录坞
 * ----------------------------------------------------------------------------
 *  收起态是一枚圆形头像按钮；点击后从圆形展开成一块玻璃面板。
 *
 *    收起  ⬤
 *    展开  ┌──────────────────────┐
 *          │ (头像)       [开关][退出]│
 *          │ 14:32                 │
 *          │ 下午好                 │
 *          │ ────────────────────  │
 *          │ ☀ 24° 晴      上海     │
 *          └──────────────────────┘
 *
 *  未登录只有一枚「登录 / 注册」主按钮。
 *  登录后不再放账号中心之类的链接 —— 那些在 sso.dreamgary.cn/account 里。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { ThemeSwitch } from './ThemeSwitch'
import { GithubHeatmap } from './GithubHeatmap'
import { useAuth } from '@/hooks/useAuth'
import { useWeather } from '@/hooks/useWeather'
import './AuthDock.css'

/** 按小时给问候语 */
function greetingOf(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 23) return '晚上好'
  return '夜深了'
}

/** 天气代码 → 图标（用现成图标近似，避免为天气再引一套图形） */
function weatherIcon(code: number, isDay: boolean) {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon'
  if (code <= 3) return 'wind'
  if (code <= 57) return 'water'
  if (code <= 67) return 'water'
  if (code <= 86) return 'water'
  return 'wind'
}

export function AuthDock() {
  const { user, loading, error, login, logout, dismissError } = useAuth()
  const [open, setOpen] = useState(false)
  /** 热力图展开：最近一个月 ↔ 最近半年 */
  const [heatFull, setHeatFull] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { weather, failed, city } = useWeather()

  // 本地时间，每分钟刷新一次就够（显示到分钟）
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000)
    return () => window.clearInterval(id)
  }, [])

  // 点外面 / Esc 收起
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const displayName = user?.name || user?.preferred_username || ''
  const initial = displayName ? displayName[0].toUpperCase() : ''
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div
      className="auth-dock"
      data-open={open}
      data-auth={user ? 'in' : 'out'}
      data-heat={heatFull ? 'year' : 'half'}
      ref={rootRef}
    >
      <div className="auth-dock__panel">
        <div className="auth-dock__head">
          <button
            type="button"
            className="auth-dock__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? '收起' : user ? '账号菜单' : '登录'}
          >
            {loading ? (
              <span className="auth-dock__spin" />
            ) : user?.picture ? (
              <img className="auth-dock__pic" src={user.picture} alt="" />
            ) : user ? (
              <span className="auth-dock__initial">{initial}</span>
            ) : (
              <Icon name="user" size={20} />
            )}
          </button>

          {user && (
            <div className="auth-dock__ident">
              <strong>{displayName}</strong>
              {user.email && <span>{user.email}</span>}
            </div>
          )}

          <div className="auth-dock__head-right">
            <ThemeSwitch />
            {user && (
              <button
                type="button"
                className="auth-dock__logout"
                onClick={logout}
                aria-label="退出登录"
                title="退出登录"
              >
                <Icon name="logout" size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="auth-dock__body" aria-hidden={!open}>
          {error && (
            <div className="auth-dock__error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={dismissError} aria-label="关闭">
                ✕
              </button>
            </div>
          )}

          {!user ? (
            <button type="button" className="auth-dock__cta" onClick={login} disabled={loading}>
              {loading ? '登录中…' : '登录 / 注册'}
            </button>
          ) : (
            <>
              <div className="auth-dock__clock">
                <strong>{time}</strong>
                <span>{greetingOf(now.getHours())}</span>
              </div>

              <div className="auth-dock__heat">
                <div className="auth-dock__heat-head">
                  <span className="auth-dock__heat-title">
                    <Icon name="github" size={14} />
                    GitHub 贡献
                  </span>
                  <button
                    type="button"
                    className={`auth-dock__heat-toggle${heatFull ? ' is-open' : ''}`}
                    onClick={() => setHeatFull((v) => !v)}
                    aria-label={heatFull ? '收起，只看最近半年' : '展开，查看最近一年'}
                    title={heatFull ? '收起（半年）' : '展开（一年）'}
                  >
                    <Icon name="chevron" size={13} />
                  </button>
                </div>
                <GithubHeatmap
                  login={user?.github?.login}
                  weeks={heatFull ? 53 : 26}
                  compact
                />
              </div>

              <div className="auth-dock__weather">
                {weather ? (
                  <>
                    <span className="auth-dock__wicon" aria-hidden="true">
                      <Icon name={weatherIcon(weather.code, weather.isDay)} size={17} />
                    </span>
                    <strong>{weather.temp}°</strong>
                    <span className="auth-dock__wlabel">{weather.label}</span>
                    <span className="auth-dock__wcity">{city}</span>
                  </>
                ) : (
                  <span className="auth-dock__wlabel">{failed ? '天气暂不可用' : '正在获取天气…'}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
