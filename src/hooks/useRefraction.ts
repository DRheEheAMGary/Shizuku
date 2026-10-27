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
 *  实时性：
 *    位移贴图按「盒子尺寸」生成，边长大就得重画（27px 的圆钮 1ms，527×56 的
 *    胶囊 20ms 左右），不可能每帧来一次。所以这里分两档：
 *      · 尺寸稳定时 —— 生成与当前盒子完全匹配的贴图，边缘最准；
 *      · 尺寸在动时（展开搜索框、滚动收起、登录坞拉开）—— 把上一张贴图
 *        用 preserveAspectRatio="none" 拉伸到当前盒子，只改属性、不重画。
 *    这样动画过程中**始终**是折射，不会退化成模糊。
 *
 *  用法：
 *    const ref = useRef<HTMLElement>(null)
 *    useRefraction(ref)
 *    CSS（见 styles/glass.css）：
 *      [data-liquid] { backdrop-filter: var(--lg-filter) saturate(...) }
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

/** 一张按某个尺寸烘好的位移贴图 */
interface Map {
  displacement: string
  highlight: string
  /** 位移量的理论上限（像素），用来换算 feDisplacementMap 的 scale */
  maximum: number
}

/** 每个元素独占一个滤镜节点：盒子尺寸会跟着动画实时改，共享节点会互相打架 */
interface Lens {
  filter: SVGFilterElement
  image: SVGImageElement
  displace: SVGFEDisplacementMapElement
}

const MAPS = new Map<string, Map>()
const LENSES = new WeakMap<HTMLElement, Lens>()
/** 每个元素最近一次用过的贴图：过渡中先拿它拉伸顶住，避免逐帧重画 */
const LASTMAP = new WeakMap<HTMLElement, Map>()
let defs: SVGDefsElement | null = null
let serial = 0

/** 尺寸稳定后多久才重画贴图（太短会在过渡里反复重画） */
const REGENERATE_MS = 140

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
function buildMap(width: number, height: number, radius: number, shape: Shape): Map {
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
  return { displacement, highlight, maximum }
}

/** 缓存上限：动画里每帧都是一个新尺寸，留太多会把内存吃掉 */
const MAP_LIMIT = 48

/** 同尺寸的玻璃复用同一份贴图（3 个 37px 圆钮只烘焙一次） */
function mapFor(width: number, height: number, radius: number, shape: Shape): Map {
  const key = keyOf(width, height, radius, shape)
  const cached = MAPS.get(key)
  if (cached) return cached
  const built = buildMap(width, height, radius, shape)
  MAPS.set(key, built)
  if (MAPS.size > MAP_LIMIT) {
    //  淘汰最早的一张（Map 保持插入顺序）
    const oldest = MAPS.keys().next()
    if (!oldest.done) MAPS.delete(oldest.value)
  }
  return built
}

const keyOf = (width: number, height: number, radius: number, shape: Shape) =>
  [Math.round(width), Math.round(height), Math.round(radius), shape.bezel, shape.thickness].join('x')

/**
 * 超过这个面积就不再逐帧烘焙：一张贴图的成本随像素数线性增长，
 * 卡片那种大块面在动画里重画会掉帧 —— 退回"拉伸旧贴图 + 停稳后补精确"。
 * 顶栏这些小元素（37²、56²、527×56）远在阈值内，实测 1–2ms/帧。
 */
const BAKE_AREA_LIMIT = 160_000

/*  ---------- 3. 滤镜节点：建一次，之后只改属性 ---------- */
function lensFor(element: HTMLElement): Lens {
  const existing = LENSES.get(element)
  if (existing) return existing

  const id = `shizuku-lens-${serial++}`
  const filter = svg('filter', {
    id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  }) as SVGFilterElement

  const image = svg('feImage', {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    preserveAspectRatio: 'none',
    result: 'field',
  }) as SVGImageElement

  const displace = svg('feDisplacementMap', {
    in: 'SourceGraphic',
    in2: 'field',
    scale: 0,
    xChannelSelector: 'R',
    yChannelSelector: 'G',
    result: 'bent',
  }) as SVGFEDisplacementMapElement

  filter.append(
    image,
    displace,
    //  位移是取最近像素，边缘弯得最狠的地方会留台阶；0.4 的模糊正好抹掉
    svg('feGaussianBlur', { in: 'bent', stdDeviation: 0.4 }),
  )
  container().append(filter)

  const lens: Lens = { filter, image, displace }
  LENSES.set(element, lens)
  return lens
}

