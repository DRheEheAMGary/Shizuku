/* ============================================================================
 *  Shizuku · 弹簧
 * ----------------------------------------------------------------------------
 *  阻尼谐振子的解析解（临界 / 过阻尼 / 欠阻尼三种情况各一条闭式公式），
 *  每帧只算一次位置，不做数值积分 —— 与 glisse（MIT，
 *  https://github.com/0kzh/glisse，src/internal/spring.ts）同一套写法。
 *
 *  所有弹簧共用一个 requestAnimationFrame 循环：停下的自动出列，
 *  没有活动弹簧时循环也随之停掉，不会白烧帧。
 * ========================================================================== */

export interface Spring {
  /** 目标值；instant=true 时直接落位（首次绘制、窗口尺寸变化） */
  set(target: number, instant?: boolean): void
  /** 换刚度/阻尼，比如拖动跟手一档、松手归位一档 */
  tune(stiffness: number, damping: number): void
  /** 当前值 */
  read(): number
  /** 立刻停住并保持当前值 */
  stop(): void
}

interface State {
  value: number
  target: number
  velocity: number
  stiffness: number
  damping: number
  /** set() 的时刻，用来做"到点必须落位"的时间兜底 */
  startedAt: number
  paint: (value: number) => void
}

/**
 * 兜底时长：弹簧是指数收敛，尾巴再薄也总差一点点；
 * 超过这个时间就直接落到目标，避免"结尾拖长 + 最后一下跳"。
 * 正常刚度下 200–260ms 就收敛了，这里是异常情况的保险。
 */
const MAX_SETTLE_MS = 620

const moving = new Set<State>()
let frame = 0
let last = 0

function advance(s: State, dt: number): void {
  const x = s.value - s.target
  const v = s.velocity
  const half = s.damping / 2
  const discriminant = half * half - s.stiffness

  if (Math.abs(discriminant) < 1e-4) {
    //  临界阻尼
    const decay = Math.exp(-half * dt)
    const b = v + half * x
    s.value = s.target + decay * (x + b * dt)
    s.velocity = decay * (v - half * b * dt)
  } else if (discriminant > 0) {
    //  过阻尼：两个实根
    const root = Math.sqrt(discriminant)
    const r1 = -half + root
    const r2 = -half - root
    const a = (v - r2 * x) / (r1 - r2)
    const b = x - a
    s.value = s.target + a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt)
    s.velocity = a * r1 * Math.exp(r1 * dt) + b * r2 * Math.exp(r2 * dt)
  } else {
    //  欠阻尼：会回弹一点
    const omega = Math.sqrt(-discriminant)
    const decay = Math.exp(-half * dt)
    const cos = Math.cos(omega * dt)
    const sin = Math.sin(omega * dt)
    s.value = s.target + decay * (x * cos + ((v + half * x) / omega) * sin)
    s.velocity = decay * (v * cos - ((half * v + s.stiffness * x) / omega) * sin)
  }
}

function tick(time: number): void {
  frame = 0
  //  按真实经过的时间推进（帧率抖动时也不会"少走一段"）；
  //  只挡一下切后台回来的超大跨度。
  const dt = Math.min(0.5, Math.max(0, (time - last) / 1000))
  last = time

  for (const s of moving) {
    advance(s, dt)
    s.paint(s.value)
    if (time - s.startedAt > MAX_SETTLE_MS || (Math.abs(s.value - s.target) < 0.1 && Math.abs(s.velocity) < 0.1)) {
      s.value = s.target
      s.velocity = 0
      s.paint(s.value)
      moving.delete(s)
    }
  }

  if (moving.size) frame = requestAnimationFrame(tick)
}

function start(): void {
  if (frame) return
  last = performance.now()
  frame = requestAnimationFrame(tick)
}

export function createSpring(
  initial: number,
  stiffness: number,
  damping: number,
  paint: (value: number) => void,
): Spring {
  const state: State = {
    value: initial,
    target: initial,
    velocity: 0,
    stiffness,
    damping,
    startedAt: 0,
    paint,
  }

  return {
    set(target, instant = false) {
      state.target = target
      state.startedAt = performance.now()
      if (instant) {
        state.value = target
        state.velocity = 0
        moving.delete(state)
        state.paint(target)
        return
      }
      moving.add(state)
      start()
    },
    tune(nextStiffness, nextDamping) {
      state.stiffness = nextStiffness
      state.damping = nextDamping
    },
    read: () => state.value,
    stop() {
      moving.delete(state)
      state.velocity = 0
    },
  }
}
