import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemory, isTimeBound, ageText, factKey } from '../src/main/memory.js'
import { createInitiative, TIMES } from '../src/main/initiative.js'
import { createMind } from '../src/main/mind.js'
import { runAction } from '../src/main/actions/index.js'

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const memory = () => createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-mem-')), 'memoria.json'))
const base = { inactivoSeg: 0, bloqueada: false, online: true, bateria: null, pantallaCompleta: false, actividad: null, pomodoro: false }
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m) // noviembre de 2026
const kinds = (r) => r.notices.map((n) => n.kind)
const calm = { ...TIMES, pausaCada: Infinity, agua: Infinity, charla: Infinity } // sin pausa, agua ni charla
const ago = (now, days) => new Date(now.getTime() - days * DAY)

test('sabe qué tiene fecha y hace cuánto fue', () => {
  for (const t of ['mañana tengo prueba de química', 'el viernes juego al fútbol', 'la semana que viene me voy de viaje', 'hoy cumple mi primo', 'el 15 de marzo rindo inglés', 'estudiar para la prueba del viernes'])
    assert.ok(isTimeBound(t), t)
  for (const t of ['mi perro se llama Toby', 'me gusta el rock', 'soy hincha de River']) assert.ok(!isTimeBound(t), t)
  const now = at(20, 12)
  assert.equal(ageText(now.toISOString(), now), 'hoy')
  assert.equal(ageText(ago(now, 1).toISOString(), now), 'ayer')
  assert.equal(ageText(ago(now, 3).toISOString(), now), 'hace 3 días')
  assert.equal(ageText(ago(now, 14).toISOString(), now), 'hace 2 semanas')
  assert.equal(ageText(ago(now, 95).toISOString(), now), 'hace 3 meses')
  assert.equal(ageText(ago(now, 400).toISOString(), now), 'hace un año')
})

test('lo nuevo pisa a lo viejo: «mi perro se llama Rocky» reemplaza a «Toby»', async () => {
  assert.equal(factKey('mi perro se llama Toby'), factKey('Mi perro se llama Rocky'))
  assert.equal(factKey('me gusta el rock'), factKey('no me gusta el rock'))
  assert.equal(factKey('estoy en 5to año'), factKey('estoy en sexto año'))
  assert.notEqual(factKey('mi perro se llama Toby'), factKey('mi gata se llama Mora'))
  assert.equal(factKey('mañana tengo prueba'), null)
  const mem = memory()
  const ctx = { memory: mem, log: () => {} }
  await runAction('recordar_dato', { texto: 'mi perro se llama Toby' }, ctx)
  await runAction('recordar_dato', { texto: 'mi gata se llama Mora' }, ctx)
  const r = await runAction('recordar_dato', { texto: 'mi perro se llama Rocky' }, ctx)
  assert.equal(r.text, 'Listo, lo cambio: antes me habías dicho que tu perro se llama Toby. Ahora me guardo que tu perro se llama Rocky.')
  assert.deepEqual(mem.listFacts().map((f) => f.texto), ['mi gata se llama Mora', 'mi perro se llama Rocky'])
})

test('a la IA le cuenta hace cuánto se lo dijiste, y lo que tenía fecha y ya pasó no se lo cuenta', () => {
  const mem = memory()
  const now = at(20, 12)
  mem.addFact('mañana tengo prueba de química', ago(now, 90)) // hace 3 meses: ya pasó
  mem.addFact('mi perro se llama Toby', ago(now, 60))
  mem.addFact('el viernes juego al fútbol', ago(now, 2))
  assert.deepEqual(mem.factsForAI(now), ['mi perro se llama Toby (te lo contó hace 2 meses)', 'el viernes juego al fútbol (te lo contó hace 2 días)'])
  mem.addTodo('estudiar para la prueba del martes')
  mem.data.pendientes[0].creado = ago(now, 40).toISOString()
  assert.deepEqual(mem.todosForAI(now), ['1) estudiar para la prueba del martes (anotado hace un mes)'])
})

