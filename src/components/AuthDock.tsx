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
  /** 退出登录的二次确认 */
  const [confirmLogout, setConfirmLogout] = useState(false)
  /** 悬停预览：收起态下悬浮头像，圆往右撑开露出名字和邮箱 */
  const [peek, setPeek] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { weather, locate, failed, request, address } = useWeather()

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
  // 首字母与回退色优先用 SSO 给的，和账号页保持一致
  const initial = user?.initial || (displayName ? displayName[0].toUpperCase() : '')
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div
      className="auth-dock"
      data-open={open}
      data-auth={user ? 'in' : 'out'}
      data-peek={peek && !open}
      data-heat={heatFull ? 'year' : 'half'}
      ref={rootRef}
      /*  监听整个坞而不只是头像：撑开之后指针移到文字上时，
       *  面板不该立刻缩回去 */
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => setPeek(false)}
    >
      <div className="auth-dock__panel">
        <div className="auth-dock__head">
          <button
            type="button"
            className="auth-dock__trigger"
            onClick={() => {
              setConfirmLogout(false)
              setOpen((v) => !v)
            }}
            aria-expanded={open}
            aria-label={open ? '收起' : user ? '账号菜单' : '登录'}
          >
            {loading ? (
              <span className="auth-dock__spin" />
            ) : user?.picture ? (
              <img className="auth-dock__pic" src={user.picture} alt="" />
            ) : user ? (
              <span
                className="auth-dock__initial"
                style={user?.avatar_color ? { background: user.avatar_color } : undefined}
              >
                {initial}
              </span>
            ) : (
              <Icon name="user" size={20} />
            )}
          </button>

          {user && (
            <span className="auth-dock__divider" aria-hidden="true" />
          )}

          {user && (
            <div className="auth-dock__ident">
              <strong>{displayName}</strong>
              {user.email && <span title={user.email}>{user.email}</span>}
            </div>
          )}

          <div className="auth-dock__head-right">
            <ThemeSwitch />
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

          {user && confirmLogout ? (
            /*  确认时把整个内容区换掉，而不是浮在上面：
             *  面板有 overflow:hidden，浮层既会被裁也会压住时钟 */
            <div className="auth-dock__confirm" role="alertdialog" aria-label="确认退出登录">
              <span className="auth-dock__confirm-q">确认退出登录？</span>
              <div className="auth-dock__confirm-acts">
                <button type="button" onClick={() => setConfirmLogout(false)}>
                  取消
                </button>
                <button type="button" className="is-danger" onClick={logout}>
                  退出
                </button>
              </div>
            </div>
          ) : !user ? (
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
                {/*  始终渲染完整一年：半年态由 CSS 右对齐、左侧溢出裁掉。
                    展开时面板变宽，被裁掉的左半部分自然滑出来 ——
                    不需要重新渲染，滑出动画直接由宽度过渡驱动。 */}
                <GithubHeatmap login={user?.github?.login} compact />
              </div>

              <div className="auth-dock__weather">
                <span className="auth-dock__wicon" aria-hidden="true">
                  <Icon
                    name={weather ? weatherIcon(weather.code, weather.isDay) : 'wind'}
                    size={17}
                  />
                </span>
                <strong>{weather ? `${weather.temp}°` : '--°'}</strong>
                <span className="auth-dock__wlabel">
                  {weather ? weather.label : failed ? '暂不可用' : '--'}
                </span>
                <span className="auth-dock__wcity">{address || '--'}</span>

                {/*  退出按钮放在这一行最右边：
                 *  和上面的主题开关右侧对齐，一列两个小圆钮。 */}
                <button
                  type="button"
                  className="auth-dock__logout"
                  onClick={() => setConfirmLogout(true)}
                  aria-label="退出登录"
                  title="退出登录"
                >
                  <Icon name="logout" size={15} />
                </button>

                {/*  没授权就盖一层，写清楚要授权什么 */}
                {locate !== 'granted' && (
                  <div className="auth-dock__wveil">
                    <span className="auth-dock__wveil-text">
                      {locate === 'denied'
                        ? '已拒绝定位权限'
                        : locate === 'unsupported'
                          ? '浏览器不支持定位'
                          : locate === 'asking'
                            ? '正在请求定位…'
                            : '当前无法获取地址'}
                    </span>
                    {locate !== 'asking' && locate !== 'unsupported' && (
                      <button type="button" className="auth-dock__wgrant" onClick={request}>
                        授权
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
