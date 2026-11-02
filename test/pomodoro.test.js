import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlan,
  planText,
  blockTips,
  advicePrompt,
  pomodoroView,
  recommendTechniques,
  studyIntent,
  subjectFrom,
  minutesFrom,
  topicFromTitle,
  selfTest,
  quizPrompt,
  taskTypeFrom,
  subjectIn,
  topicsFromTitles,
  focusKind
} from '../src/main/study.js'
import { createPomodoro } from '../src/main/pomodoro.js'
import { runAction } from '../src/main/actions/index.js'
import { toggleTimer, timersState, onTimersChange } from '../src/main/actions/timers.js'
import { interpretAll } from '../src/main/brain.js'
import { createSettings } from '../src/main/settings.js'
import { studyWindow } from '../src/main/scenes.js'
import { renderTimer, drawBreakBar, planLayout } from '../src/renderer/src/face/standby.js'
import { WIDTH, HEIGHT } from '../src/renderer/src/face/draw.js'

const MIN = 60 * 1000
const kinds = (plan) => plan.bloques.map((b) => `${b.tipo[0]}${b.minutos}`).join(' ')

// Un reloj de mentira para probar la sesión sin esperar 25 minutos
function fakeClock() {
  let t = 0
  let id = 0
  const q = new Map()
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      q.set(++id, { at: t + ms, fn })
      return id
    },
    clearTimer: (h) => q.delete(h),
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

function session() {
  const clock = fakeClock()
  const events = []
  const p = createPomodoro({ now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, on: (e, st) => events.push([e, st]) })
  return { p, clock, events, names: () => events.map(([e]) => e).filter((e) => e !== 'cambio') }
}

// ── El plan ──

test('el plan llena el tiempo que tenés con bloques y descansos (el último sin descanso)', () => {
  const inicio = new Date('2026-11-02T16:00:00')
  const plan = buildPlan({ minutos: 120, inicio })
  assert.equal(kinds(plan), 'e25 d5 e25 d5 e25 d5 e25')
  assert.equal(plan.bloquesEstudio, 4)
  assert.equal(plan.estudioMin, 100)
  assert.equal(plan.totalMin, 115)
  assert.equal(new Date(plan.bloques[0].desde).getTime(), inicio.getTime())
  assert.equal(new Date(plan.bloques.at(-1).hasta).getTime(), inicio.getTime() + 115 * MIN)
  assert.deepEqual(plan.bloques.filter((b) => b.tipo === 'estudio').map((b) => b.n), [1, 2, 3, 4])
})

test('cada 4 bloques hay un descanso largo; con bloques largos, cada 3', () => {
  assert.equal(kinds(buildPlan({ minutos: 240 })), 'e25 d5 e25 d5 e25 d5 e25 l15 e25 d5 e25 d5 e25 d5 e20')
  assert.equal(kinds(buildPlan({ minutos: 180, metodo: 'largo' })), 'e50 d10 e50 d10 e50')
  assert.equal(kinds(buildPlan({ minutos: 240, metodo: 'largo' })), 'e50 d10 e50 d10 e50 l20 e50')
})

test('con poco tiempo entra un solo bloque, y el tiempo se acota entre 15 minutos y 8 horas', () => {
  assert.equal(kinds(buildPlan({ minutos: 20 })), 'e20')
  assert.equal(kinds(buildPlan({ minutos: 5 })), 'e15')
  assert.equal(buildPlan({ minutos: 2000 }).totalMin <= 480, true)
  assert.equal(buildPlan({ minutos: 'cualquier cosa' }).totalMin, 115, 'sin un número, usa 2 horas')
  assert.equal(buildPlan({ metodo: 'inventado' }).metodo, 'clasico')
})

test('el plan se dice corto, con la materia y una técnica para estudiarla', () => {
  const text = planText(buildPlan({ minutos: 120, materia: 'historia', inicio: new Date('2026-11-02T16:00:00') }))
  assert.match(text, /^Para leer teoría conviene .* Te armé 4 bloques de 25 minutos de historia con descansos de 5 minutos: de 16:00 a 17:55/)
  assert.match(text, /1 hora y 40 minutos de estudio/)
  assert.match(text, /resumen propio/i)
  // Con el método elegido a mano no explica por qué
  assert.match(planText(buildPlan({ minutos: 120, materia: 'historia', metodo: 'clasico' })), /^Te armé 4 bloques/)
})

