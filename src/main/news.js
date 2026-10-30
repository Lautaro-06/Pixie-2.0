// Noticias de Infobae y TN, por RSS (gratis, sin clave). Si el RSS de un diario no responde,
// usa Google Noticias filtrado por ese diario. Los titulares que pasan el filtro de contenido
// (nada para adultos ni gore) se guardan un rato para no pedirlos a cada rato.
import { checkQuery } from './safety.js'

const CACHE_MS = 10 * 60 * 1000
const googleNews = (site) => `https://news.google.com/rss/search?q=site:${site}+when:1d&hl=es-419&gl=AR&ceid=AR:es-419`

export const SOURCES = {
  infobae: {
    nombre: 'Infobae',
    feeds: ['https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml', 'https://www.infobae.com/feeds/rss/', googleNews('infobae.com')]
  },
  tn: {
    nombre: 'TN',
    feeds: ['https://tn.com.ar/arc/outboundfeeds/rss/?outputType=xml', 'https://tn.com.ar/rss.xml', googleNews('tn.com.ar')]
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', ndash: '–', mdash: '—', hellip: '…' }

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

const clean = (s) =>
  decodeEntities(
    String(s ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/<[^>]+>/g, ' ') // por si venía escapado dos veces
    .replace(/\s+/g, ' ')
    .trim()

const tag = (block, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? m[1] : null
}

// Un RSS (o Atom) → [{ titulo, link, fecha, resumen }]
export function parseFeed(xml, { nombre = null } = {}) {
  const text = String(xml ?? '')
  const blocks = text.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? text.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  const items = []
  for (const b of blocks) {
    let titulo = clean(tag(b, 'title'))
    if (!titulo) continue
    // Google Noticias agrega " - Infobae" al final
    if (nombre) titulo = titulo.replace(new RegExp(`\\s+[-–]\\s+${nombre}(\\.com(\\.ar)?)?$`, 'i'), '')
    const link = clean(tag(b, 'link')) || (/<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? '')
    const when = clean(tag(b, 'pubDate') ?? tag(b, 'dc:date') ?? tag(b, 'updated') ?? tag(b, 'published'))
    const fecha = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null
    const resumen = clean(tag(b, 'description') ?? tag(b, 'summary')).slice(0, 300)
    items.push({ titulo, link: decodeEntities(link), fecha, ...(resumen && resumen !== titulo ? { resumen } : {}) })
  }
  return items
}

// Titulares que Pixie no lee (para chicos y ferias): nada para adultos, gore ni cosas ilegales
export const isSafe = (item) => !checkQuery(`${item.titulo} ${item.resumen ?? ''}`)

export function createNews({ fetchImpl = (...a) => fetch(...a), log = () => {}, now = () => Date.now() }) {
  const cache = new Map() // fuente → { items, at }
  const working = new Map() // fuente → qué dirección anduvo la última vez

  async function fetchSource(id) {
    const source = SOURCES[id]
    const urls = [...new Set([working.get(id), ...source.feeds].filter(Boolean))]
    for (const url of urls) {
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (Pixie)' } })
        if (!res.ok) continue
        const items = parseFeed(await res.text(), { nombre: source.nombre })
        if (!items.length) continue
        working.set(id, url)
        return items.map((it) => ({ ...it, fuente: source.nombre }))
      } catch {
        // probamos la siguiente
      }
    }
    throw new Error(`No pude leer las noticias de ${source.nombre}.`)
  }

  async function bySource(id) {
    const hit = cache.get(id)
    if (hit && now() - hit.at < CACHE_MS) return hit.items
    try {
      const items = (await fetchSource(id)).filter(isSafe)
      cache.set(id, { items, at: now() })
      return items
    } catch (err) {
      log(`noticias: ${err.message}`)
      if (hit) return hit.items // sin internet: las últimas que tenía
      throw err
    }
  }

  // Lo último de las fuentes elegidas, intercalado y lo más nuevo primero. tema: filtra por palabra.
  async function latest({ fuentes = Object.keys(SOURCES), tema = null } = {}) {
    const ids = fuentes.filter((f) => SOURCES[f])
    const results = await Promise.allSettled(ids.map(bySource))
    const lists = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    if (!lists.length) throw new Error('No pude leer las noticias. ¿Hay internet?')
    let all = []
    for (let i = 0; all.length < 200 && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) all.push(l[i])
    if (tema) {
      const words = fold(tema).split(/\s+/).filter((w) => w.length > 2)
      all = all.filter((it) => {
        const t = fold(`${it.titulo} ${it.resumen ?? ''}`)
        return words.some((w) => t.includes(w))
      })
    }
    const seen = new Set()
    return all.filter((it) => {
      const k = fold(it.titulo).slice(0, 60)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  return { latest }
}

function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
