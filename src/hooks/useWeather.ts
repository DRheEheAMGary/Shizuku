/* ============================================================================
 *  Shizuku · 天气与地址
 * ----------------------------------------------------------------------------
 *  两路数据：
 *    1. 天气 —— Open-Meteo，免费、无需 API Key、允许浏览器直接跨域
 *    2. 地址 —— 逆地理编码走 SSO 的 /api/reverse-geocode 代理
 *       （上游第三方在国内常不可达，直连会一直转圈）
 *
 *  定位权限不主动弹窗：进入时先用 Permissions API 查一次状态，
 *  已授权才直接取；未授权则把状态留给界面（登录坞）去显示「授权」按钮。
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react'
import { SSO_ISSUER } from '@/auth/config'

export interface Weather {
  /** 摄氏温度，已取整 */
  temp: number
  /** WMO 天气代码 */
  code: number
  /** 是否为白天，决定用太阳还是月亮图标 */
  isDay: boolean
  /** 中文短语，如「多云」 */
  label: string
}

export interface Place {
  province: string
  city: string
  district: string
}

/** 定位状态 */
export type LocateState =
  /** 浏览器不支持定位 */
  | 'unsupported'
  /** 还没授权，等用户点「授权」 */
  | 'prompt'
  /** 正在弹系统的权限框 */
  | 'asking'
  /** 已拿到坐标 */
  | 'granted'
  /** 被拒绝，或拿不到位置 */
  | 'denied'

/** WMO 天气代码 → 中文短语 */
function labelOf(code: number): string {
  if (code === 0) return '晴'
  if (code <= 2) return '多云'
  if (code === 3) return '阴'
  if (code <= 48) return '雾'
  if (code <= 57) return '毛毛雨'
  if (code <= 67) return '雨'
  if (code <= 77) return '雪'
  if (code <= 82) return '阵雨'
  if (code <= 86) return '阵雪'
  if (code <= 99) return '雷雨'
  return '—'
}

const weatherApi = (lat: number, lon: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&current=temperature_2m,weather_code,is_day&timezone=auto`

const geoApi = (lat: number, lon: number) =>
  `${SSO_ISSUER}/api/reverse-geocode?lat=${lat}&lon=${lon}`

/** 把省/市/区拼成「省 · 市 · 区」：缺的省略，重复的也省略（直辖市省市同名） */
export function formatPlace(place: Place | null): string {
  if (!place) return ''
  const parts: string[] = []
  for (const part of [place.province, place.city, place.district]) {
    const v = (part ?? '').trim()
    if (!v) continue
    if (parts.length && parts[parts.length - 1] === v) continue
    parts.push(v)
  }
  return parts.join(' · ')
}

export function useWeather() {
  const [locate, setLocate] = useState<LocateState>('prompt')
  const [weather, setWeather] = useState<Weather | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [failed, setFailed] = useState(false)
  /** 失败是被浏览器拦下的（权限被 block），还是超时/不可用 —— 两者的挽救方式不一样 */
  const [blocked, setBlocked] = useState(false)

  /**
   * 用一组坐标并行拉天气与地址，共用一个 AbortController 与 15s 超时。
   * 地址失败不影响天气：天气本身就是主信息，地址只是补充。
   */
  const load = useCallback((lat: number, lon: number) => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15_000)

    fetch(weatherApi(lat, lon), { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        const cur = data?.current
        if (!cur) throw new Error('shape')
        setWeather({
          temp: Math.round(Number(cur.temperature_2m)),
          code: Number(cur.weather_code),
          isDay: Number(cur.is_day) === 1,
          label: labelOf(Number(cur.weather_code)),
        })
      })
      .catch((err) => {
        // 用户主动取消不算失败
        if (err?.name !== 'AbortError') setFailed(true)
      })

    fetch(geoApi(lat, lon), { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setPlace({
          province: String(data?.province ?? ''),
          city: String(data?.city ?? ''),
          district: String(data?.district ?? ''),
        })
      })
      .catch(() => {
        /* 地址拿不到就只显示天气 */
      })

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  /** 弹系统的定位权限框；拿到坐标后交给 load */
  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocate('unsupported')
      return
    }
    setLocate('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBlocked(false)
        setLocate('granted')
        load(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        //  1 = PERMISSION_DENIED：浏览器把这个站点的定位拉黑了，
        //  再点按钮也不会弹窗，必须去站点设置里恢复。
        //  2 / 3 = 位置不可用 / 超时，重试有意义。
        setBlocked(err.code === 1)
        setLocate('denied')
      },
      {
        // 只要城市级精度，关掉高精度可以更快出结果
        enableHighAccuracy: false,
        timeout: 12_000,
        // 位置变化不大，缓存十分钟，避免每次开页面都重新定位
        maximumAge: 600_000,
      },
    )
  }, [load])

  //  进入时先查权限状态：已授权就直接取，没授权就等用户点按钮。
  //  同时订阅权限变化 —— 用户去地址栏把定位改回「允许」之后，
  //  不用刷新页面就能自己恢复（这是之前「点了授权也没用」的死角：
  //  浏览器一旦 block，再调 getCurrentPosition 只会立刻失败）。
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocate('unsupported')
      return
    }
    if (!navigator.permissions?.query) {
      // 老浏览器没有 Permissions API，直接让用户点
      setLocate('prompt')
      return
    }

    let alive = true
    let status: PermissionStatus | undefined

    const sync = () => {
      if (!alive || !status) return
      if (status.state === 'granted') {
        setBlocked(false)
        request()
      } else if (status.state === 'denied') {
        setBlocked(true)
        setLocate('denied')
      } else {
        setBlocked(false)
        //  刚从 denied 放开时，界面停在「被拦」，要退回到可点状态
        setLocate((prev) => (prev === 'denied' ? 'prompt' : prev))
      }
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (!alive) return
        status = s
        s.addEventListener('change', sync)
        sync()
      })
      .catch(() => alive && setLocate('prompt'))

    return () => {
      alive = false
      status?.removeEventListener('change', sync)
    }
  }, [request])

  return {
    weather,
    place,
    locate,
    failed,
    /** 权限被浏览器 block（不是超时）—— 界面要给「去站点设置里恢复」的提示 */
    blocked,
    request,
    /** 已拼好的地址文本，未取到时为空串 */
    address: formatPlace(place),
  }
}
