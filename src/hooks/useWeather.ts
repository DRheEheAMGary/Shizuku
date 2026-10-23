/* ============================================================================
 *  Shizuku · 天气与地址
 * ----------------------------------------------------------------------------
 *  两件事：
 *    1. 天气 —— Open-Meteo，免费、无需 API Key、允许浏览器直接跨域调用
 *    2. 地址 —— 逆地理编码走 **SSO 的 /api/reverse-geocode 代理**，
 *       不直连第三方：上游在国内经常不可达，直连会一直转圈
 *
 *  定位权限不主动弹。一进来先问系统「授权过了吗」：
 *    授权过 → 直接取
 *    没授权 → 界面上盖一层遮罩，写着「当前无法获取地址」+「授权」，
 *             由用户点一下才弹系统的权限框
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react'
import { SSO_ISSUER } from '@/auth/config'

export interface Weather {
  temp: number
  code: number
  isDay: boolean
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

/** 把省/市/区拼成「省 · 市 · 区」：缺的省略，重复的也省略 */
export function formatPlace(place: Place | null): string {
  if (!place) return ''
  const parts: string[] = []
  for (const part of [place.province, place.city, place.district]) {
    const v = (part ?? '').trim()
    if (!v) continue
    // 直辖市的省和市同名，只留一个
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

  /** 取一次坐标，然后并行拉天气和地址 */
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
        if (err?.name !== 'AbortError') setFailed(true)
      })

    // 地址失败不影响天气，天气好了照样显示
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

  /** 弹系统的定位权限框 */
  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocate('unsupported')
      return
    }
    setLocate('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocate('granted')
        load(pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocate('denied'),
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        // 位置变化不大，缓存十分钟，避免每次开页面都重新定位
        maximumAge: 600_000,
      },
    )
  }, [load])

  // 进来先问系统：以前授权过就直接取，没授权就等着用户点
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
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted') request()
        else if (p.state === 'denied') setLocate('denied')
        else setLocate('prompt')
      })
      .catch(() => setLocate('prompt'))
  }, [request])

  return {
    weather,
    place,
    locate,
    failed,
    request,
    address: formatPlace(place),
  }
}
