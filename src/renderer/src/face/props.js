// Los «disfraces» de Pixie según lo que estás haciendo: anteojos 3D y pochoclos, auriculares, la compu,
// un libro, un joystick… Se dibujan arriba de la cara, en la misma grilla de 64×32, con colores.
// Cada píxel guarda un número de color (ver PALETTE): 0 apagado, 1 la cara, el resto los disfraces.
import { WIDTH, HEIGHT } from './draw.js'

export const COLOR = {
  cara: 1,
  rojo: 2,
  cian: 3,
  rojoOscuro: 4,
  cianOscuro: 5,
  blanco: 6,
  amarillo: 7,
  gris: 8,
  verde: 9,
  violeta: 10,
  marron: 11,
  naranja: 12,
  azul: 13,
  rosa: 14,
  grisOscuro: 15,
  verdeOscuro: 16
}
// El 1 (la cara) toma el color de la pantallita (--pixel)
export const PALETTE = [
  null, null,
  '#ff4d5e', '#36d6ff', '#5c1a24', '#0e3f55', '#eef4ff', '#ffd84a', '#8b9bb4',
  '#53e08a', '#c38bff', '#b07a4a', '#ff9f43', '#6fa8ff', '#ff7ab8', '#4a5568',
  '#1d5c3a'
]

// descanso: el del Pomodoro (lo pone la ventanita, no lo que estás haciendo)
export const SCENES = ['cine', 'trabajando', 'programando', 'leyendo', 'musica', 'jugando', 'reunion', 'chateando', 'artista', 'descanso']
// Lo que se lleva puesto (se ve también mientras te escucha) y lo que tiene en la mano (solo en reposo)
const WEARABLE = { cine: 'anteojos3d', trabajando: 'anteojos', programando: 'anteojos', leyendo: 'redondos', musica: 'auris', reunion: 'headset', artista: 'boina', descanso: 'sol' }

const LEGEND = {
  '.': 0, y: COLOR.amarillo, w: COLOR.blanco, r: COLOR.rojo, g: COLOR.gris, d: COLOR.grisOscuro, k: COLOR.marron,
  v: COLOR.verde, b: COLOR.azul, c: COLOR.cian, p: COLOR.rosa, o: COLOR.naranja, m: COLOR.violeta
}

const POPCORN = [
  '...y.y...',
  '..yywyy..',
  '.ywyyywy.',
  'yywyywyyy',
  'rwrwrwrwr',
  'rwrwrwrwr',
  '.rwrwrwr.',
  '.rwrwrwr.',
  '.rwrwrwr.',
  '.rwrwrwr.',
  '..rwrwr..',
  '..rwrwr..'
]
const GAMEPAD = [
  '.dddddd......dddddd.',
  'dddddddddddddddddddd',
  'ddwddddddddddddrdddd',
  'dwwwdddddddddbdddvdd',
  'ddwddddddddddddydddd',
  'dddddddddddddddddddd',
  'dddd............dddd',
  '.dd..............dd.'
]
const BOOK = [
  '.wwwwwwwwwwww..wwwwwwwwwwww.',
  'wwggggggggwwwkkwwwggggggggww',
  'wwwwwwwwwwwwwkkwwwwwwwwwwwww',
  'wwgggggggwwwwkkwwwwgggggggww',
  'wwwwwwwwwwwwwkkwwwwwwwwwwwww',
  'wwggggggwwwwwkkwwwwwggggggww',
  'wwwwwwwwwwwwwkkwwwwwwwwwwwww',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkk.'
]
const PHONE = [
  '.ddddddd.',
  'ddddddddd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'dbbbbbbbd',
  'ddddddddd',
  'dddd.dddd',
  '.ddddddd.'
]
const BERET = [
  '..........kk..........',
  '....pppppppppppppp....',
  '.pppppppppppppppppppp.',
  'pppppppppppppppppppppp'
]
// El mate del descanso (con la bombilla)
const MATE = [
  '.......g',
  '......g.',
  '.....g..',
  '.vvvvgv.',
  'kkkkkkkk',
  'kkkkkkkk',
  '.kkkkkk.',
  '.kkkkkk.',
  '..kkkk..',
  '..dddd..'
]
const CODE = [
  ['..#', '.#.', '#..', '.#.', '..#'],
  ['..#', '..#', '.#.', '#..', '#..'],
  ['#..', '.#.', '..#', '.#.', '#..']
]
const NOTE = ['..##.', '..#.#', '..#..', '..#..', '###..', '###..']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Sale con un saltito al final (como si se acomodara)
export function easeOutBack(k) {
  const c = 1.6
  const x = clamp(k, 0, 1) - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

function painter(bits) {
  const put = (x, y, c) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && c) bits[y * WIDTH + x] = c
  }
  return {
    put,
    get: (x, y) => (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT ? bits[Math.round(y) * WIDTH + Math.round(x)] : 0),
    box(x0, y0, x1, y1, c) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c)
    },
    frame(x0, y0, x1, y1, c) {
      for (let x = x0; x <= x1; x++) {
        put(x, y0, c)
        put(x, y1, c)
      }
      for (let y = y0; y <= y1; y++) {
        put(x0, y, c)
        put(x1, y, c)
      }
    },
    sprite(rows, x0, y0, legend = LEGEND) {
      rows.forEach((row, y) => [...row].forEach((ch, x) => legend[ch] && put(x0 + x, y0 + y, legend[ch])))
    },
    glyph(rows, x0, y0, c) {
      rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && put(x0 + x, y0 + y, c)))
    }
  }
}

