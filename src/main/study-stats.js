// Las cuentas del seguimiento de estudio (sin tocar el disco): los días, la racha, la adherencia, el
// temario, lo que dice Pixie al terminar y la vista de Ajustes → Mi estudio. Lo usa study-log.js
// (que guarda estudio.json) y la vista previa de Ajustes en el navegador.
import { minutesText } from './study.js'

const MAX_TOPICS = 60
const MIN_DAY_MINUTES = 15 // un día cuenta para la racha con 15 minutos o un ciclo
export const DEFAULT_GOAL = 60 // meta diaria (minutos)

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const pad = (n) => String(n).padStart(2, '0')
// «química» y «Química» son la misma materia: se agrupan sin mayúsculas ni tildes y se muestran con mayúscula
export const subjectName = (s) => {
  const t = String(s ?? '').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null
}
// De las formas en que la escribiste, la más linda: con tildes y sin todo en mayúsculas
const nameScore = (n) => (/[^\x00-\x7f]/.test(n) ? 2 : 0) + (n !== n.toUpperCase() ? 1 : 0)
function subjectNames(list) {
  const names = new Map()
  for (const s of list) {
    if (!s.materia) continue
    const k = fold(s.materia)
    const n = subjectName(s.materia)
    if (!names.has(k) || nameScore(n) > nameScore(names.get(k))) names.set(k, n)
  }
  return names
}
// La fecha del día en la hora de la compu: "2026-11-02"
export const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
// "1 h 40" para leer en pantalla (para decirlo en voz alta se usa minutesText)
export function shortMinutes(min) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`
}
const listText = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`)

// ── Los días ──

// Cuánto estudiaste un día: { minutos, ciclos, sesiones, foco, planeado }
export function daySummary(sessions, date) {
  const key = dayKey(date)
  const list = sessions.filter((s) => dayKey(s.inicio) === key)
  const sum = (k) => list.reduce((t, s) => t + (s[k] ?? 0), 0)
  return { minutos: sum('estudiadoMin'), ciclos: sum('ciclos'), sesiones: list.length, foco: sum('focoMin'), planeado: sum('planeadoMin'), temas: [...new Set(list.flatMap((s) => s.temas ?? []))] }
}
const counts = (d) => d.minutos >= MIN_DAY_MINUTES || d.ciclos >= 1

// Días seguidos estudiando hasta hoy (si hoy todavía no estudiaste, cuenta hasta ayer)
export function streakDays(sessions, now = new Date(), materia = null) {
  const list = materia ? sessions.filter((s) => fold(s.materia) === fold(materia)) : sessions
  let day = new Date(now)
  if (!counts(daySummary(list, day))) day = addDays(day, -1)
  let n = 0
  while (counts(daySummary(list, day)) && n < 3650) {
    n++
    day = addDays(day, -1)
  }
  return n
}

// La adherencia de varias sesiones juntas: lo que estudiaste con foco sobre lo que planeaste
export function adherenceOf(sessions) {
  const planned = sessions.reduce((t, s) => t + (s.planeadoMin ?? 0), 0)
  const focus = sessions.reduce((t, s) => t + (s.focoMin ?? 0), 0)
  return planned ? Math.min(100, Math.round((focus / planned) * 100)) : null
}

// Cómo te fue en el día, como en un habit tracker
export function dayStatus(min, goal = DEFAULT_GOAL) {
  if (min >= goal * 1.5) return { emoji: '🔥', texto: '¡Imparable!' }
  if (min >= goal) return { emoji: '👍', texto: 'Bien hecho' }
  if (min > 0) return { emoji: '💪', texto: 'Dale que podés' }
  return null
}

// ── El temario ──

