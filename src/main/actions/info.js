import { describeWeather } from './weather.js'
import { timersSummary } from './timers.js'

const locale = 'es-AR'

function timeText(date = new Date()) {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

function dateText(date = new Date()) {
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'Buen día'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export const infoActions = [
  {
    name: 'decir_hora',
    description: 'Dice la hora o la fecha de hoy',
    run: ({ fecha }) => ({
      text: fecha ? `Hoy es ${dateText()}.` : `Son las ${timeText()}.`,
      face: 'happy'
    })
  },
  {
    name: 'buen_dia',
    description: 'Resumen del momento: hora, clima y timers',
    run: async (_params, ctx) => {
      const parts = [`${greeting()}. Hoy es ${dateText()} y son las ${timeText()}.`]
      try {
        parts.push(await describeWeather(ctx))
      } catch {
        parts.push('No pude ver el clima.')
      }
      parts.push(timersSummary())
      return { text: parts.filter(Boolean).join(' '), face: 'happy' }
    }
  },
  {
    name: 'saludo',
    description: 'Saluda',
    run: (_params, ctx) => ({
      text: `¡Hola! Soy Pixie. Pedime cosas como «abrí YouTube» o «timer de 5 minutos». Me llamás con ${ctx.shortcutLabel()}.`,
      face: 'happy'
    })
  },
  {
    name: 'gracias',
    description: 'Responde a un agradecimiento',
    run: () => ({ text: '¡De nada!', face: 'happy' })
  },
  {
    name: 'ayuda',
    description: 'Muestra lo que Pixie sabe hacer',
    run: () => ({
      text:
        'Puedo: decirte la hora y el clima, abrir apps, sitios y carpetas, buscar en Google o YouTube, ' +
        'manejar el volumen y la música, poner timers y Pomodoros, bloquear la compu, sacar una captura ' +
        'y contarte cómo está la compu. Probá «buen día».',
      face: 'happy',
      suggestions: ['buen día', 'abrí YouTube', 'timer de 5 minutos', '¿cómo está la compu?']
    })
  },
  {
    name: 'ocultar',
    description: 'Esconde a Pixie hasta que lo llames con el atajo',
    run: (_params, ctx) => {
      setTimeout(() => ctx.hideWindow(), 1200)
      return { text: `¡Chau! Llamame con ${ctx.shortcutLabel()}.`, face: 'happy' }
    }
  }
]
