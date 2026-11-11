import { checkQuery } from '../safety.js'
import { BlockedError, FriendlyError } from '../windows.js'

const CROSSREF_URL = 'https://api.crossref.org/works'
const MAX_RESULTS = 5

function publicationYear(item) {
  for (const key of ['published-print', 'published-online', 'published', 'issued']) {
    const parts = item[key]?.['date-parts']?.[0]
    if (Array.isArray(parts) && Number.isInteger(Number(parts[0]))) return Number(parts[0])
  }
  return null
}

function parsePapers(items) {
  const found = []
  const seen = new Set()
  for (const item of items) {
    const title = Array.isArray(item.title) ? String(item.title[0] ?? '').trim() : ''
    const doi = String(item.DOI ?? '').trim()
    if (!title || checkQuery(title) || !/^10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/.test(doi) || seen.has(doi)) continue
    const authors = (Array.isArray(item.author) ? item.author : [])
      .map((author) => [author.given, author.family].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .slice(0, 8)
    const year = publicationYear(item)
    if (!authors.length || !year) continue
    seen.add(doi)
    found.push({
      title: title.slice(0, 300),
      authors,
      year,
      url: `https://doi.org/${encodeURI(doi)}`,
      doi
    })
    if (found.length === MAX_RESULTS) break
  }
  return found
}

export async function searchCrossref(query, fetchImpl = (...args) => fetch(...args)) {
  const url = new URL(CROSSREF_URL)
  url.search = new URLSearchParams({
    'query.bibliographic': query,
    rows: String(MAX_RESULTS),
    select: 'DOI,title,author,published-print,published-online,published,issued'
  }).toString()
  let response
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': 'Pixie/0.16.4 (desktop assistant)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    })
  } catch {
    throw new FriendlyError('No pude conectarme con Crossref para buscar publicaciones. Revisá internet e intentá de nuevo.')
  }
  if (!response.ok) throw new FriendlyError(`Crossref no respondió bien (HTTP ${response.status}); no puedo verificar publicaciones ahora.`)
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new FriendlyError('Crossref devolvió una respuesta que no pude leer; no voy a inventar referencias.')
  }
  const items = payload?.message?.items
  if (!Array.isArray(items)) throw new FriendlyError('Crossref no devolvió resultados verificables.')
  return parsePapers(items)
}

export function createPapersAction({ fetchImpl } = {}) {
  let lastResults = []
  return {
    name: 'work_papers',
    requiresAI: false,
    logLine: (_params, result) => result.logLine ?? 'Modo Trabajo: consultó publicaciones',
    description: 'Busca publicaciones académicas reales en Crossref, guarda lecturas pendientes y recuerda temas de interés.',
    aiTool: {
      name: 'work_papers',
      description: 'Busca publicaciones en Crossref en tiempo real; nunca inventa citas. Para guardar una lectura, usa guardar con el número de un resultado reciente. Usa guardar_interes para recordar un tema de investigación.',
      input_schema: {
        type: 'object',
        properties: {
          operacion: { type: 'string', enum: ['buscar', 'guardar', 'guardar_interes'], description: 'Buscar publicaciones, guardar una lectura o recordar un tema de interés' },
          tema: { type: 'string', description: 'Tema de investigación para buscar o recordar' },
          numero: { type: 'integer', minimum: 1, maximum: MAX_RESULTS, description: 'Número de resultado que se quiere guardar como lectura pendiente' }
        },
        required: ['operacion'],
        additionalProperties: false
      }
    },
    async run(params = {}, ctx) {
      const mode = ctx.work?.context?.()
      if (!mode?.habilitado || !mode.perfiles.some(({ id }) => id === 'cientifico')) {
        throw new FriendlyError('Activá el perfil Científico en Ajustes → Trabajo para buscar publicaciones.')
      }
      if (params.operacion === 'guardar') {
        const index = Number(params.numero) - 1
        const paper = Number.isInteger(index) ? lastResults[index] : null
        if (!paper) throw new FriendlyError('Elegí un número de la búsqueda de publicaciones más reciente.')
        const todo = ctx.memory?.addTodo?.(`Leer: ${paper.title} — ${paper.url}`)
        if (!todo) throw new FriendlyError('No pude guardar la lectura pendiente en la memoria.')
        return { text: `Anoté como lectura pendiente: «${paper.title}».`, face: 'happy', logLine: 'Modo Trabajo: guardó una lectura pendiente' }
      }
      if (params.operacion === 'guardar_interes') {
        const topic = String(params.tema ?? '').trim().slice(0, 200)
        if (!topic) throw new FriendlyError('Decime qué tema de investigación querés que recuerde.')
        const blocked = checkQuery(topic)
        if (blocked) throw new BlockedError(blocked)
        const fact = ctx.memory?.addFact?.(`me interesa investigar ${topic}`)
        if (!fact) throw new FriendlyError('No pude guardar ese tema de interés en la memoria.')
        return { text: `Voy a recordar que te interesa investigar ${topic}.`, face: 'happy', logLine: 'Modo Trabajo: guardó un tema de interés' }
      }
      if (params.operacion !== 'buscar') throw new FriendlyError('Esa operación de búsqueda no está disponible.')
      const query = String(params.tema ?? '').trim().slice(0, 300)
      if (!query) throw new FriendlyError('Decime el tema o la pregunta para buscar publicaciones.')
      const blocked = checkQuery(query)
      if (blocked) throw new BlockedError(blocked)
      lastResults = await searchCrossref(query, fetchImpl)
      if (!lastResults.length) return { text: 'Crossref no encontró publicaciones con título y DOI verificables para esa búsqueda.', face: 'confused' }
      return {
        text: `Resultados reales de Crossref para «${query}»:\n\n${lastResults.map((paper, index) => {
          return `${index + 1}. ${paper.title}\n${paper.authors.join(', ')} · ${paper.year}\n${paper.url}`
        }).join('\n\n')}\n\nDecime «guardá la lectura ${1}» para anotarla como pendiente.`,
        face: 'happy',
        logLine: 'Modo Trabajo: consultó publicaciones'
      }
    }
  }
}

export const papersAction = createPapersAction()
