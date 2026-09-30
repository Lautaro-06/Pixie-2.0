// La "mente" de Pixie: junta la memoria, lo que ve de la compu, la iniciativa
// y su estado de ánimo. Cada 5 segundos mira cómo está todo y decide si hablar.
import { app } from 'electron'
import { join } from 'node:path'
import { createMemory } from './memory.js'
import { createAwareness } from './awareness.js'
import { createInitiative } from './initiative.js'
import { afterInteraction, feeling, howAreYou } from './feelings.js'
import { isPomodoroRunning, timersSummary } from './actions/timers.js'
import { CATEGORY_NAMES, durationText, summarizeUsage } from './usage.js'
import { describeWhen, startOfDay, addDays } from './dates.js'
import { runAction } from './actions/index.js'
import { isWindows } from './windows.js'
import { howItWent } from './brain.js'

const TICK_MS = 5000
const QUESTION_MS = 20 * 60 * 1000 // cuánto espera la respuesta a "¿cómo te fue?"

const AFTER_ANSWER = {
  bien: { text: ['¡Qué bueno! Me alegro un montón.', '¡Bien ahí! Sabía que te iba a ir bien.'], face: 'love', dijo: 'bien' },
  masomenos: { text: ['Bueno, no siempre sale perfecto. La próxima sale mejor.', 'Ahí vamos. ¡Lo importante es que ya pasó!'], face: 'happy', dijo: 'más o menos' },
  mal: {
    text: ['Uh, qué bajón… La próxima va a salir mejor. ¿Te cuento un chiste para levantar?', 'Uf, lo siento. Igual ya pasó, y la próxima sale mejor.'],
    face: 'sad',
    dijo: 'mal',
    suggestions: ['contame un chiste', 'juguemos al pong']
  }
}

export function createMind({ ctx, sendEvent, notify, log, showWindow }) {
  const memory = createMemory(join(app.getPath('userData'), 'memoria.json'))
  const awareness = createAwareness()
  const initiative = createInitiative()
  let quietUntil = 0
  let lastFeeling = null
  let question = null // la última pregunta que hizo por su cuenta, esperando respuesta
  const timers = []

  const isQuiet = () => awareness.snapshot().pantallaCompleta || Date.now() < quietUntil

  function shareFeeling() {
    const f = feeling(memory.getMood(), new Date())
    if (f !== lastFeeling) {
      lastFeeling = f
      sendEvent({ type: 'feeling', feeling: f })
    }
  }

  async function deliver(notice) {
    let n = notice
    if (n.kind === 'resumen') n = { ...(await runAction('buen_dia', {}, ctx)), kind: 'resumen' }
    const quiet = isQuiet()
    if (n.urgent) {
      notify('Pixie', n.text)
      showWindow?.() // aunque lo hayas escondido, los recordatorios aparecen
    }
    if (n.pregunta) question = { ...n.pregunta, hasta: Date.now() + QUESTION_MS }
    sendEvent({ type: 'notice', text: n.text, face: n.face, voice: !quiet, suggestions: n.suggestions })
    ctx.ai?.note(`Pixie le dijo por su cuenta: «${n.text}».`)
    log(`aviso (${n.kind}): ${n.text}`)
  }

  function tick() {
    const now = new Date()
    const snap = awareness.snapshot()
    if (snap.actividad && snap.inactivoSeg < 120 && !snap.bloqueada) {
      memory.addUsage(now, snap.actividad.categoria, snap.actividad.app, TICK_MS / 1000)
    }
    const { notices, presence } = initiative.tick(
      now,
      { ...snap, silencioHasta: quietUntil, pomodoro: isPomodoroRunning() },
      memory
    )
    if (presence) sendEvent({ type: 'presence', away: presence === 'ausente' })
    for (const n of notices) deliver(n).catch((err) => console.error(err))
    shareFeeling()
  }

  return {
    memory,
    start() {
      awareness.start()
      timers.push(setTimeout(tick, 3000), setInterval(tick, TICK_MS), setInterval(() => memory.save(), 60000))
    },
    stop() {
      timers.forEach((t) => clearInterval(t))
      awareness.stop()
      memory.save()
    },
    // Lo que Pixie ve ahora (solo en Windows)
    snapshot: () => (isWindows ? awareness.snapshot() : null),
    setQuiet(minutes) {
      quietUntil = minutes > 0 ? Date.now() + minutes * 60000 : 0
    },
    feeling: () => feeling(memory.getMood(), new Date()),
    howAreYou: () => howAreYou(memory.getMood(), new Date()),
    // Lo que la IA necesita saber en cada mensaje
    contextText() {
      const now = new Date()
      const when = `${now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}, ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
      const lines = [`Ahora: ${when}.`]
      const name = memory.getName()
      if (name) lines.push(`Se llama ${name}.`)
      const snap = isWindows ? awareness.snapshot() : null
      if (snap?.actividad) {
        const cat = CATEGORY_NAMES[snap.actividad.categoria] ?? snap.actividad.categoria
        lines.push(`Está usando ${snap.actividad.app} (${cat}) hace ${durationText(snap.enActividadSeg)}.`)
      }
      lines.push(`Cómo se siente Pixie: ${feeling(memory.getMood(), now)}.`)
      const facts = memory.listFacts().slice(-15).map((f) => f.texto)
      if (facts.length) lines.push(`Lo que contó: ${facts.join('; ')}.`)
      const todos = memory.listTodos()
      if (todos.length) lines.push(`Pendientes: ${todos.map((t, i) => `${i + 1}) ${t.texto}`).join('; ')}.`)
      const events = memory.eventsBetween(startOfDay(now), addDays(startOfDay(now), 8))
      if (events.length) lines.push(`Agenda: ${events.map((e) => `${e.texto} ${describeWhen(e.cuando, e.conHora, now)}`).join('; ')}.`)
      const timers = timersSummary()
      if (timers) lines.push(timers)
      const usage = memory.getUsage(now)
      if (usage.total >= 600) lines.push(summarizeUsage(usage))
      return lines.join('\n')
    },
    // Si Pixie preguntó "¿cómo te fue?" hace poco y esto es la respuesta, contesta y se lo guarda
    answerQuestion(text) {
      if (!question || Date.now() > question.hasta) return null
      if (String(text).trim().split(/\s+/).length > 12) return null
      const how = howItWent(text)
      if (!how) return null
      const { evento } = question
      question = null
      const r = AFTER_ANSWER[how]
      memory.addFact(`${evento}: me fue ${r.dijo}`)
      return { text: r.text[Math.floor(Math.random() * r.text.length)], face: r.face, suggestions: r.suggestions }
    },
    // Cada vez que le hablás, su ánimo cambia
    interacted(kind) {
      memory.setMood(afterInteraction(memory.getMood(), kind))
      shareFeeling()
    }
  }
}