test('el método sale del tipo de tarea: ejercicios con bloques largos, memorizar y teoría con el clásico', () => {
  const ex = buildPlan({ minutos: 120, tipo: 'practica', inicio: new Date('2026-11-02T16:00:00') })
  assert.deepEqual([ex.metodo, ex.auto, ex.tipo], ['largo', true, 'practica'])
  assert.match(planText(ex), /^Para resolver ejercicios conviene bloques largos.* Te armé 2 bloques de 50 minutos con un descanso de 10 minutos/)
  assert.equal(buildPlan({ tipo: 'memorizar' }).metodo, 'clasico')
  assert.equal(buildPlan({ tipo: 'teoria' }).metodo, 'clasico')
  // Sin tipo, sale de la materia: química es de ejercicios, inglés de memorizar
  assert.deepEqual([buildPlan({ materia: 'química' }).tipo, buildPlan({ materia: 'química' }).metodo], ['practica', 'largo'])
  assert.equal(buildPlan({ materia: 'Inglés' }).tipo, 'memorizar')
  // Si elegís el método a mano, manda lo tuyo
  assert.equal(buildPlan({ materia: 'química', metodo: 'clasico' }).metodo, 'clasico')
  assert.equal(taskTypeFrom('tengo que resolver ejercicios de física'), 'practica')
  assert.equal(taskTypeFrom('me tengo que aprender de memoria las fechas'), 'memorizar')
  assert.equal(taskTypeFrom('leer el capítulo 3'), 'teoria')
  assert.equal(taskTypeFrom('hola'), null)
  assert.deepEqual(recommendTechniques(null, 'memorizar').map((t) => t.nombre), ['Recuperación activa', 'Repaso espaciado', 'Fichas de pregunta y respuesta'])
  assert.deepEqual(recommendTechniques('historia', 'teoria').map((t) => t.nombre), ['Resumen propio', 'Técnica Feynman', 'Mapa conceptual'])
  assert.equal(subjectIn('mañana tengo prueba de Química'), 'química')
  assert.equal(subjectIn('nada que ver'), null)
})

test('recomienda técnicas según la materia', () => {
  assert.equal(recommendTechniques('Matemática')[0].nombre, 'Práctica con ejercicios')
  assert.equal(recommendTechniques('historia')[0].nombre, 'Recuperación activa')
  assert.equal(recommendTechniques('inglés')[0].nombre, 'Fichas de pregunta y respuesta')
  assert.equal(recommendTechniques(null).length, 3)
})

test('sin IA dice qué hacer en cada bloque; con IA le pide consejos a medida', () => {
  const plan = buildPlan({ minutos: 120, materia: 'historia' })
  const tips = blockTips(plan)
  assert.equal(tips.length, 4)
  assert.match(tips[0], /^Bloque 1: leé y marcá lo más importante/)
  assert.match(tips[3], /^Bloque 4: .*mini test/)
  assert.equal(blockTips(buildPlan({ minutos: 20 })).length, 1)
  const prompt = advicePrompt(plan)
  assert.match(prompt, /de historia/)
  assert.match(prompt, /4 bloques de 25 minutos/)
  assert.match(prompt, /«Bloque 1:»/)
})

test('se da cuenta cuando hablás de estudiar, de qué materia y cuánto tiempo', () => {
  for (const t of ['tengo que estudiar para la prueba', 'mañana tengo examen de historia', 'tengo un parcial el jueves', 'tengo que hacer la tarea de mate', 'voy a repasar inglés'])
    assert.equal(studyIntent(t), true, t)
  for (const t of ['poné música', 'quiero ver una peli', 'qué hora es']) assert.equal(studyIntent(t), false, t)
  assert.equal(subjectFrom('tengo que estudiar química para el jueves'), 'química')
  assert.equal(subjectFrom('mañana tengo prueba de historia'), 'historia')
  assert.equal(subjectFrom('tengo que estudiar un rato'), null)
  assert.equal(minutesFrom('tengo 2 horas'), 120)
  assert.equal(minutesFrom('una hora y media'), 90)
  assert.equal(minutesFrom('45 minutos'), 45)
  assert.equal(minutesFrom('media hora'), 30)
  assert.equal(minutesFrom('1:30'), 90)
  assert.equal(minutesFrom('hola'), null)
})