test('«¿qué sabés de mí?» dice hace cuánto fue lo que tenía fecha', async () => {
  const mem = memory()
  mem.addFact('mañana tengo prueba de química', ago(new Date(), 90))
  mem.addFact('mi perro se llama Toby')
  const r = await runAction('ver_datos', {}, { memory: mem, log: () => {} })
  assert.match(r.text, /mañana tenés prueba de química \(me lo dijiste hace 3 meses\) y tu perro se llama Toby/)
  const q = await runAction('consultar_memoria', { buscar: 'prueba de química' }, { memory: mem, log: () => {} })
  assert.match(q.text, /\(me lo dijiste hace 3 meses\)/)
})

test('los pendientes viejos: pregunta si siguen, una vez por día y no de nuevo enseguida', () => {
  const mem = memory()
  const now = at(20, 15)
  mem.markDone('resumen', now)
  mem.addTodo('comprar cartuchos')
  mem.addTodo('estudiar para la prueba del viernes')
  mem.addTodo('ordenar el escritorio')
  mem.data.pendientes[0].creado = ago(now, 25).toISOString() // viejo
  mem.data.pendientes[1].creado = ago(now, 8).toISOString() // tenía fecha: a la semana ya se pregunta
  mem.data.pendientes[2].creado = ago(now, 1).toISOString()
  assert.equal(mem.oldTodo(now).texto, 'comprar cartuchos')
  assert.deepEqual(mem.recentTodos(now).map((t) => t.texto), ['estudiar para la prueba del viernes', 'ordenar el escritorio'])
  const ini = createInitiative(calm)
  ini.tick(at(20, 14, 30), base, mem)
  const r = ini.tick(now, base, mem)
  assert.deepEqual(kinds(r), ['pendiente_viejo'])
  assert.match(r.notices[0].text, /^Tenés anotado «comprar cartuchos» desde hace 4 semanas\. ¿Sigue pendiente\?$/)
  assert.deepEqual(r.notices[0].pregunta, { tipo: 'pendiente_viejo', id: 1, texto: 'comprar cartuchos' })
  // Ya preguntó hoy; y ese no se vuelve a preguntar por un mes
  assert.deepEqual(kinds(ini.tick(at(20, 16), base, mem)), [])
  assert.equal(mem.oldTodo(now).texto, 'estudiar para la prueba del viernes')
})

test('«ya lo hice» saca el pendiente viejo, «sigue» lo deja', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixie-mente-'))
  rmSync('/tmp/pixie-pruebas/userData/memoria.json', { force: true })
  const events = []
  const ctx = { getConfig: () => ({}), log: () => {} }
  const mind = createMind({ ctx, sendEvent: (e) => events.push(e), notify: () => {}, log: () => {} })
  const mem = mind.memory
  mem.clearTodos()
  const a = mem.addTodo('comprar cartuchos')
  const b = mem.addTodo('ordenar el escritorio')
  mind.say({ kind: 'pendiente_viejo', text: '¿Sigue pendiente?', pregunta: { tipo: 'pendiente_viejo', id: a.id, texto: a.texto } })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(mind.answerQuestion('¿qué hora es?'), null, 'otra cosa no es la respuesta')
  assert.equal(mind.answerQuestion('ya lo hice').text, '¡Bien ahí! Lo saco de la lista.')
  assert.deepEqual(mem.listTodos().map((t) => t.texto), ['ordenar el escritorio'])
  mind.say({ kind: 'pendiente_viejo', text: '¿Sigue pendiente?', pregunta: { tipo: 'pendiente_viejo', id: b.id, texto: b.texto } })
  await new Promise((r) => setTimeout(r, 10))
  assert.match(mind.answerQuestion('sí, sigue pendiente').text, /dejo «ordenar el escritorio»/)
  assert.ok(mem.listTodos()[0].revisado)
  assert.equal(mind.answerQuestion('borralo'), null, 'ya contestaste')
  mem.clearTodos()
  void dir
})

