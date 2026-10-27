/* ============================================================================
 *  Shizuku · 图片预加载
 * ----------------------------------------------------------------------------
 *  站内真正会显示的图片：三套主题背景 + 头像（favicon 顺手预热）。
 *
 *  加载页只等「当前主题背景 + 头像」这两张关键图，其余在后台预热，
 *  切换主题色时就不用临时拉图。
 *  所有请求都有超时兜底，任何一张挂掉都不会把加载页卡死。
 * ========================================================================== */

import { site } from '@/content/site'

const BACKGROUNDS = ['/bg.webp', '/bg-yellow.webp', '/bg-purple.webp'] as const

/** 首屏关键图：最多等这么久 */
const CRITICAL_TIMEOUT = 4000
/** 后台预热图：给更宽裕的时间，反正不挡加载页 */
const WARM_TIMEOUT = 12000

/** 从 --bg-image 里取出当前主题的背景地址；取不到返回 null */
function currentBackground(): string | null {
  if (typeof window === 'undefined') return null
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg-image').trim()
  const match = raw.match(/^url\((['"]?)(.+?)\1\)$/)
  return match ? match[2] : null
}

/** 加载一张图（含解码）；成功、失败、超时都 resolve，绝不 reject */
function preloadImage(src: string, timeout: number): Promise<void> {
  if (!src) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const img = new Image()
    img.decoding = 'async'
    // onload 只说明字节到了，decode() 之后才真的能画
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(done, done)
      else done()
    }
    img.onerror = done
    img.src = src

    window.setTimeout(done, timeout)
  })
}

/**
 * 预加载站点所有图片。
 * 返回的 Promise 只等首屏关键图；其余图片已经在后台开始加载。
 */
export function preloadSiteImages(): Promise<void> {
  const activeBg = currentBackground()
  const critical = [activeBg, site.avatar].filter(Boolean) as string[]

  // 先让后台图跑起来，不用等它们
  for (const src of [...BACKGROUNDS, site.favicon]) {
    if (!critical.includes(src)) void preloadImage(src, WARM_TIMEOUT)
  }

  return Promise.all(critical.map((src) => preloadImage(src, CRITICAL_TIMEOUT))).then(() => undefined)
}
