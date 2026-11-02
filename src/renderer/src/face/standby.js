// Lo que muestra la pantallita cuando Pixie está en reposo, con los mismos píxeles que la cara:
//   reloj   → la hora grande y la fecha
//   resumen → la carita en chiquito, la hora y el clima
import { WIDTH, HEIGHT } from './draw.js'

// Números de 5×7 (la hora)
const DIGITS = {
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....']
}

// Letras y números de 3×5 (la fecha)
const SMALL = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  Ñ: ['###', '...', '##.', '#.#', '#.#'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.']
}

// Íconos de 7×7 para el clima
const ICONS = {
  sol: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'],
  luna: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
  parcial: ['.#.....', '###.##.', '.#.####', '..#####', '.######', '.......', '.......'],
  nube: ['.......', '..##...', '.####..', '######.', '#######', '.......', '.......'],
  lluvia: ['..##...', '.####..', '######.', '.......', '.#.#.#.', '#.#.#..', '.......'],
  tormenta: ['..##...', '.####..', '######.', '...#...', '..#....', '...#...', '..#....'],
  nieve: ['#.#.#..', '.###...', '#####..', '.###...', '#.#.#..', '.......', '.......']
}
const DEGREE = ['.#.', '#.#', '.#.']

const DAYS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB']
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export const STANDBY_MODES = ['cara', 'reloj', 'resumen']

// color: el número de color de cada píxel (1 = el de la cara; los otros, de props.js)
function painter(bits, color = 1) {
  const dot = (x, y, c = color) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) bits[y * WIDTH + x] = c
  }
  const glyph = (rows, x0, y0, scale = 1) => {
    rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== '#') return
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) dot(x0 + x * scale + dx, y0 + y * scale + dy)
      })
    )
  }
  const withColor = (c, fn) => {
    const prev = color
    color = c
    fn()
    color = prev
  }
  return { dot, glyph, withColor }
}

// Ancho de un texto en letras de 3×5 (los espacios ocupan 2)
function smallWidth(text) {
  return [...text].reduce((w, c) => w + (c === ' ' ? 2 : 4), 0) - 1
}

function drawSmall(p, text, x0, y0) {
  let x = x0
  for (const c of text) {
    if (c === ' ') x += 2
    else {
      if (SMALL[c]) p.glyph(SMALL[c], x, y0)
      x += 4
    }
  }
}

// La hora en números de 5×7: "14:05". Devuelve el ancho que ocupó.
function drawTime(p, hh, mm, x0, y0, scale, colon) {
  let x = x0
  for (const d of hh) {
    p.glyph(DIGITS[d], x, y0, scale)
    x += 6 * scale
  }
  if (colon) {
    for (const row of [2, 4]) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) p.dot(x + dx, y0 + row * scale + dy)
  }
  x += 2 * scale
  for (const d of mm) {
    p.glyph(DIGITS[d], x, y0, scale)
    x += 6 * scale
  }
  return x - scale - x0
}

// La cara de 64×32 en 32×16: un píxel encendido si alguno de sus 4 lo estaba
function shrink(face) {
  const out = []
  for (let y = 0; y < HEIGHT / 2; y++) {
    for (let x = 0; x < WIDTH / 2; x++) {
      const i = 2 * y * WIDTH + 2 * x
      out.push(face[i] || face[i + 1] || face[i + WIDTH] || face[i + WIDTH + 1] ? 1 : 0)
    }
  }
  return out
}

// mode: 'reloj' | 'resumen'; weather: { temp, icon } o null
export function renderStandby(mode, face, date = new Date(), weather = null) {
  const bits = new Uint8Array(WIDTH * HEIGHT)
  const p = painter(bits)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const colon = date.getSeconds() % 2 === 0

  if (mode === 'reloj') {
    drawTime(p, hh, mm, 7, 2, 2, colon)
    const text = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
    drawSmall(p, text, Math.floor((WIDTH - smallWidth(text)) / 2), 24)
    return bits
  }

  // Resumen: la carita a la izquierda, la hora y el clima a la derecha
  const small = shrink(face)
  for (let y = 0; y < HEIGHT / 2; y++) for (let x = 0; x < WIDTH / 2; x++) if (small[y * (WIDTH / 2) + x]) p.dot(x, y + 9)
  drawTime(p, hh, mm, 35, 4, 1, colon)
  if (weather && Number.isFinite(weather.temp)) {
    p.glyph(ICONS[weather.icon] ?? ICONS.nube, 35, 17)
    let x = 44
    for (const d of String(Math.round(weather.temp))) {
      p.glyph(DIGITS[d] ?? DIGITS['-'], x, 17)
      x += 6
    }
    p.glyph(DEGREE, x, 17)
  } else {
    drawSmall(p, `${DAYS[date.getDay()]} ${date.getDate()}`, 35, 18)
  }
  return bits
}