// Una lente: lo que se ve de la cara adentro sale teñido (rojo o cian), el resto oscuro
function lens(p, x0, y0, x1, y1, bright, dark) {
  for (let y = y0 + 1; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) p.put(x, y, p.get(x, y) ? bright : dark)
  }
  p.frame(x0, y0, x1, y1, COLOR.blanco)
}

const WEAR = {
  anteojos3d(p, ox, oy) {
    lens(p, 5 + ox, 9 + oy, 26 + ox, 22 + oy, COLOR.rojo, COLOR.rojoOscuro)
    lens(p, 37 + ox, 9 + oy, 58 + ox, 22 + oy, COLOR.cian, COLOR.cianOscuro)
    p.box(27 + ox, 12 + oy, 36 + ox, 13 + oy, COLOR.blanco)
    p.box(1 + ox, 11 + oy, 4 + ox, 11 + oy, COLOR.blanco)
    p.box(59 + ox, 11 + oy, 62 + ox, 11 + oy, COLOR.blanco)
  },
  anteojos(p, ox, oy) {
    p.frame(5 + ox, 10 + oy, 26 + ox, 21 + oy, COLOR.blanco)
    p.frame(37 + ox, 10 + oy, 58 + ox, 21 + oy, COLOR.blanco)
    p.box(27 + ox, 13 + oy, 36 + ox, 13 + oy, COLOR.blanco)
  },
  redondos(p, ox, oy) {
    for (const cx of [16, 47]) {
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2
        p.put(cx + ox + Math.cos(t) * 11, 16 + oy + Math.sin(t) * 7, COLOR.naranja)
      }
    }
    p.box(28 + ox, 14 + oy, 35 + ox, 14 + oy, COLOR.naranja)
  },
  auris(p, ox, oy) {
    const c = COLOR.violeta
    p.box(5 + ox, 0 + oy, 58 + ox, 0 + oy, c)
    p.box(3 + ox, 1 + oy, 4 + ox, 1 + oy, c)
    p.box(59 + ox, 1 + oy, 60 + ox, 1 + oy, c)
    p.box(1 + ox, 2 + oy, 2 + ox, 8 + oy, c)
    p.box(61 + ox, 2 + oy, 62 + ox, 8 + oy, c)
    p.box(0 + ox, 9 + oy, 3 + ox, 19 + oy, c)
    p.box(60 + ox, 9 + oy, 63 + ox, 19 + oy, c)
    p.box(1 + ox, 11 + oy, 2 + ox, 17 + oy, COLOR.rosa)
    p.box(61 + ox, 11 + oy, 62 + ox, 17 + oy, COLOR.rosa)
  },
  headset(p, ox, oy) {
    WEAR.auris(p, ox, oy)
    // El micrófono, desde el auricular izquierdo hasta la boca
    for (let i = 0; i <= 20; i++) p.put(2 + ox + i, 19 + oy + Math.round((i / 20) * 7), COLOR.gris)
    p.box(22 + ox, 25 + oy, 24 + ox, 27 + oy, COLOR.blanco)
  },
  // Anteojos de sol (en el descanso del Pomodoro): lentes oscuras (no se le ven los ojos) con un brillito
  sol(p, ox, oy) {
    for (const [x0, x1] of [[5, 26], [37, 58]]) {
      for (let y = 8; y <= 23; y++) {
        // Abajo se angostan un poco
        const cut = y >= 21 ? y - 20 : 0
        for (let x = x0 + cut; x <= x1 - cut; x++) p.put(x + ox, y + oy, COLOR.grisOscuro)
      }
      p.box(x0 + ox, 7 + oy, x1 + ox, 7 + oy, COLOR.blanco)
      // El brillito en diagonal
      for (let i = 0; i < 4; i++) p.put(x0 + 3 + i + ox, 13 - i + oy, COLOR.blanco)
      p.put(x0 + 9 + ox, 10 + oy, COLOR.blanco)
    }
    p.box(27 + ox, 9 + oy, 36 + ox, 10 + oy, COLOR.blanco)
    p.box(1 + ox, 8 + oy, 4 + ox, 8 + oy, COLOR.blanco)
    p.box(59 + ox, 8 + oy, 62 + ox, 8 + oy, COLOR.blanco)
  },
  boina(p, ox, oy) {
    p.sprite(BERET, 2 + ox, 0 + oy)
  },
  gorro(p, ox, oy) {
    // Gorro de dormir (de noche, cuando duerme)
    for (let y = 0; y < 3; y++) p.box(38 + ox + y * 4, y + oy, 60 + ox - y, y + oy, COLOR.azul)
    p.box(37 + ox, 3 + oy, 61 + ox, 3 + oy, COLOR.blanco)
    p.box(60 + ox, 4 + oy, 63 + ox, 7 + oy, COLOR.blanco)
  }
}

