// «¿Cómo llego al Obelisco?», «¿cuánto tardo caminando a la escuela?», «mi casa queda en Rivadavia 5000»,
// «¿dónde viene el 60?». Ver maps.js.
import { launch, BlockedError } from '../windows.js'
import { checkQuery } from '../safety.js'
import { directionsUrl, distanceText, durationText, haversine, MODE_NAMES } from '../maps.js'

export const TRANSIT_SIGNUP = 'https://api-transporte.buenosaires.gob.ar/registro'
const HOME = /^(mi |a mi |a )?casa$/i
const CITY_BUS_KMH = 15 // lo que anda un colectivo en la ciudad, más o menos

const MODE_TEXT = { caminando: 'Caminando', bici: 'En bici', auto: 'En auto' }

export const mapActions = [
  {
    name: 'como_llego',
    description: 'Abre en Google Maps cómo llegar a un lugar (en colectivo, caminando, en bici o en auto) y dice cuánto se tarda',
    run: async ({ destino, modo }, ctx) => {
      let to = String(destino ?? '').trim()
      if (!to) return { text: '¿A dónde querés ir?', face: 'confused' }
      const blocked = checkQuery(to)
      if (blocked) throw new BlockedError(blocked)
      const casa = ctx.getConfig().direccionCasa ?? null
      const toHome = HOME.test(to)
      if (toHome) {
        if (!casa) return { text: 'No sé dónde queda tu casa. Decime, por ejemplo, «mi casa queda en Rivadavia 5000».', face: 'confused' }
        to = casa
      }
      const how = MODE_NAMES.includes(modo) ? modo : 'colectivo'
      const from = toHome ? null : casa
      await launch({ tipo: 'uri', valor: directionsUrl(to, { origen: from, modo: how }) })
      const place = toHome ? 'tu casa' : to
      const opened = `Te abrí en Google Maps cómo llegar a ${place}${how === 'colectivo' ? ' en colectivo' : ''}.`
      // Cuánto se tarda (si hay internet y encuentra los dos lugares)
      if (!ctx.maps || !from) return { text: `${opened}${casa ? '' : ' Si me decís dónde queda tu casa, te digo cuánto tardás.'}`, face: 'happy' }
      try {
        const [a, b] = await Promise.all([ctx.maps.geocode(from), ctx.maps.geocode(to)])
        if (!a || !b) return { text: opened, face: 'happy' }
        if (how === 'colectivo') {
          const walk = await ctx.maps.route(a, b, 'caminando')
          const far = walk ? walk.metros : haversine(a, b)
          return { text: `${opened} Queda a ${distanceText(far)} de tu casa.`, face: 'happy' }
        }
        const r = await ctx.maps.route(a, b, how)
        if (!r) return { text: opened, face: 'happy' }
        return { text: `${opened} ${MODE_TEXT[how]} son ${distanceText(r.metros)}, más o menos ${durationText(r.segundos)}.`, face: 'happy' }
      } catch (err) {
        ctx.log?.(`mapas: ${err.message}`)
        return { text: opened, face: 'happy' }
      }
    }
  },
  {
    name: 'mi_casa',
    description: 'Guarda dónde queda tu casa (para calcular cuánto tardás y dónde viene el colectivo)',
    run: ({ direccion }, ctx) => {
      const d = String(direccion ?? '').trim().slice(0, 120)
      if (!d) {
        const casa = ctx.getConfig().direccionCasa
        return casa
          ? { text: `Tengo anotado que tu casa queda en ${casa}.`, face: 'happy' }
          : { text: 'No sé dónde queda tu casa. Decime, por ejemplo, «mi casa queda en Rivadavia 5000».', face: 'confused' }
      }
      ctx.saveConfig({ direccionCasa: d })
      return { text: `Listo, guardé que tu casa queda en ${d}. Queda solo en esta compu; para calcular recorridos se la paso a los mapas.`, face: 'happy' }
    }
  },
  {
    name: 'colectivo',
    description: 'Dice dónde viene un colectivo de la Ciudad de Buenos Aires (el más cercano a tu casa) y cuánto le falta',
    run: async ({ linea }, ctx) => {
      const l = String(linea ?? '').trim().replace(/^(el|la|linea)\s+/i, '')
      if (!l) return { text: '¿Qué colectivo? Decime, por ejemplo, «¿dónde viene el 60?».', face: 'confused' }
      const casa = ctx.getConfig().direccionCasa
      if (!ctx.transit?.configured()) {
        ctx.openSettings?.('ajustes/mapas')
        const q = `parada colectivo ${l}${casa ? ` cerca de ${casa}` : ''}`
        await launch({ tipo: 'uri', valor: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` })
        return {
          text: `Para decirte dónde viene el ${l} en vivo necesito una clave gratis de la Ciudad: te abrí mis ajustes (Mapas) con los pasos. Mientras, te mostré las paradas del ${l} en Google Maps.`,
          face: 'idle'
        }
      }
      if (!casa) return { text: 'Primero decime dónde queda tu casa: «mi casa queda en …». Así busco el colectivo más cerca.', face: 'confused' }
      try {
        const home = await ctx.maps.geocode(casa)
        if (!home) return { text: `No encontré «${casa}» en el mapa. Probá decirme la dirección con la ciudad.`, face: 'confused' }
        const buses = await ctx.transit.vehicles(l)
        if (!buses.length) return { text: `No veo ningún ${l} andando ahora. Puede que esa línea no sea de la Ciudad o que no esté pasando.`, face: 'confused' }
        const near = buses.map((b) => ({ ...b, metros: haversine(home, b) })).sort((a, b) => a.metros - b.metros)
        const b = near[0]
        const eta = (b.metros / 1000 / CITY_BUS_KMH) * 3600
        const where = b.destino ? `, va para ${b.destino}` : ''
        const others = buses.length > 1 ? ` Hay ${buses.length} andando.` : ''
        return {
          text: `El ${l} más cerca está a ${distanceText(b.metros)} de tu casa${where}: si viene para tu lado, llega en más o menos ${durationText(eta)}.${others}`,
          face: 'happy'
        }
      } catch (err) {
        return { text: `No pude ver dónde viene el ${l}: ${err.message}.`, face: 'confused' }
      }
    }
  }
]
