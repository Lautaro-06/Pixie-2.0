import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInitiative, TIMES } from '../src/main/initiative.js'
import { createMemory } from '../src/main/memory.js'

const MIN = 60 * 1000
const memory = () => createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-')), 'memoria.json'))
const base = { inactivoSeg: 0, bloqueada: false, online: true, bateria: null, pantallaCompleta: false, actividad: null, pomodoro: false }
const at = (h, m = 0) => new Date(2026, 8, 30, h, m)
const kinds = (r) => r.notices.map((n) => n.kind)
const noBreaks = { ...TIMES, pausaCada: Infinity, agua: Infinity } // para probar horas enteras sin la pausa activa ni el agua
const onlyFollowUps = { ...noBreaks, charla: Infinity }

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

test('pregunta cómo te fue, una sola vez y cuando ya pasó', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  mem.addEvent({ texto: 'la prueba de historia', cuando: at(10), conHora: true })
  const ini = createInitiative(onlyFollowUps)
  ini.tick(at(9, 30), base, mem)
  ini.tick(at(9, 45), base, mem) // aviso de 15 minutos antes
  ini.tick(at(10), base, mem) // aviso de la hora
  assert.deepEqual(kinds(ini.tick(at(11, 59), base, mem)), [])
  const r = ini.tick(at(12), base, mem)
  assert.deepEqual(r.notices.map((n) => n.text), ['Hoy tenías la prueba de historia. ¿Cómo te fue?'])
  assert.deepEqual(r.notices[0].pregunta, { tipo: 'como_fue', evento: 'la prueba de historia' })
  assert.deepEqual(kinds(ini.tick(at(12, 1), base, mem)), [])
})

test('lo de todo el día lo pregunta a la noche, y si no estabas, al otro día', () => {
  const mem = memory()
  mem.markDone('resumen', at(9))
  mem.addEvent({ texto: 'el cumple de Sofi', cuando: at(0), conHora: false })
  const ini = createInitiative(onlyFollowUps)
  ini.tick(at(18), base, mem)
  assert.deepEqual(kinds(ini.tick(at(18, 59), base, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(19), { ...base, pantallaCompleta: true }, mem)), []) // espera
  assert.deepEqual(kinds(ini.tick(at(19, 1), { ...base, inactivoSeg: 600 }, mem)), []) // no está

  const tomorrow = new Date(2026, 9, 1, 9)
  mem.markDone('resumen', tomorrow)
  assert.deepEqual(ini.tick(tomorrow, base, mem).notices.map((n) => n.text), ['¡Volviste!']) // de a una cosa por vez
  const next = new Date(tomorrow.getTime() + 5000)
  assert.deepEqual(ini.tick(next, base, mem).notices.map((n) => n.text), ['Ayer tenías el cumple de Sofi. ¿Cómo te fue?'])
})

test('pasadas 20 horas ya no pregunta', () => {
  const mem = memory()
  mem.addEvent({ texto: 'dentista', cuando: at(10), conHora: true })
  const ini = createInitiative(onlyFollowUps)
  const later = new Date(2026, 9, 1, 9)
  mem.markDone('resumen', later)
  assert.deepEqual(kinds(ini.tick(later, base, mem)), [])
})

test('si hace rato que no hablan, charla por su cuenta (pocas veces y sin repetir)', () => {
  const mem = memory()
  mem.markDone('resumen', at(10))
  const ini = createInitiative(noBreaks, () => 0)
  ini.tick(at(10), base, mem)
  assert.deepEqual(kinds(ini.tick(at(11, 29), base, mem)), [])
  const first = ini.tick(at(11, 30), base, mem).notices
  assert.deepEqual(first.map((n) => n.kind), ['charla'])
  assert.ok(first[0].text.includes('Pong'))
  assert.deepEqual(first[0].suggestions, ['¡dale, juguemos!', 'ahora no'])
  assert.deepEqual(kinds(ini.tick(at(12), base, mem)), []) // no insiste enseguida
  const second = ini.tick(at(13), base, mem).notices
  assert.equal(second[0].kind, 'charla')
  assert.ok(!second[0].text.includes('Pong')) // no repite lo mismo
  ini.tick(at(14, 30), base, mem)
  ini.tick(at(16), base, mem)
  assert.deepEqual(kinds(ini.tick(at(17, 30), base, mem)), []) // hasta 4 por día
})

test('no charla si le hablaste hace poco, si estás estudiando o de noche', () => {
  const mem = memory()
  mem.markDone('resumen', at(10))
  const ini = createInitiative(noBreaks)
  ini.tick(at(10), base, mem)
  mem.setMood({ ultimoContacto: at(11).getTime() })
  assert.deepEqual(kinds(ini.tick(at(11, 30), base, mem)), [])
  const studying = { ...base, actividad: { categoria: 'estudio', app: 'Word' } }
  assert.deepEqual(kinds(ini.tick(at(13), studying, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(13), { ...base, pomodoro: true }, mem)), [])

  const night = memory()
  const late = new Date(2026, 8, 30, 22, 30)
  night.markDone('resumen', late)
  const ini2 = createInitiative(noBreaks)
  ini2.tick(new Date(2026, 8, 30, 20), base, night)
  assert.deepEqual(kinds(ini2.tick(late, base, night)), [])
})

test('si tenés pendientes, a veces te los recuerda', () => {
  const mem = memory()
  mem.markDone('resumen', at(10))
  mem.addTodo('comprar cartuchos')
  const ini = createInitiative(noBreaks, () => 0.99)
  ini.tick(at(10), base, mem)
  const r = ini.tick(at(11, 30), base, mem)
  assert.equal(r.notices[0].text, 'Te quedó pendiente «comprar cartuchos». ¿Le damos ahora?')
})

test('en una reunión o llamada se queda callado (salvo recordatorios)', () => {
  const mem = memory()
  const ini = createInitiative()
  assert.deepEqual(kinds(ini.tick(at(9), { ...base, enReunion: true }, mem)), []) // el resumen espera
  mem.addEvent({ texto: 'dentista', cuando: at(10), conHora: true })
  assert.deepEqual(kinds(ini.tick(at(9, 45), { ...base, enReunion: true }, mem)), ['recordatorio'])
  assert.deepEqual(kinds(ini.tick(at(9, 50), base, mem)), ['resumen'])
})

test('si hace dos horas que no anotás agua, te lo recuerda (y no insiste)', () => {
  const mem = memory()
  mem.markDone('resumen', at(10))
  const ini = createInitiative({ ...TIMES, pausaCada: Infinity, charla: Infinity })
  ini.tick(at(10), base, mem)
  mem.addWater(at(10, 30))
  assert.deepEqual(kinds(ini.tick(at(12, 29), base, mem)), [])
  const r = ini.tick(at(12, 30), base, mem)
  assert.deepEqual(r.notices.map((n) => n.text), ['¿Tomaste agua? Hoy van 1 vaso.'])
  assert.deepEqual(r.notices[0].suggestions, ['tomé agua', 'ahora no'])
  assert.deepEqual(kinds(ini.tick(at(13), base, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(15), { ...base, salud: false }, mem)), []) // se puede apagar
})
