import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createJournal, journalContext, topicsOf, whenText } from '../src/main/journal.js'
import { sensitiveTopic, redactSecrets, crisisRisk, CRISIS_TEXT } from '../src/main/sensitive.js'
import { createMemory } from '../src/main/memory.js'
import { runAction } from '../src/main/actions/index.js'
import { dayFromWords } from '../src/main/actions/memory.js'
import { interpretAll } from '../src/main/brain.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const dir = () => mkdtempSync(join(tmpdir(), 'pixie-'))

// Un diario con un reloj de mentira: cada charla se anota «cuando» digas
function diary(start = new Date(2026, 9, 26, 18, 0)) {
  let t = start.getTime()
  const file = join(dir(), 'charlas.jsonl')
  const j = createJournal(file, { now: () => new Date(t) })
  return { j, file, at: (d) => (t = d.getTime()), now: () => new Date(t) }
}

// ── Lo sensible y lo privado ──

test('reconoce los temas sensibles, pero no confunde las cosas de la escuela', () => {
  assert.equal(sensitiveTopic('estoy yendo al psicólogo por la ansiedad'), 'salud mental')
  assert.equal(sensitiveTopic('mis viejos se están separando'), 'familia')
  assert.equal(sensitiveTopic('me gusta una chica de mi curso'), 'pareja')
  assert.equal(sensitiveTopic('en casa no nos alcanza la plata'), 'dinero')
  assert.equal(sensitiveTopic('mañana me operan, tengo una cirugía'), 'salud')
  assert.equal(sensitiveTopic('me gusta la pizza'), null)
  assert.equal(sensitiveTopic('tengo prueba de Política y Ciudadanía'), null, 'una materia no es personal')
  assert.equal(sensitiveTopic('el TP de enfermedades de Biología'), null)
  assert.equal(sensitiveTopic('juego al fútbol los sábados'), null)
})

test('tapa las contraseñas, tarjetas, el DNI y las claves antes de guardar nada', () => {
  assert.equal(redactSecrets('mi contraseña es pepito123'), 'mi contraseña es [dato privado]')
  assert.equal(redactSecrets('la clave del wifi es abc12345'), 'la clave del wifi es [dato privado]')
  assert.equal(redactSecrets('pagá con 4509 9535 6623 3704'), 'pagá con [dato privado]')
  assert.equal(redactSecrets('mi dni es 44.123.456'), 'mi dni es [dato privado]')
  assert.equal(redactSecrets(`usá ${'AIza'}SyA1234567890abcdefghijklmnop`), 'usá [dato privado]') // armada en dos partes para que no parezca una clave real
  assert.equal(redactSecrets('tengo 3 pruebas el 12 de noviembre'), 'tengo 3 pruebas el 12 de noviembre', 'los números comunes quedan')
})

test('si alguien dice que se quiere hacer daño, contesta con cuidado y con a quién llamar', () => {
  assert.equal(crisisRisk('a veces me quiero morir'), true)
  assert.equal(crisisRisk('no quiero seguir viviendo'), true)
  assert.equal(crisisRisk('me muero de risa'), false)
  assert.equal(crisisRisk('estoy muerto de cansancio'), false)
  assert.match(CRISIS_TEXT, /135/)
  assert.match(CRISIS_TEXT, /911/)
})

// ── El diario de charlas ──

test('anota cada charla en la compu y se acuerda aunque se cierre', () => {
  const { j, file } = diary()
  j.record('¿Me ayudás con la prueba de fotosíntesis?', 'Dale, arranquemos por la luz.')
  j.record('mi contraseña es pepito123', 'No hace falta que me la digas.')
  assert.equal(j.count(), 2)
  const lines = readFileSync(file, 'utf8').trim().split('\n')
  assert.equal(lines.length, 2)
  assert.doesNotMatch(lines.join('\n'), /pepito123/, 'la contraseña no queda en el disco')
  const again = createJournal(file)
  assert.equal(again.count(), 2)
  assert.match(again.recent(2)[0].yo, /fotosíntesis/)
  assert.deepEqual(again.recent(2)[0].temas, ['ayudás', 'prueba', 'fotosíntesis'])
})

