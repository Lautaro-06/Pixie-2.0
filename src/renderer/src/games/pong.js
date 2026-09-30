// Pong en la pantallita de Pixie (64x32). Vos movés la paleta de la izquierda,
// Pixie la de la derecha. Todo es puro: step() recibe el estado y devuelve
// el estado nuevo y lo que pasó, así se puede probar.
import { WIDTH as W, HEIGHT as H } from '../face/draw.js'

export const PADDLE_H = 8
export const BALL = 2
export const LEFT_X = 2 // paleta del usuario: x 2-3
export const RIGHT_X = 60 // paleta de Pixie: x 60-61
export const TARGET = 3 // gana el primero en llegar a 3

const BASE_SPEED = 0.024 // píxeles por ms
const MAX_SPEED = 0.06
const PIXIE_SPEED = 0.024 // qué tan rápido mueve Pixie su paleta
const USER_SPEED = 0.045 // tu paleta sigue al mouse, pero no se teletransporta
const SERVE_MS = 900

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function newGame() {
  return {
    user: { y: (H - PADDLE_H) / 2 },
    pixie: { y: (H - PADDLE_H) / 2, aim: 0 },
    ball: { x: (W - BALL) / 2, y: (H - BALL) / 2, vx: 0, vy: 0 },
    score: { user: 0, pixie: 0 },
    phase: 'serve', // serve | play | end
    wait: SERVE_MS,
    serveTo: 1, // 1 = hacia Pixie, -1 = hacia vos
    winner: null
  }
}

function launch(g, rng) {
  const angle = (rng() - 0.5) * 0.9
  g.ball = {
    x: (W - BALL) / 2,
    y: (H - BALL) / 2,
    vx: g.serveTo * BASE_SPEED * Math.cos(angle),
    vy: BASE_SPEED * Math.sin(angle)
  }
  g.pixie.aim = (rng() - 0.5) * 6
}

function bounceOff(g, paddleY, dir, rng) {
  const speed = Math.min(MAX_SPEED, Math.hypot(g.ball.vx, g.ball.vy) * 1.07)
  const hit = (g.ball.y + BALL / 2 - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2 + 1) // -1 … 1
  const angle = clamp(hit, -1, 1) * 0.9
  g.ball.vx = dir * speed * Math.cos(angle)
  g.ball.vy = speed * Math.sin(angle)
  g.pixie.aim = (rng() - 0.5) * 7 // Pixie no es perfecto: apunta con error
}

