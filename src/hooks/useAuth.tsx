/* ============================================================================
 *  Shizuku · 登录状态
 * ----------------------------------------------------------------------------
 *  启动时：先读本地快照把界面点亮，再尝试消费 OAuth 回调。
 *  回调消费成功就换成真实资料；失败则清掉并给出错误。
 *
 *  access_token 不出现在任何 React 状态里 —— 只在 handleCallback 内部
 *  用一次拿 userinfo，随后丢弃。界面只依赖 sub / name / picture 这些公开字段。
 * ========================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { handleCallback, loadUser, logout as doLogout, startLogin } from '@/auth/client'
import type { SsoUser } from '@/auth/client'

interface AuthApi {
  user: SsoUser | null
  /** 回调是否还在处理中 */
  loading: boolean
  error: string | null
  login: () => void
  logout: () => void
  dismissError: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

/*  StrictMode 在开发环境会把 effect 跑两遍（mount → cleanup → mount）。
 *  而 OAuth 回调是一次性的：第一次已经用掉 code 和 PKCE 中间态，
 *  第二次必然找不到，还会覆盖掉第一次的结果。
 *  用模块级标记保证只消费一次。 */
let callbackConsumed = false

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SsoUser | null>(loadUser)
  const [loading, setLoading] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.has('code') && p.has('state')
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (callbackConsumed) return
    callbackConsumed = true

    handleCallback()
      .then((u) => {
        if (u) setUser(u)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(() => {
    void startLogin()
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    doLogout()
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  const value = useMemo<AuthApi>(
    () => ({ user, loading, error, login, logout, dismissError }),
    [user, loading, error, login, logout, dismissError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
