/* ============================================================================
 *  Shizuku · 液态玻璃（折射）
 * ----------------------------------------------------------------------------
 *  把一层 SVG 位移滤镜接进 backdrop-filter，让玻璃**边缘把背后的画面掰弯**，
 *  而不是只有模糊。只在 Chromium 上生效 —— 只有它对「活的」backdrop 应用
 *  SVG 滤镜（Safari / Firefox 会忽略 url() 这一项，等于退回纯模糊）。
 *
 *  计算模型移植自 glisse（MIT，https://github.com/0kzh/glisse，
 *  src/internal/refraction.ts），原始思路见
 *  https://kube.io/blog/liquid-glass-css-svg/ 。这里只保留 Chromium 那条路径，
 *  去掉了色散（selection）、放大（zoom）和 Safari 的 DOM 克隆兜底。
 *
 *  用法：
 *    const ref = useRef<HTMLElement>(null)
 *    useRefraction(ref)
 *    CSS 里把变量接上：
 *      backdrop-filter: blur(...) saturate(...) var(--lg-filter, none);
 *      background-image: var(--lg-rim, none);
 *
 *  可调参数（写在元素上，同样以 CSS 变量形式读取）：
 *    --lg-bezel       边框带宽（折射只发生在这个环带里），默认按短边 12% 夹到 4–10px
 *    --lg-thickness   玻璃厚度，默认按短边 20% 夹到 8–24px
 *    --lg-refraction  折射强度倍率，默认 1
 * ========================================================================== */

import { useEffect, type RefObject } from 'react'

const NS = 'http://www.w3.org/2000/svg'

interface Shape {
  bezel: number | undefined
  thickness: number | undefined
  level: number
}

interface Lens {
  filter: string
  rim: string
}

/** 同尺寸的玻璃复用同一份滤镜与贴图：十个一样宽的按钮只生成一次 */
const lenses = new Map<string, Lens>()
let defs: SVGDefsElement | null = null

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function svg(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(NS, name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value))
  return element
}

function container(): SVGDefsElement {
  if (defs?.isConnected) return defs
  const root = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' })
  root.setAttribute('style', 'position:absolute;pointer-events:none')
  defs = svg('defs', {}) as SVGDefsElement
  root.append(defs)
  document.body.append(root)
  return defs
}

/*  ---------- 1. 边缘剖面：按斯涅尔定律算每个入射位置的偏移量 ----------
 *  折射率取 1.5（玻璃）。曲面用 (1-(1-t)^4)^0.25 近似苹果那种「方中带圆」的
 *  倒角，越靠边越陡，于是边缘的位移量最大、往里迅速衰减到 0。 */
function profile(bezel: number, thickness: number): { samples: Float32Array; maximum: number } {
  const samples = new Float32Array(128)
  let maximum = 0
  for (let i = 0; i < samples.length; i++) {
    const t = Math.max(0.001, i / (samples.length - 1))
    const surface = (1 - (1 - t) ** 4) ** 0.25
    const incident = Math.atan((1 - t) ** 3 / surface ** 3)
    const refracted = Math.asin(Math.sin(incident) / 1.5)
    samples[i] = Math.tan(incident - refracted) * (thickness + surface * bezel)
    maximum = Math.max(maximum, samples[i]!)
  }
  return { samples, maximum }
}

/*  ---------- 2. 生成位移图与高光图 ----------
 *  位移图：R 通道 = x 偏移、G 通道 = y 偏移，128 表示不偏移（中性）。
 *  高光图：白色 + alpha，越靠近边框越亮，铺在玻璃表面当镜面反光。 */
