import { describeWeather } from './weather.js'
import { timersSummary } from './timers.js'
import { evaluate } from '../calc.js'
import { JOKES, FACTS } from '../content.js'

const locale = 'es-AR'
const pick = (list) => list[Math.floor(Math.random() * list.length)]

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

const CHAT = {
  quien_sos: () => ({
    text: 'Soy Pixie, tu asistente de escritorio. Me hicieron Sofía, Thomas, Mauro y Lautaro. Vivo en esta esquina y te ayudo con la compu.',
    face: 'happy'
  }),
  como_estas: (ctx) => {
    const text = ctx?.howAreYou?.() ?? pick(['¡Re bien! Con ganas de ayudarte. ¿Qué necesitás?', 'Todo piola por acá. ¿Y vos?'])
    const feeling = ctx?.feeling?.()
    return { text, face: { contento: 'love', aburrido: 'sad', cansado: 'sad' }[feeling] ?? 'happy' }
  },
  chiste: () => ({ text: pick(JOKES), face: 'wink' }),
  dato: () => ({ text: `¿Sabías que…? ${pick(FACTS)}`, face: 'surprised' }),
  carino: () => ({ text: pick(['¡Aww, yo también te quiero!', '¡Me vas a hacer sonrojar los píxeles!', '¡Gracias! Vos también sos lo más.']), face: 'love' }),
  insulto: () => ({ text: 'Eso me dolió un poquito… pero igual te sigo ayudando.', face: 'angry' }),
  aburrido: () => ({
    text: '¿Te cuento un chiste o un dato curioso? También te puedo poner algo en YouTube.',
    face: 'happy',
    suggestions: ['contame un chiste', 'dato curioso', 'poné videos de gatos']
  }),
  callate: () => ({ text: 'Ok, me callo.', face: 'sad', speak: false }),
  ahora_no: () => ({ text: pick(['¡Dale! Cuando quieras.', 'Ok, otro rato será.', 'Tranqui, acá estoy si me necesitás.']), face: 'wink' }),
  risa: () => ({ text: pick(['¡Jaja! Sabía que te iba a gustar.', '¡Ya sé, soy re gracioso!', 'Tengo más, eh. Pedime otro cuando quieras.']), face: 'laugh' }),
  animo: () => ({
    text: '¡Ánimo! Todos tenemos días así. ¿Te cuento un chiste o te pongo algo de música?',
    face: 'love',
    suggestions: ['contame un chiste', 'poné música', 'poné videos de gatos']
  }),
  estudiar: () => ({
    text: '¡Vamos! Te puedo arrancar un Pomodoro de 25 minutos, abrir Classroom o poner música para concentrarte.',
    face: 'happy',
    suggestions: ['arrancá un pomodoro', 'abrí classroom', 'poné lofi para estudiar en youtube']
  })
}

const pretty = (expr) => expr.replace(/\((\d+(?:\.\d+)?)\/100\*(\d+(?:\.\d+)?)\)/g, '$1% de $2').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/(?<=[\d)])-/g, ' − ')

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
    description: 'Resumen del momento: hora, agenda, pendientes, clima y timers',
    run: async (_params, ctx) => {
      const now = new Date()
      const name = ctx.memory?.getName()
      const parts = [`${greeting(now)}${name ? `, ${name}` : ''}. Hoy es ${dateText(now)} y son las ${timeText(now)}.`]
      if (ctx.memory) {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start.getTime() + 86400000 - 1)
        const events = ctx.memory.eventsBetween(start, end).map((e) =>
          e.conHora ? `${e.texto} a las ${new Date(e.cuando).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : e.texto
        )
        if (events.length) parts.push(`Hoy tenés: ${events.join(', ')}.`)
        const todos = ctx.memory.listTodos().length
        if (todos) parts.push(`Te ${todos === 1 ? 'queda un pendiente' : `quedan ${todos} pendientes`}.`)
      }
      try {
        parts.push(await describeWeather(ctx))
      } catch {
        // sin internet: el resumen sale igual
      }
      parts.push(timersSummary())
      return { text: parts.filter(Boolean).join(' '), face: 'happy' }
    }
  },
  {
    name: 'saludo',
    description: 'Saluda',
    run: (_params, ctx) => ({
      text: pick([
        `¡Hola${ctx.memory?.getName() ? `, ${ctx.memory.getName()}` : ''}! Pedime lo que necesites o llamame con ${ctx.shortcutLabel()}.`,
        `¡Hola, hola${ctx.memory?.getName() ? ` ${ctx.memory.getName()}` : ''}! ¿En qué te ayudo?`,
        '¡Buenas! Acá estoy. ¿Qué hacemos?'
      ]),
      face: 'happy'
    })
  },
  {
    name: 'gracias',
    description: 'Responde a un agradecimiento',
    run: () => ({ text: pick(['¡De nada!', '¡Para eso estoy!', '¡Cuando quieras!']), face: 'love' })
  },
  {
    name: 'charla',
    description: 'Charla: quién es, chistes, datos curiosos',
    run: ({ tema }, ctx) => (CHAT[tema] ?? CHAT.como_estas)(ctx)
  },
  {
    name: 'calcular',
    description: 'Hace una cuenta',
    run: ({ expresion }) => {
      const result = evaluate(expresion)
      if (result === null) return { text: 'No pude hacer esa cuenta. Probá con algo como «25 por 4».', face: 'confused' }
      const value = result.toLocaleString(locale, { maximumFractionDigits: 6 })
      return { text: `${pretty(expresion)} = ${value}`, face: 'happy' }
    }
  },
  {
    name: 'ayuda',
    description: 'Muestra lo que Pixie sabe hacer',
    run: () => ({
      text:
        'Puedo abrir apps, sitios y carpetas, buscar en Google, YouTube o Maps, manejar el volumen y la música, ' +
        'poner timers, hacer cuentas y decirte la hora y el clima. También me acuerdo de cosas: agenda, pendientes ' +
        'y lo que me cuentes, y te aviso a tiempo. Me doy cuenta de lo que hacés en la compu y te hablo cuando hace falta.',
      face: 'happy',
      suggestions: ['el martes tengo prueba de historia', 'anotá comprar cartuchos', '¿qué tengo esta semana?', '¿cuánto usé la compu hoy?']
    })
  },
  {
    name: 'jugar',
    description: 'Juega al Pong contra Pixie: sus ojos y su boca se vuelven el juego',
    run: () => ({
      text: pick(['¡Dale, juguemos al Pong!', '¡Sí! Preparate que no te la dejo fácil.', '¡Pong! A ver quién gana.']),
      face: 'happy',
      game: 'pong'
    })
  },
  {
    name: 'ocultar',
    description: 'Esconde a Pixie hasta que lo llames con el atajo',
    run: (_params, ctx) => {
      setTimeout(() => ctx.hideWindow(), 1600)
      return { text: `¡Chau! Llamame con ${ctx.shortcutLabel()}.`, face: 'wink' }
    }
  }
]
