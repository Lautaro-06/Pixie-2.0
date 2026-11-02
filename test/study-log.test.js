import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createStudyLog,
  streakDays,
  daySummary,
  endSummaryText,
  statsText,
  parseSyllabus,
  topicSeen,
  trackerView,
  dayStatus,
  adherenceOf
} from '../src/main/study-log.js'
import { focusKind, topicsFromTitles } from '../src/main/study.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'
import { dodgeTarget, createDodger } from '../src/main/dodge.js'
import { createInitiative } from '../src/main/initiative.js'
import { createMemory } from '../src/main/memory.js'

const at = (d, h = 17, m = 0) => new Date(2026, 10, d, h, m) // noviembre de 2026 (el 2 es lunes)
const session = (d, extra = {}) => ({
  inicio: at(d).toISOString(),
  fin: at(d, 18).toISOString(),
  materia: 'Biología',
  estudiadoMin: 50,
  focoMin: 45,
  distraidoMin: 5,
  planeadoMin: 50,
  ciclos: 2,
  ciclosPlaneados: 2,
  adherencia: 90,
  temas: [],
  ...extra
})

// ── La racha y los días ──

test('la racha cuenta los días seguidos estudiando (hoy, o hasta ayer si hoy todavía no)', () => {
  const list = [session(1), session(2), session(3), session(5)]
  assert.equal(streakDays(list, at(5, 20)), 1, 'el 4 se cortó')
  assert.equal(streakDays(list, at(4, 20)), 3, 'hoy (4) todavía no, cuenta hasta ayer')
  assert.equal(streakDays(list, at(6, 20)), 1, 'el 6 todavía puede estudiar: sigue la del 5')
  assert.equal(streakDays(list, at(7, 20)), 0)
  // Un día con 10 minutos y ningún ciclo no cuenta
  assert.equal(streakDays([session(1), session(2, { estudiadoMin: 10, ciclos: 0 })], at(2, 20)), 1, 'el 2 no cuenta: sigue la del 1')
  assert.equal(streakDays([session(2, { estudiadoMin: 10, ciclos: 0 })], at(2, 20)), 0)
  // Por materia
  assert.equal(streakDays([session(1), session(2, { materia: 'Química' })], at(2, 20), 'biología'), 1)
})

test('cuánto estudiaste un día, sumando las sesiones', () => {
  const d = daySummary([session(2, { temas: ['Mitosis'] }), session(2, { estudiadoMin: 25, ciclos: 1, temas: ['Mitosis', 'ADN'] }), session(3)], at(2))
  assert.deepEqual(d, { minutos: 75, ciclos: 3, sesiones: 2, foco: 90, planeado: 100, temas: ['Mitosis', 'ADN'] })
  assert.equal(adherenceOf([session(2), session(3, { focoMin: 25 })]), 70)
  assert.equal(adherenceOf([]), null)
  assert.equal(dayStatus(100, 60).texto, '¡Imparable!')
  assert.equal(dayStatus(60, 60).texto, 'Bien hecho')
  assert.equal(dayStatus(10, 60).texto, 'Dale que podés')
  assert.equal(dayStatus(0, 60), null)
})

// ── Lo que dice al terminar ──

test('al terminar: los ciclos de hoy, el tiempo, la racha, la adherencia y los temas', () => {
  const text = endSummaryText({
    sesion: { completo: true, estudiadoMin: 100, planeadoMin: 100, focoMin: 92, adherencia: 92, temas: ['Fotosíntesis', 'Respiración celular'] },
    hoy: { minutos: 100, ciclos: 4 },
    racha: 3
  })
  assert.equal(text, '¡Terminaste el Pomodoro! Hoy hiciste 4 ciclos: 1 hora y 40 minutos de estudio. Llevás 3 días seguidos estudiando. ¡No cortes la racha! Adherencia: 92%. Vimos: Fotosíntesis y Respiración celular.')
  // Terminado a mano, con poca adherencia: explica por qué
  const low = endSummaryText({ sesion: { completo: false, estudiadoMin: 30, planeadoMin: 100, focoMin: 25, adherencia: 25, temas: [] }, hoy: { minutos: 30, ciclos: 1 }, racha: 1 })
  assert.match(low, /^¡Listo por hoy! Hoy hiciste 1 ciclo: 30 minutos de estudio\. Arrancaste una racha/)
  assert.match(low, /Adherencia: 25% \(de 1 hora y 40 minutos que planeaste, estudiaste 25 minutos con foco\)\./)
  // Con temario
  const temario = { materia: 'Biología', temas: [{ texto: 'Célula', visto: true }, { texto: 'ADN', visto: false }, { texto: 'Mitosis', visto: false }, { texto: 'Meiosis', visto: false }, { texto: 'Genética', visto: false }] }
  assert.match(endSummaryText({ sesion: { completo: true, estudiadoMin: 25, planeadoMin: 25, focoMin: 25, adherencia: 100 }, hoy: { minutos: 25, ciclos: 1 }, racha: 1, temario }), /Del temario de Biología llevás 1 de 5 temas; te faltan ADN, Mitosis, Meiosis y 1 más\.$/)
  temario.temas.forEach((t) => (t.visto = true))
  assert.match(endSummaryText({ sesion: { completo: true, estudiadoMin: 25, planeadoMin: 25, focoMin: 25, adherencia: 100 }, hoy: { minutos: 25, ciclos: 1 }, racha: 1, temario }), /¡Ya viste todo el temario de Biología!$/)
})