// Del texto que soltaste (una lista, un .txt): un tema por renglón, sin viñetas ni números.
// Los renglones muy largos no son temas (es el contenido): se saltean.
export function parseSyllabus(text) {
  const seen = new Set()
  const out = []
  for (const raw of String(text ?? '').split(/\r?\n|;|•/)) {
    const line = raw
      .replace(/^\s*(?:[-*–·>]+|\d+[.)-]|[a-z][.)]|unidad \d+\s*[:.-]?|tema \d+\s*[:.-]?)\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.:]$/, '')
    if (line.length < 2 || line.length > 90) continue
    const key = fold(line)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= MAX_TOPICS) break
  }
  return out
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'por', 'para', 'con', 'una', 'uno', 'un', 'que', 'sus', 'su', 'al', 'a', 'o', 'u', 'the', 'and', 'of', 'tipos', 'tipo', 'concepto', 'introduccion'])
const words = (t) => fold(t).replace(/[^a-z0-9ñ ]+/g, ' ').split(' ').filter(Boolean)
// ¿Ese tema aparece en lo que tuviste abierto? («Respiración celular» ↔ «Respiración celular - Wikipedia»)
export function topicSeen(topic, titles) {
  const keys = words(topic).filter((w) => !STOP.has(w) && (w.length >= 4 || /\d/.test(w)))
  const tokens = keys.length ? keys : words(topic).filter((w) => !STOP.has(w))
  if (!tokens.length) return false
  const need = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.67)
  return titles.some((title) => {
    const ws = words(title)
    // La misma palabra o su plural: «ecuación» y «ecuaciones», «raíz» y «raíces» (pero «célula» no es «celular»)
    const same = (w, tk) => w === tk || w === `${tk}s` || w === `${tk}es` || tk === `${w}s` || tk === `${w}es` || (tk.endsWith('z') && w === `${tk.slice(0, -1)}ces`) || (w.endsWith('z') && tk === `${w.slice(0, -1)}ces`)
    const hits = tokens.filter((tk) => ws.some((w) => same(w, tk))).length
    return hits >= need
  })
}

// ── Lo que dice Pixie ──

// El resumen al terminar: «Hoy hiciste 4 ciclos: 1 hora y 40 minutos de estudio. Llevás 3 días seguidos…»
export function endSummaryText({ sesion, hoy, racha, temario = null }) {
  const parts = [sesion.completo ? '¡Terminaste el Pomodoro!' : '¡Listo por hoy!']
  if (hoy.ciclos >= 1) parts.push(`Hoy hiciste ${hoy.ciclos === 1 ? '1 ciclo' : `${hoy.ciclos} ciclos`}: ${minutesText(hoy.minutos)} de estudio.`)
  else if (hoy.minutos >= 1) parts.push(`Hoy estudiaste ${minutesText(hoy.minutos)}.`)
  if (racha >= 2) parts.push(`Llevás ${racha} días seguidos estudiando. ¡No cortes la racha!`)
  else if (racha === 1 && hoy.minutos >= MIN_DAY_MINUTES) parts.push('Arrancaste una racha: mañana sumá otro día.')
  if (sesion.planeadoMin && sesion.estudiadoMin >= 1) {
    const why = sesion.adherencia < 70 ? ` (de ${minutesText(sesion.planeadoMin)} que planeaste, estudiaste ${minutesText(sesion.focoMin)} con foco)` : ''
    parts.push(`Adherencia: ${sesion.adherencia}%${why}.`)
  }
  if (sesion.temas?.length) parts.push(`Vimos: ${listText(sesion.temas.slice(0, 4))}.`)
  if (temario?.temas?.length) {
    const seen = temario.temas.filter((t) => t.visto).length
    const missing = temario.temas.filter((t) => !t.visto).map((t) => t.texto)
    const of = temario.materia ? ` de ${temario.materia}` : ''
    if (!missing.length) parts.push(`¡Ya viste todo el temario${of}!`)
    else {
      const named = missing.length > 3 ? `${missing.slice(0, 3).join(', ')} y ${missing.length - 3} más` : listText(missing)
      parts.push(`Del temario${of} llevás ${seen} de ${temario.temas.length} temas; te ${missing.length === 1 ? 'falta' : 'faltan'} ${named}.`)
    }
  }
  return parts.join(' ')
}

// «¿Cuánto estudié hoy / esta semana / este mes?»
export function statsText(sessions, periodo = 'hoy', now = new Date()) {
  const racha = streakDays(sessions, now)
  const streak = racha >= 2 ? ` Llevás ${racha} días seguidos.` : ''
  if (periodo === 'racha') return racha ? `Llevás ${racha === 1 ? '1 día' : `${racha} días seguidos`} estudiando.` : 'Todavía no tenés una racha: hacé un Pomodoro hoy y arrancamos.'
  if (periodo === 'hoy') {
    const d = daySummary(sessions, now)
    if (!d.minutos) return `Hoy todavía no estudiaste con un Pomodoro.${streak}`
    return `Hoy estudiaste ${minutesText(d.minutos)}${d.ciclos ? ` en ${d.ciclos === 1 ? '1 ciclo' : `${d.ciclos} ciclos`}` : ''}.${streak}`
  }
  const from = periodo === 'semana' ? addDays(now, -((new Date(now).getDay() + 6) % 7)) : new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1)
  const list = sessions.filter((s) => dayKey(s.inicio) >= dayKey(from) && dayKey(s.inicio) <= dayKey(now))
  const total = list.reduce((t, s) => t + (s.estudiadoMin ?? 0), 0)
  const what = periodo === 'semana' ? 'Esta semana' : 'Este mes'
  if (!total) return `${what} todavía no estudiaste con un Pomodoro.`
  const days = new Set(list.map((s) => dayKey(s.inicio))).size
  const bySubject = {}
  const pretty = subjectNames(list)
  for (const s of list) {
    if (!s.materia) continue
    const k = fold(s.materia)
    bySubject[k] ??= [pretty.get(k), 0]
    bySubject[k][1] += s.estudiadoMin
  }
  const top = Object.values(bySubject).sort((a, b) => b[1] - a[1])[0]
  const adh = adherenceOf(list)
  return `${what} estudiaste ${minutesText(total)} en ${days === 1 ? '1 día' : `${days} días`}${top ? `; lo que más, ${top[0]} (${minutesText(top[1])})` : ''}.${adh !== null ? ` Adherencia: ${adh}%.` : ''}${streak}`
}

