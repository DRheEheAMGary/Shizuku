/* ============================================================================
 *  Shizuku · 首屏加载
 * ----------------------------------------------------------------------------
 *  卡片用 backdrop-filter 做磨砂玻璃，浏览器要先采样背景图、做模糊才画得出。
 *  若不等这一步就渲染页面，会先看到一层没糊开的底图。
 *
 *  因此盖一层纯色加载页，等「字体 + 图片 + 两帧 + 最短停留」都满足，
 *  再让站名 Shizuku 由左向右从背景色填成主题色，最后淡出并卸载。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import { preloadSiteImages } from '@/lib/preloadImages'
import './PageLoader.css'

/** 填充动画的计划时长（ms）：到点开始淡出；CSS 的 --loader-fill 为 900ms，
 *  所以淡出会在填充收尾前约 120ms 开始 */
const FILL_MS = 780
/** 进入 out 到卸载的等待时长（ms）：CSS 的 --loader-fade 为 480ms，
 *  提前约 80ms 卸载时透明度已接近 0 */
const FADE_MS = 400
/** 最短停留：资源都缓存好了也得让动画演完，否则会闪一下 */
const MIN_WAIT_MS = 320

type Phase = 'wait' | 'fill' | 'out' | 'done'

// 等字体、页面内图片与站点关键图（含当前主题背景）都就绪。
// 每张图都在 load / error 上 resolve：单张失败不会把加载页卡死。
function whenAssetsReady(): Promise<unknown> {
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const images = Array.from(document.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        }),
  )
  return Promise.all([fonts, ...images, preloadSiteImages()])
}

export function PageLoader() {
  const [phase, setPhase] = useState<Phase>('wait')

  useEffect(() => {
    let alive = true
    const started = Date.now()

    whenAssetsReady()
      .then(() => {
        // 资源等待时间不足最短停留时补足，让填充动画有完整的呼吸
        const rest = MIN_WAIT_MS - (Date.now() - started)
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, rest)))
      })
      .then(() => {
        if (!alive) return
        // 再等两帧：让浏览器把这一帧的 backdrop-filter 真的算完并画出来
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive) return
            setPhase('fill')
            setTimeout(() => alive && setPhase('out'), FILL_MS)
          }),
        )
      })

    return () => {
      alive = false
    }
  }, [])

  // 淡出结束后彻底卸载
  useEffect(() => {
    if (phase !== 'out') return
    const t = setTimeout(() => setPhase('done'), FADE_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'done') return null

  return (
    /*  淡出时保留 is-fill —— 否则动画类一撤，--fill 归零，
     *  会在淡出的瞬间闪回未填充色。 */
    <div
      className={`page-loader ${phase === 'wait' ? 'is-wait' : 'is-fill'}${
        phase === 'out' ? ' is-out' : ''
      }`}
      role="status"
      aria-label="正在载入"
    >
      <span className="page-loader__word">Shizuku</span>
    </div>
  )
}