// input: { userY } posición deseada de tu paleta (arriba de la paleta).
// Devuelve { game, events } — events: 'rebote', 'punto_pixie', 'punto_usuario', 'fin'
export function step(game, dt, input = {}, rng = Math.random) {
  const g = structuredClone(game)
  const events = []
  if (g.phase === 'end') return { game: g, events }

  if (typeof input.userY === 'number') {
    const want = clamp(input.userY, 0, H - PADDLE_H)
    g.user.y += clamp(want - g.user.y, -USER_SPEED * dt, USER_SPEED * dt)
  }

  // Pixie sigue la pelota cuando viene hacia él; si no, vuelve al centro
  const target = g.ball.vx > 0 ? g.ball.y + BALL / 2 - PADDLE_H / 2 + g.pixie.aim : (H - PADDLE_H) / 2
  const delta = clamp(target - g.pixie.y, -PIXIE_SPEED * dt, PIXIE_SPEED * dt)
  g.pixie.y = clamp(g.pixie.y + delta, 0, H - PADDLE_H)

  if (g.phase === 'serve') {
    g.wait -= dt
    if (g.wait <= 0) {
      g.phase = 'play'
      launch(g, rng)
    }
    return { game: g, events }
  }

  const b = g.ball
  b.x += b.vx * dt
  b.y += b.vy * dt

  if (b.y < 0) {
    b.y = -b.y
    b.vy = Math.abs(b.vy)
  } else if (b.y > H - BALL) {
    b.y = 2 * (H - BALL) - b.y
    b.vy = -Math.abs(b.vy)
  }

  const overlaps = (py) => b.y + BALL > py && b.y < py + PADDLE_H
  if (b.vx < 0 && b.x <= LEFT_X + 2 && b.x >= LEFT_X - 1 && overlaps(g.user.y)) {
    b.x = LEFT_X + 2
    bounceOff(g, g.user.y, 1, rng)
    events.push('rebote')
  } else if (b.vx > 0 && b.x + BALL >= RIGHT_X && b.x + BALL <= RIGHT_X + 3 && overlaps(g.pixie.y)) {
    b.x = RIGHT_X - BALL
    bounceOff(g, g.pixie.y, -1, rng)
    events.push('rebote')
  }

  let point = null
  if (b.x + BALL < 0) point = 'pixie'
  else if (b.x > W) point = 'user'
  if (point) {
    g.score[point]++
    events.push(point === 'pixie' ? 'punto_pixie' : 'punto_usuario')
    if (g.score[point] >= TARGET) {
      g.phase = 'end'
      g.winner = point
      events.push('fin')
    } else {
      g.phase = 'serve'
      g.wait = SERVE_MS
      g.serveTo = point === 'pixie' ? -1 : 1 // la pelota sale hacia el que perdió el punto
      g.ball = { x: (W - BALL) / 2, y: (H - BALL) / 2, vx: 0, vy: 0 }
    }
  }
  return { game: g, events }
}

// ───────────── Dibujo ─────────────

const DIGITS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###']
}

export function renderPong(g) {
  const bits = new Uint8Array(W * H)
  const set = (x, y) => {
    if (x >= 0 && x < W && y >= 0 && y < H) bits[y * W + x] = 1
  }
  const rect = (x0, y0, w, h) => {
    for (let y = Math.round(y0); y < Math.round(y0) + h; y++) for (let x = Math.round(x0); x < Math.round(x0) + w; x++) set(x, y)
  }
  // Red punteada
  for (let y = 0; y < H; y += 4) rect(31, y, 1, 2)
  // Puntajes
  const digit = (n, x0) => (DIGITS[Math.min(n, 3)] ?? DIGITS[0]).forEach((row, y) => [...row].forEach((c, x) => c === '#' && set(x0 + x, 1 + y)))
  digit(g.score.user, 25)
  digit(g.score.pixie, 35)
  // Paletas y pelota
  rect(LEFT_X, g.user.y, 2, PADDLE_H)
  rect(RIGHT_X, g.pixie.y, 2, PADDLE_H)
  if (g.phase !== 'end') rect(g.ball.x, g.ball.y, BALL, BALL)
  return bits
}

// Transformación: los ojos se achican hasta ser paletas y la boca se vuelve la pelota.
// t va de 0 (cara) a 1 (Pong).
export function renderMorph(t) {
  const k = clamp(t, 0, 1)
  const lerp = (a, b) => Math.round(a + (b - a) * k)
  const bits = new Uint8Array(W * H)
  const rect = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < W && y >= 0 && y < H) bits[y * W + x] = 1
  }
  const mid = (H - PADDLE_H) / 2
  // ojo izquierdo (x 8-23, y 4-23) → paleta izquierda
  rect(lerp(8, LEFT_X), lerp(4, mid), lerp(23, LEFT_X + 1), lerp(23, mid + PADDLE_H - 1))
  // ojo derecho (x 40-55, y 4-23) → paleta derecha
  rect(lerp(40, RIGHT_X), lerp(4, mid), lerp(55, RIGHT_X + 1), lerp(23, mid + PADDLE_H - 1))
  // boca (x 28-35, y 24-27) → pelota
  const bx = (W - BALL) / 2
  const by = (H - BALL) / 2
  rect(lerp(28, bx), lerp(24, by), lerp(35, bx + BALL - 1), lerp(27, by + BALL - 1))
  return bits
}
