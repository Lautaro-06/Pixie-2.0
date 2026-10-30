// Calendarios de afuera (Google Calendar, las materias de Classroom, Outlook): Pixie los lee con la
// «dirección secreta en formato iCal», que es gratis y no pide iniciar sesión. Los eventos se suman a
// su agenda (para «¿qué tengo hoy?», el resumen del día y los recordatorios).
// Las direcciones son secretas (quien las tiene ve tu calendario): se guardan cifradas en
// calendarios.json, en esta compu, y no van al respaldo.
import { readFileSync, writeFileSync } from 'node:fs'
import { alertsFor } from './memory.js'

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const REFRESH_MS = 15 * MIN
const MAX_OCCURRENCES = 2000

// ───────────── Leer el formato iCal ─────────────

const unescapeText = (s) =>
  s
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

// Cada renglón: NOMBRE;PARAM=valor:VALOR (los renglones largos siguen en el siguiente, empezando con un espacio)
function* properties(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  for (const line of lines) {
    let quoted = false
    let colon = -1
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted
      else if (line[i] === ':' && !quoted) {
        colon = i
        break
      }
    }
    if (colon < 0) continue
    const [name, ...rawParams] = line.slice(0, colon).split(';')
    const params = {}
    for (const p of rawParams) {
      const eq = p.indexOf('=')
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
    }
    yield { name: name.toUpperCase(), params, value: line.slice(colon + 1) }
  }
}

// Diferencia en ms entre la hora de una zona y UTC en ese momento (para TZID=America/Argentina/Buenos_Aires)
function zoneOffset(timeZone, utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(utcMs))
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utcMs
}

// Una hora "de reloj" (año, mes, día, hora…) en una zona → el momento exacto
export function wallTime({ y, mo, d, h = 0, mi = 0, s = 0 }, { utc = false, timeZone = null } = {}) {
  if (utc) return new Date(Date.UTC(y, mo, d, h, mi, s))
  if (timeZone) {
    try {
      const guess = Date.UTC(y, mo, d, h, mi, s)
      let ms = guess - zoneOffset(timeZone, guess)
      ms = guess - zoneOffset(timeZone, ms)
      return new Date(ms)
    } catch {
      // zona que no conoce (por ejemplo las de Outlook): se toma como hora de la compu
    }
  }
  return new Date(y, mo, d, h, mi, s)
}

// DTSTART;TZID=…:20261030T143000 → { wall, allDay, utc, timeZone }
function parseWhen(prop) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(prop.value.trim())
  if (!m) return null
  const wall = { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) }
  const allDay = prop.params.VALUE === 'DATE' || !m[4]
  return { wall, allDay, utc: Boolean(m[7]), timeZone: prop.params.TZID ?? null }
}

const toDate = (when) => (when.allDay ? new Date(when.wall.y, when.wall.mo, when.wall.d) : wallTime(when.wall, when))

const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function parseRule(value) {
  const r = {}
  for (const part of value.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) r[k.toUpperCase()] = v
  }
  return r
}

// Suma días/meses a una hora de reloj sin moverle la hora (aunque cambie el horario de verano)
function shiftWall(wall, { days = 0, months = 0 }) {
  const base = new Date(Date.UTC(wall.y, wall.mo + months, wall.d + days))
  return { ...wall, y: base.getUTCFullYear(), mo: base.getUTCMonth(), d: base.getUTCDate() }
}

const weekday = (wall) => new Date(Date.UTC(wall.y, wall.mo, wall.d)).getUTCDay()

