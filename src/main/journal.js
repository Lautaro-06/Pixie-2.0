// El diario de charlas: todo lo que hablás con Pixie queda anotado en la compu (charlas.jsonl, una
// línea por charla), así se acuerda aunque se cierre, se actualice o pasen meses. Con eso:
//   - contesta «¿de qué hablamos ayer?» o «¿qué te conté del viaje?»
//   - la IA recibe lo último que hablaron y lo que charlaron antes sobre el tema de ahora
//   - cada día queda resumido en pocos temas (para acordarse de semanas atrás sin leer todo)
// Lo sensible queda marcado: Pixie no lo saca ella (solo si vos lo volvés a traer).
// Las contraseñas, tarjetas y claves se tapan antes de guardar.
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { sensitiveTopic, redactSecrets } from './sensitive.js'
import { words, similarity } from './memory.js'
import { dayKey } from './dates.js'

const MAX_ENTRIES = 20000 // unos años de charlas; lo más viejo se va
const MAX_TEXT = 600
const DAY = 24 * 60 * 60 * 1000

// Palabras que no dicen de qué hablaron
const FILLER = new Set([
  'hola', 'chau', 'gracias', 'dale', 'bueno', 'pixie', 'estas', 'esta', 'como', 'andas', 'bien', 'mal', 'todo', 'nada', 'algo', 'cosa',
  'cosas', 'quiero', 'queres', 'podes', 'puedo', 'hace', 'hacer', 'decime', 'deci', 'sabes', 'tenes', 'tengo', 'hoy', 'ayer', 'manana',
  'ahora', 'despues', 'listo', 'si', 'no', 'che', 'vos', 'yo', 'ella', 'ellos', 'aca', 'ahi', 'eso', 'esto', 'muy', 'mas', 'menos', 'otra',
  'otro', 'vez', 'poco', 'mucho', 'tambien', 'pero', 'porque', 'entonces', 'abri', 'pone', 'busca', 'cerra', 'subi', 'baja', 'volumen',
  // los pedidos («recordame…», «poné un timer de 5 segundos») no son temas
  'recordame', 'recorda', 'recordar', 'acordate', 'acorda', 'avisame', 'avisa', 'anotame', 'anota', 'agendame', 'agenda', 'haceme', 'timer', 'timers',
  'alarma', 'segundo', 'minuto', 'hora', 'poneme', 'abrime', 'buscame', 'contame', 'mostrame', 'explicame', 'hablamos', 'hablame', 'charlamos', 'conte',
  'dije', 'sabe', 'cuanto', 'cuanta', 'falta', 'queda', 'porfa', 'favor', 'gracia', 'chiste', 'quiere', 'pued', 'tene', 'quier', 'dale'
])
// «¿De qué hablamos ayer?», «¿qué te conté del viaje?»: son preguntas sobre las charlas, no charlas de ese tema
const RECALL = /\b(de que (hablamos|charlamos)|que te (conte|dije)|te acordas|que sabes de mi|olvidate)\b/