// ── La vista de Ajustes → Mi estudio (como un habit tracker) ──

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const GENERAL = 'Sin materia'

function monthView(sessions, year, month, today) {
  const days = new Date(year, month + 1, 0).getDate()
  const prefix = `${year}-${pad(month + 1)}-`
  const list = sessions.filter((s) => dayKey(s.inicio).startsWith(prefix))
  const rows = {}
  const total = {}
  const pretty = subjectNames(list)
  for (const s of list) {
    const d = Number(dayKey(s.inicio).slice(8))
    const key = fold(s.materia) || GENERAL
    rows[key] ??= { materia: pretty.get(key) || GENERAL, dias: {}, total: 0 }
    rows[key].dias[d] = (rows[key].dias[d] ?? 0) + s.estudiadoMin
    rows[key].total += s.estudiadoMin
    total[d] = (total[d] ?? 0) + s.estudiadoMin
  }
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month
  return {
    titulo: `${MONTHS[month]} ${year}`,
    dias: days,
    hoy: isThisMonth ? today.getDate() : null,
    filas: Object.values(rows).sort((a, b) => b.total - a.total),
    total,
    minutos: list.reduce((t, s) => t + s.estudiadoMin, 0),
    diasEstudiados: Object.values(total).filter((m) => m >= MIN_DAY_MINUTES).length
  }
}

export function trackerView(sessions, { now = new Date(), goal = DEFAULT_GOAL, temario = null } = {}) {
  const today = new Date(now)
  const todayKey = dayKey(today)
  // La semana de lunes a domingo
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const semana = [...Array(7).keys()].map((i) => {
    const d = addDays(monday, i)
    const key = dayKey(d)
    const s = daySummary(sessions, d)
    const list = sessions.filter((x) => dayKey(x.inicio) === key)
    return {
      fecha: key,
      dia: `${WEEKDAYS[d.getDay()]} ${d.getDate()}`,
      hoy: key === todayKey,
      futuro: key > todayKey,
      minutos: s.minutos,
      ciclos: s.ciclos,
      progreso: Math.min(1, s.minutos / goal),
      adherencia: adherenceOf(list),
      estado: key > todayKey ? null : dayStatus(s.minutos, goal),
      temas: s.temas.slice(0, 4),
      materias: [...subjectNames(list).values()]
    }
  })
  const weekList = sessions.filter((s) => dayKey(s.inicio) >= dayKey(monday) && dayKey(s.inicio) <= todayKey)
  const recent = sessions.filter((s) => dayKey(s.inicio) >= dayKey(addDays(today, -13)))
  // Cada materia: cuánto esta semana y su racha
  const names = [...subjectNames(sessions.filter((s) => dayKey(s.inicio) >= dayKey(addDays(today, -30)))).values()]
  const materias = names
    .map((name) => {
      const mine = weekList.filter((s) => fold(s.materia) === fold(name))
      const last = sessions.filter((s) => fold(s.materia) === fold(name)).map((s) => s.inicio).sort().at(-1)
      return { materia: name, racha: streakDays(sessions, today, name), semanaMin: mine.reduce((t, s) => t + s.estudiadoMin, 0), ultima: last ? dayKey(last) : null }
    })
    .sort((a, b) => b.semanaMin - a.semanaMin || (b.ultima ?? '').localeCompare(a.ultima ?? ''))
  const hoy = daySummary(sessions, today)
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return {
    meta: goal,
    resumen: {
      racha: streakDays(sessions, today),
      hoyMin: hoy.minutos,
      hoyCiclos: hoy.ciclos,
      semanaMin: weekList.reduce((t, s) => t + s.estudiadoMin, 0),
      adherencia: adherenceOf(recent),
      sesiones: sessions.length
    },
    semana,
    mes: monthView(sessions, today.getFullYear(), today.getMonth(), today),
    mesAnterior: monthView(sessions, prev.getFullYear(), prev.getMonth(), today),
    materias,
    temario
  }
}