test('saca el tema de lo que tenés abierto (sin el nombre del programa)', () => {
  assert.equal(topicFromTitle('Fotosíntesis - Wikipedia, la enciclopedia libre - Google Chrome'), 'Fotosíntesis')
  assert.equal(topicFromTitle('Revolución de Mayo.docx - Word'), 'Revolución de Mayo')
  assert.equal(topicFromTitle('● apunte-quimica.pdf'), 'apunte-quimica')
  assert.equal(studyWindow({ titulo: 'Fotosíntesis - Wikipedia', proceso: 'chrome.exe' }), true, 'navegar una página cuenta')
  assert.equal(studyWindow({ titulo: 'TP.docx - Word', proceso: 'WINWORD.EXE' }), true)
  assert.equal(studyWindow({ titulo: 'Gatos - YouTube', proceso: 'chrome' }), false, 'un video no es lo que estudiás')
  assert.equal(studyWindow({ titulo: 'Pixie', proceso: 'Pixie.exe' }), false)
  assert.equal(studyWindow({ titulo: '', proceso: 'chrome' }), false)
})

test('el mini test: sin IA, preguntas para repasar solo; con IA, de a una sobre lo que leíste', () => {
  assert.match(selfTest('Fotosíntesis'), /^Mini test de repaso sobre «Fotosíntesis»/)
  assert.match(selfTest(null), /^Mini test de repaso\. Cerrá el apunte/)
  const p = quizPrompt('Fotosíntesis', 'La fotosíntesis es...')
  assert.match(p, /3 preguntas cortas, de a una por vez/)
  assert.match(p, /<texto>\nLa fotosíntesis es\.\.\.\n<\/texto>/)
})

// ── La sesión ──

test('la sesión pasa por los bloques, avisa los últimos 2 minutos y los descansos', () => {
  const { p, clock, names } = session()
  p.start(buildPlan({ minutos: 60 }))
  let st = p.status()
  assert.equal(st.fase, 'estudio')
  assert.equal(st.bloque, 1)
  assert.equal(st.bloques, 2)
  assert.equal(st.indice, 0)
  assert.equal(p.enFoco(), true)
  clock.advance(23 * MIN)
  assert.deepEqual(names(), ['bloque', 'ultimos2'])
  assert.equal(p.status().restanteMs, 2 * MIN)
  clock.advance(2 * MIN)
  st = p.status()
  assert.equal(st.fase, 'descanso')
  assert.equal(st.bloque, 1, 'en el descanso sigue diciendo qué bloque terminaste')
  assert.equal(p.enFoco(), false, 'en el descanso no está en foco')
  clock.advance(5 * MIN)
  assert.equal(p.status().bloque, 2)
  clock.advance(25 * MIN)
  assert.deepEqual(names(), ['bloque', 'ultimos2', 'descanso', 'bloque', 'ultimos2', 'fin'])
  assert.equal(p.activo(), false)
})

test('al terminar todo cuenta cuánto estudiaste', () => {
  const { p, clock, events } = session()
  p.start(buildPlan({ minutos: 120, materia: 'historia' }))
  clock.advance(120 * MIN)
  const fin = events.find(([e]) => e === 'fin')[1]
  assert.deepEqual(
    { ...fin, inicio: undefined, fin: undefined },
    { completo: true, estudiadoMin: 100, bloquesHechos: 4, materia: 'historia', tipo: 'teoria', metodo: 'clasico', inicio: undefined, fin: undefined, ciclos: 4, ciclosPlaneados: 4, planeadoMin: 100, distraidoMin: 0, focoMin: 100, adherencia: 100 }
  )
  assert.deepEqual(p.status(), { activo: false })
})

