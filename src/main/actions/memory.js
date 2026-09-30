import { describeWhen, startOfDay, addDays } from '../dates.js'
import { similarity } from '../memory.js'
import { summarizeUsage, durationText, CATEGORY_NAMES } from '../usage.js'

// "mi perro se llama Toby" → "tu perro se llama Toby"
const SWAPS = [
  [/\bmi\b/gi, 'tu'], [/\bmis\b/gi, 'tus'], [/\bme\b/gi, 'te'], [/\bmío\b/gi, 'tuyo'], [/\bmía\b/gi, 'tuya'],
  [/\bestoy\b/gi, 'estás'], [/\bsoy\b/gi, 'sos'], [/\btengo\b/gi, 'tenés'], [/\bvoy\b/gi, 'vas'], [/\bquiero\b/gi, 'querés']
]
export const toYou = (text) => SWAPS.reduce((s, [re, rep]) => s.replace(re, rep), text)

const capitalize = (s) => s.replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase())
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function listText(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

function todosText(todos) {
  if (!todos.length) return 'No tenés pendientes. ¡Bien ahí!'
  const list = todos.map((t, i) => `${i + 1}) ${t.texto}`).join(', ')
  return `Tenés ${todos.length === 1 ? 'un pendiente' : `${todos.length} pendientes`}: ${list}.`
}

function eventText(e, now) {
  return `${e.texto} ${describeWhen(e.cuando, e.conHora, now)}`
}

export const memoryActions = [
  // Nombre
  {
    name: 'guardar_nombre',
    description: 'Aprende tu nombre',
    run: ({ nombre }, ctx) => {
      const n = capitalize(nombre)
      ctx.memory.setName(n)
      return { text: `¡Un gusto, ${n}! Me lo guardo.`, face: 'love' }
    }
  },
  {
    name: 'quien_soy',
    description: 'Dice tu nombre',
    run: (_p, ctx) => {
      const n = ctx.memory.getName()
      return n
        ? { text: `Sos ${n}. ¿Cómo me voy a olvidar?`, face: 'happy' }
        : { text: 'Todavía no me dijiste tu nombre. Decime «me llamo…».', face: 'confused' }
    }
  },

  // Datos que le contás
  {
    name: 'recordar_dato',
    description: 'Guarda algo que le contás',
    run: ({ texto }, ctx) => {
      if (!texto) return { text: '¿De qué querés que me acuerde?', face: 'confused' }
      ctx.memory.addFact(texto)
      return { text: `Listo, me lo guardo: ${toYou(texto)}.`, face: 'happy' }
    }
  },
  {
    name: 'ver_datos',
    description: 'Cuenta lo que sabe de vos',
    run: (_p, ctx) => {
      const m = ctx.memory
      const parts = []
      if (m.getName()) parts.push(`Sé que te llamás ${m.getName()}.`)
      const facts = m.listFacts()
      if (facts.length) parts.push(`Me contaste que ${listText(facts.map((f) => toYou(f.texto)))}.`)
      const todos = m.listTodos().length
      const events = m.data.agenda.length
      if (todos || events) parts.push(`Tenés ${todos} pendiente${todos === 1 ? '' : 's'} y ${events} cosa${events === 1 ? '' : 's'} en la agenda.`)
      if (!parts.length) return { text: 'Todavía no me contaste nada. Probá «acordate que…» o «me llamo…».', face: 'confused' }
      return { text: parts.join(' '), face: 'happy' }
    }
  },
  {
    name: 'olvidar',
    description: 'Borra algo de la memoria',
    run: ({ buscar }, ctx) => {
      const item = ctx.memory.forget(buscar)
      return item
        ? { text: `Listo, me olvidé de: ${toYou(item.texto)}.`, face: 'happy' }
        : { text: 'No encontré nada sobre eso.', face: 'confused' }
    }
  },
  {
    name: 'olvidar_todo',
    description: 'Borra toda la memoria (pide confirmación)',
    confirm: true,
    confirmText: () => '¿Me olvido de todo? Tu nombre, lo que me contaste, tus pendientes y tu agenda.',
    run: (_p, ctx) => {
      ctx.memory.forgetAll()
      return { text: 'Listo, empiezo de cero. ¿Cómo te llamás?', face: 'sad' }
    }
  },

  // Pendientes
  {
    name: 'agregar_pendiente',
    description: 'Anota un pendiente',
    run: ({ texto }, ctx) => {
      if (!texto) return { text: '¿Qué querés que anote?', face: 'confused' }
      ctx.memory.addTodo(texto)
      const n = ctx.memory.listTodos().length
      return {
        text: `Anotado: ${texto}. Tenés ${n === 1 ? 'un pendiente' : `${n} pendientes`}. Si querés que te avise, decime cuándo.`,
        face: 'happy'
      }
    }
  },
  {
    name: 'ver_pendientes',
    description: 'Lista los pendientes',
    run: (_p, ctx) => {
      const todos = ctx.memory.listTodos()
      return { text: todosText(todos), face: todos.length ? 'happy' : 'love' }
    }
  },
  {
    name: 'completar_pendiente',
    description: 'Tacha un pendiente',
    run: ({ buscar, numero }, ctx) => {
      const item = ctx.memory.completeTodo({ buscar, numero })
      if (!item) {
        return numero
          ? { text: `No tengo un pendiente número ${numero}.`, face: 'confused' }
          : { text: '¡Bien ahí! No lo tenía en tus pendientes, pero igual te felicito.', face: 'happy' }
      }
      const left = ctx.memory.listTodos().length
      const rest = left === 0 ? 'No te queda nada pendiente.' : left === 1 ? 'Te queda uno.' : `Te quedan ${left}.`
      return { text: `¡Bien! Taché «${item.texto}». ${rest}`, face: 'happy' }
    }
  },
  {
    name: 'limpiar_pendientes',
    description: 'Borra todos los pendientes (pide confirmación)',
    confirm: true,
    confirmText: (_p, ctx) => `¿Borro todos tus pendientes (${ctx.memory.listTodos().length})?`,
    run: (_p, ctx) => {
      const n = ctx.memory.clearTodos()
      return { text: n ? `Listo, borré ${n} pendiente${n === 1 ? '' : 's'}.` : 'No tenías pendientes.', face: 'happy' }
    }
  },

  // Agenda
  {
    name: 'agendar',
    description: 'Agenda algo para un día y hora',
    run: ({ texto, cuando, conHora }, ctx) => {
      const now = new Date()
      if (!texto) return { text: `¿Qué tenés ${describeWhen(cuando, conHora, now)}?`, face: 'confused' }
      if (conHora && new Date(cuando) < now) return { text: 'Ese horario ya pasó. ¿Para cuándo lo agendo?', face: 'confused' }
      ctx.memory.addEvent({ texto, cuando, conHora })
      const aviso = conHora ? 'Te aviso 15 minutos antes y a la hora.' : 'Te aviso la noche anterior y ese día a la mañana.'
      return { text: `Agendado: ${texto}, ${describeWhen(cuando, conHora, now)}. ${aviso}`, face: 'happy' }
    }
  },
  {
    name: 'ver_agenda',
    description: 'Cuenta lo que tenés agendado',
    run: ({ dia, dias }, ctx) => {
      const now = new Date()
      const todos = ctx.memory.listTodos().length
      const extra = todos ? ` Y tenés ${todos === 1 ? 'un pendiente' : `${todos} pendientes`}.` : ''
      if (dia) {
        const from = startOfDay(dia)
        const to = new Date(addDays(from, 1) - 1)
        const events = ctx.memory.eventsBetween(from, to)
        const when = describeWhen(from, false, now)
        if (!events.length) return { text: `No tenés nada agendado para ${when}.${extra}`, face: 'happy' }
        const items = events.map((e) => (e.conHora ? `${e.texto} a las ${describeWhen(e.cuando, true, now).split(' a las ')[1]}` : e.texto))
        return { text: `${upperFirst(when)} tenés: ${listText(items)}.${extra}`, face: 'happy' }
      }
      const from = startOfDay(now)
      const events = ctx.memory.eventsBetween(from, addDays(from, dias ?? 7))
      if (!events.length) return { text: `No tenés nada agendado para los próximos ${dias ?? 7} días.${extra}`, face: 'happy' }
      return { text: `Se viene: ${listText(events.map((e) => eventText(e, now)))}.${extra}`, face: 'happy' }
    }
  },
  {
    name: 'consultar_memoria',
    description: 'Busca en la agenda, los pendientes y lo que le contaste',
    run: ({ buscar }, ctx) => {
      const m = ctx.memory
      const now = new Date()
      const candidates = [
        ...m.data.agenda.map((e) => ({ kind: 'evento', item: e })),
        ...m.listFacts().map((f) => ({ kind: 'dato', item: f })),
        ...m.listTodos().map((t) => ({ kind: 'pendiente', item: t }))
      ]
        .map((c) => ({ ...c, score: similarity(buscar, c.item.texto) }))
        .filter((c) => c.score >= 0.34)
        .sort((a, b) => b.score - a.score)
      const top = candidates[0]
      if (!top) return { text: 'No lo tengo anotado. ¿Querés que lo busque en internet?', face: 'confused', suggestions: [`buscá ${buscar}`] }
      if (top.kind === 'evento') return { text: `${upperFirst(top.item.texto)} es ${describeWhen(top.item.cuando, top.item.conHora, now)}.`, face: 'happy' }
      if (top.kind === 'dato') return { text: `Me contaste que ${toYou(top.item.texto)}.`, face: 'happy' }
      return { text: `Lo tenés en pendientes: ${top.item.texto}.`, face: 'happy' }
    }
  }
]

export const contextActions = [
  {
    name: 'que_hago',
    description: 'Cuenta qué estás haciendo en la compu',
    run: (_p, ctx) => {
      const snap = ctx.awareness()
      if (!snap) return { text: 'Por ahora solo me doy cuenta de eso en Windows.', face: 'confused' }
      const act = snap.actividad
      if (!act) return { text: 'No veo nada en especial abierto.', face: 'confused' }
      const since = snap.enActividadSeg >= 60 ? ` hace ${durationText(snap.enActividadSeg)}` : ''
      return { text: `Estás en ${act.app} (${CATEGORY_NAMES[act.categoria] ?? act.categoria})${since}.`, face: 'happy' }
    }
  },
  {
    name: 'uso_hoy',
    description: 'Cuenta cuánto usaste la compu hoy',
    run: ({ buscar }, ctx) => ({ text: summarizeUsage(ctx.memory.getUsage(new Date()), { buscar }), face: 'happy' })
  },
  {
    name: 'no_molestar',
    description: 'Pixie no habla ni avisa por un rato',
    run: ({ minutos = 60 }, ctx) => {
      ctx.setQuiet(minutos)
      return {
        text: `Listo, no te molesto por ${durationText(minutos * 60)}. Los recordatorios de la agenda te los aviso igual, sin hablar.`,
        face: 'wink'
      }
    }
  },
  {
    name: 'molestar',
    description: 'Pixie vuelve a hablar',
    run: (_p, ctx) => {
      ctx.setQuiet(0)
      return { text: '¡Volví! Ya puedo hablar.', face: 'happy' }
    }
  }
]
