// Fechas y horas en español ("mañana a las 6 de la tarde", "el martes",
// "el 15 de octubre", "en 3 días"). Trabaja sobre texto ya normalizado
// (minúsculas y sin tildes).

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const HOUR_WORDS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 }
const COUNT_WORDS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, diez: 10, quince: 15 }

const HOUR = `(\\d{1,2}|${Object.keys(HOUR_WORDS).join('|')})`
const COUNT = `(\\d{1,2}|${Object.keys(COUNT_WORDS).join('|')})`

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const toNum = (w, words) => (w in words ? words[w] : parseInt(w, 10))

// Busca el día. Devuelve { date, start, end } o null.
function findDay(t, now) {
  const today = startOfDay(now)
  const tries = [
    [/\bpasado manana\b/, () => addDays(today, 2)],
    [/(?<!\bla |\besta |\bpor la |\bde la )\bmanana\b/, () => addDays(today, 1)],
    [/\bhoy\b|\besta (?:tarde|noche)\b/, () => today],
    [/\b(?:la semana que viene|la proxima semana)\b/, () => addDays(today, 7)],
    [new RegExp(`\\b(?:en|dentro de) ${COUNT} (dias?|semanas?)\\b`), (m) => addDays(today, toNum(m[1], COUNT_WORDS) * (m[2].startsWith('semana') ? 7 : 1))],
    [/\b(?:el )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => fullDate(today, +m[1], +m[2] - 1, m[3])],
    [new RegExp(`\\b(?:el )?(\\d{1,2}) de (${MONTHS.join('|')}|setiembre)\\b`), (m) => fullDate(today, +m[1], m[2] === 'setiembre' ? 8 : MONTHS.indexOf(m[2]))],
    [/\bel (\d{1,2})\b(?! ?(?:minutos?|min|horas?|segundos?|%|por|y|de la))/, (m) => dayOfMonth(today, +m[1])],
    [new RegExp(`\\b(?:(este|esta|el proximo|el|la proxima)\\s+)?(${WEEKDAYS.join('|')})(\\s+que viene|\\s+proximo)?\\b`), (m) => nextWeekday(today, WEEKDAYS.indexOf(m[2]), m[1] === 'este' || m[1] === 'esta')]
  ]
  for (const [re, make] of tries) {
    const m = re.exec(t)
    if (m) {
      const date = make(m)
      if (date && !isNaN(date)) return { date, start: m.index, end: m.index + m[0].length }
    }
  }
  return null
}

function fullDate(today, day, month, year) {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  let y = year ? +year : today.getFullYear()
  if (y < 100) y += 2000
  let d = new Date(y, month, day)
  if (!year && d < today) d = new Date(y + 1, month, day)
  return d.getDate() === day ? d : null
}

function dayOfMonth(today, day) {
  if (day < 1 || day > 31) return null
  let d = new Date(today.getFullYear(), today.getMonth(), day)
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day)
  return d.getDate() === day ? d : null
}

function nextWeekday(today, weekday, allowToday) {
  let diff = (weekday - today.getDay() + 7) % 7
  if (diff === 0 && !allowToday) diff = 7
  return addDays(today, diff)
}

// Busca la hora. Devuelve { h, m, start, end } o null.
function findTime(t) {
  const clock = new RegExp(
    `\\ba (?:las|la) ${HOUR}(?:[:.](\\d{2})| y (media|cuarto))?(?: ?(?:hs|horas|h))?(?: de la (manana|tarde|noche)| (am|pm))?\\b`
  )
  const m = clock.exec(t)
  if (m) {
    let h = toNum(m[1], HOUR_WORDS)
    const min = m[2] ? +m[2] : m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : 0
    const part = m[4] || m[5]
    if ((part === 'tarde' || part === 'noche' || part === 'pm') && h < 12) h += 12
    else if ((part === 'manana' || part === 'am') && h === 12) h = 0
    else if (!part && h >= 1 && h <= 7) h += 12 // "a las 6" suele ser a la tarde
    if (h > 23 || min > 59) return null
    return { h, m: min, start: m.index, end: m.index + m[0].length }
  }
  const parts = [
    [/\bal mediodia\b/, 12, 0],
    [/\b(?:a la|esta|por la) manana\b/, 9, 0],
    [/\b(?:a la|esta|por la) tarde\b/, 17, 0],
    [/\b(?:a la|esta|por la) noche\b/, 21, 0]
  ]
  for (const [re, h, min] of parts) {
    const p = re.exec(t)
    if (p) return { h, m: min, start: p.index, end: p.index + p[0].length }
  }
  return null
}

// Devuelve { date, hasTime, spans } o null. spans marca qué partes del texto eran la fecha.
export function parseWhen(t, now = new Date()) {
  const day = findDay(t, now)
  const time = findTime(t)
  if (!day && !time) return null
  let date = day ? new Date(day.date) : startOfDay(now)
  if (time) {
    date.setHours(time.h, time.m, 0, 0)
    if (!day && date <= now) date = addDays(date, 1)
  }
  const spans = [day, time].filter(Boolean).map((x) => [x.start, x.end])
  return { date, hasTime: Boolean(time), spans }
}

// Saca del texto las partes que eran fecha u hora.
export function withoutSpans(t, spans) {
  let out = t
  for (const [s, e] of [...spans].sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + ' ' + out.slice(e)
  return out.replace(/\s+/g, ' ').trim()
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "hoy a las 18:00", "mañana", "el martes 7 de octubre a las 9:30"
export function describeWhen(date, hasTime, now = new Date()) {
  const d = new Date(date)
  const today = startOfDay(now)
  const diff = Math.round((startOfDay(d) - today) / 86400000)
  let day
  if (diff === 0) day = 'hoy'
  else if (diff === 1) day = 'mañana'
  else if (diff === 2) day = 'pasado mañana'
  else if (diff > 0 && diff < 7) day = `el ${d.toLocaleDateString('es-AR', { weekday: 'long' })}`
  else day = `el ${d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (!hasTime) return day
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${day} a las ${time}`
}

export { startOfDay, addDays }