test('los temas salen tal cual los dijiste, sin las palabras de relleno', () => {
  assert.deepEqual(topicsOf('¿Querés que juguemos al fútbol el sábado?'), ['juguemos', 'fútbol', 'sábado'])
  assert.deepEqual(topicsOf('hola pixie cómo andás'), [])
  assert.deepEqual(topicsOf('los sábados y el sábado'), ['sábados'], 'no repite el mismo tema')
})

test('dice cuándo fue: hoy, ayer, el martes o la fecha', () => {
  const now = new Date(2026, 10, 3, 12, 0) // martes 3 de noviembre
  assert.equal(whenText(new Date(2026, 10, 3, 9, 0), now), 'hoy')
  assert.equal(whenText(new Date(2026, 10, 2, 22, 0), now), 'ayer')
  assert.equal(whenText(new Date(2026, 9, 29, 10, 0), now), 'el jueves')
  assert.equal(whenText(new Date(2026, 9, 3, 10, 0), now), 'el 3 de octubre')
  assert.equal(dayFromWords('ayer', now).getDate(), 2)
  assert.equal(dayFromWords('el lunes', now).getDate(), 2)
  assert.equal(dayFromWords('el martes', now).getDate(), 27, 'el martes pasado, no hoy')
  assert.equal(dayFromWords('cualquiera', now), null)
})

test('busca charlas viejas por tema; las sensibles solo si las pedís', () => {
  const { j, at } = diary()
  j.record('Me voy de viaje a Mendoza en las vacaciones', 'Qué lindo, ¿con quién vas?')
  j.record('estoy yendo al psicólogo por la ansiedad', 'Gracias por contármelo.')
  at(new Date(2026, 9, 28, 18, 0))
  assert.match(j.search('¿qué te conté del viaje a Mendoza?')[0].yo, /Mendoza/)
  assert.equal(j.search('el psicólogo y la ansiedad').length, 0, 'lo sensible no sale solo')
  assert.equal(j.search('el psicólogo y la ansiedad', { includeSensitive: true }).length, 1)
})

test('resume cada día en pocos temas, sin lo sensible y sin el día de hoy', () => {
  const { j, at } = diary(new Date(2026, 9, 30, 18, 0))
  j.record('mañana tengo prueba de química', 'Repasemos estequiometría.')
  j.record('mis viejos se están separando', 'Uh, lo siento mucho.')
  at(new Date(2026, 9, 31, 17, 0))
  j.record('el sábado juego al fútbol', '¡Éxitos!')
  at(new Date(2026, 10, 1, 10, 0))
  j.record('hoy no hago nada', 'Descansá.')
  const days = j.summaries(7)
  assert.equal(days.length, 2, 'el día de hoy no está')
  assert.deepEqual(days[0], { fecha: '2026-10-30', charlas: 2, sensibles: 1, temas: ['prueba', 'química'] })
  assert.deepEqual(days[1].temas, ['sábado', 'juego', 'fútbol'])
})

test('a la IA le pasa lo último que hablaron (aunque haya sido ayer) y lo viejo del tema, sin lo sensible', () => {
  const { j, at } = diary(new Date(2026, 9, 20, 18, 0))
  j.record('Me voy de viaje a Mendoza en las vacaciones', 'Qué lindo.')
  j.record('mi novia me dejó', 'Uh, lo siento.')
  at(new Date(2026, 10, 2, 20, 0))
  j.record('¿me recomendás una peli?', 'Mirá Coco.')
  const now = new Date(2026, 10, 3, 9, 0)
  at(now)
  const ctx = journalContext(j, '¿qué llevo para el viaje a Mendoza?', now)
  assert.match(ctx, /Lo último que hablaron: \[ayer\] le dijo «¿me recomendás una peli\?»/)
  assert.match(ctx, /Antes hablaron de esto: el 20 de octubre te dijo «Me voy de viaje a Mendoza/)
  assert.doesNotMatch(ctx, /novia/, 'lo sensible no entra si no lo trajo')
  assert.match(ctx, /no lo saques vos/)
  assert.match(journalContext(j, 'sigo triste porque mi novia me dejó', now), /mi novia me dejó/, 'si lo trae, sí')
  assert.equal(journalContext(createJournal(join(dir(), 'vacio.jsonl')), 'hola', now), '')
})