// Todas las veces que pasa un evento que se repite, entre from y to.
// COUNT cuenta también las fechas salteadas (EXDATE), como dice el formato.
function occurrences(start, rule, from, to, skip) {
  const r = parseRule(rule)
  const interval = Math.max(1, Number(r.INTERVAL) || 1)
  const count = r.COUNT ? Number(r.COUNT) : Infinity
  const untilWhen = r.UNTIL ? parseWhen({ value: r.UNTIL, params: {} }) : null
  const until = untilWhen ? (untilWhen.allDay ? new Date(untilWhen.wall.y, untilWhen.wall.mo, untilWhen.wall.d, 23, 59, 59) : toDate(untilWhen)) : null
  const byDay = (r.BYDAY ?? '')
    .split(',')
    .map((d) => WEEKDAYS[d.trim().slice(-2)])
    .filter((d) => d !== undefined)
    .sort((a, b) => a - b)
  const first = toDate(start)
  const out = []
  let seen = 0
  // Devuelve false cuando ya no hay que seguir buscando
  const take = (wall) => {
    const at = toDate({ ...start, wall })
    if (at < first) return true
    if (until && at > until) return false
    seen++
    if (seen > count || at > to) return false
    if (at >= from && !skip.has(at.getTime())) out.push(at)
    return true
  }
  // Si no tiene un límite de veces, salta directo cerca de la ventana (un evento diario de hace años)
  let firstStep = 0
  if (count === Infinity && from > first) {
    const ago = from - first
    const steps = { DAILY: ago / (interval * DAY), WEEKLY: ago / (7 * interval * DAY), MONTHLY: ago / (30.5 * interval * DAY), YEARLY: ago / (366 * interval * DAY) }
    firstStep = Math.max(0, Math.floor(steps[r.FREQ] ?? 0) - 1)
  }
  for (let i = firstStep; i < firstStep + MAX_OCCURRENCES; i++) {
    let keep = true
    if (r.FREQ === 'DAILY') keep = take(shiftWall(start.wall, { days: i * interval }))
    else if (r.FREQ === 'WEEKLY') {
      const days = byDay.length ? byDay : [weekday(start.wall)]
      const weekStart = shiftWall(start.wall, { days: i * 7 * interval - weekday(start.wall) })
      for (const dow of days) {
        if (!take(shiftWall(weekStart, { days: dow }))) {
          keep = false
          break
        }
      }
    } else if (r.FREQ === 'MONTHLY') keep = take(shiftWall(start.wall, { months: i * interval }))
    else if (r.FREQ === 'YEARLY') keep = take(shiftWall(start.wall, { months: 12 * i * interval }))
    else {
      take(start.wall)
      keep = false
    }
    if (!keep) break
  }
  return out
}

// El texto de un .ics → { nombre, eventos: [{ id, texto, cuando, conHora, fin, lugar }] } entre from y to
export function parseICS(text, { from = new Date(Date.now() - DAY), to = new Date(Date.now() + 30 * DAY) } = {}) {
  let nombre = null
  const raw = []
  let cur = null
  for (const p of properties(text)) {
    if (p.name === 'X-WR-CALNAME' && !cur) nombre = unescapeText(p.value)
    else if (p.name === 'BEGIN' && p.value.trim().toUpperCase() === 'VEVENT') cur = { exdates: [] }
    else if (p.name === 'END' && p.value.trim().toUpperCase() === 'VEVENT') {
      if (cur) raw.push(cur)
      cur = null
    } else if (cur) {
      if (p.name === 'SUMMARY') cur.texto = unescapeText(p.value)
      else if (p.name === 'LOCATION') cur.lugar = unescapeText(p.value)
      else if (p.name === 'UID') cur.uid = p.value.trim()
      else if (p.name === 'DTSTART') cur.start = parseWhen(p)
      else if (p.name === 'DTEND') cur.end = parseWhen(p)
      else if (p.name === 'RRULE') cur.rrule = p.value
      else if (p.name === 'STATUS') cur.cancelado = /CANCELLED/i.test(p.value)
      else if (p.name === 'RECURRENCE-ID') cur.recurrenceId = parseWhen(p)
      else if (p.name === 'EXDATE') {
        for (const v of p.value.split(',')) {
          const w = parseWhen({ value: v, params: p.params })
          if (w) cur.exdates.push(toDate(w).getTime())
        }
      }
    }
  }
  // Las veces que se cambió una sola fecha de un evento que se repite reemplazan a la original
  const moved = new Map()
  for (const e of raw) {
    if (!e.recurrenceId || !e.uid) continue
    if (!moved.has(e.uid)) moved.set(e.uid, new Set())
    moved.get(e.uid).add(toDate(e.recurrenceId).getTime())
  }
  const eventos = []
  for (const e of raw) {
    if (!e.start || !e.texto || e.cancelado) continue
    const conHora = !e.start.allDay
    const length = e.end ? toDate(e.end) - toDate(e.start) : conHora ? 0 : DAY
    const starts = []
    if (e.rrule && !e.recurrenceId) {
      const skip = new Set([...e.exdates, ...(moved.get(e.uid) ?? [])])
      starts.push(...occurrences(e.start, e.rrule, from, to, skip))
    } else {
      const at = toDate(e.start)
      if (at >= from && at <= to) starts.push(at)
    }
    for (const at of starts) {
      eventos.push({
        id: `${e.uid ?? e.texto}@${at.getTime()}`,
        texto: e.texto,
        cuando: at.toISOString(),
        conHora,
        fin: length > 0 ? new Date(at.getTime() + length).toISOString() : null,
        ...(e.lugar ? { lugar: e.lugar } : {})
      })
    }
  }
  eventos.sort((a, b) => new Date(a.cuando) - new Date(b.cuando))
  return { nombre, eventos }
}