function maps(width: number, height: number, radius: number, shape: Shape) {
  const density = Math.min(devicePixelRatio || 1, 2)
  const bezel = shape.bezel ?? clamp(Math.min(width, height) * 0.12, 4, 10)
  const thickness = shape.thickness ?? clamp(Math.min(width, height) * 0.2, 8, 24)
  const { samples, maximum } = profile(bezel, thickness)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * density)
  canvas.height = Math.ceil(height * density)
  const context = canvas.getContext('2d')!
  const field = context.createImageData(canvas.width, canvas.height)
  const shine = context.createImageData(canvas.width, canvas.height)

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = ((x + 0.5) * width) / canvas.width - width / 2
      const py = ((y + 0.5) * height) / canvas.height - height / 2

      //  圆角矩形的有符号距离：先求到「内缩矩形」的距离，再减掉圆角半径
      const qx = Math.abs(px) - (width / 2 - radius)
      const qy = Math.abs(py) - (height / 2 - radius)
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      const length = Math.hypot(ox, oy)
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0))

      //  法线方向（指向内部），圆角处是斜的，所以边缘会被"卷"一下
      const nx = length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0
      const ny = length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py)

      //  只有离边框 bezel 以内才有位移，中间整块是中性值
      let shift = 0
      if (distance >= 0 && distance < bezel) {
        const sample = (distance / bezel) * (samples.length - 1)
        const lower = Math.floor(sample)
        const a = samples[lower]!
        const b = samples[Math.min(lower + 1, samples.length - 1)]!
        shift = a + (b - a) * (sample - lower)
      }

      const i = (y * canvas.width + x) * 4
      field.data[i] = Math.round(127.5 - ((nx * shift) / maximum) * 127.5)
      field.data[i + 1] = Math.round(127.5 - ((ny * shift) / maximum) * 127.5)
      field.data[i + 2] = 128
      field.data[i + 3] = 255

      //  高光：朝上的一侧最亮（光从上方来），朝下的一侧留一点反射
      const light = -(nx + ny) * Math.SQRT1_2
      const glint = Math.max(light, 0) ** 3
      const reflected = Math.max(-light, 0) ** 3
      let alpha = 0
      if (distance >= 0) {
        const rim = Math.exp(-(((distance - 0.4) / 0.38) ** 2))
        const bloom = Math.exp(-((distance / (bezel * 0.22)) ** 2))
        alpha = rim * (0.045 + 0.52 * glint + 0.2 * reflected) + bloom * 0.02 * glint
      }
      shine.data[i] = shine.data[i + 1] = shine.data[i + 2] = 255
      shine.data[i + 3] = Math.round(clamp(alpha, 0, 1) * 255)
    }
  }

  context.putImageData(field, 0, 0)
  const displacement = canvas.toDataURL()
  context.putImageData(shine, 0, 0)
  const highlight = canvas.toDataURL()
  return { displacement, highlight, scale: maximum * 2 * shape.level }
}

/*  ---------- 3. 拼出 SVG 滤镜并缓存 ---------- */
function lens(width: number, height: number, radius: number, shape: Shape): Lens {
  const key = [width, height, radius, shape.bezel, shape.thickness, shape.level].join('-')
  const cached = lenses.get(key)
  if (cached) return cached

  const { displacement, highlight, scale } = maps(width, height, radius, shape)
  const id = `shizuku-lens-${lenses.size}`
  const box = { x: 0, y: 0, width, height }

  const filter = svg('filter', {
    id,
    ...box,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  })

  filter.append(
    svg('feImage', { href: displacement, ...box, preserveAspectRatio: 'none', result: 'field' }),
    svg('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'field',
      scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'bent',
    }),
    //  位移是取最近像素，边缘弯得最狠的地方会留台阶；0.4 的模糊正好抹掉
    svg('feGaussianBlur', { in: 'bent', stdDeviation: 0.4 }),
  )

  container().append(filter)
  const result = { filter: `url("#${id}")`, rim: `url("${highlight}")` }
  lenses.set(key, result)
  return result
}

/*  ---------- 4. 量尺寸、算圆角、写回 CSS 变量 ---------- */
function fit(element: HTMLElement): void {
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) return

  const style = getComputedStyle(element)
  const corner = style.borderTopLeftRadius
  //  胶囊的 999px 会被浏览器夹到高度的一半，这里要跟着夹，否则 SDF 算错
  const radius = Math.min(
    width / 2,
    height / 2,
    corner.endsWith('%') ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner),
  )

  const length = (name: string) => {
    const value = parseFloat(style.getPropertyValue(name))
    return Number.isFinite(value) ? value : undefined
  }

  const shape: Shape = {
    bezel: length('--lg-bezel'),
    thickness: length('--lg-thickness'),
    level: length('--lg-refraction') ?? 1,
  }

  const { filter, rim } = lens(width, height, radius, shape)
  element.style.setProperty('--lg-filter', filter)
  element.style.setProperty('--lg-rim', rim)
}

/** 只有 Chromium 会把 SVG 滤镜应用到活的 backdrop 上 */
const refractsBackdrop = () => /Chrom(?:e|ium)\//.test(navigator.userAgent)

/**
 * 给元素挂上液态玻璃折射。不做兜底：不支持时什么都不写，元素保持原本的模糊。
 * 尺寸变化会重算贴图；过渡进行中先摘掉滤镜（贴图尺寸和当前盒子对不上，
 * 硬用会错位），停下后再挂回去。
 */
export function useRefraction(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || !refractsBackdrop()) return

    let settle = 0
    let restoring = 0

    const apply = () => {
      window.clearTimeout(settle)
      window.clearTimeout(restoring)
      restoring = 0
      fit(element)
    }

    //  尺寸还在变（展开成搜索框、滚动收起）时先关掉，停稳 120ms 后再算
    const schedule = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(apply, 120)
    }

    const drop = () => {
      element.style.removeProperty('--lg-filter')
      element.style.removeProperty('--lg-rim')
    }

    const observer = new ResizeObserver(() => {
      drop()
      schedule()
    })
    observer.observe(element)

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== element) return
      window.clearTimeout(restoring)
      restoring = window.setTimeout(apply, 30)
    }

    element.addEventListener('transitionend', onTransitionEnd)
    apply()

    return () => {
      observer.disconnect()
      element.removeEventListener('transitionend', onTransitionEnd)
      window.clearTimeout(settle)
      window.clearTimeout(restoring)
      drop()
    }
  }, [ref])
}
