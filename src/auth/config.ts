/* ============================================================================
 *  Shizuku · SSO 接入配置
 * ----------------------------------------------------------------------------
 *  身份提供方是独立站点 sso.dreamgary.cn（标准 OIDC 授权服务器）。
 *
 *  Shizuku 是纯前端 SPA，走 Authorization Code + PKCE，
 *  **不持有 client_secret** —— 公开客户端靠 code_verifier 自证。
 *
 *  client_id 由 SSO 侧登记后分配，回调地址必须在那边精确匹配：
 *    https://dreamgary.cn/auth/callback
 *    https://www.dreamgary.cn/auth/callback
 *    http://localhost:5180/auth/callback   （开发用）
 *
 *  端点取自 https://sso.dreamgary.cn/.well-known/openid-configuration
 * ========================================================================== */

/** 授权服务器根地址 */
export const SSO_ISSUER = 'https://sso.dreamgary.cn'

/** SSO 后台为本站登记的公开客户端（无 secret，靠 PKCE） */
export const SSO_CLIENT_ID = 'app_jhip2b2293yoXxuP'

/** 申请的作用域：只拿身份信息 */
export const SSO_SCOPE = 'openid profile email'

/** 回调地址，必须与 SSO 侧登记的完全一致 */
export const SSO_REDIRECT_URI = `${window.location.origin}/auth/callback`

/** OIDC 端点（与发现文档一致） */
export const SSO_ENDPOINTS = {
  authorize: `${SSO_ISSUER}/authorize`,
  token: `${SSO_ISSUER}/token`,
  userinfo: `${SSO_ISSUER}/userinfo`,
  logout: `${SSO_ISSUER}/logout`,
  discovery: `${SSO_ISSUER}/.well-known/openid-configuration`,
  jwks: `${SSO_ISSUER}/jwks.json`,
} as const

/** 会话存储的键：PKCE 中间态与本地用户快照 */
export const SSO_PKCE_KEY = 'shizuku-sso-pkce'
export const SSO_USER_KEY = 'shizuku-sso-user'
