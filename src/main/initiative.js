// Iniciativa: Pixie habla primero cuando tiene sentido. Cada 5 segundos mira
// cómo está todo y decide si avisar algo. No molesta en pantalla completa ni
// en modo "no molestar" (salvo recordatorios y batería muy baja).
import { dayKey, startOfDay, addDays } from './dates.js'
import { ageText } from './memory.js'
import { feeling } from './feelings.js'
import { JOKES, FACTS } from './content.js'

const MIN = 60 * 1000
export const TIMES = {
  pausaCada: 50 * MIN, // pausa activa
  distraccion: 40 * MIN, // mucho rato en videos o redes
  ausente: 5 * MIN, // sin tocar la compu
  saludoAlVolver: 10 * MIN, // saluda si estuviste afuera al menos esto
  sinInternet: 30 * 1000,
  charla: 90 * MIN, // habla de algo por su cuenta si no charlaron en este rato
  charlaTrasVolver: 15 * MIN, // pero no apenas te sentás
  agua: 2 * 60 * MIN, // recuerda tomar agua si no anotaste un vaso en este rato
  ocioAntesDeEntrega: 20 * MIN // jugando o con videos a la noche y mañana entregás algo
}
const CHARLAS_POR_DIA = 4
// No interrumpe si estás concentrado
const FOCUSED = new Set(['estudio', 'juego'])

const DISTRACTIONS = new Set(['video', 'redes'])
const LEISURE = new Set(['juego', 'video', 'redes'])
const DELIVERY = /\b(entreg\w*|tps?|trabajos? practicos?|pruebas?|examen(es)?|parcial(es)?|evaluaci\w*|finales?|oral(es)?|lecci\w*)\b/
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Lo que tenés que entregar o rendir mañana (de tu agenda, Google Calendar o Classroom)
function tomorrowDeliveries(memory, now) {
  const from = addDays(startOfDay(now), 1)
  const to = new Date(addDays(from, 1).getTime() - 1)
  return (memory.eventsBetween?.(from, to) ?? []).filter((e) => e.entrega || DELIVERY.test(fold(e.texto)))
}

const hhmm = (d) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// Noticias por su cuenta: cuántas por día según noticiasAvisos (de 9 a 22 h, espaciadas)
const NEWS_PER_DAY = { nunca: 0, aveces: 2, seguido: 4 }

function alertText(evento, clave) {
  switch (clave) {
    case 'antes': return `En 15 minutos: ${evento.texto}.`
    case 'hora': return `¡Es la hora! ${evento.texto}.`
    case 'noche': return `Te recuerdo que mañana tenés: ${evento.texto}.`
    default: return `Hoy tenés: ${evento.texto}.`
  }
}

// Algo para decir sin que te lo pidan, según lo que estás haciendo y cómo se siente Pixie
function smallTalk(snap, memory, now, rng, last) {
  const pick = (list) => list[Math.floor(rng() * list.length)]
  const options = [
    () => ({ tipo: 'pong', text: pick(['Me estoy aburriendo un poco… ¿jugamos un Pong?', '¿Un Pong rápido? Te doy ventaja… mentira.']), face: 'happy', suggestions: ['¡dale, juguemos!', 'ahora no'] }),
    () => ({ tipo: 'dato', text: `Me acordé de un dato curioso: ${pick(FACTS)}`, face: 'surprised', suggestions: ['otro dato curioso', 'contame un chiste'] }),
    () => ({ tipo: 'chiste', text: `Se me ocurrió un chiste: ${pick(JOKES)}`, face: 'wink', suggestions: ['jajaja', 'otro chiste'] })
  ]
  // Solo los pendientes recientes: de los viejos pregunta aparte si siguen
  const todos = memory.recentTodos?.(now) ?? memory.listTodos()
  if (todos.length) {
    options.push(() => ({ tipo: 'pendiente', text: `Te quedó pendiente «${pick(todos).texto}». ¿Le damos ahora?`, face: 'happy', suggestions: ['¿qué tengo pendiente?', 'ahora no'] }))
  }
  if (snap.actividad?.categoria === 'musica') {
    options.push(() => ({ tipo: 'musica', text: '¿Qué estás escuchando? Me dieron ganas de bailar.', face: 'music' }))
  }
  if (feeling(memory.getMood(), now) === 'aburrido') {
    options.push(() => ({ tipo: 'hola', text: '¿Todo bien por ahí? Hace rato que no hablamos y me aburro.', face: 'sad', suggestions: ['todo bien, ¿y vos?', 'contame un chiste'] }))
  }
  const fresh = options.map((f) => f()).filter((o) => o.tipo !== last)
  return pick(fresh)
}