test('se puede borrar todo el diario', () => {
  const { j, file } = diary()
  j.record('hola, ¿todo bien?', 'Todo bien.')
  j.forgetAll()
  assert.equal(j.count(), 0)
  assert.ok(existsSync(file))
  assert.equal(createJournal(file).count(), 0)
})

// ── «¿De qué hablamos ayer?» ──

test('«¿de qué hablamos ayer?», «¿qué te conté del viaje?» y «olvidate de nuestras charlas»', async () => {
  const actions = (t) => interpretAll(t).map((i) => [i.action, i.params])
  assert.deepEqual(actions('¿de qué hablamos ayer?'), [['recordar_charla', { dia: 'ayer' }]])
  assert.deepEqual(actions('¿de qué hablamos el martes?'), [['recordar_charla', { dia: 'el martes' }]])
  assert.deepEqual(actions('¿qué te conté del viaje?'), [['recordar_charla', { buscar: 'viaje' }]])
  assert.deepEqual(actions('olvidate de nuestras charlas'), [['olvidar_charlas', {}]])

  const real = Date.now()
  const yesterday = new Date(real - DAY)
  const { j, at } = diary(yesterday)
  const ctx = { journal: j, memory: createMemory(join(dir(), 'memoria.json')), log: () => {} }
  assert.match((await runAction('recordar_charla', { dia: 'ayer' }, { ...ctx, journal: createJournal(join(dir(), 'x.jsonl')) })).text, /Todavía no tengo charlas/)
  j.record('Me voy de viaje a Mendoza en las vacaciones', 'Qué lindo.')
  j.record('mis viejos se están separando', 'Lo siento.')
  at(new Date(real))
  let r = await runAction('recordar_charla', { dia: 'ayer' }, ctx)
  assert.match(r.text, /^Ayer hablamos de viaje, mendoza y vacaciones\. Y de algo más personal que no nombro/)
  assert.doesNotMatch(r.text, /viejos|separando/)
  r = await runAction('recordar_charla', { buscar: 'viaje' }, ctx)
  assert.match(r.text, /^Sí: ayer me dijiste «Me voy de viaje a Mendoza/)
  r = await runAction('recordar_charla', { buscar: 'mis viejos' }, ctx)
  assert.match(r.text, /separando/, 'si lo pedís vos, te lo dice')
  r = await runAction('recordar_charla', { buscar: 'el dentista' }, ctx)
  assert.match(r.text, /No me acuerdo/)
  r = await runAction('olvidar_charlas', {}, ctx)
  assert.match(r.text, /me olvidé de nuestras charlas/)
  assert.equal(j.count(), 0)
})

// ── La memoria de datos ──

test('lo personal se guarda, pero no se lo pasa a la IA ni lo nombra si no lo traés', () => {
  const mem = createMemory(join(dir(), 'memoria.json'))
  const now = new Date(2026, 10, 3, 12, 0)
  mem.addFact('juego al fútbol los sábados', now)
  mem.addFact('voy al psicólogo los jueves por la ansiedad', now)
  mem.addFact('mi pin del banco es 1234', now)
  assert.equal(mem.listFacts().length, 3)
  assert.equal(mem.listFacts()[1].sensible, 'salud mental')
  assert.equal(mem.listFacts()[2].texto, 'mi pin del banco es [dato privado]')
  assert.deepEqual(mem.publicFacts().map((f) => f.texto), ['juego al fútbol los sábados', 'mi pin del banco es [dato privado]'])
  assert.doesNotMatch(mem.factsForAI(now).join(' '), /psicólogo/)
  assert.match(mem.factsForAI(now, 15, 'hoy fui al psicólogo por la ansiedad').join(' '), /psicólogo/, 'si lo traés vos, sí')
})