test('la adherencia descuenta el tiempo distraído y lo que no llegaste a estudiar', () => {
  const { p, clock, events } = session()
  p.start(buildPlan({ minutos: 60, metodo: 'clasico' })) // 2 bloques de 25: 50 planeados
  clock.advance(10 * MIN)
  p.noteDistraction(5 * MIN) // 5 minutos en Instagram
  clock.advance(15 * MIN)
  p.noteDistraction(MIN) // en el descanso no cuenta
  clock.advance(5 * MIN)
  const st = p.status()
  assert.equal(st.ciclos, 1)
  assert.equal(st.distraidoMs, 5 * MIN)
  assert.equal(st.planeadoMs, 50 * MIN)
  p.pause()
  p.noteDistraction(MIN) // en pausa tampoco
  p.resume()
  clock.advance(10 * MIN)
  p.stop() // «terminar por hoy» con 35 estudiados
  const fin = events.find(([e]) => e === 'fin')[1]
  assert.equal(fin.estudiadoMin, 35)
  assert.equal(fin.distraidoMin, 5)
  assert.equal(fin.focoMin, 30)
  assert.equal(fin.ciclos, 1)
  assert.equal(fin.adherencia, 60, '30 con foco de 50 planeados')
})

test('saltar un bloque casi terminado cuenta como ciclo; recién empezado, no', () => {
  const { p, clock } = session()
  p.start(buildPlan({ minutos: 60, metodo: 'clasico' }))
  clock.advance(21 * MIN)
  p.skip()
  assert.equal(p.status().ciclos, 1)
  p.skip()
  clock.advance(5 * MIN)
  assert.equal(p.status().ciclos, 1, 'el segundo recién empezado todavía no cuenta')
})

test('en pausa el tiempo no corre; al seguir, retoma donde estaba', () => {
  const { p, clock, names } = session()
  p.start(buildPlan({ minutos: 60 }))
  clock.advance(10 * MIN)
  const paused = p.pause()
  assert.equal(paused.pausado, true)
  assert.equal(paused.finAt, null)
  assert.equal(p.enFoco(), false, 'en pausa no bloquea los avisos')
  clock.advance(60 * MIN)
  assert.equal(p.status().restanteMs, 15 * MIN, 'no avanzó')
  assert.deepEqual(names(), ['bloque'], 'en pausa no avisa nada')
  p.toggle()
  assert.equal(p.status().pausado, false)
  assert.equal(p.status().finAt, clock.now() + 15 * MIN)
  clock.advance(15 * MIN)
  assert.equal(p.status().fase, 'descanso')
})

test('saltar pasa al siguiente bloque y terminar a mitad cuenta lo que llevabas', () => {
  const { p, clock, events } = session()
  p.start(buildPlan({ minutos: 60 }))
  clock.advance(10 * MIN)
  assert.equal(p.skip().fase, 'descanso')
  assert.equal(p.skip().fase, 'estudio', 'saltear el descanso')
  clock.advance(5 * MIN)
  const r = p.stop()
  assert.deepEqual([r.completo, r.estudiadoMin, r.bloquesHechos, r.materia, r.ciclos], [false, 15, 1, null, 0])
  assert.equal(events.filter(([e]) => e === 'fin').length, 1)
  assert.equal(p.stop(), null, 'si ya terminó, no hace nada')
})

test('con un bloque cortito no avisa los últimos 2 minutos', () => {
  const { p, clock, names } = session()
  const plan = buildPlan({ minutos: 15 })
  plan.bloques[0].minutos = 5
  p.start(plan)
  clock.advance(5 * MIN)
  assert.deepEqual(names(), ['bloque', 'fin'])
})

// ── Lo que dice Pixie ──

function studyCtx(extra = {}) {
  const { p, clock } = session()
  let pending = null
  const ctx = {
    getConfig: () => ({ pomodoroMinutos: 60 }),
    log: () => {},
    pomodoro: p,
    setPending: (x) => (pending = x),
    ai: { enabled: () => false },
    ...extra
  }
  return { ctx, p, clock, pending: () => pending }
}

test('«armá un pomodoro» muestra el plan y pregunta; al decir que sí, arranca', async () => {
  const { ctx, p, pending } = studyCtx()
  const r = await runAction('pomodoro', { accion: 'plan', materia: 'historia' }, ctx)
  assert.equal(r.confirm, true)
  assert.match(r.text, /Te armé 2 bloques de 25 minutos de historia/)
  assert.match(r.text, /¿Arrancamos\?$/)
  assert.deepEqual(pending(), { action: 'pomodoro', params: { accion: 'empezar', minutos: 55, materia: 'historia', metodo: 'clasico', tipo: 'teoria' } })
  assert.equal(p.activo(), false, 'todavía no arrancó')
  const go = await runAction('pomodoro', pending().params, ctx)
  assert.match(go.text, /^¡Arrancamos de historia! Bloque 1 de 2: 25 minutos\. Es momento de que no haya distracciones: vuelvo en el descanso\./)
  assert.match(go.text, /sigo acá si necesitás ayuda/)
  assert.equal(p.activo(), true)
})