test('«¿cuánto estudié?»: hoy, la semana, el mes y la racha', () => {
  const list = [session(2), session(3, { materia: 'Química', estudiadoMin: 120, focoMin: 120, planeadoMin: 120, ciclos: 4 }), session(4)]
  assert.equal(statsText(list, 'hoy', at(4, 20)), 'Hoy estudiaste 50 minutos en 2 ciclos. Llevás 3 días seguidos.')
  assert.equal(statsText(list, 'semana', at(4, 20)), 'Esta semana estudiaste 3 horas y 40 minutos en 3 días; lo que más, Química (2 horas). Adherencia: 95%. Llevás 3 días seguidos.')
  assert.equal(statsText(list, 'racha', at(4, 20)), 'Llevás 3 días seguidos estudiando.')
  assert.match(statsText([], 'hoy', at(4)), /^Hoy todavía no estudiaste/)
  assert.match(statsText([], 'racha', at(4)), /^Todavía no tenés una racha/)
})

// ── El temario ──

test('el temario: un tema por renglón, sin viñetas ni números, y sin el contenido', () => {
  const temas = parseSyllabus(`Unidad 1: La célula
  1. Fotosíntesis
  - Respiración celular
  • Mitosis y meiosis
  a) ADN
  fotosíntesis
  Este renglón es un párrafo larguísimo con el contenido de la clase que no es un tema y que Pixie no tiene que guardar porque sobrecargaría todo.

  Genética; Herencia`)
  assert.deepEqual(temas, ['La célula', 'Fotosíntesis', 'Respiración celular', 'Mitosis y meiosis', 'ADN', 'Genética', 'Herencia'])
  assert.equal(parseSyllabus(Array.from({ length: 100 }, (_, i) => `Asunto ${i}`).join('\n')).length, 60, 'como mucho 60')
  assert.deepEqual(parseSyllabus('Tema 3: Fotosíntesis\nUnidad 2 - Célula'), ['Fotosíntesis', 'Célula'])
})

test('tacha un tema cuando aparece en lo que estudiaste (la misma palabra o su plural)', () => {
  const titles = ['Respiración celular - Wikipedia', 'fotosíntesis - Buscar con Google', 'Ecuaciones cuadráticas: ejercicios', 'Las raíces de un polinomio']
  assert.equal(topicSeen('Fotosíntesis', titles), true)
  assert.equal(topicSeen('Respiración celular', titles), true)
  assert.equal(topicSeen('Ecuación cuadrática', titles), true)
  assert.equal(topicSeen('Raíz de un polinomio', titles), true)
  assert.equal(topicSeen('Célula', titles), false, '«celular» no es «célula»')
  assert.equal(topicSeen('Mitosis y meiosis', titles), false)
  assert.equal(topicSeen('', titles), false)
})

