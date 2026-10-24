/* ============================================================================
 *  Shizuku · 首屏加载
 * ----------------------------------------------------------------------------
 *  为什么要它：卡片是 backdrop-filter 做的磨砂玻璃，
 *  浏览器要把背景图采样、模糊完才画得出来。
 *  在这之前先渲染页面，看到的就是一层没糊开的底图 —— 挺奇怪的。
 *
 *  所以盖一层加载页，等「字体到位 + 图片解码完 + 浏览器算完这一帧」，
 *  再让站名 Shizuku 从左到右由文字色填成主题色，最后淡出。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import './PageLoader.css'

/** 填充动画时长（与 CSS 里的 loader-fill 保持一致） */
const FILL_MS = 780
/** 淡出时长 */
const FADE_MS = 400
/** 最短停留：资源都缓存好了也得让动画演完，否则会闪一下 */
const MIN_WAIT_MS = 320

type Phase = 'wait' | 'fill' | 'out' | 'done'

/** 等所有资源就绪：字体 + 图片 */
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
  return Promise.all([fonts, ...images])
}

export function PageLoader() {
  const [phase, setPhase] = useState<Phase>('wait')

  useEffect(() => {
    let alive = true
    const started = Date.now()

    whenAssetsReady()
      .then(() => {
        // 等资源的时间不够就再等等，让动画有完整的呼吸
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
     *  会在淡出的那一瞬闪回未填充色。 */
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
