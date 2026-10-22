/* ============================================================================
 *  Shizuku · SSO 接入配置（占位）
 * ----------------------------------------------------------------------------
 *  身份提供方是独立站点 sso.dreamgary.cn（标准 OIDC 授权服务器）。
 *  本文件只是把「接哪里」写下来，方便后面接的时候改一处就够。
 *
 *  Shizuku 是纯前端 SPA，所以走 Authorization Code + PKCE，
 *  **不持有 client_secret** —— 公开客户端靠 code_verifier 自证。
 *
 *  !!! 目前尚未接入 !!!
 *  登录交互先用 AuthCorner 的占位胶囊，点下去只提示未接入。
 *  真正的流程要等 SSO 侧的 /authorize、/token、/userinfo 上线后再实现。
 * ========================================================================== */

/** 授权服务器根地址 */
export const SSO_ISSUER = 'https://sso.dreamgary.cn'

/** SSO 后台为本站登记的客户端 ID（纯前端，无 secret） */
export const SSO_CLIENT_ID = 'shizuku'

/** 回调地址，必须在 SSO 后台的 redirect_uris 里精确匹配 */
export const SSO_REDIRECT_URI =
  typeof window === 'undefined' ? '' : `${window.location.origin}/auth/callback`

/** 申请的作用域：只拿身份信息，不要别的权限 */
export const SSO_SCOPE = 'openid profile email'

/** 计划中的 OIDC 端点 —— 与 SSO 侧的实现对齐后再启用 */
export const SSO_ENDPOINTS = {
  authorize: `${SSO_ISSUER}/authorize`,
  token: `${SSO_ISSUER}/token`,
  userinfo: `${SSO_ISSUER}/userinfo`,
  revoke: `${SSO_ISSUER}/revoke`,
  discovery: `${SSO_ISSUER}/.well-known/openid-configuration`,
  jwks: `${SSO_ISSUER}/.well-known/jwks.json`,
} as const

/** 是否已经接通 —— 接通后把它改成 true，AuthCorner 会自动切换行为 */
export const SSO_READY = false