test('el registro guarda las sesiones y el temario en estudio.json', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pixie-estudio-')), 'estudio.json')
  let now = at(2, 20)
  const log = createStudyLog(file, { now: () => now })
  assert.equal(log.record(session(2, { estudiadoMin: 0 })), null, 'menos de un minuto no se anota')
  log.record(session(1))
  log.record(session(2, { temas: ['Fotosíntesis'], materia: 'x'.repeat(80) }))
  assert.equal(log.sessions().length, 2)
  assert.equal(log.sessions()[1].materia.length, 40)
  assert.deepEqual(log.today(), { minutos: 50, ciclos: 2, sesiones: 1, foco: 45, planeado: 50, temas: ['Fotosíntesis'] })
  assert.equal(log.streak(), 2)
  // El temario
  assert.equal(log.setTemario('Biología', '\n\n'), null)
  const t = log.setTemario('Biología', 'Fotosíntesis\nRespiración celular\nMitosis')
  assert.equal(t.temas.length, 3)
  assert.deepEqual(log.markSeen(['Respiración celular - Wikipedia']), ['Respiración celular'])
  assert.deepEqual(log.markSeen(['Respiración celular - Wikipedia']), [], 'ya estaba')
  log.markTopic(2, true)
  assert.deepEqual(log.temario().temas.map((x) => [x.visto, x.auto]), [[false, false], [true, true], [true, false]])
  // Se vuelve a leer del archivo
  const again = createStudyLog(file, { now: () => now })
  assert.equal(again.sessions().length, 2)
  assert.equal(again.temario().materia, 'Biología')
  again.clearTemario()
  assert.equal(again.temario(), null)
  again.clear()
  assert.equal(createStudyLog(file).sessions().length, 0)
  void now
})

// ── Ajustes → Mi estudio ──

test('la vista del seguimiento: la semana de lunes a domingo, el mes por materia y cada materia', () => {
  const list = [session(1, { materia: 'Química' }), session(2, { temas: ['Fotosíntesis'] }), session(3, { estudiadoMin: 100, ciclos: 4, focoMin: 95, planeadoMin: 100 }), session(1, { inicio: new Date(2026, 9, 28, 17).toISOString() })]
  const v = trackerView(list, { now: at(4, 20), goal: 60 })
  assert.deepEqual(v.semana.map((d) => d.dia), ['Lun 2', 'Mar 3', 'Mié 4', 'Jue 5', 'Vie 6', 'Sáb 7', 'Dom 8'])
  assert.deepEqual(v.semana.map((d) => d.minutos), [50, 100, 0, 0, 0, 0, 0])
  assert.deepEqual(v.semana.map((d) => d.estado?.texto ?? null), ['Dale que podés', '¡Imparable!', null, null, null, null, null])
  assert.equal(v.semana[2].hoy, true)
  assert.equal(v.semana[3].futuro, true)
  assert.deepEqual(v.semana[0].temas, ['Fotosíntesis'])
  assert.equal(v.resumen.racha, 3)
  assert.equal(v.resumen.semanaMin, 150)
  assert.equal(v.mes.titulo, 'noviembre 2026')
  assert.equal(v.mes.dias, 30)
  assert.equal(v.mes.hoy, 4)
  assert.deepEqual(v.mes.filas.map((f) => [f.materia, f.dias]), [['Biología', { 2: 50, 3: 100 }], ['Química', { 1: 50 }]])
  assert.equal(v.mesAnterior.titulo, 'octubre 2026')
  assert.equal(v.mesAnterior.filas[0].dias[28], 50)
  assert.deepEqual(v.materias.map((m) => [m.materia, m.racha, m.semanaMin]), [['Biología', 2, 150], ['Química', 0, 0]])
})

// ── Lo que es una distracción ──

test('a criterio de Pixie: la música no distrae; un video de una clase tampoco; las redes y los juegos sí', () => {
  const k = (titulo, proceso = 'chrome', extra = {}) => focusKind({ titulo, proceso, ...extra }, extra)
  assert.equal(k('Spotify Premium', 'Spotify').tipo, 'neutral')
  assert.equal(k('Lo-fi para estudiar - YouTube Music').tipo, 'neutral')
  assert.equal(k('Derivadas: clase 3 - YouTube').tipo, 'estudio')
  assert.equal(k('La Revolución de Mayo - YouTube', 'chrome', { materia: 'Revolución de Mayo' }).tipo, 'estudio')
  assert.deepEqual(k('Gatos graciosos - YouTube'), { tipo: 'distraccion', app: 'YouTube' })
  for (const t of ['Instagram', 'TikTok - Make Your Day', 'Netflix', 'xQc - Twitch', 'Mercado Libre Argentina'])
    assert.equal(k(t).tipo, 'distraccion', t)
  assert.deepEqual(k('WhatsApp', 'WhatsApp'), { tipo: 'chat', app: 'WhatsApp' })
  assert.deepEqual(k('Minecraft 1.21', 'javaw'), { tipo: 'distraccion', app: 'un juego' })
  assert.equal(k('Hollow Knight', 'hollow_knight', { pantallaCompleta: true }).tipo, 'distraccion')
  assert.equal(k('Presentación1 - PowerPoint', 'POWERPNT', { pantallaCompleta: true }).tipo, 'estudio', 'presentar no es jugar')
  assert.equal(k('TP Historia.docx - Word', 'WINWORD').tipo, 'estudio')
  assert.equal(k('Pixie', 'Pixie'), null)
  assert.equal(focusKind(null), null)
})

