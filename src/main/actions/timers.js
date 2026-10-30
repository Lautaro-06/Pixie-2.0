const MAX_SECONDS = 24 * 3600
export const POMODORO = 'Pomodoro'
const timers = new Map()
let nextId = 1

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

// Segundos que le faltan a un timer (si está en pausa, lo que le quedaba al pausarlo).
function remainingSeconds(timer) {
  const ms = timer.paused ? timer.remainingMs : timer.endsAt - Date.now()
  return Math.max(0, Math.ceil(ms / 1000))
}

function describe(timer) {
  const left = durationText(remainingSeconds(timer))
  const name = timer.etiqueta ? `«${timer.etiqueta}»` : 'el timer'
  return timer.paused ? `${name} (en pausa, faltan ${left})` : `${name} (faltan ${left})`
}

// Orden en que se muestran: primero el Pomodoro, después el que termina antes.
function sortedTimers() {
  return [...timers.values()].sort((a, b) => {
    const pa = a.etiqueta === POMODORO ? 0 : 1
    const pb = b.etiqueta === POMODORO ? 0 : 1
    return pa - pb || remainingSeconds(a) - remainingSeconds(b)
  })
}

// Lo que necesita la interfaz para dibujar el cronómetro. El primero de la lista es el que se muestra grande.
// `endsAt` (ms) permite que la interfaz cuente sola, sin que main mande un mensaje por segundo; en pausa va null.
export function timersSnapshot() {
  return sortedTimers().map((t) => ({
    id: t.id,
    etiqueta: t.etiqueta ?? null,
    pomodoro: t.etiqueta === POMODORO,
    total: t.total,
    remaining: remainingSeconds(t),
    endsAt: t.paused ? null : t.endsAt,
    paused: t.paused
  }))
}

function publish(ctx) {
  ctx.emit({ type: 'timers', timers: timersSnapshot() })
}

// Un Pomodoro en pausa sigue contando como Pomodoro andando (la sesión sigue abierta).
export function isPomodoroRunning() {
  return [...timers.values()].some((t) => t.etiqueta === POMODORO)
}

export function timersSummary() {
  if (!timers.size) return ''
  const list = sortedTimers().map(describe)
  return timers.size === 1 ? `Tenés ${list[0]}.` : `Tenés ${timers.size} timers: ${list.join(', ')}.`
}

function finish(timer, ctx) {
  timers.delete(timer.id)
  const { etiqueta, total } = timer
  const pomodoro = etiqueta === POMODORO
  const text = pomodoro
    ? '¡Terminó el Pomodoro! Muy bien. Tomate 5 minutos de descanso.'
    : etiqueta
      ? `¡Tiempo! Te aviso: ${etiqueta}.`
      : `¡Terminó el timer de ${durationText(total)}!`
  publish(ctx)
  ctx.notify('Pixie', text)
  ctx.phoneIfAway?.(text)
  ctx.emit({ type: 'alarm', text, suggestions: pomodoro ? ['timer de 5 minutos', 'arrancá un pomodoro'] : undefined })
  ctx.log(`timer terminado: ${etiqueta ?? durationText(total)}`)
}

function arm(timer, ms, ctx) {
  timer.endsAt = Date.now() + ms
  timer.paused = false
  timer.remainingMs = null
  timer.handle = setTimeout(() => finish(timer, ctx), ms)
}

// Elige el timer al que se refiere el pedido: el que dice `id`, o si no, el primero que cumpla `filtro`.
function pick(id, filtro) {
  if (id != null) {
    const byId = timers.get(Number(id))
    return byId && filtro(byId) ? byId : undefined
  }
  return sortedTimers().find(filtro)
}

export const timerActions = [
  {
    name: 'crear_timer',
    description: 'Pone un timer o recordatorio',
    run: ({ segundos, etiqueta }, ctx) => {
      const total = Math.round(Number(segundos))
      if (!total || total <= 0) {
        return { text: '¿De cuánto? Por ejemplo: «timer de 10 minutos».', face: 'confused' }
      }
      if (total > MAX_SECONDS) {
        return { text: 'Por ahora pongo timers de hasta 24 horas.', face: 'confused' }
      }
      const timer = { id: nextId++, etiqueta, total, endsAt: 0, paused: false, remainingMs: null, handle: null }
      arm(timer, total * 1000, ctx)
      timers.set(timer.id, timer)
      publish(ctx)
      const about = etiqueta && etiqueta !== POMODORO ? ` para «${etiqueta}»` : ''
      const kind = etiqueta === POMODORO ? `Pomodoro de ${durationText(total)}. ¡A concentrarse!` : `timer de ${durationText(total)}${about}.`
      return { text: `Listo, ${kind}`, face: 'happy' }
    }
  },
  {
    name: 'ver_timers',
    description: 'Cuenta cuánto falta en los timers',
    run: () => ({ text: timersSummary() || 'No hay timers andando.', face: 'happy' })
  },
  {
    name: 'pausar_timer',
    description: 'Pausa un timer (el que se ve en pantalla, o el indicado por id)',
    run: ({ id } = {}, ctx) => {
      const timer = pick(id, (t) => !t.paused)
      if (!timer) return { text: 'No hay ningún timer andando para pausar.', face: 'confused' }
      clearTimeout(timer.handle)
      timer.remainingMs = Math.max(0, timer.endsAt - Date.now())
      timer.paused = true
      timer.handle = null
      publish(ctx)
      return { text: `Listo, pausé ${describe(timer)}.`, face: 'happy' }
    }
  },
  {
    name: 'reanudar_timer',
    description: 'Sigue un timer que estaba en pausa',
    run: ({ id } = {}, ctx) => {
      const timer = pick(id, (t) => t.paused)
      if (!timer) return { text: 'No hay ningún timer en pausa.', face: 'confused' }
      arm(timer, timer.remainingMs, ctx)
      publish(ctx)
      return { text: `Seguimos: ${describe(timer)}.`, face: 'happy' }
    }
  },
  {
    name: 'cancelar_timer',
    description: 'Cancela un solo timer (el que se ve en pantalla, o el indicado por id)',
    run: ({ id } = {}, ctx) => {
      const timer = pick(id, () => true)
      if (!timer) return { text: 'No hay ningún timer para cancelar.', face: 'confused' }
      clearTimeout(timer.handle)
      timers.delete(timer.id)
      publish(ctx)
      return { text: `Cancelé ${timer.etiqueta ? `«${timer.etiqueta}»` : 'el timer'}.`, face: 'happy' }
    }
  },
  {
    name: 'cancelar_timers',
    description: 'Cancela todos los timers',
    run: (_args, ctx) => {
      const n = timers.size
      for (const t of timers.values()) clearTimeout(t.handle)
      timers.clear()
      publish(ctx)
      return { text: n ? `Cancelé ${n === 1 ? 'el timer' : `${n} timers`}.` : 'No había timers andando.', face: 'happy' }
    }
  }
]