// ── El temporizador en la pantallita (Pomodoro y timers) ──
// timer: { kind: 'pomodoro' | 'timer', restanteMs, totalMs, pausado, bloque, bloques, etiqueta,
//          plan: [{ tipo, minutos }] y indice (en qué parte del plan va) para el Pomodoro }
// Pomodoro: arriba los bloques en fila (los de estudio, cuadrados rojos; los descansos, verdes y
// angostos); el que está andando se va llenando, y abajo el tiempo que falta.
// Timer común: qué es y el porcentaje arriba, el tiempo grande y una barra que se llena.
const C = { cara: 1, rojo: 2, rojoOscuro: 4, blanco: 6, amarillo: 7, gris: 8, verde: 9, naranja: 12, cian: 3, grisOscuro: 15, verdeOscuro: 16 }
const LETTERS = new Set(Object.keys(SMALL))
const CHECK = ['....#', '...#.', '#.#..', '.#...']

function smallText(text, max = 15) {
  return String(text ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split('')
    .filter((c) => c === ' ' || LETTERS.has(c))
    .join('')
    .trim()
    .slice(0, max)
}

// Lo que falta, como en un reloj: "24:58" (o "1:05" si es más de una hora)
function clockParts(ms) {
  const secs = Math.ceil(Math.max(0, ms) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const sec = secs % 60
  return h ? [String(h), String(m).padStart(2, '0')] : [String(m).padStart(2, '0'), String(sec).padStart(2, '0')]
}

// Cuánto ocupa cada parte del plan: los bloques de estudio son cuadrados de S; los descansos, angostos
const partWidth = (b, S) => (b.tipo === 'estudio' ? S : b.tipo === 'largo' ? Math.max(4, Math.round(S * 0.55)) : Math.max(3, Math.round(S * 0.36)))

// El tamaño más grande con el que entra todo el plan (si no entra ni chiquito, se corre con el bloque actual)
export function planLayout(plan, index = 0, maxWidth = WIDTH - 2) {
  let fit = null
  for (let S = 14; S >= 8 && !fit; S--) {
    const gap = S >= 11 ? 3 : 2
    const total = plan.reduce((w, b) => w + partWidth(b, S), 0) + gap * (plan.length - 1)
    if (total <= maxWidth) fit = { S, gap, total }
  }
  const scroll = !fit
  const { S, gap, total } = fit ?? { S: 10, gap: 2, total: plan.reduce((w, b) => w + partWidth(b, 10), 0) + 2 * (plan.length - 1) }
  const xs = []
  let x = 0
  for (const b of plan) {
    xs.push(x)
    x += partWidth(b, S) + gap
  }
  let offset = Math.floor((WIDTH - total) / 2)
  if (scroll) {
    // El bloque de ahora queda en el medio (sin dejar lugar vacío en las puntas)
    const cur = xs[index] + partWidth(plan[index], S) / 2
    offset = Math.round(Math.min(1, Math.max(WIDTH - 1 - total, WIDTH / 2 - cur)))
  }
  return { S, scroll, parts: plan.map((b, i) => ({ x: xs[i] + offset, w: partWidth(b, S) })) }
}

// Un rectángulo con las puntas redondeadas
function roundBox(p, x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1)
      if (!corner) p.dot(x, y, c)
    }
  }
}

function drawPart(p, b, { x, w }, y0, h, state, progress, nowMs, paused) {
  const study = b.tipo === 'estudio'
  const bright = study ? C.rojo : C.verde
  const dark = study ? C.rojoOscuro : C.verdeOscuro
  if (state === 'futuro') return roundBox(p, x, y0, w, h, dark)
  if (state === 'hecho') {
    roundBox(p, x, y0, w, h, bright)
    // Los bloques de estudio terminados llevan una tilde
    if (study && w >= 9) p.withColor(C.blanco, () => p.glyph(CHECK, x + Math.floor((w - 5) / 2), y0 + Math.floor((h - 4) / 2), 1))
    return
  }
  // El de ahora: un vaso que se va llenando desde abajo, con la superficie que brilla
  roundBox(p, x, y0, w, h, dark)
  const inner = h - 2
  const level = Math.round(progress * inner)
  for (let i = 0; i < level; i++) {
    const y = y0 + h - 2 - i
    for (let xx = x + 1; xx < x + w - 1; xx++) p.dot(xx, y, i === level - 1 && !paused ? C.naranja : bright)
  }
  if (level > 0 && !paused && w > 3) {
    const shine = x + 1 + (Math.floor(nowMs / 160) % (w - 2))
    p.dot(shine, y0 + h - 1 - level, C.blanco)
  }
  // El borde: en pausa titila en amarillo
  const edge = paused ? (nowMs % 1000 < 600 ? C.amarillo : dark) : bright
  for (let xx = x + 1; xx < x + w - 1; xx++) {
    p.dot(xx, y0, edge)
    p.dot(xx, y0 + h - 1, edge)
  }
  for (let yy = y0 + 1; yy < y0 + h - 1; yy++) {
    p.dot(x, yy, edge)
    p.dot(x + w - 1, yy, edge)
  }
}

