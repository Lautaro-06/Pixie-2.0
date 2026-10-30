// Las tareas de Classroom. Los calendarios de las materias son del profe y Google no da su dirección
// secreta, así que Pixie le pide a su extensión de Chrome que lea tu página de Pendientes (con la sesión
// que ya tenés abierta). Las tareas con fecha se suman a la agenda como entregas, con sus avisos.
// Lo último que leyó queda en classroom.json, así sabe tus entregas aunque Chrome esté cerrado.
import { readFileSync, writeFileSync } from 'node:fs'
import { alertsFor } from './memory.js'

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const EVERY_MS = 2 * 60 * MIN // cada cuánto la lee (si Chrome está abierto)
const MIN_GAP_MS = 5 * MIN // no más seguido que esto aunque se lo pidas

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const MONTHS = {
  ene: 0, enero: 0, jan: 0, january: 0,
  feb: 1, febrero: 1, february: 1,
  mar: 2, marzo: 2, march: 2,
  abr: 3, abril: 3, apr: 3, april: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5, june: 5,
  jul: 6, julio: 6, july: 6,
  ago: 7, agosto: 7, aug: 7, august: 7,
  sep: 8, sept: 8, septiembre: 8, setiembre: 8, september: 8,
  oct: 9, octubre: 9, october: 9,
  nov: 10, noviembre: 10, november: 10,
  dic: 11, diciembre: 11, dec: 11, december: 11
}
const WEEKDAYS = [
  ['dom', 'domingo', 'sun', 'sunday'],
  ['lun', 'lunes', 'mon', 'monday'],
  ['mar', 'martes', 'tue', 'tuesday'],
  ['mie', 'miercoles', 'wed', 'wednesday'],
  ['jue', 'jueves', 'thu', 'thursday'],
  ['vie', 'viernes', 'fri', 'friday'],
  ['sab', 'sabado', 'sat', 'saturday']
]
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// "Fecha de entrega: mañana, 23:59", "jueves", "5 nov.", "2 nov. 2026", "05/11" → Date (el día de la entrega) o null
export function parseDue(text, now = new Date()) {
  const t = fold(text).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || /\bsin fecha|no due date\b/.test(t)) return null
  const today = startOfDay(now)
  const time = /\b(\d{1,2}):(\d{2})\b/.exec(t)
  const at = (d) => (time ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), +time[1], +time[2]) : d)
  if (/\b(hoy|today)\b/.test(t)) return at(today)
  if (/\b(manana|tomorrow)\b/.test(t)) return at(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  if (/\b(ayer|yesterday)\b/.test(t)) return at(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
  // "5 nov", "5 de noviembre de 2026", "nov 5"
  const dm = /\b(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{4}))?\b/.exec(t)
  const md = /\b([a-z]+) (\d{1,2})(?: (\d{4}))?\b/.exec(t)
  for (const [day, month, year] of [dm && [dm[1], dm[2], dm[3]], md && [md[2], md[1], md[3]]].filter(Boolean)) {
    if (!(month in MONTHS)) continue
    let d = new Date(year ? +year : today.getFullYear(), MONTHS[month], +day)
    // Sin año y hace más de dos meses: es del año que viene (en diciembre ya se ven entregas de febrero)
    if (!year && today - d > 60 * DAY) d = new Date(today.getFullYear() + 1, MONTHS[month], +day)
    return at(d)
  }
  // "05/11" o "05/11/2026" (día/mes, como en Argentina)
  const num = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t)
  if (num) {
    const year = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : today.getFullYear()
    return at(new Date(year, +num[2] - 1, +num[1]))
  }
  // "jueves": el próximo (o hoy)
  const words = t.split(' ')
  const wd = WEEKDAYS.findIndex((names) => names.some((n) => words.includes(n)))
  if (wd >= 0) return at(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((wd - today.getDay() + 7) % 7)))
  return null
}

const DUE_HINT = /\b(vence|venc|fecha de entrega|entrega|due|hoy|manana|ayer|today|tomorrow|lunes|martes|miercoles|jueves|viernes|sabado|domingo|\d{1,2}:\d{2}|\d{1,2} (de )?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)|\d{1,2}\/\d{1,2})/
const NOISE = /^(asignad[oa]s?|tarea|pregunta|material|pendientes?|publicad[oa].*|\d+ puntos?|sin calificar|entregad[oa]|faltante|vencid[oa]|ver (mas|todo)|ver tarea)$/