test('los temas vistos salen de los títulos que tuviste abiertos (sin pestañas vacías ni apps)', () => {
  const topics = topicsFromTitles([
    ['fotosíntesis - Buscar con Google - Google Chrome', 90000],
    ['Nueva pestaña - Google Chrome', 900000],
    ['Respiración celular - Wikipedia, la enciclopedia libre - Google Chrome', 120000],
    ['Tareas - Classroom - Google Chrome', 200000],
    ['Mitosis - YouTube', 30000]
  ])
  assert.deepEqual(topics, ['Respiración celular', 'fotosíntesis'])
})

test('en un bloque avisa de lo que distrae según Pixie (un chat, recién a los 3 minutos)', () => {
  const mem = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-mem-')), 'memoria.json'))
  const base = { inactivoSeg: 0, bloqueada: false, online: true, bateria: null, pantallaCompleta: false, pomodoro: true }
  const yt = { ...base, actividad: { categoria: 'video', app: 'YouTube' } }
  const warnings = (r) => r.notices.filter((n) => n.kind === 'distraccion')
  // Un video de una clase: YouTube pero no distrae
  assert.equal(warnings(createInitiative().tick(at(16), { ...yt, foco: { tipo: 'estudio', app: 'YouTube', distraido: false } }, mem)).length, 0)
  // Spotify no
  assert.equal(warnings(createInitiative().tick(at(16), { ...base, actividad: { categoria: 'musica', app: 'Spotify' }, foco: { tipo: 'neutral', app: 'la música', distraido: false } }, mem)).length, 0)
  const chat = createInitiative().tick(at(16), { ...base, actividad: { categoria: 'mensajes', app: 'WhatsApp' }, foco: { tipo: 'chat', app: 'WhatsApp', distraido: true } }, mem)
  assert.match(warnings(chat)[0].text, /^Hace un rato que estás en WhatsApp/)
  const insta = createInitiative().tick(at(16), { ...base, actividad: { categoria: 'redes', app: 'Instagram' }, foco: { tipo: 'distraccion', app: 'Instagram', distraido: true } }, mem)
  assert.match(warnings(insta)[0].text, /te veo en Instagram/)
})

// ── Lo que dice Pixie ──

function ctxWith(extra = {}) {
  const asked = []
  return {
    asked,
    ctx: { getConfig: () => ({}), log: () => {}, pomodoro: { status: () => ({ activo: false }), start: () => null }, askStudy: (q) => asked.push(q), setPending: () => {}, ...extra }
  }
}

test('si no sabe qué vas a estudiar, pregunta (y con «armalo igual» arma el plan)', async () => {
  const { ctx, asked } = ctxWith()
  const q = await runAction('pomodoro', { accion: 'plan', minutos: 90 }, ctx)
  assert.match(q.text, /^¿Qué vas a estudiar\? Decime la materia y si vas a memorizar, resolver ejercicios o leer teoría/)
  assert.deepEqual(q.suggestions, ['memorizar', 'resolver ejercicios', 'leer teoría', 'armalo igual'])
  assert.deepEqual(asked, [{ minutos: 90, metodo: undefined }])
  const plan = await runAction('pomodoro', { accion: 'plan', minutos: 90, directo: true }, ctx)
  assert.equal(plan.confirm, true)
  const memo = await runAction('pomodoro', { accion: 'plan', minutos: 60, tipo: 'memorizar' }, ctx)
  assert.match(memo.text, /^Para memorizar conviene bloques cortos/)
  const ex = await runAction('pomodoro', { accion: 'plan', minutos: 120, tipo: 'practica' }, ctx)
  assert.match(ex.text, /2 bloques de 50 minutos/)
})

