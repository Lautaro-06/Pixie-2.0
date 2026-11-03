// «¿Cómo llego al Obelisco?», «¿cuánto tardo caminando a la escuela?», «mi casa queda en Rivadavia 5000»,
// «¿dónde para el 60?» (te muestra las paradas en Google Maps). Ver maps.js.
import { launch, BlockedError } from '../windows.js'
import { checkQuery } from '../safety.js'
import { directionsUrl, distanceText, durationText, haversine, MODE_NAMES } from '../maps.js'

const HOME = /^(mi |a mi |a )?casa$/i

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
    description: 'Guarda dónde queda tu casa (para calcular cuánto tardás en llegar a los lugares)',
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
    description: 'Muestra en Google Maps las paradas de un colectivo cerca de tu casa',
    run: async ({ linea }, ctx) => {
      const l = String(linea ?? '').trim().replace(/^(el|la|linea)\s+/i, '')
      if (!l) return { text: '¿Qué colectivo? Decime, por ejemplo, «¿dónde para el 60?».', face: 'confused' }
      const casa = ctx.getConfig().direccionCasa
      const q = `parada colectivo ${l}${casa ? ` cerca de ${casa}` : ''}`
      await launch({ tipo: 'uri', valor: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` })
      return {
        text: `Te abrí en Google Maps las paradas del ${l}${casa ? ' cerca de tu casa' : ''}. Para ir a algún lado, decime «¿cómo llego a …?» y te muestro el recorrido con los horarios.`,
        face: 'happy'
      }
    }
  }
]
