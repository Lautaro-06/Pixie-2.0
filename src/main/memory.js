// Memoria de Pixie: tu nombre, cosas que le contás, pendientes, agenda,
// cuánto usás la compu y su propio estado de ánimo. Se guarda en un JSON
// en la compu (nunca sale de ahí).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { dayKey } from './dates.js'

const EMPTY = () => ({
  nombre: null,
  datos: [], // { id, texto, creado }
  pendientes: [], // { id, texto, creado }
  agenda: [], // { id, texto, cuando, conHora, avisos: [{ clave, at }], enviados: [] }
  uso: {}, // { 'AAAA-MM-DD': { total, categorias: {}, apps: {} } }
  animo: { valor: 65, ultimoContacto: null },
  salud: {}, // { 'AAAA-MM-DD': { agua, pausas } } y ultimaAgua
  hechos: {} // cosas que Pixie ya hizo hoy: { resumen: 'AAAA-MM-DD', ... }
})

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'a', 'al', 'y', 'o', 'que', 'en', 'es', 'era',
  'mi', 'mis', 'me', 'te', 'tu', 'tus', 'se', 'lo', 'le', 'con', 'por', 'para', 'cual', 'cuales', 'cuando', 'como',
  'donde', 'tengo', 'tenia', 'hay', 'ya', 'hice', 'son', 'fue', 'esta', 'este', 'sobre'
])

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function words(text) {
  return fold(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => w.replace(/(es|s)$/, '')) // "cartuchos" ~ "cartucho"
}

// Puntaje de parecido entre una búsqueda y un texto guardado.
export function similarity(query, text) {
  const q = new Set(words(query))
  if (!q.size) return 0
  const t = new Set(words(text))
  let hits = 0
  for (const w of q) if (t.has(w) || [...t].some((x) => x.length > 4 && (x.startsWith(w) || w.startsWith(x)))) hits++
  return hits / q.size
}

function best(list, query, min = 0.34) {
  let top = null
  for (const item of list) {
    const score = similarity(query, item.texto)
    if (score >= min && (!top || score > top.score)) top = { item, score }
  }
  return top?.item ?? null
}

const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1
const MIN = 60 * 1000

// Cuándo avisar de un evento: con hora, 15 minutos antes y a la hora;
// sin hora, la noche anterior a las 20 y ese día a las 8.
export function alertsFor(cuando, conHora) {
  const at = new Date(cuando)
  if (conHora) {
    return [
      { clave: 'antes', at: new Date(at.getTime() - 15 * MIN).toISOString() },
      { clave: 'hora', at: at.toISOString() }
    ]
  }
  const eve = new Date(at)
  eve.setDate(eve.getDate() - 1)
  eve.setHours(20, 0, 0, 0)
  const morning = new Date(at)
  morning.setHours(8, 0, 0, 0)
  return [
    { clave: 'noche', at: eve.toISOString() },
    { clave: 'dia', at: morning.toISOString() }
  ]
}

// Cuándo preguntar "¿cómo te fue?": 2 horas después si tenía hora, a las 19 si era de todo el día.
// Después de 20 horas ya no se pregunta.
export function followUpAt(cuando, conHora) {
  const at = new Date(cuando)
  if (conHora) return new Date(at.getTime() + 2 * 60 * MIN)
  at.setHours(19, 0, 0, 0)
  return at
}
const FOLLOW_UP_WINDOW = 20 * 60 * MIN