test('pausar, seguir, estado, saltar y terminar por voz', async () => {
  const { ctx, clock } = studyCtx()
  assert.match((await runAction('pomodoro', { accion: 'estado' }, ctx)).text, /No hay un Pomodoro andando/)
  await runAction('pomodoro', { accion: 'empezar' }, ctx)
  clock.advance(5 * MIN)
  assert.equal((await runAction('pomodoro', { accion: 'estado' }, ctx)).text, 'Estás en el bloque 1 de 2: faltan 20 minutos. Llevás 5 minutos de 50 minutos, con 100% de foco.')
  assert.match((await runAction('pomodoro', { accion: 'pausar' }, ctx)).text, /^Pausé el Pomodoro \(faltan 20 minutos\)/)
  assert.equal((await runAction('pomodoro', { accion: 'seguir' }, ctx)).text, '¡Seguimos!')
  assert.match((await runAction('pomodoro', { accion: 'plan' }, ctx)).text, /^Ya hay un Pomodoro andando/)
  assert.equal((await runAction('pomodoro', { accion: 'saltar' }, ctx)).text, 'Listo, pasamos al descanso.')
  assert.match((await runAction('pomodoro', { accion: 'terminar' }, ctx)).text, /^Listo, terminé el Pomodoro\. Estudiaste 5 minutos\.$/)
})

test('el mini test usa lo que estuviste estudiando; sin IA, con preguntas para repasar solo', async () => {
  const { ctx } = studyCtx({ studyTopic: () => 'Fotosíntesis' })
  assert.match((await runAction('mini_test', {}, ctx)).text, /^Mini test de repaso sobre «Fotosíntesis»/)
  let asked = null
  const withAI = studyCtx({
    studyTopic: () => 'Fotosíntesis',
    contextText: () => '',
    browser: { connected: () => true, request: async () => ({ title: 'Fotosíntesis - Wikipedia', text: 'La fotosíntesis es el proceso...' }) },
    ai: { enabled: () => true, chat: async (prompt) => ((asked = prompt), { text: '¿Qué necesita una planta para hacer la fotosíntesis?', face: 'happy' }) }
  })
  const r = await runAction('mini_test', {}, withAI.ctx)
  assert.match(r.text, /^¿Qué necesita/)
  assert.match(asked, /sobre «Fotosíntesis»/)
  assert.match(asked, /La fotosíntesis es el proceso/, 'pregunta sobre la página que tenías abierta')
})

test('«¿qué me perdí?» cuenta lo que se guardó mientras estudiabas', async () => {
  const none = await runAction('que_me_perdi', {}, { log: () => {}, missedNotices: () => [] })
  assert.match(none.text, /No te perdiste nada/)
  const some = await runAction('que_me_perdi', {}, { log: () => {}, missedNotices: () => ['Te llegó un mail de la profe.', 'Hay noticias nuevas.'] })
  assert.equal(some.text, 'Mientras estudiabas: Te llegó un mail de la profe. Hay noticias nuevas.')
})

test('entiende los pedidos del Pomodoro', () => {
  const one = (t) => interpretAll(t)[0]
  assert.deepEqual(one('quiero estudiar historia una hora y media'), { action: 'pomodoro', params: { accion: 'plan', materia: 'historia', minutos: 90 } })
  assert.deepEqual(one('armá un pomodoro de 45 minutos'), { action: 'pomodoro', params: { accion: 'plan', minutos: 45 } })
  assert.deepEqual(one('pausá el pomodoro'), { action: 'pomodoro', params: { accion: 'pausar' } })
  assert.deepEqual(one('seguí con el pomodoro'), { action: 'pomodoro', params: { accion: 'seguir' } })
  assert.deepEqual(one('saltá el descanso'), { action: 'pomodoro', params: { accion: 'saltar' } })
  assert.deepEqual(one('terminá el pomodoro'), { action: 'pomodoro', params: { accion: 'terminar' } })
  assert.deepEqual(one('dale, tomame'), { action: 'mini_test', params: {} })
  assert.deepEqual(one('¿qué me perdí?'), { action: 'que_me_perdi', params: {} })
  assert.deepEqual(one('pausá el timer'), { action: 'pausar_timer', params: {} })
  assert.equal(one('técnicas de estudio para biología').action, 'tecnicas_estudio')
  assert.deepEqual(one('arrancá un pomodoro de 2 horas de historia'), { action: 'pomodoro', params: { accion: 'empezar', materia: 'historia', minutos: 120 } })
  assert.deepEqual(one('tengo 2 horas para estudiar'), { action: 'pomodoro', params: { accion: 'plan', minutos: 120 } })
})

