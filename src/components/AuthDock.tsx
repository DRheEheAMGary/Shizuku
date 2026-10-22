/* ============================================================================
 *  Shizuku · 左上角登录坞
 * ----------------------------------------------------------------------------
 *  收起态是一枚圆形头像按钮；点击后从圆形展开成一块玻璃面板。
 *
 *    收起  ⬤
 *    展开  ┌──────────────────┐
 *          │ (头像)      (开关) │
 *          │ ────────────────  │
 *          │ 登录 / 注册        │   ← 未登录
 *          └──────────────────┘
 *
 *  展开动画靠容器自身从 46×46 圆角 999px 长到面板尺寸，
 *  内容随后淡入 —— 视觉上就是「圆形被拉开」。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { ThemeSwitch } from './ThemeSwitch'
import { useAuth } from '@/hooks/useAuth'
import { SSO_ISSUER } from '@/auth/config'
import './AuthDock.css'

export function AuthDock() {
  const { user, loading, error, login, logout, dismissError } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="auth-dock" data-open={open} data-auth={user ? 'in' : 'out'} ref={rootRef}>
      <div className="auth-dock__panel">
        {/* 头行：头像 + 主题开关 —— 收起时只剩头像那一块露出来 */}
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

          <div className="auth-dock__head-right">
            <ThemeSwitch />
          </div>
        </div>

        {/* 内容区 */}
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
              <div className="auth-dock__who">
                <strong>{displayName}</strong>
                {user.email && <span>{user.email}</span>}
              </div>
              <div className="auth-dock__tiles">
                <a
                  className="auth-dock__tile"
                  href={`${SSO_ISSUER}/account/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="settings" size={17} />
                  <span>账号中心</span>
                </a>
                <button type="button" className="auth-dock__tile" onClick={logout}>
                  <Icon name="logout" size={17} />
                  <span>退出登录</span>
                </button>
              </div>
              <a
                className="auth-dock__wide"
                href={`${SSO_ISSUER}/account/`}
                target="_blank"
                rel="noreferrer"
              >
                管理绑定与安全设置
                <Icon name="arrow-up-right" size={14} />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
