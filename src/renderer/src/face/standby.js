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

function painter(bits) {
  const dot = (x, y) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) bits[y * WIDTH + x] = 1
  }
  const glyph = (rows, x0, y0, scale = 1) => {
    rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== '#') return
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) dot(x0 + x * scale + dx, y0 + y * scale + dy)
      })
    )
  }
  return { dot, glyph }
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