export function createInitiative(times = TIMES, rng = Math.random) {
  const s = {
    inicio: null,
    ultimaCharla: 0,
    ultimoTipo: null,
    charlas: { dia: null, n: 0 },
    ultimoAvisoAgua: 0,
    activoDesde: null,
    ausenteDesde: null,
    racha: { categoria: null, desde: 0, avisada: false },
    pomodoroAvisado: false,
    bateriaAvisada: null,
    offlineDesde: null,
    offlineAvisado: false,
    ultimaNoticia: 0,
    ocioDesde: null
  }
  // Si no le das bola a un tipo de aviso, lo dice menos seguido (x2, x4, hasta x8)
  const factor = (memory, kind) => Math.max(1, memory.noticeFactor?.(kind) ?? 1)

  // snap: { inactivoSeg, bloqueada, online, bateria, pantallaCompleta, enReunion, actividad, silencioHasta, pomodoro, salud }
  // memory: la memoria de Pixie. Devuelve { notices, presence }.
  function tick(now, snap, memory) {
    const t = now.getTime()
    s.inicio ??= t
    const notices = []
    let presence = null
    // En pantalla completa, en una reunión o llamada, o en "no molestar": callado
    const quiet = Boolean(snap.pantallaCompleta) || Boolean(snap.enReunion) || (snap.silencioHasta ?? 0) > t
    const say = (notice) => {
      if (notice.urgent || !quiet) notices.push(notice)
    }

    // Recordatorios de la agenda: siempre
    for (const { evento, clave } of memory.dueAlerts(now)) {
      notices.push({ kind: 'recordatorio', text: alertText(evento, clave), face: 'surprised', urgent: true })
    }

    // ¿Está en la compu o se fue?
    const idleMs = (snap.inactivoSeg ?? 0) * 1000
    const away = snap.bloqueada || idleMs >= times.ausente
    if (away) {
      if (!s.ausenteDesde) {
        s.ausenteDesde = t - idleMs
        presence = 'ausente'
      }
    } else {
      if (s.ausenteDesde) {
        const fuera = t - s.ausenteDesde
        s.ausenteDesde = null
        s.activoDesde = t
        presence = 'volvio'
        if (fuera >= times.saludoAlVolver && memory.doneToday('resumen', now)) {
          const nombre = memory.getName()
          // Lo que pasó mientras no estabas y lo que viene hoy
          const extra = []
          const mails = snap.mailsDesde?.(t - fuera) ?? 0
          if (mails) extra.push(mails === 1 ? 'Mientras no estabas te llegó un mail.' : `Mientras no estabas te llegaron ${mails} mails.`)
          const end = new Date(addDays(startOfDay(now), 1).getTime() - 1)
          const next = (memory.eventsBetween?.(now, end) ?? []).find((e) => e.conHora && new Date(e.cuando) > now)
          if (next) extra.push(`A las ${hhmm(new Date(next.cuando))} tenés ${next.texto}.`)
          say({ kind: 'volvio', text: [`¡Volviste${nombre ? `, ${nombre}` : ''}!`, ...extra].join(' '), face: 'happy', suggestions: mails ? ['¿tengo mails?'] : undefined })
        }
      }
      s.activoDesde ??= t

      // Resumen del día la primera vez que te ve
      if (!memory.doneToday('resumen', now) && now.getHours() >= 5 && !quiet) {
        memory.markDone('resumen', now)
        notices.push({ kind: 'resumen' })
        s.activoDesde = t // el día arranca ahora: la pausa se cuenta desde acá
      }

      // Pausa activa
      if (t - s.activoDesde >= times.pausaCada * factor(memory, 'pausa') && !snap.pomodoro) {
        const minutos = Math.round((t - s.activoDesde) / MIN)
        s.activoDesde = t
        say({
          kind: 'pausa',
          text: `Llevás ${minutos} minutos seguidos en la compu. Estirate un poco y tomá agua.`,
          face: 'happy',
          suggestions: ['ya me estiré', 'tomé agua']
        })
      }

      // Distracciones
      const act = snap.actividad
      if (act && DISTRACTIONS.has(act.categoria)) {
        if (s.racha.categoria !== act.categoria) s.racha = { categoria: act.categoria, desde: t, avisada: false }
        if (snap.pomodoro && !s.pomodoroAvisado) {
          s.pomodoroAvisado = true
          say({ kind: 'distraccion', text: `¡Ey! Estamos en pleno Pomodoro y te veo en ${act.app}.`, face: 'angry' })
        } else if (!s.racha.avisada && t - s.racha.desde >= times.distraccion * factor(memory, 'distraccion')) {
          s.racha.avisada = true
          say({
            kind: 'distraccion',
            text: `Llevás ${Math.round((t - s.racha.desde) / MIN)} minutos en ${act.app}. ¿Volvemos a lo tuyo?`,
            face: 'surprised',
            suggestions: ['arrancá un pomodoro', '¿qué tengo pendiente?']
          })
        }
      } else if (act) {
        s.racha = { categoria: null, desde: 0, avisada: false }
      }
      if (!snap.pomodoro) s.pomodoroAvisado = false

      // A la noche jugando o con videos, y mañana entregás algo: te lo recuerda una vez
      const h = now.getHours() + now.getMinutes() / 60
      if (act && LEISURE.has(act.categoria)) s.ocioDesde ??= t
      else if (act) s.ocioDesde = null
      if (s.ocioDesde && t - s.ocioDesde >= times.ocioAntesDeEntrega && h >= 18 && h < 23.5 && !quiet && !memory.doneToday('entrega-manana', now)) {
        const ev = tomorrowDeliveries(memory, now)[0]
        if (ev) {
          memory.markDone('entrega-manana', now)
          say({
            kind: 'entrega',
            text: `Che, mañana tenés ${ev.texto}. ¿Ya lo tenés listo? Si querés, arrancamos un pomodoro.`,
            face: 'surprised',
            suggestions: ['arrancá un pomodoro', 'ya está listo']
          })
        }
      }

      // Muy tarde
      if (h >= 0.5 && h < 5 && !memory.doneToday('tarde', now) && !quiet) {
        memory.markDone('tarde', now)
        say({ kind: 'tarde', text: 'Ya es re tarde… ¿y si seguimos mañana? Descansar también suma.', face: 'sad' })
      }
    }

    // Batería
    const b = snap.bateria
    if (b && !b.cargando) {
      if (b.nivel <= 10 && s.bateriaAvisada !== 10) {
        s.bateriaAvisada = 10
        notices.push({ kind: 'bateria', text: `¡Queda ${b.nivel}% de batería! Enchufá la compu ya.`, face: 'alarm', urgent: true })
      } else if (b.nivel <= 20 && s.bateriaAvisada === null) {
        s.bateriaAvisada = 20
        say({ kind: 'bateria', text: `Queda ${b.nivel}% de batería. Conviene enchufar la compu.`, face: 'surprised' })
      }
    } else if (b?.cargando) {
      s.bateriaAvisada = null
    }

    // Internet
    if (snap.online === false) {
      s.offlineDesde ??= t
      if (!s.offlineAvisado && t - s.offlineDesde >= times.sinInternet) {
        s.offlineAvisado = true
        say({ kind: 'internet', text: 'Se cortó internet. Te aviso cuando vuelva.', face: 'sad' })
      }
    } else if (snap.online) {
      if (s.offlineAvisado) say({ kind: 'internet', text: '¡Volvió internet!', face: 'happy' })
      s.offlineDesde = null
      s.offlineAvisado = false
    }

    // Preguntas y charla: solo si estás, sin molestar y si no dijo otra cosa recién
    if (!away && !quiet && !notices.length) {
      const evento = memory.followUpsDue(now)[0]
      if (evento) {
        memory.markFollowUp(evento.id)
        const dia = dayKey(new Date(evento.cuando)) === dayKey(now) ? 'Hoy' : 'Ayer'
        notices.push({
          kind: 'seguimiento',
          text: `${dia} tenías ${evento.texto}. ¿Cómo te fue?`,
          face: 'happy',
          suggestions: ['¡Re bien!', 'Más o menos', 'Mal'],
          pregunta: { tipo: 'como_fue', evento: evento.texto }
        })
      } else if (wantsTodoReview(now, snap, memory)) {
        // Un pendiente de hace semanas: ¿sigue o lo borramos? (una vez por día como mucho)
        const todo = memory.oldTodo(now)
        memory.markDone('repaso-pendiente', now)
        memory.touchTodo(todo.id, now)
        notices.push({
          kind: 'pendiente_viejo',
          text: `Tenés anotado «${todo.texto}» desde ${ageText(todo.creado, now)}. ¿Sigue pendiente?`,
          face: 'idle',
          suggestions: ['ya lo hice', 'sigue pendiente', 'borralo'],
          pregunta: { tipo: 'pendiente_viejo', id: todo.id, texto: todo.texto }
        })
      } else if (wantsWater(now, snap, memory)) {
        s.ultimoAvisoAgua = t
        const vasos = memory.getHealth(now).agua
        notices.push({
          kind: 'agua',
          text: `¿Tomaste agua? ${vasos ? `Hoy van ${vasos} ${vasos === 1 ? 'vaso' : 'vasos'}.` : 'Hoy todavía no anotaste ningún vaso.'}`,
          face: 'happy',
          suggestions: ['tomé agua', 'ahora no']
        })
      } else if (wantsNews(now, snap, memory)) {
        s.ultimaNoticia = t
        memory.markDone(`noticias-${newsToday(now, snap, memory) + 1}`, now)
        notices.push({ kind: 'noticias' })
      } else if (wantsToChat(now, snap, memory)) {
        const hoy = dayKey(now)
        if (s.charlas.dia !== hoy) s.charlas = { dia: hoy, n: 0 }
        s.charlas.n++
        s.ultimaCharla = t
        const { tipo, ...notice } = smallTalk(snap, memory, now, rng, s.ultimoTipo)
        s.ultimoTipo = tipo
        notices.push({ kind: 'charla', ...notice })
      }
    }

    return { notices, presence }
  }

  // ¿Hace mucho que no tomás agua? De día, si estás en la compu hace un rato
  function wantsWater(now, snap, memory) {
    if (snap.salud === false) return false
    const t = now.getTime()
    const h = now.getHours()
    if (h < 9 || h >= 22 || snap.pomodoro) return false
    if (!s.activoDesde || t - s.activoDesde < 20 * MIN) return false
    const lastWater = memory.lastWater()?.getTime() ?? 0
    return t - Math.max(s.inicio, lastWater, s.ultimoAvisoAgua) >= times.agua * factor(memory, 'agua')
  }

  // ¿Pregunto por un pendiente viejo? De día, sin cortarte la concentración, una vez por día
  function wantsTodoReview(now, snap, memory) {
    if (!memory.oldTodo || memory.doneToday('repaso-pendiente', now)) return false
    const h = now.getHours()
    if (h < 10 || h >= 21 || snap.pomodoro || FOCUSED.has(snap.actividad?.categoria)) return false
    if (!s.activoDesde || now.getTime() - s.activoDesde < times.charlaTrasVolver) return false
    return Boolean(memory.oldTodo(now))
  }

  // Cuántas noticias contó hoy (queda anotado en la memoria, así no se repite si reiniciás la compu)
  function newsToday(now, snap, memory) {
    let n = 0
    while (n < 10 && memory.doneToday(`noticias-${n + 1}`, now)) n++
    return n
  }

  // ¿Le cuento una noticia? Si las querés, de día, sin cortarte la concentración y bien espaciadas
  function wantsNews(now, snap, memory) {
    const perDay = NEWS_PER_DAY[snap.noticias] ?? 0
    if (!perDay) return false
    const t = now.getTime()
    const h = now.getHours()
    if (h < 9 || h >= 22 || snap.pomodoro || snap.online === false) return false
    if (FOCUSED.has(snap.actividad?.categoria)) return false
    if (!s.activoDesde || t - s.activoDesde < times.charlaTrasVolver) return false
    if (newsToday(now, snap, memory) >= perDay) return false
    return t - s.ultimaNoticia >= ((13 * 60 * MIN) / perDay) * factor(memory, 'noticias')
  }

  // ¿Tiene sentido hablar de algo ahora? Pocas veces por día, de día y sin cortarte la concentración.
  function wantsToChat(now, snap, memory) {
    const t = now.getTime()
    const h = now.getHours()
    if (h < 10 || h >= 22 || snap.pomodoro) return false
    if (FOCUSED.has(snap.actividad?.categoria)) return false
    if (s.charlas.dia === dayKey(now) && s.charlas.n >= CHARLAS_POR_DIA) return false
    if (!s.activoDesde || t - s.activoDesde < times.charlaTrasVolver) return false
    const lastTalk = Math.max(s.inicio, s.ultimaCharla, memory.getMood().ultimoContacto ?? 0)
    return t - lastTalk >= times.charla * factor(memory, 'charla')
  }

  return { tick, state: s }
}