// Lo que tiene en la mano, animado con el tiempo t (ms)
const HOLD = {
  cine(p, ox, oy, t) {
    p.sprite(POPCORN, 55 + ox, 20 + oy)
    // Cada 3,6 s saca un pochoclo y se lo come
    const cycle = t % 3600
    if (cycle < 600) {
      const u = cycle / 600
      const x = 58 + (30 - 58) * u
      const y = 19 + (25 - 19) * u - 8 * Math.sin(Math.PI * u)
      p.box(Math.round(x) + ox, Math.round(y) + oy, Math.round(x) + 1 + ox, Math.round(y) + 1 + oy, COLOR.amarillo)
    }
  },
  laptop(p, ox, oy, t, code) {
    p.box(17 + ox, 31 + oy, 46 + ox, 31 + oy, COLOR.grisOscuro)
    p.box(20 + ox, 23 + oy, 43 + ox, 30 + oy, COLOR.gris)
    p.frame(20 + ox, 23 + oy, 43 + ox, 30 + oy, COLOR.grisOscuro)
    if (code) {
      CODE.forEach((g, i) => p.glyph(g, 25 + i * 5 + ox, 24 + oy, COLOR.verde))
    } else {
      // El logo que titila
      p.box(31 + ox, 26 + oy, 32 + ox, 27 + oy, Math.floor(t / 900) % 2 ? COLOR.blanco : COLOR.cian)
    }
    // Teclea: chispitas arriba de la tapa
    const k = Math.floor(t / 110)
    for (let i = 0; i < 2; i++) {
      const x = 21 + ((k * 7 + i * 11) % 22)
      if ((k + i) % 3) p.put(x + ox, 22 + oy, COLOR.blanco)
    }
  },
  leyendo(p, ox, oy, t) {
    p.sprite(BOOK, 18 + ox, 24 + oy)
    // Cada 7 s da vuelta la página
    const cycle = t % 7000
    if (cycle < 500) {
      const x = 44 - Math.round((cycle / 500) * 26)
      p.box(x + ox, 24 + oy, x + 1 + ox, 30 + oy, COLOR.blanco)
    }
  },
  jugando(p, ox, oy, t) {
    p.sprite(GAMEPAD, 22 + ox, 24 + oy)
    // Aprieta botones
    const k = Math.floor(t / 180) % 4
    const buttons = [[37, 26, COLOR.rojo], [35, 27, COLOR.azul], [39, 27, COLOR.verde], [37, 28, COLOR.amarillo]]
    const [bx, by] = buttons[k]
    p.put(bx + ox, by + oy, COLOR.blanco)
  },
  chateando(p, ox, oy, t) {
    p.sprite(PHONE, 54 + ox, 17 + oy)
    // Los mensajes van subiendo
    const shift = Math.floor(t / 700) % 3
    for (let i = 0; i < 3; i++) {
      const y = 19 + ((i * 3 + 6 - shift * 3) % 9)
      const mine = (i + shift) % 2
      p.box(55 + (mine ? 3 : 1) + ox, y + oy, 55 + (mine ? 6 : 4) + ox, y + oy, mine ? COLOR.verde : COLOR.blanco)
    }
  },
  artista(p, ox, oy, t) {
    // El pincel, con la punta que cambia de color
    for (let i = 0; i <= 11; i++) p.put(63 - i + ox, 31 - i + oy, COLOR.marron)
    const tips = [COLOR.rojo, COLOR.amarillo, COLOR.cian, COLOR.verde, COLOR.rosa]
    p.box(50 + ox, 18 + oy, 52 + ox, 20 + oy, tips[Math.floor(t / 1500) % tips.length])
    // Manchitas de pintura
    const k = Math.floor(t / 1500)
    for (let i = 0; i < 3; i++) p.put(2 + ((k * 5 + i * 9) % 18) + ox, 29 + (i % 2) * 2 + oy, tips[(k + i) % tips.length])
  },
  descanso(p, ox, oy, t) {
    p.sprite(MATE, 54 + ox, 22 + oy)
    // El vapor que sube del mate
    const u = (t % 1800) / 1800
    const y = Math.round(20 - 8 * u)
    if (u < 0.85) p.put(61 + ox + (Math.floor(t / 300) % 2), y + oy, COLOR.blanco)
  },
  musica(p, ox, oy, t) {
    const u = (t % 1600) / 1600
    p.glyph(NOTE, 26 + ox, Math.round(20 - 18 * u) + oy, COLOR.violeta)
    p.glyph(NOTE, 34 + ox, Math.round(20 - 18 * ((u + 0.5) % 1)) + oy, COLOR.rosa)
  }
}