// ── Los timers comunes se pausan ──

test('un timer se puede pausar y seguir (tocando la pantallita)', async () => {
  const seen = []
  onTimersChange((list) => seen.push(list))
  const ctx = { log: () => {}, emit: () => {}, notify: () => {} }
  await runAction('crear_timer', { segundos: 600, etiqueta: 'fideos' }, ctx)
  try {
    let [t] = timersState()
    assert.equal(t.etiqueta, 'fideos')
    assert.equal(t.totalMs, 600000)
    assert.equal(t.pausado, false)
    assert.equal(typeof t.finAt, 'number')
    assert.deepEqual(toggleTimer(), { pausado: true, etiqueta: 'fideos' })
    ;[t] = timersState()
    assert.equal(t.pausado, true)
    assert.equal(t.finAt, null)
    assert.match((await runAction('ver_timers', {}, ctx)).text, /en pausa/)
    assert.match((await runAction('pausar_timer', {}, ctx)).text, /^Sigue «fideos»\./)
    assert.ok(seen.length >= 3, 'avisa a la pantallita cada cambio')
  } finally {
    await runAction('cancelar_timers', {}, ctx)
    onTimersChange(() => {})
  }
  assert.equal(toggleTimer(), null)
})

// ── La pantallita ──

const colors = (bits) => new Set([...bits].filter(Boolean))

const parts = (minutos) => buildPlan({ minutos }).bloques.map((b) => ({ tipo: b.tipo, minutos: b.minutos }))
const count = (bits, c) => [...bits].filter((x) => x === c).length

test('el Pomodoro se dibuja como bloques en fila: rojos de estudio, verdes de descanso, y el tiempo abajo', () => {
  const plan = parts(120) // e d e d e d e
  const layout = planLayout(plan, 2)
  assert.equal(layout.scroll, false, 'dos horas entran enteras')
  const [study, rest] = layout.parts
  assert.ok(study.w > rest.w * 2, 'los descansos son angostos')
  assert.ok(layout.parts.every((x, i) => i === 0 || x.x > layout.parts[i - 1].x + layout.parts[i - 1].w), 'uno al lado del otro, sin pisarse')
  assert.ok(layout.parts[0].x >= 0 && layout.parts.at(-1).x + layout.parts.at(-1).w <= WIDTH)

  const at = (indice, progreso, extra = {}) =>
    renderTimer({ kind: 'pomodoro', plan, indice, bloque: 2, bloques: 4, restanteMs: 25 * MIN * (1 - progreso), totalMs: 25 * MIN, pausado: false, ...extra }, 50)
  const bits = at(2, 0.5)
  assert.equal(bits.length, WIDTH * HEIGHT)
  assert.ok(count(bits, 2) > 0, 'rojo: los bloques hechos y lo que lleva el de ahora')
  assert.ok(count(bits, 9) > 0, 'verde: el descanso que ya pasó')
  assert.ok(count(bits, 4) > 0 && count(bits, 16) > 0, 'oscuros: los que faltan')
  assert.ok(count(bits, 6) > 0, 'la tilde de los terminados')
  // El de ahora se va llenando
  assert.ok(count(at(2, 0.9), 2) > count(at(2, 0.1), 2))
  // El tiempo, chiquito abajo (números de 7 de alto), sin nada del tiempo arriba
  const timeRows = (b) => [...Array(HEIGHT).keys()].filter((y) => [...b.slice(y * WIDTH, (y + 1) * WIDTH)].includes(1))
  assert.deepEqual(timeRows(bits), [23, 24, 25, 26, 27, 28, 29])
  // Los últimos 2 minutos, en naranja; en pausa dice PAUSA en amarillo
  assert.ok(count(at(2, 0.95), 12) > 20, 'el tiempo en naranja')
  assert.ok(count(at(2, 0.5, { pausado: true }), 7) > 0)
})

