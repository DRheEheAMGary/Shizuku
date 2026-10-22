/* ============================================================================
 *  Shizuku · 左上角登录交互
 * ----------------------------------------------------------------------------
 *  一枚独立的磨砂玻璃胶囊，固定在顶栏左侧最外端（与居中顶栏同一行）。
 *
 *  现在是**占位态**：只有「登录」一个按钮，点了提示尚未接入。
 *  SSO（sso.dreamgary.cn）接通后这里会长成：
 *
 *    未登录：[ ⬤ 登录 ]
 *    已登录：[ (头像) DRheEheAM_Gary ⌄ ]  →  下拉：账号中心 / 退出登录
 *
 *  接入点是 src/auth/config.ts，把 SSO_READY 改成 true 即可。
 * ========================================================================== */

import { Icon } from './Icon'
import { SSO_READY, SSO_ISSUER } from '@/auth/config'
import './AuthCorner.css'

export function AuthCorner() {
  // 尚未接入 SSO：点击只给出提示，不发请求
  const handleClick = () => {
    if (SSO_READY) return // 预留：接通后跳转 /authorize（见 src/auth/config.ts）
    window.alert(`SSO 尚未接入\n\n授权服务器：${SSO_ISSUER}`)
  }

  return (
    <div className="auth-corner">
      <button
        type="button"
        className="auth-corner__pill"
        onClick={handleClick}
        aria-label="登录"
      >
        <span className="auth-corner__icon" aria-hidden="true">
          <Icon name="user" size={16} />
        </span>
        <span className="auth-corner__label">登录</span>
      </button>
    </div>
  )
}
