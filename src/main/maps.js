// Mapas, gratis y sin clave:
//   - Dónde queda un lugar: OpenStreetMap (Nominatim), con preferencia por Argentina y tu ciudad
//   - Cuánto se tarda caminando, en bici o en auto: OSRM (el servidor público de OpenStreetMap)
//   - Cómo llegar en colectivo, subte o tren: se abre Google Maps con el recorrido (con los horarios)
// Solo se manda el lugar que pediste (y tu casa, si la guardaste) a esos servicios.

const UA = 'Pixie/0.13 (asistente de escritorio de la E.T. N36)'
const MODES = {
  caminando: { osrm: 'foot', google: 'walking', nombre: 'caminando' },
  bici: { osrm: 'bike', google: 'bicycling', nombre: 'en bici' },
  auto: { osrm: 'driving', google: 'driving', nombre: 'en auto' },
  colectivo: { osrm: null, google: 'transit', nombre: 'en colectivo' }
}
export const MODE_NAMES = Object.keys(MODES)

// "en colectivo", "a pie", "en auto", "en bondi" → el modo
export function modeFrom(text) {
  const t = String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/\b(a pie|caminando|camino|caminar)\b/.test(t)) return 'caminando'
  if (/\b(bici|bicicleta)\b/.test(t)) return 'bici'
  if (/\b(auto|coche|manejando|taxi|uber|remis)\b/.test(t)) return 'auto'
  if (/\b(colectivo|bondi|bus|subte|tren|transporte publico)\b/.test(t)) return 'colectivo'
  return null
}

// El link de Google Maps con el recorrido (sin origen, Google usa dónde estás)
export function directionsUrl(destino, { origen = null, modo = 'colectivo' } = {}) {
  const p = new URLSearchParams({ api: '1', destination: destino, travelmode: MODES[modo]?.google ?? 'transit' })
  if (origen) p.set('origin', origen)
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

// 2.345 km → «2,3 km»; 850 m → «850 metros»
export function distanceText(m) {
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} metros`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`
}
// 1600 s → «27 minutos»; 5400 s → «1 hora y media»
export function durationText(s) {
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(min / 60)
  const rest = min - h * 60
  const hs = h === 1 ? 'una hora' : `${h} horas`
  if (rest < 8) return hs
  if (rest >= 23 && rest <= 37) return `${hs} y media`
  return `${hs} y ${rest} minutos`
}

// Distancia en línea recta (metros)
export function haversine(a, b) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function createMaps({ fetchImpl = (...a) => fetch(...a), getConfig = () => ({}), log = () => {} } = {}) {
  const cache = new Map() // lugar → coordenadas

  async function getJson(url, init = {}) {
    const res = await fetchImpl(url, { headers: { 'user-agent': UA, 'accept-language': 'es', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`respondió ${res.status}`)
    return res.json()
  }

  // Dónde queda: { lat, lon, nombre } o null. Prefiere Argentina y tu ciudad.
  async function geocode(lugar) {
    const q = String(lugar ?? '').trim()
    if (!q) return null
    const ciudad = getConfig().ciudad
    const key = `${q}|${ciudad ?? ''}`
    if (cache.has(key)) return cache.get(key)
    const search = async (text) =>
      getJson(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: text, format: 'jsonv2', limit: '1', countrycodes: 'ar' })}`)
    let found = []
    if (ciudad && !q.toLowerCase().includes(String(ciudad).toLowerCase())) found = await search(`${q}, ${ciudad}`)
    if (!found.length) found = await search(q)
    const r = found[0]
    const place = r ? { lat: Number(r.lat), lon: Number(r.lon), nombre: String(r.name || r.display_name || q).split(',')[0] } : null
    cache.set(key, place)
    return place
  }

  // Cuánto se tarda: { metros, segundos } o null
  async function route(from, to, modo = 'caminando') {
    const profile = MODES[modo]?.osrm
    if (!profile) return null
    const data = await getJson(`https://router.project-osrm.org/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`)
    const r = data.routes?.[0]
    if (!r) return null
    // El servidor público calcula caminando y en bici con la velocidad del auto: se corrige
    const speed = { foot: 1.3, bike: 4.2 }[profile]
    return { metros: r.distance, segundos: speed ? r.distance / speed : r.duration }
  }

  return { geocode, route, directionsUrl, cache }
}
