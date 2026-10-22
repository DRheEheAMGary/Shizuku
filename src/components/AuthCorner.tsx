/* ============================================================================
 *  Shizuku · 左上角登录交互
 * ----------------------------------------------------------------------------
 *  一枚独立的磨砂玻璃胶囊，贴在顶栏左侧最外端（与居中顶栏同一行）。
 *
 *    未登录：[ ⬤ 登录 ]                    → 跳 SSO 授权
 *    已登录：[ (头像) 名字 ⌄ ]              → 下拉：账号中心 / 退出登录
 *
 *  登录走 sso.dreamgary.cn 的 Authorization Code + PKCE，
 *  细节见 src/auth/client.ts。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useAuth } from '@/hooks/useAuth'
import { SSO_ISSUER } from '@/auth/config'
import './AuthCorner.css'

export function AuthCorner() {
  const { user, loading, error, login, logout, dismissError } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点外面收起下拉
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

  const displayName = user?.name || user?.preferred_username || '已登录'
  const avatar = user?.picture

  return (
    <div className="auth-corner" ref={rootRef}>
      {error && (
        <div className="auth-corner__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="关闭">
            ✕
          </button>
        </div>
      )}

      {!user ? (
        <button
          type="button"
          className="auth-corner__pill"
          onClick={login}
          disabled={loading}
          aria-label="登录"
        >
          <span className="auth-corner__icon" aria-hidden="true">
            {loading ? <span className="auth-corner__spin" /> : <Icon name="user" size={16} />}
          </span>
          <span className="auth-corner__label">{loading ? '登录中' : '登录'}</span>
        </button>
      ) : (
        <button
          type="button"
          className="auth-corner__pill auth-corner__pill--user"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="auth-corner__avatar" aria-hidden="true">
            {avatar ? <img src={avatar} alt="" /> : <Icon name="user" size={16} />}
          </span>
          <span className="auth-corner__label">{displayName}</span>
          <span className={`auth-corner__caret${open ? ' is-open' : ''}`} aria-hidden="true">
            <Icon name="chevron" size={14} />
          </span>
        </button>
      )}

      {open && user && (
        <div className="auth-corner__menu" role="menu">
          <div className="auth-corner__who">
            <strong>{displayName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <a
            className="auth-corner__item"
            role="menuitem"
            href={`${SSO_ISSUER}/account`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="settings" size={15} />
            账号中心
          </a>
          <button type="button" className="auth-corner__item" role="menuitem" onClick={logout}>
            <Icon name="logout" size={15} />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
