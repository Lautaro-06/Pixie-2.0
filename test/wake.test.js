import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { features, trimSilence, learnSample, compare, limitFor, distanceTo, matches, createSegmenter, createWakeDetector, RATE } from '../src/renderer/src/wake.js'
import { createWakeStore, validTemplates } from '../src/main/wake-store.js'

// Grabaciones de prueba (voz sintética, 16 kHz): voz1-3 enseñan, si1-3 la llaman, no-* son otras frases
const wav = (name) => {
  const b = readFileSync(new URL(`./fixtures/voz/${name}.wav`, import.meta.url))
  const n = (b.length - 44) / 2
  return Float32Array.from({ length: n }, (_, i) => b.readInt16LE(44 + i * 2) / 32768)
}
const learn = (name) => {
  const r = learnSample(wav(name))
  assert.ok(r.ok, `${name}: ${r.problema}`)
  return r.frames
}
const templates = ['voz1', 'voz2', 'voz3'].map(learn)
const silence = (seconds) => Float32Array.from({ length: Math.round(seconds * RATE) }, () => (Math.random() * 2 - 1) * 0.002)
const join_ = (...parts) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

test('saca la huella de una frase: un vector cada 10 ms', () => {
  const f = features(wav('voz1'))
  assert.equal(f[0].length, 12)
  assert.ok(Math.abs(f.length - Math.floor((wav('voz1').length - 400) / 160 + 1)) <= 1)
  assert.ok(trimSilence(join_(silence(1), wav('voz1'), silence(1))).length < wav('voz1').length + RATE * 0.3)
})

test('reconoce «Pixie, ¿estás?» y no otras frases que terminan igual', () => {
  const limit = limitFor(templates)
  for (const name of ['si1', 'si2', 'si3']) assert.ok(matches(distanceTo(templates, learn(name)), limit), `${name} debería despertarla`)
  for (const name of ['no-pero', 'no-che', 'no-donde', 'no-hola', 'no-agua', 'no-taxi']) {
    assert.ok(!matches(distanceTo(templates, learn(name)), limit), `${name} no debería despertarla`)
  }
  // Lo que más pesa es cómo suena el «Pixie»: «Che, ¿estás?» se parece en el final pero no al principio
  const che = distanceTo(templates, learn('no-che'))
  assert.ok(che.nombre > limit.nombre)
  assert.deepEqual(compare([], templates[0]), { total: Infinity, nombre: Infinity })
})

test('la sensibilidad agranda o achica cuánto se puede alejar', () => {
  const baja = limitFor(templates, 'baja')
  const alta = limitFor(templates, 'alta')
  assert.ok(baja.total <= limitFor(templates).total && limitFor(templates).total <= alta.total)
  assert.ok(baja.nombre <= alta.nombre)
})

test('avisa si la grabación no sirve', () => {
  assert.match(learnSample(silence(2)).problema, /No te escuché/)
  assert.match(learnSample(join_(wav('voz1'), wav('no-hola'), wav('voz2'))).problema, /muy largo/)
})

test('corta el audio en frases entre silencios y descarta las charlas largas', () => {
  const got = []
  const seg = createSegmenter({ onSegment: (s) => got.push(s.length / RATE) })
  // Una charla larga: varias frases pegadas, sin silencios entre medio
  const talk = join_(...['voz1', 'no-hola', 'voz2', 'no-agua'].map((n) => trimSilence(wav(n))))
  const audio = join_(silence(1), wav('si1'), silence(0.8), wav('no-che'), silence(0.8), talk, silence(1))
  for (let i = 0; i < audio.length; i += 4096) seg.push(audio.subarray(i, i + 4096))
  assert.equal(got.length, 2, 'las dos frases cortas; la charla larga del final no')
  assert.ok(got.every((s) => s > 0.4 && s < 3))
})

test('escuchando de corrido se despierta solo con la frase', () => {
  const wakes = []
  const det = createWakeDetector({ templates, onWake: (info) => wakes.push(info) })
  const audio = join_(silence(1), wav('no-pero'), silence(0.8), wav('si2'), silence(0.8), wav('no-donde'), silence(0.8), wav('si3'), silence(1))
  for (let i = 0; i < audio.length; i += 4096) det.push(audio.subarray(i, i + 4096))
  assert.equal(wakes.length, 2)
  assert.ok(wakes.every((w) => w.distance.total <= w.limit.total))
})

test('guarda solo la huella de la voz, en esta compu', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixie-voz-'))
  const file = join(dir, 'palabra-magica.json')
  let cfg = {}
  let changes = 0
  const store = createWakeStore({ file, getConfig: () => cfg, saveConfig: (p) => (cfg = { ...cfg, ...p }), onChange: () => changes++ })
  assert.deepEqual(store.status(), { grabada: false, activa: false, sensibilidad: 'normal' })
  const plain = templates.map((t) => t.map((f) => Array.from(f)))
  assert.ok(validTemplates(plain))
  assert.ok(!validTemplates(plain.slice(0, 2)), 'hacen falta 3 grabaciones')
  assert.ok(!validTemplates([[[1, 2]], ...plain.slice(1)]), 'vectores rotos')
  assert.throws(() => store.save([[['x']]]))
  assert.deepEqual(store.save(plain), { grabada: true, activa: true, sensibilidad: 'normal' })
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(saved.plantillas.length, 3)
  assert.ok(!('audio' in saved))
  assert.equal(store.forWindow().plantillas.length, 3)
  assert.ok(store.forWindow().huella, 'la ventanita sabe si cambió la voz grabada')
  store.setActive(false)
  assert.equal(store.forWindow().plantillas, null, 'apagada no le pasa nada a la ventanita')
  store.setSensitivity('alta')
  store.setSensitivity('cualquiera')
  assert.equal(store.status().sensibilidad, 'alta')
  // Al volver a abrir la app, la encuentra
  const again = createWakeStore({ file, getConfig: () => cfg, saveConfig: () => {} })
  assert.equal(again.status().grabada, true)
  store.forget()
  assert.equal(existsSync(file), false)
  assert.ok(changes >= 4)
})

test('aprende de las veces que la llamaste de verdad (las últimas 6)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixie-voz2-'))
  const file = join(dir, 'palabra-magica.json')
  let cfg = {}
  const store = createWakeStore({ file, getConfig: () => cfg, saveConfig: (p) => (cfg = { ...cfg, ...p }) })
  const plain = templates.map((t) => t.map((f) => Array.from(f)))
  assert.equal(store.learn(plain[0]), false, 'sin grabar tu voz no aprende')
  store.save(plain)
  const before = store.forWindow().huella
  for (let i = 0; i < 8; i++) assert.equal(store.learn(plain[i % 3]), true)
  assert.equal(store.learnedCount(), 6)
  assert.equal(store.forWindow().aprendidas.length, 6)
  assert.notEqual(store.forWindow().huella, before, 'la ventanita se entera de que aprendió')
  assert.equal(store.learn([[1, 2, 3]]), false, 'una huella rota no se guarda')
  const again = createWakeStore({ file, getConfig: () => cfg, saveConfig: () => {} })
  assert.equal(again.learnedCount(), 6)
  store.save(plain)
  assert.equal(store.learnedCount(), 0, 'si grabás tu voz de nuevo, empieza de cero')
})