test('si no le das bola a un aviso, lo dice menos seguido; si le contestás, vuelve a lo normal', () => {
  const mem = memory()
  const now = at(20, 12)
  assert.equal(mem.noticeFactor('agua'), 1)
  mem.noticeSent('agua', now)
  mem.noticeSent('agua', now) // el anterior quedó sin respuesta
  mem.noticeSent('agua', now)
  assert.equal(mem.noticeFactor('agua'), 2)
  mem.noticeSent('agua', now)
  mem.noticeSent('agua', now)
  assert.equal(mem.noticeFactor('agua'), 4)
  mem.noticeAnswered(new Date(now.getTime() + 5 * MIN)) // contestó tarde: no cuenta
  assert.equal(mem.noticeFactor('agua'), 4)
  mem.noticeSent('agua', now)
  mem.noticeAnswered(new Date(now.getTime() + MIN))
  assert.equal(mem.noticeFactor('agua'), 1)
  assert.equal(mem.noticeFactor('pausa'), 1)
  // La pausa activa: con factor 2 espera el doble
  const m2 = memory()
  m2.markDone('resumen', at(20, 9))
  for (let i = 0; i < 3; i++) m2.noticeSent('pausa', at(20, 9))
  const ini = createInitiative({ ...TIMES, agua: Infinity, charla: Infinity })
  ini.tick(at(20, 10), base, m2)
  assert.deepEqual(kinds(ini.tick(at(20, 10, 50), base, m2)), [])
  assert.deepEqual(kinds(ini.tick(at(20, 11, 40), base, m2)), ['pausa'])
  assert.match(ini.tick(at(20, 11, 41), base, m2).notices[0]?.text ?? 'Llevás 100 minutos', /Llevás 100 minutos/)
})

test('a la noche, jugando y con una prueba mañana, te lo recuerda una vez', () => {
  const mem = memory()
  mem.markDone('resumen', at(20, 9))
  mem.addEvent({ texto: 'prueba de química', cuando: at(21, 0), conHora: false })
  const game = { ...base, actividad: { categoria: 'juego', app: 'Minecraft' } }
  const ini = createInitiative(calm)
  ini.tick(at(20, 19, 50), game, mem)
  assert.deepEqual(kinds(ini.tick(at(20, 20, 5), game, mem)).filter((k) => k === 'entrega'), [])
  const r = ini.tick(at(20, 20, 10), game, mem)
  const nudge = r.notices.find((n) => n.kind === 'entrega')
  assert.equal(nudge.text, 'Che, mañana tenés prueba de química. ¿Ya lo tenés listo? Si querés, arrancamos un pomodoro.')
  assert.ok(!ini.tick(at(20, 21), game, mem).notices.some((n) => n.kind === 'entrega'), 'una sola vez')
  // Estudiando no molesta
  const m2 = memory()
  m2.markDone('resumen', at(20, 9))
  m2.addEvent({ texto: 'prueba de química', cuando: at(21, 0), conHora: false })
  const study = { ...base, actividad: { categoria: 'estudio', app: 'Word' } }
  const i2 = createInitiative(calm)
  i2.tick(at(20, 19, 50), study, m2)
  assert.ok(!i2.tick(at(20, 20, 30), study, m2).notices.some((n) => n.kind === 'entrega'))
})

test('cuando volvés, te cuenta los mails que llegaron y lo próximo de hoy', () => {
  const mem = memory()
  mem.markDone('resumen', at(20, 9))
  mem.setName('Lauti')
  mem.addEvent({ texto: 'inglés', cuando: at(20, 18), conHora: true })
  const ini = createInitiative(calm)
  const snap = { ...base, mailsDesde: (since) => (since <= at(20, 15, 5).getTime() ? 2 : 0) }
  ini.tick(at(20, 15), snap, mem)
  ini.tick(at(20, 15, 10), { ...snap, inactivoSeg: 300 }, mem)
  const back = ini.tick(at(20, 15, 40), snap, mem)
  assert.equal(back.notices[0].text, '¡Volviste, Lauti! Mientras no estabas te llegaron 2 mails. A las 18:00 tenés inglés.')
  assert.deepEqual(back.notices[0].suggestions, ['¿tengo mails?'])
})