// ¿Hay una dirección de calendario en este texto? (la de Google termina en .ics; webcal:// se lee por https)
const ICAL_URL = /(?:https?|webcal):\/\/[^\s"'<>]+?\.ics(?:\?[^\s"'<>]*)?(?=$|[\s"'<>])/i
export function findCalendarUrl(text) {
  const m = ICAL_URL.exec(String(text ?? ''))
  return m ? m[0].replace(/^webcal:/i, 'https:') : null
}

// ───────────── Los calendarios guardados ─────────────

export function createCalendars({ file, cipher = null, fetchImpl = (...a) => fetch(...a), log = () => {}, now = () => new Date(), onChange = () => {} }) {
  let list = load() // [{ id, nombre, url, avisos }]
  const cache = new Map() // id → { eventos, at, error }
  const sent = new Set() // avisos ya dados (id del evento + cuál)
  let started = false
  let timer = null

  function load() {
    let data
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      return []
    }
    return (data.calendarios ?? [])
      .map((c) => {
        try {
          const url = c.urlCifrada ? cipher.decrypt(c.urlCifrada) : c.url
          return url ? { id: c.id, nombre: c.nombre, url, avisos: c.avisos !== false } : null
        } catch {
          log(`calendario «${c.nombre}»: no pude abrir la dirección (¿se guardó en otra compu?)`)
          return null
        }
      })
      .filter(Boolean)
  }

  function save() {
    const calendarios = list.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      avisos: c.avisos,
      ...(cipher?.available() ? { urlCifrada: cipher.encrypt(c.url) } : { url: c.url })
    }))
    writeFileSync(file, JSON.stringify({ version: 1, calendarios }, null, 2))
  }

  async function read(url) {
    let res
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Pixie' } })
    } catch {
      throw new Error('No me pude conectar. ¿Hay internet?')
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new Error('Esa dirección no anda: puede que la hayan cambiado o que sea privada.')
    if (!res.ok) throw new Error(`El calendario no respondió (error ${res.status}).`)
    const text = await res.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Eso no es un calendario. Copiá la «dirección secreta en formato iCal».')
    const t = now().getTime()
    return parseICS(text, { from: new Date(t - DAY), to: new Date(t + 60 * DAY) })
  }

  async function refreshOne(c) {
    try {
      const { eventos } = await read(c.url)
      cache.set(c.id, { eventos, at: now().getTime(), error: null })
    } catch (err) {
      const old = cache.get(c.id)
      cache.set(c.id, { eventos: old?.eventos ?? [], at: old?.at ?? null, error: err.message })
      log(`calendario «${c.nombre}»: ${err.message}`)
    }
  }

  function events(from, to) {
    const out = []
    for (const c of list) {
      for (const e of cache.get(c.id)?.eventos ?? []) {
        const at = new Date(e.cuando)
        if (at >= from && at <= to) out.push({ ...e, calendario: c.nombre, avisos: c.avisos })
      }
    }
    return out.sort((a, b) => new Date(a.cuando) - new Date(b.cuando))
  }

  // Con hora: 15 minutos antes. De todo el día (como las entregas de Classroom): la noche anterior y ese día a la mañana.
  function allAlerts() {
    const t = now().getTime()
    const out = []
    for (const e of events(new Date(t - DAY), new Date(t + 2 * DAY))) {
      if (!e.avisos) continue
      for (const a of alertsFor(e.cuando, e.conHora)) {
        if (e.conHora && a.clave === 'hora') continue
        out.push({ evento: e, clave: a.clave, at: new Date(a.at) })
      }
    }
    return out
  }

  async function refresh() {
    await Promise.all(list.map(refreshOne))
    // La primera vez no avisa de lo que ya pasó mientras Pixie estaba cerrada
    if (!started) {
      started = true
      for (const a of allAlerts()) if (a.at <= now()) sent.add(`${a.evento.id}:${a.clave}`)
    }
    onChange()
  }

  return {
    start() {
      refresh()
      timer = setInterval(refresh, REFRESH_MS)
    },
    stop: () => clearInterval(timer),
    refresh,
    eventsBetween: events,
    // Los avisos que ya tocan (los que pasaron hace más de 6 horas se descartan sin avisar)
    dueAlerts(at = now()) {
      if (!started) return []
      const due = []
      for (const a of allAlerts()) {
        const key = `${a.evento.id}:${a.clave}`
        if (sent.has(key) || a.at > at) continue
        sent.add(key)
        if (at - a.at < 6 * 60 * MIN) due.push({ evento: a.evento, clave: a.clave })
      }
      return due
    },
    // Para la ventana de Ajustes (sin las direcciones)
    status() {
      const t = now()
      const week = events(t, new Date(t.getTime() + 7 * DAY))
      return list.map((c) => {
        const cached = cache.get(c.id)
        return {
          id: c.id,
          nombre: c.nombre,
          avisos: c.avisos,
          proximos: week.filter((e) => e.calendario === c.nombre).length,
          actualizado: cached?.at ?? null,
          error: cached?.error ?? null
        }
      })
    },
    // Prueba la dirección y, si anda, la guarda. Devuelve { ok, mensaje }
    async add(url) {
      const clean = findCalendarUrl(url)
      if (!clean) return { ok: false, mensaje: 'Eso no parece la dirección de un calendario. Copiá la «dirección secreta en formato iCal» (termina en .ics).' }
      if (list.some((c) => c.url === clean)) return { ok: false, mensaje: 'Ese calendario ya lo tengo.' }
      let parsed
      try {
        parsed = await read(clean)
      } catch (err) {
        return { ok: false, mensaje: err.message }
      }
      const id = `cal${now().getTime().toString(36)}${list.length}`
      const name = (parsed.nombre || 'Calendario').slice(0, 60)
      list.push({ id, nombre: name, url: clean, avisos: true })
      cache.set(id, { eventos: parsed.eventos, at: now().getTime(), error: null })
      started = true
      save()
      onChange()
      const t = now().getTime()
      const week = parsed.eventos.filter((e) => new Date(e.cuando) >= new Date(t) && new Date(e.cuando) <= new Date(t + 7 * DAY)).length
      const cuantos = week === 0 ? 'no tiene nada en los próximos 7 días' : week === 1 ? 'tiene 1 cosa en los próximos 7 días' : `tiene ${week} cosas en los próximos 7 días`
      return { ok: true, mensaje: `¡Listo! Sumé «${name}»: ${cuantos}.` }
    },
    remove(id) {
      list = list.filter((c) => c.id !== id)
      cache.delete(id)
      save()
      onChange()
    },
    setAlerts(id, on) {
      const c = list.find((x) => x.id === id)
      if (!c) return
      c.avisos = Boolean(on)
      save()
      onChange()
    },
    count: () => list.length,
    has: (url) => list.some((c) => c.url === findCalendarUrl(url))
  }
}