export function createMemory(file) {
  let data = load()

  function load() {
    try {
      return { ...EMPTY(), ...JSON.parse(readFileSync(file, 'utf8')) }
    } catch {
      return EMPTY()
    }
  }

  function save() {
    try {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('No se pudo guardar la memoria', err)
    }
  }

  function healthDay(date) {
    const key = dayKey(date)
    data.salud[key] ??= { agua: 0, pausas: 0 }
    // Guarda solo las últimas dos semanas
    const days = Object.keys(data.salud).filter((k) => /^\d{4}-/.test(k)).sort()
    for (const k of days.slice(0, Math.max(0, days.length - 14))) delete data.salud[k]
    return data.salud[key]
  }

  return {
    get data() {
      return data
    },

    // Nombre
    getName: () => data.nombre,
    setName(nombre) {
      data.nombre = nombre
      save()
    },

    // Datos que le contás
    addFact(texto) {
      const item = { id: nextId(data.datos), texto, creado: new Date().toISOString() }
      data.datos.push(item)
      save()
      return item
    },
    listFacts: () => [...data.datos],
    findFact: (query) => best(data.datos, query),
    forget(query) {
      const item = best([...data.datos, ...data.pendientes, ...data.agenda], query)
      if (!item) return null
      data.datos = data.datos.filter((x) => x !== item)
      data.pendientes = data.pendientes.filter((x) => x !== item)
      data.agenda = data.agenda.filter((x) => x !== item)
      save()
      return item
    },
    forgetAll() {
      const keep = { uso: data.uso, animo: data.animo, salud: data.salud }
      data = { ...EMPTY(), ...keep }
      save()
    },

    // Pendientes
    addTodo(texto) {
      const item = { id: nextId(data.pendientes), texto, creado: new Date().toISOString() }
      data.pendientes.push(item)
      save()
      return item
    },
    listTodos: () => [...data.pendientes],
    completeTodo({ buscar, numero }) {
      const item = numero ? data.pendientes[numero - 1] : best(data.pendientes, buscar)
      if (!item) return null
      data.pendientes = data.pendientes.filter((x) => x !== item)
      save()
      return item
    },
    clearTodos() {
      const n = data.pendientes.length
      data.pendientes = []
      save()
      return n
    },

    // Agenda
    addEvent({ texto, cuando, conHora }) {
      const item = {
        id: nextId(data.agenda),
        texto,
        cuando: new Date(cuando).toISOString(),
        conHora,
        avisos: alertsFor(cuando, conHora),
        enviados: []
      }
      data.agenda.push(item)
      data.agenda.sort((a, b) => new Date(a.cuando) - new Date(b.cuando))
      save()
      return item
    },
    // Eventos entre dos fechas (incluidas), ordenados.
    eventsBetween(from, to) {
      return data.agenda.filter((e) => {
        const d = new Date(e.cuando)
        return d >= from && d <= to
      })
    },
    findEvent: (query) => best(data.agenda, query),
    removeEvent(query) {
      const item = best(data.agenda, query)
      if (!item) return null
      data.agenda = data.agenda.filter((x) => x !== item)
      save()
      return item
    },
    // Avisos que ya tocan. Los muy viejos (más de 6 h) se descartan sin avisar.
    dueAlerts(now = new Date()) {
      const due = []
      let changed = false
      for (const e of data.agenda) {
        for (const a of e.avisos) {
          if (e.enviados.includes(a.clave)) continue
          const at = new Date(a.at)
          if (at > now) continue
          e.enviados.push(a.clave)
          changed = true
          if (now - at < 6 * 60 * MIN) due.push({ evento: e, clave: a.clave })
        }
      }
      // Limpia eventos que pasaron hace más de 2 días
      const before = data.agenda.length
      data.agenda = data.agenda.filter((e) => now - new Date(e.cuando) < 2 * 24 * 60 * MIN)
      if (changed || data.agenda.length !== before) save()
      return due
    },

    // Eventos que ya pasaron y todavía no le preguntó cómo le fue
    followUpsDue(now = new Date()) {
      return data.agenda.filter((e) => {
        if (e.seguimiento) return false
        const at = followUpAt(e.cuando, e.conHora)
        return at <= now && now - at < FOLLOW_UP_WINDOW
      })
    },
    markFollowUp(id) {
      const e = data.agenda.find((x) => x.id === id)
      if (!e) return
      e.seguimiento = true
      save()
    },

    // Uso de la compu
    addUsage(date, categoria, app, seconds) {
      const key = dayKey(date)
      const day = (data.uso[key] ??= { total: 0, categorias: {}, apps: {} })
      day.total += seconds
      day.categorias[categoria] = (day.categorias[categoria] ?? 0) + seconds
      if (app) day.apps[app] = (day.apps[app] ?? 0) + seconds
      // Guarda solo las últimas dos semanas
      const keys = Object.keys(data.uso).sort()
      for (const k of keys.slice(0, Math.max(0, keys.length - 14))) delete data.uso[k]
    },
    getUsage: (date) => data.uso[dayKey(date)] ?? { total: 0, categorias: {}, apps: {} },

    // Salud: vasos de agua y pausas de cada día
    addWater(date = new Date(), vasos = 1) {
      const day = healthDay(date)
      day.agua += vasos
      data.salud.ultimaAgua = date.toISOString()
      save()
      return day
    },
    addBreak(date = new Date()) {
      const day = healthDay(date)
      day.pausas += 1
      save()
      return day
    },
    getHealth: (date = new Date()) => ({ agua: 0, pausas: 0, ...data.salud[dayKey(date)] }),
    lastWater: () => (data.salud.ultimaAgua ? new Date(data.salud.ultimaAgua) : null),

    // Estado de ánimo de Pixie
    getMood: () => ({ ...data.animo }),
    setMood(animo) {
      data.animo = { ...data.animo, ...animo }
    },

    // Cosas que ya hizo hoy (para no repetir avisos)
    doneToday: (what, date = new Date()) => data.hechos[what] === dayKey(date),
    markDone(what, date = new Date()) {
      data.hechos[what] = dayKey(date)
      save()
    },

    save
  }
}