test('no pregunta «¿cómo te fue?» por lo sensible', () => {
  const mem = createMemory(join(dir(), 'memoria.json'))
  const cuando = new Date(2026, 10, 3, 10, 0)
  mem.addEvent({ texto: 'turno con el psiquiatra', cuando, conHora: true })
  mem.addEvent({ texto: 'partido de fútbol', cuando, conHora: true })
  const due = mem.followUpsDue(new Date(cuando.getTime() + 3 * HOUR))
  assert.deepEqual(due.map((e) => e.texto), ['partido de fútbol'])
})

test('los eventos que pasaron quedan un tiempo (para «¿qué hice el martes?»)', () => {
  const file = join(dir(), 'memoria.json')
  const mem = createMemory(file)
  mem.addEvent({ texto: 'prueba de historia', cuando: new Date(Date.now() - 20 * DAY), conHora: false })
  assert.equal(createMemory(file).eventsBetween(new Date(Date.now() - 30 * DAY), new Date()).length, 1)
})

// ── Recordatorios ──

test('«recordame… que tengo…» se agenda (antes lo tomaba como una pregunta)', () => {
  const one = (t) => {
    const r = interpretAll(t)
    assert.equal(r.length, 1, t)
    return r[0]
  }
  let r = one('recordame mañana a las 8 que tengo que llevar el TP')
  assert.equal(r.action, 'agendar')
  assert.equal(r.params.texto, 'llevar el tp')
  assert.equal(r.params.conHora, true)
  assert.equal(new Date(r.params.cuando).getHours(), 8)
  r = one('avisame a las 18 que tengo fútbol')
  assert.equal(r.action, 'agendar')
  assert.equal(new Date(r.params.cuando).getHours(), 18)
  r = one('haceme acordar el viernes de la prueba de química')
  assert.equal(r.action, 'agendar')
  assert.equal(new Date(r.params.cuando).getDay(), 5)
  assert.equal(one('¿qué tengo mañana?').action, 'ver_agenda', 'la pregunta sigue siendo pregunta')
})

test('los pedidos no son temas, y las preguntas sobre las charlas no se confunden con la charla', () => {
  assert.deepEqual(topicsOf('poné un timer de 5 segundos'), [])
  assert.deepEqual(topicsOf('recordame mañana a las 8 que tengo que llevar el TP'), ['llevar'])
  assert.deepEqual(topicsOf('¿de qué hablamos hoy?'), [])
  const { j } = diary()
  j.record('Me voy de viaje a Mendoza en las vacaciones', 'Qué lindo.')
  j.record('¿qué te conté del viaje?', 'Sí: hoy me dijiste…')
  const found = j.search('viaje')
  assert.equal(found.length, 1)
  assert.match(found[0].yo, /Mendoza/, 'encuentra lo que contaste, no la pregunta')
})

test('«me voy» bloquea la compu solo si te vas de la compu', () => {
  const action = (t) => interpretAll(t)?.[0]?.action ?? null
  assert.equal(action('me voy a comer'), 'bloquear_pc')
  assert.equal(action('bueno, me voy'), 'bloquear_pc')
  assert.equal(action('ya vuelvo'), 'bloquear_pc')
  assert.notEqual(action('me voy de viaje a Mendoza en las vacaciones de invierno'), 'bloquear_pc')
  assert.notEqual(action('me voy a vivir a Córdoba'), 'bloquear_pc')
})

test('al volver retoma la última charla de verdad (no un pedido, ni algo personal o privado)', () => {
  const { j, at, now } = diary()
  j.record('me voy de viaje a Mendoza en las vacaciones', 'Qué lindo.')
  j.record('abrí tus ajustes', 'Listo.', { pedido: true })
  j.record('mi contraseña de instagram es pepito123', 'No hace falta que me la digas.')
  j.record('sí', 'Dale.')
  assert.equal(j.recent(2)[0].sensible, 'privado', 'lo que tenía una contraseña cuenta como personal')
  assert.match(j.lastTalk().yo, /Mendoza/)
  at(new Date(now().getTime() + 3 * HOUR))
  assert.equal(j.lastTalk(), null, 'si fue hace mucho, no la retoma')
})
