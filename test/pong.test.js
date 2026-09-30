import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newGame, step, renderPong, renderMorph, TARGET, PADDLE_H } from '../src/renderer/src/games/pong.js'
import { renderFace, WIDTH, HEIGHT } from '../src/renderer/src/face/draw.js'

// Generador pseudoaleatorio fijo, para que las pruebas den siempre igual
function seeded(seed = 1) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function play(game, ms, input, rng) {
  let g = game
  const events = []
  for (let t = 0; t < ms; t += 16) {
    const r = step(g, 16, input(g), rng)
    g = r.game
    events.push(...r.events)
    if (g.phase === 'end') break
  }
  return { game: g, events }
}

test('arranca sacando y después la pelota se mueve', () => {
  const rng = seeded()
  let g = newGame()
  assert.equal(g.phase, 'serve')
  g = play(g, 1000, () => ({}), rng).game
  assert.equal(g.phase, 'play')
  assert.notEqual(g.ball.vx, 0)
})

test('si no movés la paleta, Pixie te gana', () => {
  const rng = seeded(7)
  const { game, events } = play(newGame(), 120000, () => ({ userY: 0 }), rng)
  assert.equal(game.phase, 'end')
  assert.equal(game.winner, 'pixie')
  assert.equal(game.score.pixie, TARGET)
  assert.ok(events.includes('punto_pixie'))
  assert.ok(events.includes('fin'))
})

test('si seguís la pelota, rebota en tu paleta', () => {
  const rng = seeded(3)
  const follow = (g) => ({ userY: g.ball.y - PADDLE_H / 2 + 1 })
  const { events } = play(newGame(), 20000, follow, rng)
  assert.ok(events.filter((e) => e === 'rebote').length >= 2)
})

test('es parejo: jugando normal, a veces ganás vos y a veces Pixie', () => {
  const winners = new Set()
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seeded(seed)
    let g = newGame()
    const seen = []
    // una persona reacciona con ~150 ms de demora
    for (let t = 0; t < 300000 && g.phase !== 'end'; t += 16) {
      seen.push({ y: g.ball.y, vx: g.ball.vx })
      const past = seen[Math.max(0, seen.length - 10)]
      g = step(g, 16, { userY: past.vx < 0 ? past.y - PADDLE_H / 2 + 1 : 12 }, rng).game
    }
    winners.add(g.winner)
  }
  assert.ok(winners.has('user'))
  assert.ok(winners.has('pixie'))
})

test('la paleta no se sale de la pantalla', () => {
  let g = newGame()
  for (let i = 0; i < 60; i++) g = step(g, 16, { userY: -50 }).game
  assert.equal(g.user.y, 0)
  for (let i = 0; i < 60; i++) g = step(g, 16, { userY: 500 }).game
  assert.equal(g.user.y, HEIGHT - PADDLE_H)
})

test('se dibuja y la transformación empieza en la cara', () => {
  const bits = renderPong(newGame())
  assert.equal(bits.length, WIDTH * HEIGHT)
  assert.ok(bits.some(Boolean))
  // t = 0: ojos y boca en el mismo lugar que la cara (sin mechones ni alas)
  const morph0 = renderMorph(0)
  const face = renderFace()
  for (let i = 0; i < morph0.length; i++) if (morph0[i]) assert.equal(face[i], 1)
  assert.ok(renderMorph(1).filter(Boolean).length < morph0.filter(Boolean).length)
})
