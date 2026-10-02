// Acciones en el navegador: poner videos y temas, YouTube y resumir el mail o la
// página abierta. Casi todas necesitan la extensión "Pixie para Chrome" (carpeta
// extension/); poner un tema anda también sin ella.
import { launch, BlockedError } from '../windows.js'
import { checkQuery } from '../safety.js'
import { findVideo } from '../youtube-search.js'

const FACE_BY_ACTION = { like: 'love', suscribir: 'happy', dislike: 'sad', que_veo: 'happy' }

// Si no hay IA: asunto, remitente y las primeras oraciones
export function quickSummary(page) {
  const sentences = String(page.text ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20)
    .slice(0, 2)
    .join(' ')
  const start = page.kind === 'mail' ? `Es de ${page.sender || 'alguien'}: «${page.subject}».` : `«${page.title}».`
  return `${start} ${sentences}`.trim().slice(0, 400)
}

// Texto para darle a la IA
export function pageForAI(page) {
  const head = page.kind === 'mail' ? `Asunto: ${page.subject}\nDe: ${page.sender}` : `Título: ${page.title}\nDirección: ${page.url}`
  const note = page.truncated ? '\n(Es muy largo: esto es solo el principio.)' : ''
  return `${head}${note}\n\n${page.text}`
}

// Lo que contesta Pixie cuando pone un video
function nowPlaying(v, playing = true) {
  const what = `«${v.title || 'el video'}»${v.channel ? ` de ${v.channel}` : ''}`
  return playing ? `Poniendo ${what}.` : `Te dejé ${what}. Si no arranca solo, tocá play.`
}

export const browserActions = [
  {
    name: 'reproducir',
    description: 'Busca y reproduce enseguida un tema o video en YouTube',
    run: async ({ consulta }, ctx) => {
      const q = String(consulta ?? '').trim()
      if (!q) return { text: '¿Qué querés que ponga?', face: 'confused' }
      const blocked = checkQuery(q)
      if (blocked) throw new BlockedError(blocked)
      // Con la extensión: lo pone en tu pestaña de YouTube y se fija que suene
      if (ctx.browser?.connected()) {
        try {
          const r = await ctx.browser.request('reproducir', { consulta: q }, 30000)
          const bad = checkQuery(r.title)
          if (bad) {
            await ctx.browser.request('youtube', { accion: 'pausa' }).catch(() => {})
            throw new BlockedError(bad)
          }
          return { text: nowPlaying(r, r.playing), face: 'music' }
        } catch (err) {
          if (err instanceof BlockedError) throw err
          ctx.log(`reproducir con la extensión: ${err.message}`)
        }
      }
      // Sin la extensión: busca el video y lo abre directo
      const video = await findVideo(q, ctx.fetch).catch(() => null)
      if (video && !checkQuery(video.title)) {
        await launch({ tipo: 'uri', valor: `https://www.youtube.com/watch?v=${video.videoId}` })
        return { text: nowPlaying(video), face: 'music' }
      }
      await launch({ tipo: 'uri', valor: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` })
      return { text: `Te abrí la búsqueda de «${q}» en YouTube: tocá el que quieras.`, face: 'music' }
    }
  },
  {
    name: 'youtube_click',
    description: 'Pone el video número N de la lista de YouTube que tenés abierta',
    run: async ({ n }, ctx) => {
      const r = await ctx.browser.request('youtube_click', { n: Number(n) || 1 }, 20000)
      const bad = checkQuery(r.title)
      if (bad) {
        await ctx.browser.request('youtube', { accion: 'pausa' }).catch(() => {})
        throw new BlockedError(bad)
      }
      return { text: nowPlaying(r, r.playing), face: 'music' }
    }
  },
  {
    name: 'youtube',
    description: 'Interactúa con el video de YouTube abierto en Chrome',
    run: async ({ accion, valor }, ctx) => {
      const r = await ctx.browser.request('youtube', { accion, valor })
      return { text: r.text, face: r.ok ? FACE_BY_ACTION[accion] ?? 'happy' : 'confused' }
    }
  },
  {
    name: 'resumir',
    description: 'Resume el mail abierto en Gmail o la página abierta en Chrome',
    run: async ({ que }, ctx) => {
      const page = await ctx.readPage(que === 'mail' ? 'mail' : 'pagina')
      let summary = null
      if (ctx.ai?.enabled()) {
        try {
          summary = await ctx.ai.summarize(page.kind, pageForAI(page))
        } catch {
          summary = null // sin IA o sin internet: resumen simple
        }
      }
      return { text: summary || quickSummary(page), face: 'happy' }
    }
  }
]
