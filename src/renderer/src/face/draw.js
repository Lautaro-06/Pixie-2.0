// Dibuja la cara de Pixie en una grilla de 64x32 píxeles (1 = encendido).
// En reposo es idéntica al dibujo original del ESP32; los parámetros la
// transforman para cada expresión.

export const WIDTH = 64
export const HEIGHT = 32

export const REST = {
  openL: 1, // apertura de cada ojo: 1 abierto, 0 cerrado
  openR: 1,
  lookX: 0, // hacia dónde mira: -1 izquierda … 1 derecha
  lookY: 0, // -1 arriba … 1 abajo
  eyes: 'normal', // normal | wide | happy | heart
  brow: 'normal', // normal | angry | sad
  mouth: 'small', // small | smile | frown | flat | talk | o | none
  dx: 0, // desplazamiento de toda la cara (saltitos, temblor)
  dy: 0,
  extra: null, // dots | question | exclaim | zzz | notes
  extraT: 0 // fase 0…1 para los extras animados
}

const HEART = [
  '..####....####..',
  '.######..######.',
  '################',
  '################',
  '.##############.',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......'
]
const QUESTION = ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '...##...', '........', '...##...', '...##...']
const EXCLAIM = ['####', '####', '####', '####', '####', '####', '....', '####', '####']
const Z_BIG = ['#####', '...#.', '..#..', '.#...', '#####']
const Z_SMALL = ['####', '..#.', '.#..', '####']
const NOTE = ['..##.', '..#.#', '..#..', '..#..', '###..', '###..']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function renderFace(params = {}) {
  const p = { ...REST, ...params }
  const bits = new Uint8Array(WIDTH * HEIGHT)

  const set = (x, y) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) bits[y * WIDTH + x] = 1
  }
  const rect = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y)
  }
  const glyph = (rows, x0, y0) => {
    rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && set(x0 + x, y0 + y)))
  }

  const lx = Math.round(clamp(p.lookX, -1, 1) * 4) + Math.round(p.dx)
  const ly = Math.round(clamp(p.lookY, -1, 1) * 3) + Math.round(p.dy)

  for (const side of ['L', 'R']) {
    const left = side === 'L'
    const bodyX0 = left ? 8 : 40
    const bodyX1 = bodyX0 + 15

    if (p.eyes === 'happy') {
      // ^ ^
      const c = bodyX0 + 8
      rect(c - 2 + lx, 10 + ly, c + 1 + lx, 12 + ly)
      rect(c - 5 + lx, 13 + ly, c - 3 + lx, 15 + ly)
      rect(c + 2 + lx, 13 + ly, c + 4 + lx, 15 + ly)
      rect(c - 8 + lx, 16 + ly, c - 6 + lx, 18 + ly)
      rect(c + 5 + lx, 16 + ly, c + 7 + lx, 18 + ly)
      continue
    }
    if (p.eyes === 'heart') {
      glyph(HEART, bodyX0 + lx, 9 + ly)
      continue
    }

    const wide = p.eyes === 'wide' ? 1 : 0
    const open = clamp(left ? p.openL : p.openR, 0, 1)
    const top = 20 - Math.round(16 * open) - wide * 2
    const bottom = 23 + wide

    // Ceja: barra de 4 px con un ala hacia afuera
    let barX0 = left ? 4 : 40
    let barX1 = left ? 23 : 59
    if (p.brow === 'angry') {
      if (left) barX1 = 19
      else barX0 = 44
    } else if (p.brow === 'sad') {
      if (left) barX0 = 8
      else barX1 = 55
    }
    rect(barX0 + lx, top + ly, barX1 + lx, top + 3 + ly)

    // Ojo
    if (top + 4 <= bottom) rect(bodyX0 - wide + lx, top + 4 + ly, bodyX1 + wide + lx, bottom + ly)

    // Mechón de arriba
    const tuftX = left ? 8 : 52
    const drop = p.brow === 'sad' ? 2 : 0
    rect(tuftX + lx, top - 4 + drop + ly, tuftX + 3 + lx, top - 1 + drop + ly)
  }

  // Boca
  const mx = Math.round(p.dx)
  const my = Math.round(p.dy)
  const m = (x0, y0, x1, y1) => rect(x0 + mx, y0 + my, x1 + mx, y1 + my)
  switch (p.mouth) {
    case 'small': m(28, 24, 35, 27); break
    case 'smile': m(28, 26, 35, 27); m(24, 24, 27, 25); m(36, 24, 39, 25); break
    case 'frown': m(28, 24, 35, 27); m(24, 28, 27, 31); m(36, 28, 39, 31); break
    case 'flat': m(26, 25, 37, 26); break
    case 'talk': m(28, 23, 35, 29); break
    case 'o': m(28, 23, 35, 24); m(28, 29, 35, 30); m(26, 25, 27, 28); m(36, 25, 37, 28); break
    default: break
  }

  // Extras
  const t = clamp(p.extraT, 0, 1)
  switch (p.extra) {
    case 'dots': {
      const n = Math.floor(t * 4) % 4
      for (let i = 0; i < n; i++) rect(27 + i * 4 + mx, 25 + my, 28 + i * 4 + mx, 26 + my)
      break
    }
    case 'question': glyph(QUESTION, 28, 5); break
    case 'exclaim': glyph(EXCLAIM, 30, 4); break
    case 'zzz': {
      glyph(Z_BIG, 45, Math.round(12 - 10 * t))
      glyph(Z_SMALL, 54, Math.round(8 - 8 * ((t + 0.5) % 1)))
      break
    }
    case 'notes': {
      glyph(NOTE, 26, Math.round(20 - 18 * t))
      glyph(NOTE, 34, Math.round(20 - 18 * ((t + 0.5) % 1)))
      break
    }
    default: break
  }

  return bits
}
