// Clima con Open-Meteo (gratis y sin clave para uso no comercial).

const WEATHER = [
  [[0], 'despejado'],
  [[1], 'mayormente despejado'],
  [[2], 'parcialmente nublado'],
  [[3], 'nublado'],
  [[45, 48], 'con niebla'],
  [[51, 53, 55, 56, 57], 'con llovizna'],
  [[61, 63, 66], 'lloviendo'],
  [[65, 67], 'lloviendo fuerte'],
  [[71, 73, 75, 77, 85, 86], 'nevando'],
  [[80, 81, 82], 'con chaparrones'],
  [[95, 96, 99], 'con tormenta']
]

function weatherText(code) {
  return WEATHER.find(([codes]) => codes.includes(code))?.[1] ?? 'con un clima raro'
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function geocode(ciudad) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`
  const data = await getJson(url)
  const r = data.results?.[0]
  if (!r) return null
  const extra = [r.admin1, r.country].filter((x) => x && x !== r.name).join(', ')
  return { nombre: r.name, detalle: extra, lat: r.latitude, lon: r.longitude }
}

async function currentPlace(ctx) {
  const cfg = ctx.getConfig()
  if (cfg.lugar) return cfg.lugar
  const lugar = await geocode(cfg.ciudad)
  if (!lugar) throw new Error(`No encontré la ciudad ${cfg.ciudad}`)
  ctx.saveConfig({ lugar })
  return lugar
}

export async function describeWeather(ctx) {
  const lugar = await currentPlace(ctx)
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat}&longitude=${lugar.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=1'
  const data = await getJson(url)
  const now = data.current
  const temp = Math.round(now.temperature_2m)
  const feels = Math.round(now.apparent_temperature)
  const min = Math.round(data.daily.temperature_2m_min[0])
  const max = Math.round(data.daily.temperature_2m_max[0])
  const rain = data.daily.precipitation_probability_max?.[0]
  let text = `En ${lugar.nombre} hay ${temp}°`
  if (Math.abs(feels - temp) >= 2) text += ` (sensación de ${feels}°)`
  text += ` y está ${weatherText(now.weather_code)}. Hoy: mínima ${min}°, máxima ${max}°`
  if (rain != null) text += `, ${rain}% de probabilidad de lluvia`
  text += '.'
  if (rain >= 60) text += ' Llevá paraguas.'
  return text
}

export const weatherActions = [
  {
    name: 'clima',
    description: 'Dice el clima de la ciudad configurada',
    run: async (_params, ctx) => {
      try {
        return { text: await describeWeather(ctx), face: 'happy' }
      } catch {
        return { text: 'No pude conseguir el clima. ¿Hay internet?', face: 'confused' }
      }
    }
  },
  {
    name: 'configurar_ciudad',
    description: 'Cambia la ciudad para el clima',
    run: async ({ ciudad }, ctx) => {
      let lugar
      try {
        lugar = await geocode(ciudad)
      } catch {
        return { text: 'No pude buscar la ciudad. ¿Hay internet?', face: 'confused' }
      }
      if (!lugar) return { text: `No encontré «${ciudad}».`, face: 'confused' }
      ctx.saveConfig({ ciudad: lugar.nombre, lugar })
      const where = lugar.detalle ? `${lugar.nombre} (${lugar.detalle})` : lugar.nombre
      return { text: `Listo, para el clima uso ${where}.`, face: 'happy' }
    }
  }
]
