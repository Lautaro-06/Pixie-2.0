// Acciones en el navegador: YouTube y resumir el mail o la página abierta.
// Necesitan la extensión "Pixie para Chrome" (carpeta extension/).

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

export const browserActions = [
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
