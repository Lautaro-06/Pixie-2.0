// La "mente" de Pixie: junta la memoria, lo que ve de la compu, la iniciativa
// y su estado de ánimo. Cada 5 segundos mira cómo está todo y decide si hablar.
import { app } from 'electron'
import { join } from 'node:path'
import { createMemory } from './memory.js'
import { createAwareness } from './awareness.js'
import { createInitiative } from './initiative.js'
import { afterInteraction, feeling, howAreYou } from './feelings.js'
import { isPomodoroRunning } from './actions/timers.js'
import { runAction } from './actions/index.js'
import { isWindows } from './windows.js'

const TICK_MS = 5000

export function createMind({ ctx, sendEvent, notify, log, showWindow }) {
  const memory = createMemory(join(app.getPath('userData'), 'memoria.json'))
  const awareness = createAwareness()
  const initiative = createInitiative()
  let quietUntil = 0
  let lastFeeling = null
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
    sendEvent({ type: 'notice', text: n.text, face: n.face, voice: !quiet, suggestions: n.suggestions })
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
    // Cada vez que le hablás, su ánimo cambia
    interacted(kind) {
      memory.setMood(afterInteraction(memory.getMood(), kind))
      shareFeeling()
    }
  }
}