test('recomienda el método según la tarea', async () => {
  const r = await runAction('tecnicas_estudio', { tipo: 'practica' }, { log: () => {} })
  assert.match(r.text, /^Te recomiendo para resolver ejercicios: práctica con ejercicios/)
  assert.match(r.text, /Te conviene el bloques largos \(50 minutos de estudio y 10 de descanso\)\.$/)
  const memo = await runAction('tecnicas_estudio', { tipo: 'memorizar' }, { log: () => {} })
  assert.match(memo.text, /recuperación activa.*repaso espaciado/)
})

test('el seguimiento y el temario por voz', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pixie-estudio-')), 'estudio.json')
  const studyLog = createStudyLog(file, { now: () => at(4, 20) })
  studyLog.record(session(4))
  let opened = null
  const ctx = { log: () => {}, studyLog, openSettings: (v) => (opened = v) }
  assert.match((await runAction('estudio_resumen', { periodo: 'hoy' }, ctx)).text, /^Hoy estudiaste 50 minutos en 2 ciclos\./)
  assert.equal((await runAction('ver_seguimiento', {}, ctx)).text, 'Te abrí tu seguimiento de estudio.')
  assert.equal(opened, 'ajustes/estudio')
  assert.match((await runAction('temario', {}, ctx)).text, /^No tengo tu temario/)
  assert.equal((await runAction('temario', { temas: 'célula, mitosis y meiosis', materia: 'biología' }, ctx)).text, 'Anoté 3 temas de biología. Mientras estudiás voy tachando los que veo.')
  studyLog.markTopic(0, true)
  assert.equal((await runAction('temario', {}, ctx)).text, 'Llevás 1 de 3 temas de biología. Te faltan: mitosis y meiosis.')
})

test('entiende «terminar por hoy», «¿cuánto estudié?», «mi racha» y el temario', () => {
  const one = (t) => interpretAll(t)[0]
  for (const t of ['terminar por hoy', 'por hoy es suficiente', 'listo por hoy', 'cortamos por hoy']) assert.deepEqual(one(t), { action: 'pomodoro', params: { accion: 'terminar' } }, t)
  assert.deepEqual(one('¿cuánto estudié esta semana?'), { action: 'estudio_resumen', params: { periodo: 'semana' } })
  assert.deepEqual(one('¿cuánto estudié hoy?'), { action: 'estudio_resumen', params: { periodo: 'hoy' } })
  assert.deepEqual(one('¿cuál es mi racha?'), { action: 'estudio_resumen', params: { periodo: 'racha' } })
  assert.deepEqual(one('mostrame mi seguimiento de estudio'), { action: 'ver_seguimiento', params: {} })
  assert.deepEqual(one('¿qué temas me faltan?'), { action: 'temario', params: {} })
  assert.equal(one('los temas de biología son: célula, mitosis y meiosis').action, 'temario')
  assert.deepEqual(one('pomodoro para memorizar'), { action: 'pomodoro', params: { accion: 'plan', tipo: 'memorizar' } })
  assert.deepEqual(one('quiero estudiar física, tengo que resolver ejercicios'), { action: 'pomodoro', params: { accion: 'plan', materia: 'física', tipo: 'practica' } })
  assert.deepEqual(one('¿qué método me conviene para resolver ejercicios?'), { action: 'tecnicas_estudio', params: { tipo: 'practica' } })
})

// ── Pixie se corre del mouse ──

test('adónde se corre: al lugar más cerca que no quede debajo del mouse, sin salirse de la pantalla', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const pixie = { x: 1694, y: 860, width: 210, height: 164 } // abajo a la derecha
  const to = dodgeTarget(pixie, { x: 1800, y: 950 }, area)
  assert.deepEqual(to, { x: 1694, y: 950 - 164 - 28 }, 'sube lo justo para dejar libre el mouse')
  const mid = dodgeTarget({ x: 800, y: 400, width: 210, height: 164 }, { x: 820, y: 480 }, area)
  assert.deepEqual(mid, { x: 848, y: 400 }, 'si el mouse está en el borde izquierdo, se corre a la derecha')
  // Contra el borde izquierdo: se va a la derecha o arriba
  const left = dodgeTarget({ x: 0, y: 860, width: 210, height: 164 }, { x: 20, y: 950 }, area)
  assert.ok(left.x > 20 + 10 || left.y + 164 < 950, JSON.stringify(left))
  assert.ok(left.x >= 0 && left.x + 210 <= 1920 && left.y >= 0 && left.y + 164 <= 1040)
})

