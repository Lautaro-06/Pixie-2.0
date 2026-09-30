import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderFace, WIDTH, HEIGHT } from '../src/renderer/src/face/draw.js'
import { REACTIONS, MOODS, compose, keyframes } from '../src/renderer/src/face/animations.js'
import { FACES } from './fixtures/original-faces.js'

function fromHex(hex) {
  const bytes = Buffer.from(hex, 'hex')
  const bits = new Uint8Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) bits[y * WIDTH + x] = (bytes[y * 8 + (x >> 3)] >> (7 - (x & 7))) & 1
  }
  return bits
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

test('en reposo es igual al dibujo original', () => {
  assert.ok(same(renderFace(), fromHex(FACES.open)))
})

test('el pestañeo reproduce los cuadros originales', () => {
  assert.ok(same(renderFace({ openL: 0.75, openR: 0.75 }), fromHex(FACES.blink1)))
  assert.ok(same(renderFace({ openL: 0.5, openR: 0.5 }), fromHex(FACES.blink2)))
  assert.ok(same(renderFace({ openL: 0.25, openR: 0.25 }), fromHex(FACES.blink3)))
  assert.ok(same(renderFace({ openL: 0, openR: 0 }), fromHex(FACES.blink4)))
})

test('la cara enojada reproduce el dibujo original', () => {
  assert.ok(same(renderFace({ brow: 'angry', mouth: 'frown' }), fromHex(FACES.angry1)))
})

test('cada reacción cambia la cara y termina sin errores', () => {
  const rest = renderFace()
  for (const [name, [duration, fn]] of Object.entries(REACTIONS)) {
    let changed = false
    for (let t = 0; t <= duration; t += 20) {
      const bits = renderFace(fn(t))
      if (!same(bits, rest)) changed = true
    }
    assert.ok(changed, `${name} no cambia nada`)
  }
})

test('los estados de ánimo se pueden dibujar', () => {
  for (const mood of Object.keys(MOODS)) {
    for (let t = 0; t < 3000; t += 100) renderFace(compose(mood, 0, [], t))
  }
})

test('keyframes interpola números y cambia textos de golpe', () => {
  const frames = [[0, { a: 0, s: 'x' }], [100, { a: 10, s: 'y' }]]
  assert.deepEqual(keyframes(50, frames), { a: 5, s: 'x' })
  assert.deepEqual(keyframes(100, frames), { a: 10, s: 'y' })
  assert.deepEqual(keyframes(500, frames), { a: 10, s: 'y' })
})