// Lo que leyó la extensión ({ items: [{ link, lineas, seccion }] }) → tareas con su materia y su fecha
export function parseTodo(raw, now = new Date()) {
  const tasks = []
  const seen = new Set()
  for (const item of raw?.items ?? []) {
    const lines = (item.lineas ?? []).map((l) => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (!lines.length) continue
    const dueLine = lines.find((l) => DUE_HINT.test(fold(l)) && parseDue(l, now)) ?? null
    const sinFecha = lines.some((l) => /sin fecha/.test(fold(l))) || /sin fecha/.test(fold(item.seccion))
    const rest = lines.filter((l) => l !== dueLine && !NOISE.test(fold(l)) && !/sin fecha/.test(fold(l)))
    const titulo = rest[0]
    if (!titulo) continue
    const materia = rest.find((l) => l !== titulo) ?? null
    const due = dueLine ? parseDue(dueLine, now) : null
    const id = item.link || `${titulo}|${materia}`
    if (seen.has(id)) continue
    seen.add(id)
    tasks.push({ id, titulo: titulo.slice(0, 120), materia: materia?.slice(0, 80) ?? null, cuando: due && !sinFecha ? due.toISOString() : null, link: item.link ?? null })
  }
  return tasks
}

export function createClassroom({ browser, file, getConfig = () => ({}), log = () => {}, now = () => new Date(), onChange = () => {} }) {
  let saved = load() // { tareas, leido, error }
  let state = saved.tareas.length ? 'ok' : 'sin-leer'
  let error = null
  let lastTry = 0
  let reading = null
  let timer = null
  const sent = new Set()
  let started = false

  function load() {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'))
      return { tareas: Array.isArray(data.tareas) ? data.tareas : [], leido: data.leido ?? null }
    } catch {
      return { tareas: [], leido: null }
    }
  }

  // Lee los Pendientes con la extensión. force: aunque lo haya leído hace poco (igual espera 5 minutos)
  async function refresh({ force = false } = {}) {
    if (reading) return reading
    const t = now().getTime()
    if (!force && saved.leido && t - saved.leido < EVERY_MS - MIN) return status()
    if (t - lastTry < MIN_GAP_MS) return status()
    if (!browser?.connected()) {
      state = 'sin-extension'
      return status()
    }
    lastTry = t
    state = 'leyendo'
    reading = (async () => {
      try {
        const raw = await browser.request('classroom', {}, 2 * 60 * 1000)
        const tareas = parseTodo(raw, now())
        saved = { tareas, leido: now().getTime() }
        writeFileSync(file, JSON.stringify({ version: 1, ...saved, crudo: raw?.items?.slice(0, 60) ?? [] }, null, 2))
        state = 'ok'
        error = null
        log(`classroom: leí ${tareas.length} ${tareas.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}`)
      } catch (err) {
        state = /desconocido/i.test(err.message) ? 'extension-vieja' : 'error'
        error = err.message
        log(`classroom: ${err.message}`)
      } finally {
        reading = null
        startAlerts()
        onChange()
      }
      return status()
    })()
    return reading
  }

  // De lo que ya pasó mientras Pixie estaba cerrada no avisa
  function startAlerts() {
    if (started) return
    started = true
    for (const a of alerts()) if (a.at <= now()) sent.add(`${a.evento.id}:${a.clave}`)
  }

  function events(from, to) {
    return saved.tareas
      .filter((x) => x.cuando && new Date(x.cuando) >= from && new Date(x.cuando) <= to)
      .map((x) => ({
        id: `classroom:${x.id}`,
        texto: x.materia ? `${x.titulo} (${x.materia})` : x.titulo,
        cuando: startOfDay(new Date(x.cuando)).toISOString(),
        conHora: false,
        calendario: 'Classroom',
        entrega: true
      }))
  }

  // Como las entregas de todo el día: la noche anterior a las 20 y ese día a las 8
  function alerts() {
    if (getConfig().classroomAvisos === false) return []
    const t = now().getTime()
    const out = []
    for (const e of events(new Date(t - DAY), new Date(t + 2 * DAY))) {
      for (const a of alertsFor(e.cuando, false)) out.push({ evento: e, clave: a.clave, at: new Date(a.at) })
    }
    return out
  }

  function status() {
    const t = now().getTime()
    const proximas = saved.tareas.filter((x) => x.cuando && new Date(x.cuando) >= startOfDay(new Date(t))).length
    return {
      estado: state,
      conectada: Boolean(browser?.connected()),
      tareas: saved.tareas.length,
      conFecha: proximas,
      leido: saved.leido,
      error,
      avisos: getConfig().classroomAvisos !== false
    }
  }

  return {
    start() {
      setTimeout(() => refresh(), 60 * 1000)
      timer = setInterval(() => refresh(), 10 * MIN)
    },
    stop: () => clearInterval(timer),
    refresh,
    status,
    eventsBetween: events,
    tasks: () => saved.tareas,
    dueAlerts(at = now()) {
      if (!started) return []
      const due = []
      for (const a of alerts()) {
        const key = `${a.evento.id}:${a.clave}`
        if (sent.has(key) || a.at > at) continue
        sent.add(key)
        if (at - a.at < 6 * 60 * MIN) due.push({ evento: a.evento, clave: a.clave })
      }
      return due
    }
  }
}