// scene: { name, t (ms desde que empezó), exit (true mientras se va), props (si se ve lo de la mano), auris, night }
// dx, dy: hacia dónde se movió la cara
export function drawScene(bits, scene, { dx = 0, dy = 0 } = {}) {
  if (!scene) return bits
  const p = painter(bits)
  const k = scene.exit ? 1 - clamp(scene.t / 280, 0, 1) : easeOutBack(scene.t / 480)
  const wearY = Math.round((1 - k) * -12) + Math.round(dy)
  const holdY = Math.round((1 - k) * 16)
  const ox = Math.round(dx)
  const name = scene.name
  // Lo de la mano queda quieto en su lugar; lo que lleva puesto se mueve con la cara
  if (scene.props !== false && HOLD[name]) HOLD[name](p, 0, holdY, scene.t)
  if (name === 'trabajando' || name === 'programando') {
    if (scene.props !== false) HOLD.laptop(p, 0, holdY, scene.t, name === 'programando')
  }
  if (WEARABLE[name]) WEAR[WEARABLE[name]](p, ox, wearY)
  if (scene.auris && name !== 'musica') WEAR.auris(p, ox, wearY)
  return bits
}

// El gorro de dormir (de noche)
export function drawNightcap(bits, { dx = 0, dy = 0 } = {}) {
  WEAR.gorro(painter(bits), Math.round(dx), Math.round(dy))
  return bits
}