function renderPomodoro(timer, nowMs) {
  const bits = new Uint8Array(WIDTH * HEIGHT)
  const p = painter(bits)
  const left = Math.max(0, timer.restanteMs ?? 0)
  const total = Math.max(1, timer.totalMs ?? 1)
  const progress = Math.min(1, Math.max(0, 1 - left / total))
  const plan = timer.plan
  const index = Math.min(plan.length - 1, Math.max(0, timer.indice ?? 0))
  const { S, parts } = planLayout(plan, index)
  const y0 = 1 + Math.floor((21 - S) / 2)
  // Recién terminado: el bloque anterior destella un ratito
  const justDone = total - left < 700 && index > 0 && nowMs % 200 < 100
  plan.forEach((b, i) => {
    const state = i < index ? 'hecho' : i === index ? 'ahora' : 'futuro'
    if (i === index - 1 && justDone) roundBox(p, parts[i].x, y0, parts[i].w, S, C.blanco)
    else drawPart(p, b, parts[i], y0, S, state, progress, nowMs, timer.pausado)
  })

  // Abajo, chiquito: en qué bloque vas, el tiempo que falta y el porcentaje (o el símbolo de pausa)
  const label = `${timer.bloque ?? 1}/${timer.bloques ?? 1}`
  p.withColor(C.gris, () => drawSmall(p, label, 2, 24))
  if (timer.pausado) {
    // El símbolo de pausa (dos rayitas)
    for (let y = 24; y <= 28; y++) for (const x of [WIDTH - 7, WIDTH - 6, WIDTH - 4, WIDTH - 3]) p.dot(x, y, C.amarillo)
  } else {
    const pct = `${Math.floor(progress * 100)}%`
    p.withColor(C.gris, () => drawSmall(p, pct, WIDTH - 2 - smallWidth(pct), 24))
  }
  const [a, b] = clockParts(left)
  if (!(timer.pausado && nowMs % 1000 > 600)) {
    const width = (a.length + b.length) * 6 + 1
    const color = timer.pausado ? C.amarillo : left <= 120000 ? C.naranja : C.cara
    p.withColor(color, () => drawTime(p, a, b, Math.floor((WIDTH - width) / 2), 23, 1, timer.pausado || nowMs % 1000 < 500))
  }
  return bits
}

export function renderTimer(timer, nowMs = Date.now()) {
  if (timer.kind === 'pomodoro' && Array.isArray(timer.plan) && timer.plan.length) return renderPomodoro(timer, nowMs)
  const bits = new Uint8Array(WIDTH * HEIGHT)
  const p = painter(bits)
  const left = Math.max(0, timer.restanteMs ?? 0)
  const total = Math.max(1, timer.totalMs ?? 1)
  const progress = Math.min(1, Math.max(0, 1 - left / total))
  const pomodoro = timer.kind === 'pomodoro'
  const accent = pomodoro ? C.verde : C.cian

  // Arriba: qué es, y el porcentaje (o PAUSA)
  const label = pomodoro ? `BLOQUE ${timer.bloque ?? 1}/${timer.bloques ?? 1}` : smallText(String(timer.etiqueta ?? '').replace(/^(el|la|los|las|un|una|mi|mis)\s+/i, ''), 9) || 'TIMER'
  p.withColor(accent, () => drawSmall(p, label, 1, 1))
  const right = timer.pausado ? 'PAUSA' : `${Math.floor(progress * 100)}%`
  p.withColor(timer.pausado ? C.amarillo : C.cara, () => drawSmall(p, right, WIDTH - 1 - smallWidth(right), 1))

  // El tiempo grande; en pausa titila, y los últimos 2 minutos se pone naranja
  const [a, b] = clockParts(left)
  const blink = timer.pausado && nowMs % 1000 > 600
  if (!blink) {
    const width = (a.length + b.length) * 12 + 2
    const color = !timer.pausado && left <= 120000 ? C.naranja : C.cara
    p.withColor(color, () => drawTime(p, a, b, Math.floor((WIDTH - width) / 2), 8, 2, timer.pausado || nowMs % 1000 < 500))
  }

  // La barra: se llena con el avance y un brillito la recorre
  const x0 = 2
  const x1 = WIDTH - 3
  const fill = Math.round(progress * (x1 - x0 + 1))
  for (let x = x0; x <= x1; x++) {
    p.dot(x, 25, C.grisOscuro)
    p.dot(x, 29, C.grisOscuro)
  }
  for (const y of [26, 27, 28]) {
    p.dot(x0 - 1, y, C.grisOscuro)
    p.dot(x1 + 1, y, C.grisOscuro)
    for (let x = x0; x < x0 + fill; x++) p.dot(x, y, accent)
  }
  if (fill > 2 && !timer.pausado) {
    const shine = x0 + Math.floor(((nowMs % 1400) / 1400) * fill)
    for (const y of [26, 27, 28]) p.dot(shine, y, C.blanco)
  }
  return bits
}

// En el descanso: una rayita abajo que muestra cuánto falta para volver
export function drawBreakBar(bits, timer) {
  const left = Math.max(0, timer.restanteMs ?? 0)
  const total = Math.max(1, timer.totalMs ?? 1)
  const width = Math.round((left / total) * WIDTH)
  const row = (HEIGHT - 1) * WIDTH
  // Sin tapar lo que ya hay (el mate)
  for (let x = 0; x < width; x++) if (!bits[row + x]) bits[row + x] = C.amarillo
  return bits
}
