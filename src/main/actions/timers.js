const MAX_SECONDS = 24 * 3600
const timers = new Map()
let nextId = 1
// Para la pantallita: cada vez que cambian los timers (se crea, se pausa, termina)
let listener = () => {}
// El modo Pomodoro (pomodoro.js) avisa si está en un bloque de estudio
let pomodoroProbe = () => false

export function onTimersChange(fn) {
  listener = fn
}
export function setPomodoroProbe(fn) {
  pomodoroProbe = fn
}

// Lo que se ve en la pantallita: { id, etiqueta, finAt, restanteMs, totalMs, pausado }
export function timersState() {
  return [...timers.values()]
    .map((t) => ({ id: t.id, etiqueta: t.etiqueta ?? null, finAt: t.paused === null ? t.endsAt : null, restanteMs: t.paused ?? Math.max(0, t.endsAt - Date.now()), totalMs: t.totalMs, pausado: t.paused !== null }))
    .sort((a, b) => a.restanteMs - b.restanteMs)
}
const changed = () => listener(timersState())

function arm(timer, ms, fire) {
  clearTimeout(timer.handle)
  timer.endsAt = Date.now() + ms
  timer.handle = setTimeout(fire, ms)
}

// Pausa o sigue un timer (el más cercano si no decís cuál). Devuelve el estado o null si no hay.
export function toggleTimer(id = null) {
  const t = id ? timers.get(id) : timers.get(timersState()[0]?.id)
  if (!t) return null
  if (t.paused === null) {
    t.paused = Math.max(0, t.endsAt - Date.now())
    clearTimeout(t.handle)
  } else {
    arm(t, t.paused, t.fire)
    t.paused = null
  }
  changed()
  return { pausado: t.paused !== null, etiqueta: t.etiqueta }
}

export function durationText(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`)
  if (m) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`)
  if (sec && !h) parts.push(`${sec} ${sec === 1 ? 'segundo' : 'segundos'}`)
  return parts.join(' y ') || '0 segundos'
}

function describe(timer) {
  const left = Math.ceil((timer.paused ?? timer.endsAt - Date.now()) / 1000)
  return `${timer.etiqueta ? `«${timer.etiqueta}»` : 'el timer'} (faltan ${durationText(left)}${timer.paused !== null ? ', en pausa' : ''})`
}

export function isPomodoroRunning() {
  return pomodoroProbe() || [...timers.values()].some((t) => t.etiqueta === 'Pomodoro')
}

export function timersSummary() {
  if (!timers.size) return ''
  const list = [...timers.values()].map(describe)
  return timers.size === 1 ? `Tenés ${list[0]}.` : `Tenés ${timers.size} timers: ${list.join(', ')}.`
}

export const timerActions = [
  {
    name: 'crear_timer',
    description: 'Pone un timer o recordatorio',
    run: ({ segundos, etiqueta }, ctx) => {
      if (!segundos) {
        return { text: '¿De cuánto? Por ejemplo: «timer de 10 minutos».', face: 'confused' }
      }
      if (segundos > MAX_SECONDS) {
        return { text: 'Por ahora pongo timers de hasta 24 horas.', face: 'confused' }
      }
      const id = nextId++
      const timer = { id, etiqueta, endsAt: Date.now() + segundos * 1000, totalMs: segundos * 1000, paused: null }
      timer.fire = () => {
        timers.delete(id)
        changed()
        const pomodoro = etiqueta === 'Pomodoro'
        const text = pomodoro
          ? '¡Terminó el Pomodoro! Muy bien. Tomate 5 minutos de descanso.'
          : etiqueta
            ? `¡Tiempo! Te aviso: ${etiqueta}.`
            : `¡Terminó el timer de ${durationText(segundos)}!`
        ctx.notify('Pixie', text)
        ctx.phoneIfAway?.(text)
        ctx.emit({ type: 'alarm', text, suggestions: pomodoro ? ['timer de 5 minutos', 'arrancá un pomodoro'] : undefined })
        ctx.log(`timer terminado: ${etiqueta ?? durationText(segundos)}`)
      }
      arm(timer, segundos * 1000, timer.fire)
      timers.set(id, timer)
      changed()
      const about = etiqueta && etiqueta !== 'Pomodoro' ? ` para «${etiqueta}»` : ''
      const kind = etiqueta === 'Pomodoro' ? 'Pomodoro de 25 minutos. ¡A concentrarse!' : `timer de ${durationText(segundos)}${about}.`
      return { text: `Listo, ${kind}`, face: 'happy' }
    }
  },
  {
    name: 'pausar_timer',
    description: 'Pausa o sigue el timer que está andando',
    run: () => {
      const r = toggleTimer()
      if (!r) return { text: 'No hay timers andando.', face: 'confused' }
      const what = r.etiqueta ? `«${r.etiqueta}»` : 'el timer'
      return { text: r.pausado ? `Pausé ${what}. Tocá la pantallita o decime «seguí con el timer» para seguir.` : `Sigue ${what}.`, face: 'happy' }
    }
  },
  {
    name: 'ver_timers',
    description: 'Cuenta cuánto falta en los timers',
    run: () => ({ text: timersSummary() || 'No hay timers andando.', face: 'happy' })
  },
  {
    name: 'cancelar_timers',
    description: 'Cancela todos los timers',
    run: () => {
      const n = timers.size
      for (const t of timers.values()) clearTimeout(t.handle)
      timers.clear()
      changed()
      return { text: n ? `Cancelé ${n === 1 ? 'el timer' : `${n} timers`}.` : 'No había timers andando.', face: 'happy' }
    }
  }
]
