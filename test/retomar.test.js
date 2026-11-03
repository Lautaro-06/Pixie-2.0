// Lo que Pixie retoma después de actualizarse o reiniciarse: el Pomodoro, los timers y la charla con la IA
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPlan } from '../src/main/study.js'
import { createPomodoro } from '../src/main/pomodoro.js'
import { runAction } from '../src/main/actions/index.js'
import { exportTimers, restoreTimers, timersState } from '../src/main/actions/timers.js'
import { createAI } from '../src/main/ai.js'
import { createMemory } from '../src/main/memory.js'

const MIN = 60 * 1000

// Un reloj de mentira (el mismo de las pruebas del Pomodoro)
function fakeClock(start = 0) {
  let t = start
  let id = 0
  const q = new Map()
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      q.set(++id, { at: t + ms, fn })
      return id
    },
    clearTimer: (h) => q.delete(h),
    set: (ms) => (t = ms),
    advance(ms) {
      const end = t + ms
      for (;;) {
        const next = [...q.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > end) break
        q.delete(next[0])
        t = next[1].at
        next[1].fn()
      }
      t = end
    }
  }
}
const pomodoro = (clock) => {
  const events = []
  const p = createPomodoro({ now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, on: (e, st) => events.push([e, st]) })
  return { p, events }
}

test('el Pomodoro sigue donde estaba después de actualizarse (el tiempo siguió corriendo)', () => {
  const clock = fakeClock()
  const before = pomodoro(clock)
  before.p.start(buildPlan({ minutos: 60, materia: 'historia' }))
  clock.advance(10 * MIN)
  const snap = JSON.parse(JSON.stringify(before.p.snapshot())) // como queda en estado.json
  const savedAt = clock.now()

  // Pixie se cierra, se actualiza y vuelve 2 minutos después
  clock.advance(2 * MIN)
  const after = pomodoro(clock)
  const r = after.p.restore(snap, { savedAt })
  assert.equal(r.sigue.fase, 'estudio')
  assert.equal(r.sigue.bloque, 1)
  assert.equal(r.sigue.restanteMs, 13 * MIN, 'los 2 minutos que estuvo cerrada también cuentan')
  assert.equal(r.sigue.materia, 'historia')
  assert.equal(after.p.activo(), true)
  // Y sigue funcionando: avisa los últimos 2 minutos y pasa al descanso
  clock.advance(13 * MIN)
  assert.deepEqual(after.events.map(([e]) => e).filter((e) => e !== 'cambio'), ['ultimos2', 'descanso'])
})

test('si mientras estaba cerrada terminó un bloque, sigue en el que corresponde', () => {
  const clock = fakeClock()
  const before = pomodoro(clock)
  before.p.start(buildPlan({ minutos: 60 }))
  clock.advance(20 * MIN)
  const snap = before.p.snapshot()
  const savedAt = clock.now()
  clock.advance(8 * MIN) // terminó el bloque 1 (a los 25) y va 3 minutos del descanso
  const after = pomodoro(clock)
  const r = after.p.restore(snap, { savedAt })
  assert.equal(r.sigue.fase, 'descanso')
  assert.equal(r.sigue.restanteMs, 2 * MIN)
  assert.equal(r.sigue.ciclos, 1, 'el bloque que terminó cuenta como ciclo')
})

test('si estuvo cerrada mucho tiempo, la sesión termina donde había quedado', () => {
  const clock = fakeClock()
  const before = pomodoro(clock)
  before.p.start(buildPlan({ minutos: 60 }))
  clock.advance(10 * MIN)
  const snap = before.p.snapshot()
  const savedAt = clock.now()
  clock.advance(3 * 60 * MIN) // la compu se apagó 3 horas
  const after = pomodoro(clock)
  const r = after.p.restore(snap, { savedAt })
  assert.equal(r.terminado.completo, false)
  assert.equal(r.terminado.estudiadoMin, 10, 'cuenta solo lo que estudiaste antes de cerrarse')
  assert.equal(after.p.activo(), false)
})