test('se corre si dejás el mouse encima un ratito, pero no mientras la usás o la arrastrás', () => {
  let t = 10000
  let mode = 'compact'
  let bounds = { x: 1694, y: 860, width: 210, height: 164 }
  const moves = []
  const handlers = {}
  const win = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => bounds,
    setPosition: (x, y) => {
      bounds = { ...bounds, x, y }
      moves.push([x, y])
      handlers.move?.()
    },
    on: (e, fn) => (handlers[e] = fn)
  }
  const timers = []
  const d = createDodger({ getWindow: () => win, getMode: () => mode, workArea: () => ({ x: 0, y: 0, width: 1920, height: 1040 }), now: () => t, setTimer: (fn) => timers.push(fn) })
  const over = { x: 1800, y: 950 }
  d.check({ x: 0, y: 0 }) // ya estaba andando
  t += 5000
  assert.equal(d.check(over), false, 'recién llega')
  t += 200
  assert.equal(d.check(over), false)
  t += 150
  assert.equal(d.check(over), true, 'después de 300 ms se corre')
  timers.splice(0).forEach((fn) => fn())
  assert.deepEqual(moves.at(-1), [1694, 758])
  // Si la arrastrás (se mueve y no fue ella), no se escapa
  t += 5000
  bounds = { ...bounds, x: 1600 }
  handlers.move()
  assert.equal(d.check({ x: 1700, y: 950 }), false)
  t += 400
  assert.equal(d.check({ x: 1700, y: 950 }), false, 'la estás arrastrando')
  // Con la barra abierta o el globito, no
  t += 5000
  mode = 'expanded'
  d.check({ x: 1700, y: 950 })
  t += 400
  assert.equal(d.check({ x: 1700, y: 950 }), false)
})

test('«química» y «Química» son la misma materia', () => {
  const list = [session(2, { materia: 'Química' }), session(3, { materia: 'química' }), session(4, { materia: 'QUIMICA' })]
  const v = trackerView(list, { now: at(4, 20) })
  assert.deepEqual(v.materias.map((m) => [m.materia, m.racha, m.semanaMin]), [['Química', 3, 150]])
  assert.equal(v.mes.filas.length, 1)
  assert.match(statsText(list, 'semana', at(4, 20)), /lo que más, Química \(2 horas y 30 minutos\)/)
  const log = createStudyLog(join(mkdtempSync(join(tmpdir(), 'pixie-estudio-')), 'estudio.json'))
  assert.equal(log.record(session(2, { materia: 'historia' })).materia, 'Historia')
})

test('Ajustes → Mi estudio: el seguimiento, la meta diaria, el temario y borrar el historial', async () => {
  const { createSettings } = await import('../src/main/settings.js')
  let cfg = {}
  const studyLog = createStudyLog(join(mkdtempSync(join(tmpdir(), 'pixie-estudio-')), 'estudio.json'), { now: () => at(3, 20) })
  studyLog.record(session(2))
  studyLog.record(session(3))
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (patch) => (cfg = { ...cfg, ...patch }),
    voices: { status: () => '' },
    updates: { status: () => ({}), describe: () => '' },
    ai: {},
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Espacio',
    setCity: async () => '',
    studyLog
  })
  let snap = s.snapshot()
  assert.equal(snap.estudio.meta, 60)
  assert.equal(snap.estudio.resumen.racha, 2)
  assert.equal(snap.general.esquivarMouse, true, 'se corre del mouse si no lo apagaste')
  snap = await s.apply({ metaDiaria: 5, esquivarMouse: false })
  assert.equal(snap.estudio.meta, 15, 'por lo menos 15 minutos')
  assert.equal(snap.general.esquivarMouse, false)
  let r = s.syllabus({ accion: 'guardar', materia: 'Biología', texto: '1. Célula\n2. ADN' })
  assert.match(r.mensaje, /^Anoté 2 temas/)
  assert.deepEqual(r.estudio.temario.temas.map((t) => t.texto), ['Célula', 'ADN'])
  r = s.syllabus({ accion: 'marcar', indice: 1, visto: true })
  assert.equal(r.estudio.temario.temas[1].visto, true)
  assert.match(s.syllabus({ accion: 'guardar', texto: '' }).mensaje, /^No encontré temas/)
  assert.equal(s.syllabus({ accion: 'borrar' }).estudio.temario, null)
  assert.equal(s.clearStudy().estudio.resumen.sesiones, 0)
})
