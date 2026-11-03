import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMaps, directionsUrl, distanceText, durationText, modeFrom } from '../src/main/maps.js'
import { runAction } from '../src/main/actions/index.js'
import { opened } from './helpers/electron-stub.mjs'
import { interpretAll } from '../src/main/brain.js'

// Servicios de mentira: Nominatim, OSRM y la API de Transporte
const PLACES = {
  'av rivadavia 5000, Buenos Aires': { lat: -34.6186, lon: -58.4371, name: 'Avenida Rivadavia' },
  'obelisco, Buenos Aires': { lat: -34.6037, lon: -58.3816, name: 'Obelisco' }
}
function fakeFetch(log = []) {
  return async (url) => {
    log.push(url)
    const u = new URL(url)
    if (u.host === 'nominatim.openstreetmap.org') {
      const p = PLACES[u.searchParams.get('q')]
      return { ok: true, json: async () => (p ? [{ lat: String(p.lat), lon: String(p.lon), name: p.name }] : []) }
    }
    if (u.host === 'router.project-osrm.org') return { ok: true, json: async () => ({ routes: [{ distance: 5200, duration: 700 }] }) }
    if (u.host === 'apitransporte.buenosaires.gob.ar') {
      if (u.searchParams.get('client_secret') !== 'secreto') return { ok: false, status: 401, json: async () => ({}) }
      return {
        ok: true,
        json: async () => [
          { route_short_name: '60A', latitude: -34.6100, longitude: -58.4300, trip_headsign: 'Constitución', speed: 5 },
          { route_short_name: '60B', latitude: -34.5600, longitude: -58.4600, trip_headsign: 'Escobar', speed: 7 },
          { route_short_name: '152', latitude: -34.6187, longitude: -58.4372, trip_headsign: 'Olivos' }
        ]
      }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
}

test('arma el link de Google Maps y dice distancias y tiempos en criollo', () => {
  assert.equal(directionsUrl('Obelisco', { origen: 'Rivadavia 5000', modo: 'colectivo' }), 'https://www.google.com/maps/dir/?api=1&destination=Obelisco&travelmode=transit&origin=Rivadavia+5000')
  assert.match(directionsUrl('Obelisco', { modo: 'caminando' }), /travelmode=walking$/)
  assert.equal(distanceText(830), '850 metros')
  assert.equal(distanceText(5230), '5,2 km')
  assert.equal(durationText(1600), '27 minutos')
  assert.equal(durationText(5400), 'una hora y media')
  assert.equal(durationText(7300), '2 horas')
  assert.equal(modeFrom('en bondi'), 'colectivo')
  assert.equal(modeFrom('a pie'), 'caminando')
})

test('«¿cómo llego…?» abre el recorrido y dice cuánto se tarda desde tu casa', async () => {
  let cfg = { ciudad: 'Buenos Aires' }
  const log = []
  const maps = createMaps({ fetchImpl: fakeFetch(log), getConfig: () => cfg })
  const ctx = { maps, getConfig: () => cfg, saveConfig: (p) => (cfg = { ...cfg, ...p }), log: () => {} }
  let r = await runAction('como_llego', { destino: 'obelisco', modo: 'caminando' }, ctx)
  assert.match(r.text, /^Te abrí en Google Maps cómo llegar a obelisco\. Si me decís dónde queda tu casa/)
  r = await runAction('mi_casa', { direccion: 'av rivadavia 5000' }, ctx)
  assert.match(r.text, /guardé que tu casa queda en av rivadavia 5000/)
  r = await runAction('como_llego', { destino: 'obelisco', modo: 'caminando' }, ctx)
  assert.equal(r.text, 'Te abrí en Google Maps cómo llegar a obelisco. Caminando son 5,2 km, más o menos una hora.')
  assert.match(opened.at(-1), /maps\/dir\/\?api=1&destination=obelisco&travelmode=walking&origin=av\+rivadavia\+5000/)
  r = await runAction('como_llego', { destino: 'obelisco' }, ctx)
  assert.match(r.text, /en colectivo\. Queda a 5,2 km de tu casa\.$/)
  r = await runAction('como_llego', { destino: 'casa' }, ctx)
  assert.equal(r.text, 'Te abrí en Google Maps cómo llegar a tu casa en colectivo.')
  assert.ok(log.some((u) => u.includes('countrycodes=ar')), 'busca en Argentina')
  await assert.rejects(runAction('como_llego', { destino: 'videos porno' }, ctx).then((x) => { if (x.blocked) throw new Error('bloqueado') }), /bloqueado/)
})

test('«¿dónde para el 60?»: las paradas en Google Maps (sin la API de colectivos)', async () => {
  const cfg = { ciudad: 'Buenos Aires', direccionCasa: 'av rivadavia 5000' }
  const ctx = { getConfig: () => cfg, log: () => {} }
  const r = await runAction('colectivo', { linea: '60' }, ctx)
  assert.match(r.text, /^Te abrí en Google Maps las paradas del 60 cerca de tu casa\./)
  assert.match(opened.at(-1), /google\.com\/maps\/search\/\?api=1&query=parada%20colectivo%2060%20cerca%20de%20av%20rivadavia%205000/)
  const nohome = await runAction('colectivo', { linea: '39' }, { getConfig: () => ({}), log: () => {} })
  assert.match(nohome.text, /^Te abrí en Google Maps las paradas del 39\./)
})

test('entiende cómo se pide', () => {
  const one = (t) => interpretAll(t)?.[0]
  assert.deepEqual(one('¿Cómo llego al Obelisco en colectivo?'), { action: 'como_llego', params: { destino: 'obelisco', modo: 'colectivo' } })
  assert.deepEqual(one('cuánto tardo caminando a la plaza'), { action: 'como_llego', params: { destino: 'plaza', modo: 'caminando' } })
  assert.deepEqual(one('¿dónde viene el 60?'), { action: 'colectivo', params: { linea: '60' } })
  assert.deepEqual(one('¿dónde para el 152?'), { action: 'colectivo', params: { linea: '152' } })
  assert.deepEqual(one('¿dónde queda mi casa?'), { action: 'mi_casa', params: {} })
  assert.equal(one('¿dónde queda Tucumán?').action, 'buscar', 'dónde queda un lugar sigue siendo buscarlo en el mapa')
})