test('si el plan es muy largo, los bloques se corren para que se vea el de ahora', () => {
  const plan = parts(480)
  const first = planLayout(plan, 0)
  const later = planLayout(plan, plan.length - 3)
  assert.equal(first.scroll, true)
  const visible = (l, i) => l.parts[i].x >= 0 && l.parts[i].x + l.parts[i].w <= WIDTH
  assert.ok(visible(first, 0))
  assert.ok(visible(later, plan.length - 3))
  assert.ok(!visible(later, 0), 'los primeros quedan fuera')
})

test('el timer común: qué es, el tiempo grande y la barra', () => {
  const bits = renderTimer({ kind: 'timer', etiqueta: 'los fideos', restanteMs: 5 * MIN, totalMs: 10 * MIN, pausado: false }, 0)
  assert.ok(count(bits, 3) > 0, 'en celeste')
  const row = 27 * WIDTH
  const filled = [...bits.slice(row, row + WIDTH)].filter((x) => x === 3 || x === 6).length
  assert.ok(filled > 25 && filled < 35, `barra a la mitad (${filled})`)
  assert.ok(count(renderTimer({ kind: 'timer', etiqueta: 'fideos', restanteMs: 5 * MIN, totalMs: 10 * MIN, pausado: true }, 0), 7) > 0)
})

test('en el descanso, una rayita abajo muestra cuánto falta', () => {
  const bits = new Uint8Array(WIDTH * HEIGHT)
  drawBreakBar(bits, { restanteMs: 2.5 * MIN, totalMs: 5 * MIN })
  const last = [...bits.slice((HEIGHT - 1) * WIDTH)]
  assert.equal(last.filter(Boolean).length, WIDTH / 2)
})

// ── Ajustes → Pomodoro ──

function settings({ config = {}, ai = { enabled: () => false } } = {}) {
  let cfg = { ...config }
  const said = []
  const { p } = session()
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (patch) => {
      cfg = { ...cfg, ...patch }
      for (const [k, v] of Object.entries(patch)) if (v === undefined) delete cfg[k]
    },
    voices: { status: () => '' },
    updates: { status: () => ({}), describe: () => '' },
    ai,
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Espacio',
    setCity: async () => '',
    pomodoro: p,
    runPomodoro: async (accion) => {
      said.push(accion)
      if (accion === 'empezar') p.start(buildPlan({ minutos: cfg.pomodoroMinutos, materia: cfg.pomodoroMateria }))
      return `hice ${accion}`
    }
  })
  return { s, cfg: () => cfg, said, p }
}

test('Ajustes → Pomodoro muestra el plan con lo que elegiste', async () => {
  const { s, cfg } = settings()
  let v = s.snapshot().pomodoro
  assert.equal(v.minutos, 120)
  assert.equal(v.metodo, 'auto', 'por defecto elige el método según la tarea')
  assert.equal(v.metodoUsado, 'clasico')
  assert.equal(v.tipos.length, 3)
  assert.equal(v.ofrecer, true)
  assert.equal(v.distracciones, true)
  assert.equal(v.plan.bloques.length, 7)
  assert.equal(v.plan.consejos.length, 4)
  assert.deepEqual(v.sesion, { activo: false })
  v = (await s.apply({ pomodoroMinutos: 5, pomodoroMetodo: 'largo', pomodoroMateria: '  Biología ', pomodoroOfrecer: false })).pomodoro
  assert.equal(v.minutos, 15, 'por lo menos 15 minutos')
  assert.equal(v.metodo, 'largo')
  assert.equal(v.materia, 'Biología')
  assert.equal(v.ofrecer, false)
  assert.equal(v.tecnicas[0].nombre, 'Resumen propio', 'biología es leer teoría')
  await s.apply({ pomodoroMetodo: 'inventado', pomodoroMateria: '' })
  assert.equal(cfg().pomodoroMetodo, 'largo', 'un método que no existe no se guarda')
  assert.equal('pomodoroMateria' in cfg(), false)
  // Qué vas a hacer: con «según la tarea», ejercicios elige bloques largos y dice por qué
  v = (await s.apply({ pomodoroMetodo: 'auto', pomodoroTipo: 'practica' })).pomodoro
  assert.equal(v.tipo, 'practica')
  assert.equal(v.metodoUsado, 'largo')
  assert.match(v.porque, /bloques largos/)
  assert.equal((await s.apply({ pomodoroTipo: '' })).pomodoro.tipo, '')
})

