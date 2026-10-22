/* ============================================================================
 *  Shizuku · OIDC 客户端
 * ----------------------------------------------------------------------------
 *  完整流程：
 *
 *    ① startLogin()
 *         生成 verifier / state / nonce → 存 sessionStorage → 跳 /authorize
 *    ② SSO 侧完成登录 → 302 回 /auth/callback?code=&state=
 *    ③ handleCallback()
 *         校验 state → POST /token（带 code_verifier）→ 拿 access_token
 *         → GET /userinfo → 存本地 → 清掉 URL 上的参数
 *    ④ logout()
 *         清本地 → 跳 SSO 的 /logout，把服务端会话也一起结束
 *
 *  只依赖 fetch 与 Web Crypto，没有任何第三方库。
 * ========================================================================== */

import {
  SSO_CLIENT_ID,
  SSO_ENDPOINTS,
  SSO_PKCE_KEY,
  SSO_REDIRECT_URI,
  SSO_SCOPE,
  SSO_USER_KEY,
} from './config'
import { codeChallenge, randomString } from './pkce'

export interface SsoUser {
  sub: string
  name?: string
  preferred_username?: string
  picture?: string
  email?: string
  email_verified?: boolean
  updated_at?: number
}

interface PkceState {
  verifier: string
  state: string
  nonce: string
  /** 登录后回到哪个页面（同源路径） */
  returnTo: string
}

/** ① 跳去授权服务器 */
export async function startLogin(returnTo = window.location.pathname + window.location.search): Promise<void> {
  const verifier = randomString(48)
  const pkce: PkceState = {
    verifier,
    state: randomString(24),
    nonce: randomString(24),
    returnTo,
  }
  sessionStorage.setItem(SSO_PKCE_KEY, JSON.stringify(pkce))

  const url = new URL(SSO_ENDPOINTS.authorize)
  url.searchParams.set('client_id', SSO_CLIENT_ID)
  url.searchParams.set('redirect_uri', SSO_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SSO_SCOPE)
  url.searchParams.set('state', pkce.state)
  url.searchParams.set('nonce', pkce.nonce)
  url.searchParams.set('code_challenge', await codeChallenge(verifier))
  url.searchParams.set('code_challenge_method', 'S256')

  window.location.assign(url.toString())
}

/** ③ 处理回调；没有 code 就返回 null */
export async function handleCallback(): Promise<SsoUser | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    cleanupUrl()
    throw new Error(params.get('error_description') || error)
  }
  if (!code || !state) return null

  const raw = sessionStorage.getItem(SSO_PKCE_KEY)
  sessionStorage.removeItem(SSO_PKCE_KEY)
  if (!raw) throw new Error('登录会话已过期，请重新登录')

  const pkce = JSON.parse(raw) as PkceState
  // state 必须原样返回 —— 这里不一致说明回调不是本次发起的（CSRF）
  if (pkce.state !== state) throw new Error('state 校验失败，已中止')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SSO_REDIRECT_URI,
    client_id: SSO_CLIENT_ID,
    code_verifier: pkce.verifier,
  })

  const tokenRes = await fetch(SSO_ENDPOINTS.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenRes.ok) {
    const detail = await tokenRes.json().catch(() => ({}))
    throw new Error(detail.error_description || '换取令牌失败')
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
  }

  const infoRes = await fetch(SSO_ENDPOINTS.userinfo, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) throw new Error('获取用户资料失败')

  const user = (await infoRes.json()) as SsoUser
  saveUser(user)
  cleanupUrl(pkce.returnTo)
  return user
}

function cleanupUrl(replaceWith?: string): void {
  const clean = replaceWith || window.location.pathname
  window.history.replaceState({}, '', clean)
}

/** 本地缓存的用户（仅用于刷新后恢复界面，不含任何令牌） */
export function loadUser(): SsoUser | null {
  try {
    const raw = localStorage.getItem(SSO_USER_KEY)
    return raw ? (JSON.parse(raw) as SsoUser) : null
  } catch {
    return null
  }
}

export function saveUser(user: SsoUser): void {
  localStorage.setItem(SSO_USER_KEY, JSON.stringify(user))
}

export function clearUser(): void {
  localStorage.removeItem(SSO_USER_KEY)
  sessionStorage.removeItem(SSO_PKCE_KEY)
}

/** ④ 登出：先清本地，再把 SSO 的服务端会话一并结束 */
export function logout(): void {
  clearUser()
  const back = window.location.origin + '/'
  window.location.assign(`${SSO_ENDPOINTS.logout}?post_logout_redirect_uri=${encodeURIComponent(back)}`)
}
