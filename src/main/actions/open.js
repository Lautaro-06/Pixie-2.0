import { app } from 'electron'
import { resolveTarget } from '../catalog.js'
import { launch, closeProcess, BlockedError } from '../windows.js'
import { checkUrl, checkQuery } from '../safety.js'

function findTarget(objetivo, ctx) {
  return resolveTarget(objetivo ?? '', ctx.getConfig().apps ?? [])
}

export const openActions = [
  {
    name: 'abrir',
    description: 'Abre una app, un sitio web o una carpeta',
    run: async ({ objetivo }, ctx) => {
      const asked = checkQuery(objetivo) ?? checkUrl(objetivo ?? '', ctx.getConfig().sitiosBloqueados)
      if (asked) throw new BlockedError(asked)
      const found = findTarget(objetivo, ctx)
      if (!found) {
        return {
          text: `No conozco «${objetivo}». Se puede sumar en config.json (lo abrís desde el ícono de Pixie en la barra de tareas).`,
          face: 'confused'
        }
      }
      const { tipo, item } = found
      if (tipo === 'sitio') {
        const blocked = checkUrl(item.url, ctx.getConfig().sitiosBloqueados)
        if (blocked) throw new BlockedError(blocked)
      }
      if (tipo === 'carpeta') await launch({ tipo: 'ruta', valor: app.getPath(item.clave) })
      else if (tipo === 'sitio') await launch({ tipo: 'uri', valor: item.url })
      else await launch(item.abrir)
      return { text: `Abriendo ${item.nombre}.`, face: 'happy' }
    }
  },
  {
    name: 'cerrar_app',
    description: 'Cierra una app (pide confirmación)',
    confirm: true,
    confirmText: ({ objetivo }, ctx) => {
      const found = findTarget(objetivo, ctx)
      const nombre = found?.item?.nombre ?? objetivo
      return `¿Cierro ${nombre}? Si tenés algo sin guardar, se puede perder.`
    },
    run: async ({ objetivo }, ctx) => {
      const found = findTarget(objetivo, ctx)
      if (!found || found.tipo !== 'app' || !found.item.proceso) {
        return { text: `No sé cerrar «${objetivo}».`, face: 'confused' }
      }
      try {
        await closeProcess(found.item.proceso)
      } catch {
        return { text: `No encontré ${found.item.nombre} abierto.`, face: 'confused' }
      }
      return { text: `Cerré ${found.item.nombre}.`, face: 'happy' }
    }
  },
  {
    name: 'buscar',
    description: 'Busca algo en Google, YouTube o Google Maps',
    run: async ({ sitio, consulta }) => {
      const blocked = checkQuery(consulta)
      if (blocked) throw new BlockedError(blocked)
      const q = encodeURIComponent(consulta ?? '')
      // Google siempre con la búsqueda segura activada
      const google = `https://www.google.com/search?q=${q}&safe=active`
      const where = {
        youtube: ['YouTube', `https://www.youtube.com/results?search_query=${q}`],
        maps: ['Google Maps', `https://www.google.com/maps/search/${q}`],
        google: ['Google', google]
      }[sitio] ?? ['Google', google]
      await launch({ tipo: 'uri', valor: where[1] })
      return { text: `Buscando «${consulta}» en ${where[0]}.`, face: 'happy' }
    }
  }
]
