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
import { combineScene } from './scenes.js'

// Avisos que se dicen menos si no les das bola
const LEARNS = new Set(['charla', 'agua', 'pausa', 'noticias', 'distraccion'])
// En un bloque de Pomodoro solo se dicen estos; el resto se guarda para el descanso
// En un bloque de estudio solo se dice lo del Pomodoro, las distracciones y el «Ya volví» después de actualizarse
const DURING_FOCUS = new Set(['pomodoro', 'distraccion', 'volvio'])
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,]/g, ' ').trim()

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
  let held = [] // avisos guardados durante un bloque de Pomodoro
  let missed = [] // los que se guardó en el último bloque (para «¿qué me perdí?»)
  // El disfraz de Pixie según lo que hacés, y la música que suena (se mira cada 10 segundos)
  let scene = { escena: null, auris: false }
  let media = null
  let mediaCheckedAt = 0

  function updateScene(snap) {
    if (ctx.media && Date.now() - mediaCheckedAt > 10000) {
      mediaCheckedAt = Date.now()
      ctx.media
        .info()
        .then((m) => (media = m))
        .catch(() => (media = null))
    }
    const next = combineScene(snap.escena ?? null, media)
    if (next.escena !== scene.escena || next.auris !== scene.auris) {
      scene = next
      sendEvent({ type: 'escena', ...scene })
    }
  }

  const isQuiet = () => {
    const snap = awareness.snapshot()
    return snap.pantallaCompleta || snap.enReunion || Date.now() < quietUntil
  }

  function shareFeeling() {
    const f = feeling(memory.getMood(), new Date())
    if (f !== lastFeeling) {
      lastFeeling = f
      sendEvent({ type: 'feeling', feeling: f })
    }
  }

  async function deliver(notice) {
    // Estudiando no molesta: lo guarda para el descanso (los recordatorios de la agenda y la batería, igual)
    if (ctx.pomodoro?.enFoco() && !notice.urgent && !DURING_FOCUS.has(notice.kind)) {
      held.push(notice)
      return
    }
    let n = notice
    if (n.kind === 'resumen') n = { ...(await runAction('buen_dia', {}, ctx)), kind: 'resumen' }
    if (n.kind === 'noticias') {
      n = { ...(await runAction('noticias', { aviso: true }, ctx)), kind: 'noticias' }
      if (!n.text) return // sin internet o sin nada nuevo: no dice nada
    }
    const quiet = isQuiet()
    if (n.urgent) {
      notify('Pixie', n.text)
      // Los recordatorios de la agenda también al WhatsApp (la batería baja, no)
      if (n.kind === 'recordatorio') (ctx.phoneNotify ?? ctx.phoneIfAway)?.(n.text)
      showWindow?.() // aunque lo hayas escondido, los recordatorios aparecen
    }
    if (n.pregunta) question = { ...n.pregunta, hasta: Date.now() + QUESTION_MS }
    if (LEARNS.has(n.kind)) memory.noticeSent(n.kind)
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
    const workSuggestion = ctx.hasPending?.() ? null : ctx.work?.suggestionForUsage?.(memory.getUsage(now), now) ?? null
    const { notices, presence } = initiative.tick(
      now,
      {
        ...snap,
        workSuggestion,
        silencioHasta: quietUntil,
        pomodoro: isPomodoroRunning(),
        pomodoroAvisos: ctx.getConfig().pomodoroDistracciones !== false,
        // En un bloque: lo que tenés adelante según Pixie (la música no distrae; un video de una clase, tampoco)
        foco: ctx.pomodoroFocus ? ctx.pomodoroFocus() : undefined,
        salud: ctx.getConfig().recordatoriosSalud !== false,
        noticias: ctx.getConfig().noticiasAvisos ?? 'aveces',
        // Cuántos mails llegaron desde un momento (si pediste los avisos de mails)
        mailsDesde: (since) => (ctx.mail?.status().avisos ? ctx.mail.arrivedSince(since).length : 0)
      },
      memory
    )
    for (const notice of notices) {
      if (notice.kind === 'work_profile_suggestion') {
        ctx.work?.recordSuggestion?.(workSuggestion.id, now)
        ctx.setPending?.({ action: 'work_profile_suggestion', params: { profileId: workSuggestion.id } })
      }
    }
    if (presence) sendEvent({ type: 'presence', away: presence === 'ausente', bloqueada: Boolean(snap.bloqueada) })
    updateScene(snap)
    for (const n of notices) deliver(n).catch((err) => console.error(err))
    shareFeeling()
  }

  // «¿Sigue pendiente?»: «ya lo hice» / «borralo» lo saca; «sigue» lo deja
  function answerOldTodo(text) {
    const t = fold(text)
    const { id, texto } = question
    const keep = /\b(sigue|todavia|aun|falta|dejalo|dejala|si sigue)\b/.test(t) || /^si$/.test(t)
    const done = /\b(ya (lo |la )?hice|ya esta|lo termine|la termine|hecho|listo)\b/.test(t)
    const remove = /\b(borra(lo|la)?|saca(lo|la)?|ya fue|ya no|olvida(lo|la)?|no va mas)\b/.test(t) || /^no$/.test(t)
    if (!keep && !done && !remove) return null
    question = null
    if (keep) {
      memory.touchTodo(id)
      return { text: `Dale, dejo «${texto}» en la lista. Te vuelvo a preguntar en unas semanas.`, face: 'happy' }
    }
    memory.removeTodo(id)
    return done ? { text: '¡Bien ahí! Lo saco de la lista.', face: 'love' } : { text: `Listo, borré «${texto}».`, face: 'happy' }
  }

  return {
    memory,
    // Para que otras partes de Pixie digan algo por su cuenta
    say: (notice) => deliver(notice).catch((err) => console.error(err)),
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
    lastWindow: () => (isWindows ? awareness.lastWindow() : null),
    setQuiet(minutes) {
      quietUntil = minutes > 0 ? Date.now() + minutes * 60000 : 0
    },
    feeling: () => feeling(memory.getMood(), new Date()),
    scene: () => scene,
    // En el descanso: lo que no te dijo mientras estudiabas, en una frase
    releaseHeld() {
      const list = held
      held = []
      if (!list.length) return ''
      missed = list
      const mails = list.filter((n) => n.kind === 'mail').length
      const others = list.length - mails
      const parts = []
      if (mails) parts.push(mails === 1 ? 'te llegó un mail' : `te llegaron ${mails} mails`)
      if (others) parts.push(others === 1 ? 'tengo un aviso para vos' : `tengo ${others} avisos para vos`)
      return `Mientras estudiabas ${parts.join(' y ')}: preguntame «¿qué me perdí?».`
    },
    // «¿Qué me perdí?»: lo que se guardó (en el último bloque y en este, si seguís estudiando)
    missedNotices() {
      const all = [...missed, ...held]
      missed = []
      return all.map((n) => {
        if (n.text) return n.text
        if (n.kind === 'noticias') return 'Hay noticias nuevas: preguntame «¿qué noticias hay?».'
        if (n.kind === 'resumen') return 'Tenía tu resumen del día: decime «buen día» y te lo cuento.'
        return null
      }).filter(Boolean)
    },
    heldNotices: () => [...held],
    howAreYou: () => howAreYou(memory.getMood(), new Date()),
    // Lo que la IA necesita saber en cada mensaje
    // query: lo que dijo ahora (lo sensible que guardó solo entra si habla de eso)
    contextText(query = '') {
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
      if (snap?.enReunion) lines.push('Está en una reunión o llamada: respondé corto.')
      const health = memory.getHealth(now)
      if (health.agua || health.pausas) lines.push(`Hoy tomó ${health.agua} vasos de agua e hizo ${health.pausas} pausas.`)
      lines.push(`Cómo se siente Pixie: ${feeling(memory.getMood(), now)}.`)
      // Con hace cuánto: «mañana tengo prueba» de hace un mes ya pasó
      const facts = memory.factsForAI(now, 15, query)
      if (facts.length) lines.push(`Lo que contó: ${facts.join('; ')}.`)
      const todos = memory.todosForAI(now)
      if (todos.length) lines.push(`Pendientes: ${todos.join('; ')}.`)
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
      if (question.tipo === 'pendiente_viejo') return answerOldTodo(text)
      const how = howItWent(text)
      if (!how) return null
      const { evento } = question
      question = null
      const r = AFTER_ANSWER[how]
      memory.addFact(`${evento}: me fue ${r.dijo}`)
      return { text: r.text[Math.floor(Math.random() * r.text.length)], face: r.face, suggestions: r.suggestions }
    },
    // Cada vez que le hablás, su ánimo cambia (y si fue después de un aviso, ese aviso sirvió)
    interacted(kind) {
      memory.noticeAnswered()
      memory.setMood(afterInteraction(memory.getMood(), kind))
      shareFeeling()
    }
  }
}
