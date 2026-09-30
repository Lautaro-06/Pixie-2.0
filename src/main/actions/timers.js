const MAX_SECONDS = 24 * 3600
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

function describe(timer) {
  const left = Math.ceil((timer.endsAt - Date.now()) / 1000)
  return `${timer.etiqueta ? `«${timer.etiqueta}»` : 'el timer'} (faltan ${durationText(left)})`
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
      const timer = { id, etiqueta, endsAt: Date.now() + segundos * 1000 }
      timer.handle = setTimeout(() => {
        timers.delete(id)
        const text = etiqueta
          ? `¡Tiempo! Te aviso: ${etiqueta}.`
          : `¡Terminó el timer de ${durationText(segundos)}!`
        ctx.notify('Pixie', text)
        ctx.emit({ type: 'alarm', text })
        ctx.log(`timer terminado: ${etiqueta ?? durationText(segundos)}`)
      }, segundos * 1000)
      timers.set(id, timer)
      const about = etiqueta && etiqueta !== 'Pomodoro' ? ` para «${etiqueta}»` : ''
      const kind = etiqueta === 'Pomodoro' ? 'Pomodoro de 25 minutos. ¡A concentrarse!' : `timer de ${durationText(segundos)}${about}.`
      return { text: `Listo, ${kind}`, face: 'happy' }
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
      return { text: n ? `Cancelé ${n === 1 ? 'el timer' : `${n} timers`}.` : 'No había timers andando.', face: 'happy' }
    }
  }
]
