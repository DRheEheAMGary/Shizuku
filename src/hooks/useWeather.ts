/* ============================================================================
 *  Shizuku · 天气
 * ----------------------------------------------------------------------------
 *  数据源 Open-Meteo：免费、无需 API Key、允许浏览器直接跨域调用。
 *  城市写死在下面的常量里 —— 不弹定位授权，避免一进来就被问权限。
 * ========================================================================== */

import { useEffect, useState } from 'react'

/** 默认城市（改这里即可换地方） */
export const WEATHER_CITY = { name: '上海', lat: 31.2304, lon: 121.4737 }

export interface Weather {
  temp: number
  code: number
  isDay: boolean
  label: string
}

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

const API =
  `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_CITY.lat}` +
  `&longitude=${WEATHER_CITY.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch(API, { signal: controller.signal })
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

    return () => controller.abort()
  }, [])

  return { weather, failed, city: WEATHER_CITY.name }
}