/** 读出当前几何：圆角、以及三个可调参数 */
function readShape(element: HTMLElement, width: number, height: number) {
  const style = getComputedStyle(element)
  const corner = style.borderTopLeftRadius
  //  胶囊的 999px 会被浏览器夹到高度的一半，这里要跟着夹，否则 SDF 算错
  const radius = Math.min(
    width / 2,
    height / 2,
    corner.endsWith('%') ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner || '0'),
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
  return { radius, shape }
}

/**
 * 把贴图套到当前盒子上。用拉伸而不是重画 —— 属性写入是微秒级，可以每帧干。
 * @param mode 'exact' 时允许为当前尺寸烘焙新贴图；'auto' 时若尺寸没见过就拉伸旧的。
 * @returns 是否用了拉伸过的贴图（是的话调用方要在尺寸停稳后补一张精确的）
 */
function paint(element: HTMLElement, mode: 'auto' | 'exact'): boolean {
  const width = Math.round(element.offsetWidth)
  const height = Math.round(element.offsetHeight)
  if (!width || !height) return false

  const { radius, shape } = readShape(element, width, height)
  const key = keyOf(width, height, radius, shape)

  let map = MAPS.get(key)
  let stretched = false
  if (!map) {
    const previous = LASTMAP.get(element)
    //  小元素直接按当前尺寸烘焙（1–2ms，动画每帧都扛得住，边缘始终精确）；
    //  大元素才退而求其次用拉伸。
    if (mode === 'auto' && previous && width * height > BAKE_AREA_LIMIT) {
      map = previous
      stretched = true
    } else {
      map = mapFor(width, height, radius, shape)
    }
  }
  LASTMAP.set(element, map)

  const lens = lensFor(element)
  const box = { x: 0, y: 0, width, height }
  for (const [name, value] of Object.entries(box)) {
    lens.filter.setAttribute(name, String(value))
    lens.image.setAttribute(name, String(value))
  }
  lens.image.setAttribute('href', map.displacement)
  lens.displace.setAttribute('scale', String(map.maximum * 2 * shape.level))

  element.dataset.liquid = ''
  element.style.setProperty('--lg-filter', `url("#${lens.filter.id}")`)
  element.style.setProperty('--lg-rim', `url("${map.highlight}")`)

  return stretched
}

/** 只有 Chromium 会把 SVG 滤镜应用到活的 backdrop 上 */
const refractsBackdrop = () => /Chrom(?:e|ium)\//.test(navigator.userAgent)

/**
 * 给元素挂上液态玻璃折射。不做兜底：不支持时什么都不写，元素保持原本的模糊。
 *
 * 动画全程不摘滤镜：尺寸一变就按当前盒子把贴图拉伸着用，停稳 140ms 后再
 * 烘焙一张严丝合缝的。所以过渡过程中看到的也是折射，不会突然糊一下。
 */
export function useRefraction(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || !refractsBackdrop()) return

    let settle = 0

    const apply = (mode: 'auto' | 'exact' = 'auto') => {
      window.clearTimeout(settle)
      const stretched = paint(element, mode)
      //  用了拉伸版贴图 → 等尺寸停下来再烘一张严丝合缝的
      if (stretched) settle = window.setTimeout(() => paint(element, 'exact'), REGENERATE_MS)
    }

    //  过渡期间每帧最多来一次：只改属性，不碰 canvas
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        apply('auto')
      })
    })
    observer.observe(element)

    //  过渡结束后补一张精确的（有些尺寸变化不触发 ResizeObserver 也能兜住）
    let endTimer = 0
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== element) return
      window.clearTimeout(endTimer)
      endTimer = window.setTimeout(() => apply('exact'), 30)
    }
    element.addEventListener('transitionend', onTransitionEnd)

    apply()

    return () => {
      observer.disconnect()
      element.removeEventListener('transitionend', onTransitionEnd)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(settle)
      window.clearTimeout(endTimer)
      LENSES.get(element)?.filter.remove()
      LENSES.delete(element)
      delete element.dataset.liquid
      element.style.removeProperty('--lg-filter')
      element.style.removeProperty('--lg-rim')
    }
  }, [ref])
}