test('los botones de Ajustes arrancan el Pomodoro y muestran cómo va', async () => {
  const { s, said, p } = settings({ config: { pomodoroMinutos: 60 } })
  const r = await s.pomodoroControl('empezar')
  assert.equal(r.mensaje, 'hice empezar')
  assert.equal(r.pomodoro.sesion.activo, true)
  assert.equal(r.pomodoro.sesion.bloque, 1)
  assert.equal(r.pomodoro.sesion.indice, 0)
  assert.equal(r.pomodoro.sesion.plan.length, 3)
  assert.equal((await s.pomodoroControl('borrar todo')).mensaje, null, 'solo los botones que existen')
  assert.deepEqual(said, ['empezar'])
  p.stop()
})

test('los consejos para cada bloque: con IA a medida, sin IA (o si falla) los de siempre', async () => {
  const offline = await settings().s.pomodoroAdvice()
  assert.equal(offline.ia, false)
  assert.equal(offline.consejos.length, 4)
  const withAI = await settings({ ai: { enabled: () => true, advise: async () => 'Bloque 1: leé el capítulo.\nBloque 2: hacé un cuadro.\n\nEn los descansos, tomá agua.' } }).s.pomodoroAdvice()
  assert.deepEqual(withAI, { ia: true, consejos: ['Bloque 1: leé el capítulo.', 'Bloque 2: hacé un cuadro.', 'En los descansos, tomá agua.'] })
  const failing = await settings({ ai: { enabled: () => true, advise: async () => { throw new Error('sin internet') } } }).s.pomodoroAdvice()
  assert.equal(failing.ia, false)
})

test('la vista del Pomodoro se arma igual para Ajustes y para la vista previa', () => {
  const v = pomodoroView({ minutos: 90, materia: 'historia' })
  assert.equal(v.plan.estudioMin, 75)
  assert.equal(v.metodos.length, 3, 'según la tarea, clásico y largo')
  assert.match(v.plan.texto, /3 bloques de 25 minutos de historia/)
})

// ── Mientras estudiás no molesta ──

test('en un bloque se guarda los avisos y en el descanso te los cuenta («¿qué me perdí?»)', async () => {
  const { createMind } = await import('../src/main/mind.js')
  let focus = true
  const events = []
  const ctx = { getConfig: () => ({}), log: () => {}, pomodoro: { enFoco: () => focus } }
  const mind = createMind({ ctx, sendEvent: (e) => events.push(e), notify: () => {}, log: () => {} })
  const shown = () => events.filter((e) => e.type === 'notice').map((e) => e.text)
  mind.say({ kind: 'mail', text: 'Te llegó un mail de la profe.' })
  mind.say({ kind: 'charla', text: '¿Viste el partido?' })
  mind.say({ kind: 'distraccion', text: 'Estás en el bloque de estudio y te veo en Instagram.' })
  mind.say({ kind: 'recordatorio', text: 'En 10 minutos tenés inglés.', urgent: true })
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(shown(), ['Estás en el bloque de estudio y te veo en Instagram.', 'En 10 minutos tenés inglés.'])
  assert.equal(mind.heldNotices().length, 2)
  focus = false
  assert.equal(mind.releaseHeld(), 'Mientras estudiabas te llegó un mail y tengo un aviso para vos: preguntame «¿qué me perdí?».')
  assert.equal(mind.releaseHeld(), '', 'ya los contó')
  assert.deepEqual(mind.missedNotices(), ['Te llegó un mail de la profe.', '¿Viste el partido?'])
  assert.deepEqual(mind.missedNotices(), [], 'una sola vez')
})

test('«tengo una hora y media para estudiar» no se parte en dos pedidos', () => {
  assert.deepEqual(interpretAll('tengo 1 hora y media para estudiar historia'), [{ action: 'pomodoro', params: { accion: 'plan', materia: 'historia', minutos: 90 } }])
  assert.deepEqual(interpretAll('timer de una hora y media'), [{ action: 'crear_timer', params: { segundos: 5400 } }])
  assert.equal(interpretAll('abrí youtube y subí el volumen').length, 2, 'los pedidos juntos se siguen separando')
})