// De qué se habló: las palabras con más peso de lo que dijiste (tal cual las dijiste, con tildes)
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
export function topicsOf(text, max = 3) {
  const seen = new Set()
  const out = []
  for (const raw of String(text ?? '').toLowerCase().split(/[^a-z0-9áéíóúüñ]+/)) {
    const key = words(raw)[0] // sin tildes ni plural: «sábados» ~ «sabado»
    if (!key || raw.length < 4 || FILLER.has(fold(raw)) || FILLER.has(key) || /^\d+$/.test(raw) || seen.has(key)) continue
    seen.add(key)
    out.push(raw)
    if (out.length >= max) break
  }
  return out
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
// «hoy», «ayer», «el martes», «el 3 de octubre»
export function whenText(iso, now = new Date()) {
  const d = new Date(iso)
  const days = Math.round((new Date(dayKey(now)) - new Date(dayKey(d))) / DAY)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `el ${WEEKDAYS[d.getDay()]}`
  return `el ${d.getDate()} de ${d.toLocaleDateString('es-AR', { month: 'long' })}`
}

export function createJournal(file, { now = () => new Date() } = {}) {
  let entries = []
  try {
    if (existsSync(file)) {
      entries = readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
    }
  } catch {
    entries = []
  }

  function rewrite() {
    try {
      writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''))
    } catch {
      // sin disco: queda en memoria
    }
  }

  return {
    // Anota una charla: lo que dijiste y lo que contestó Pixie. pedido: era una orden («abrí Spotify»), no charla.
    // Si tenía un dato privado (una contraseña), queda tapado y la charla cuenta como personal.
    record(yo, pixie, { pedido = false } = {}) {
      const raw = String(yo ?? '').trim()
      const said = redactSecrets(raw).slice(0, MAX_TEXT)
      if (!said) return null
      const reply = redactSecrets(String(pixie ?? '').trim()).slice(0, MAX_TEXT)
      const sensible = sensitiveTopic(said) ?? (said !== raw.slice(0, MAX_TEXT) ? 'privado' : null)
      const entry = { at: now().toISOString(), yo: said, pixie: reply, temas: topicsOf(said), sensible, ...(pedido ? { pedido: true } : {}) }
      entries.push(entry)
      try {
        appendFileSync(file, `${JSON.stringify(entry)}\n`)
      } catch {
        // sin disco: queda en memoria
      }
      if (entries.length > MAX_ENTRIES * 1.1) {
        entries = entries.slice(-MAX_ENTRIES)
        rewrite()
      }
      return entry
    },
    count: () => entries.length,
    // Lo último que hablaron (para seguir la charla aunque Pixie se haya cerrado)
    recent(n = 6, { since = null } = {}) {
      const list = since ? entries.filter((e) => new Date(e.at) >= since) : entries
      return list.slice(-n)
    },
    // La última charla de verdad (no un pedido ni algo personal), de hace menos de maxMs
    lastTalk(maxMs = 2 * 60 * 60 * 1000) {
      const since = now().getTime() - maxMs
      for (let i = entries.length - 1; i >= 0 && new Date(entries[i].at).getTime() >= since; i--) {
        const e = entries[i]
        if (!e.pedido && !e.sensible && e.temas?.length && !RECALL.test(fold(e.yo))) return e
      }
      return null
    },
    // Lo que hablaron un día
    day(date) {
      const key = dayKey(date)
      return entries.filter((e) => dayKey(e.at) === key)
    },
    // Charlas viejas sobre un tema (las sensibles, solo si lo pediste vos con includeSensitive)
    search(query, { limit = 3, includeSensitive = false, before = null, min = 0.34 } = {}) {
      return entries
        .filter((e) => (includeSensitive || !e.sensible) && (!before || new Date(e.at) < before) && !RECALL.test(fold(e.yo)))
        .map((e) => ({ e, score: similarity(query, `${e.yo} ${e.temas?.join(' ') ?? ''}`) }))
        .filter((x) => x.score >= min)
        .sort((a, b) => b.score - a.score || b.e.at.localeCompare(a.e.at))
        .slice(0, limit)
        .map((x) => x.e)
    },
    // Cada día, en pocos temas (sin lo sensible): para la IA y para «¿de qué hablamos la semana pasada?»
    summaries(days = 7) {
      const today = dayKey(now())
      const byDay = new Map()
      for (const e of entries) {
        const k = dayKey(e.at)
        if (k === today) continue
        if (!byDay.has(k)) byDay.set(k, { fecha: k, charlas: 0, temas: new Map(), sensibles: 0 })
        const d = byDay.get(k)
        d.charlas++
        if (e.sensible) {
          d.sensibles++
          continue
        }
        for (const t of e.temas ?? []) d.temas.set(t, (d.temas.get(t) ?? 0) + 1)
      }
      return [...byDay.values()]
        .slice(-days)
        .map((d) => ({ fecha: d.fecha, charlas: d.charlas, sensibles: d.sensibles, temas: [...d.temas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t) }))
    },
    forgetAll() {
      entries = []
      rewrite()
    }
  }
}

// Lo que la IA tiene que saber de las charlas: lo último (aunque haya sido otro día) y lo que hablaron
// antes sobre el tema de ahora. Lo sensible solo entra si el mensaje de ahora es sobre eso.
export function journalContext(journal, message, now = new Date()) {
  if (!journal?.count()) return ''
  const lines = []
  const recent = journal.recent(6, { since: new Date(now.getTime() - 3 * DAY) }).filter((e) => !e.sensible)
  if (recent.length) lines.push(`Lo último que hablaron: ${recent.map((e) => `[${whenText(e.at, now)}] le dijo «${e.yo}» y le contestaste «${e.pixie.slice(0, 160)}»`).join(' | ')}`)
  const mine = sensitiveTopic(message)
  const older = journal.search(message, { limit: 3, includeSensitive: Boolean(mine), before: new Date(now.getTime() - 60 * 60 * 1000) })
  if (older.length) lines.push(`Antes hablaron de esto: ${older.map((e) => `${whenText(e.at, now)} te dijo «${e.yo}»`).join(' | ')}`)
  const days = journal.summaries(5).filter((d) => d.temas.length)
  if (days.length) lines.push(`Días anteriores: ${days.map((d) => `${d.fecha}: ${d.temas.join(', ')}`).join('; ')}`)
  lines.push('Lo personal o sensible (salud, familia, pareja, plata, creencias) no lo saques vos: usalo solo si el usuario lo trae.')
  return lines.join('\n')
}
