/* ============================================================================
 *  Shizuku · PKCE 与随机串
 * ----------------------------------------------------------------------------
 *  RFC 7636：code_verifier 是 43~128 字符的随机串，
 *  code_challenge = BASE64URL(SHA256(verifier))，method 固定 S256。
 *
 *  只用 Web Crypto（crypto.getRandomValues / crypto.subtle），
 *  因此要求安全上下文：https 或 localhost / 127.0.0.1。
 * ========================================================================== */

/** 生成 base64url 随机串（默认 32 字节 → 43 字符，符合 verifier 长度要求） */
export function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return base64Url(buf)
}

/** 标准 base64 → base64url：+ → -，/ → _，去掉尾部 = */
function base64Url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** code_challenge = BASE64URL(SHA-256(verifier)) */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}