test('un Pomodoro en pausa vuelve en pausa, con el mismo tiempo', () => {
  const clock = fakeClock()
  const before = pomodoro(clock)
  before.p.start(buildPlan({ minutos: 60 }))
  clock.advance(5 * MIN)
  before.p.pause()
  const snap = before.p.snapshot()
  const savedAt = clock.now()
  clock.advance(60 * MIN)
  const after = pomodoro(clock)
  const r = after.p.restore(snap, { savedAt })
  assert.equal(r.sigue.pausado, true)
  assert.equal(r.sigue.restanteMs, 20 * MIN)
  assert.equal(after.p.restore(snap, { savedAt }), null, 'no pisa una sesión que ya está andando')
  assert.equal(after.p.restore(null), null)
})

test('los timers vuelven después de actualizarse; los que se cumplieron mientras tanto suenan enseguida', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 })
  const alarms = []
  const phone = []
  const ctx = { log: () => {}, emit: (e) => e.type === 'alarm' && alarms.push(e.text), notify: () => {}, phoneNotify: (text) => phone.push(text) }
  try {
    await runAction('crear_timer', { segundos: 600, etiqueta: 'fideos' }, ctx)
    await runAction('crear_timer', { segundos: 60, etiqueta: 'sacar la ropa' }, ctx)
    await runAction('crear_timer', { segundos: 300 }, ctx)
    const saved = JSON.parse(JSON.stringify(exportTimers()))
    assert.equal(saved.length, 3)
    await runAction('cancelar_timers', {}, ctx) // Pixie se cierra

    // Vuelve 2 minutos después: el de 1 minuto ya se cumplió
    const r = restoreTimers(saved, ctx, Date.now() + 2 * MIN)
    assert.deepEqual(r.vencidos, [{ etiqueta: 'sacar la ropa' }])
    assert.deepEqual(
      r.siguen.map((x) => [x.etiqueta, x.restanteMs]),
      [
        ['fideos', 8 * MIN],
        [null, 3 * MIN]
      ]
    )
    assert.equal(timersState().length, 3)
    t.mock.timers.tick(2000)
    assert.deepEqual(alarms, ['¡Tiempo! Te aviso: sacar la ropa. (se cumplió mientras me reiniciaba)'])
    assert.deepEqual(phone, alarms, 'también te llega al celular')
    // Uno que venció hace mucho ya no suena
    assert.deepEqual(restoreTimers([{ etiqueta: 'viejo', endsAt: Date.now() - 2 * 60 * MIN, totalMs: MIN, paused: null }], ctx), { siguen: [], vencidos: [] })
  } finally {
    await runAction('cancelar_timers', {}, ctx)
  }
})

test('un timer en pausa vuelve en pausa', async () => {
  const ctx = { log: () => {}, emit: () => {}, notify: () => {} }
  try {
    const r = restoreTimers([{ etiqueta: 'horno', endsAt: 0, totalMs: 10 * MIN, paused: 4 * MIN }], ctx)
    assert.deepEqual(r.siguen, [{ etiqueta: 'horno', restanteMs: 4 * MIN, pausado: true }])
    assert.equal(timersState()[0].pausado, true)
    assert.equal(timersState()[0].restanteMs, 4 * MIN)
  } finally {
    await runAction('cancelar_timers', {}, ctx)
  }
})

test('la charla con la IA sigue después de reiniciarse', async () => {
  const calls = []
  const script = [
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Te recomiendo «Coco».' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Es de Pixar, de 2017.' }] }
  ]
  const factory = () => ({ beta: { messages: { create: async (p) => (calls.push(structuredClone(p)), script.shift()) } } })
  const ctx = { memory: createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-')), 'memoria.json')), log: () => {}, emit: () => {}, notify: () => {} }
  const make = () => createAI({ getConfig: () => ({ claveIA: 'sk-prueba' }), ctx, clientFactory: factory })
  const first = make()
  assert.equal(first.saveState(), null, 'sin charla no guarda nada')
  await first.chat('recomendame una peli', '')
  const st = JSON.parse(JSON.stringify(first.saveState()))

  const second = make() // después de actualizarse
  second.loadState(st)
  await second.chat('¿de qué año es?', '')
  const msgs = calls[1].messages
  assert.equal(msgs.length, 3, 'manda la charla de antes')
  assert.match(JSON.stringify(msgs[0]), /recomendame una peli/)
  assert.match(JSON.stringify(msgs[1]), /Coco/)
  second.loadState({ messages: 'cualquiera' }) // un estado roto no la rompe
})
