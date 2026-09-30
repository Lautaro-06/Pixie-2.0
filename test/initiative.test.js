import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInitiative } from '../src/main/initiative.js'
import { createMemory } from '../src/main/memory.js'

const MIN = 60 * 1000
const memory = () => createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-')), 'memoria.json'))
const base = { inactivoSeg: 0, bloqueada: false, online: true, bateria: null, pantallaCompleta: false, actividad: null, pomodoro: false }
const at = (h, m = 0) => new Date(2026, 8, 30, h, m)
const kinds = (r) => r.notices.map((n) => n.kind)

test('saluda con el resumen la primera vez del día, una sola vez', () => {
  const mem = memory()
  const ini = createInitiative()
  assert.deepEqual(kinds(ini.tick(at(9), base, mem)), ['resumen'])
  assert.deepEqual(kinds(ini.tick(at(9, 1), base, mem)), [])
})

test('avisa de los recordatorios aunque estés en pantalla completa', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  mem.addEvent({ texto: 'dentista', cuando: at(17), conHora: true })
  const ini = createInitiative()
  const r = ini.tick(at(16, 46), { ...base, pantallaCompleta: true }, mem)
  assert.deepEqual(r.notices.map((n) => n.text), ['En 15 minutos: dentista.'])
})

test('propone una pausa después de 50 minutos seguidos', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  const ini = createInitiative()
  ini.tick(at(10), base, mem)
  assert.deepEqual(kinds(ini.tick(at(10, 49), base, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(10, 50), base, mem)), ['pausa'])
})

test('se da cuenta de que te fuiste y te saluda al volver', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  mem.setName('Lauti')
  const ini = createInitiative()
  ini.tick(at(10), base, mem)
  assert.equal(ini.tick(at(10, 10), { ...base, inactivoSeg: 300 }, mem).presence, 'ausente')
  const back = ini.tick(at(10, 30), base, mem)
  assert.equal(back.presence, 'volvio')
  assert.deepEqual(back.notices.map((n) => n.text), ['¡Volviste, Lauti!'])
})

test('avisa si pasás mucho tiempo en videos, y enseguida si hay un Pomodoro', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  const yt = { ...base, actividad: { categoria: 'video', app: 'YouTube' } }
  const ini = createInitiative()
  ini.tick(at(15), yt, mem)
  assert.deepEqual(kinds(ini.tick(at(15, 39), yt, mem)), [])
  assert.deepEqual(ini.tick(at(15, 40), yt, mem).notices.map((n) => n.text), ['Llevás 40 minutos en YouTube. ¿Volvemos a lo tuyo?'])
  assert.deepEqual(kinds(ini.tick(at(15, 45), yt, mem)), []) // no insiste

  const ini2 = createInitiative()
  const r = ini2.tick(at(16), { ...yt, pomodoro: true }, mem)
  assert.equal(r.notices[0].text, '¡Ey! Estamos en pleno Pomodoro y te veo en YouTube.')
})

test('no molesta en pantalla completa ni en modo no molestar', () => {
  const mem = memory()
  const ini = createInitiative()
  assert.deepEqual(kinds(ini.tick(at(9), { ...base, pantallaCompleta: true }, mem)), []) // el resumen espera
  assert.deepEqual(kinds(ini.tick(at(9, 5), { ...base, silencioHasta: at(10).getTime() }, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(10, 1), base, mem)), ['resumen'])
})

test('batería baja e internet', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  const ini = createInitiative()
  assert.deepEqual(kinds(ini.tick(at(11), { ...base, bateria: { nivel: 19, cargando: false } }, mem)), ['bateria'])
  assert.deepEqual(kinds(ini.tick(at(11, 1), { ...base, bateria: { nivel: 18, cargando: false } }, mem)), [])
  const low = ini.tick(at(11, 30), { ...base, bateria: { nivel: 9, cargando: false }, pantallaCompleta: true }, mem)
  assert.deepEqual(kinds(low), ['bateria']) // muy baja: avisa igual

  const ini2 = createInitiative()
  ini2.tick(at(12), { ...base, online: false }, mem)
  assert.deepEqual(kinds(ini2.tick(new Date(at(12).getTime() + 31000), { ...base, online: false }, mem)), ['internet'])
  assert.deepEqual(ini2.tick(at(12, 2), base, mem).notices.map((n) => n.text), ['¡Volvió internet!'])
})

test('a la madrugada sugiere ir a dormir, una vez', () => {
  const mem = memory()
  const ini = createInitiative()
  const night = new Date(2026, 9, 1, 1, 30)
  mem.markDone('resumen', night)
  assert.deepEqual(kinds(ini.tick(night, base, mem)), ['tarde'])
  assert.deepEqual(kinds(ini.tick(new Date(2026, 9, 1, 1, 40), base, mem)), [])
})
