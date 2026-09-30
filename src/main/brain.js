// Cerebro de Pixie: convierte lo que escribe la persona en una acción de la lista.
// Por ahora usa reglas. Más adelante (paso 5) se puede sumar una IA que elija
// entre las mismas acciones.

const NUMBER_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
  quince: 15, veinte: 20, veinticinco: 25, treinta: 30, 'cuarenta y cinco': 45,
  cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90
}
const NUMBER_RE = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')
const DURATION_RE = new RegExp(
  `\\b(\\d+(?:[.,]\\d+)?|${NUMBER_RE})\\s*(segundos?|segs?|minutos?|mins?|horas?|hs|h|m|s)\\b`,
  'g'
)

const FILLERS = [
  'por favor', 'porfa', 'me podrias', 'me podes', 'me puedes', 'podrias', 'podes', 'puedes',
  'quiero que', 'necesito que', 'quisiera que', 'che', 'oye', 'pixie'
]
const GREETING_LEAD = /^(hola|holis|hey|ey)\s+/

export function normalize(text) {
  let t = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!,;:"«»()]/g, ' ')
    .replace(/\.(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const f of FILLERS) t = t.replace(new RegExp(`(^|\\s)${f}(?=\\s|$)`, 'g'), ' ')
  return t.replace(/\s+/g, ' ').trim()
}

function toNumber(word) {
  if (word in NUMBER_WORDS) return NUMBER_WORDS[word]
  return parseFloat(word.replace(',', '.'))
}

// Devuelve { seconds, start, end } con todas las duraciones sumadas, o null.
export function parseDuration(t) {
  const fixed = [
    [/\bhora y media\b/, 5400],
    [/\bmedia hora\b/, 1800],
    [/\bun cuarto de hora\b/, 900]
  ]
  for (const [re, seconds] of fixed) {
    const m = re.exec(t)
    if (m) return { seconds, start: m.index, end: m.index + m[0].length }
  }
  let seconds = 0
  let start = -1
  let end = -1
  for (const m of t.matchAll(DURATION_RE)) {
    const n = toNumber(m[1])
    const unit = m[2]
    const factor = unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1
    seconds += n * factor
    if (start < 0) start = m.index
    end = m.index + m[0].length
  }
  return seconds > 0 ? { seconds: Math.round(seconds), start, end } : null
}

const TIMER_WORDS = /\b(timer|temporizador|alarma|cronometro|avisame|avisa|recordame|recorda|recuerdame)\b/
const LABEL_LEAD = /^(pone|poneme|pon|crea|crear|arma|un|una|timer|temporizador|alarma|cronometro|avisame|avisa|recordame|recorda|recuerdame|que|para|de|en|dentro de|y|el|la)\b\s*/
const LABEL_TAIL = /\s*\b(en|de|dentro de|dentro|y)$/

function cleanLabel(s) {
  let out = s.trim()
  let prev
  do {
    prev = out
    out = out.replace(LABEL_LEAD, '').replace(LABEL_TAIL, '').trim()
  } while (out !== prev)
  return out
}

function timerLabel(t, d) {
  const after = cleanLabel(t.slice(d.end))
  if (after) return after
  return cleanLabel(t.slice(0, d.start))
}

const YES = /^(si|sii|dale|ok|okey|okay|de una|confirmo|hacelo|hazlo|obvio|claro)$/
const NO = /^(no|nop|cancela|cancelar|mejor no|deja|dejalo|para)$/

export function isYes(text) { return YES.test(normalize(text)) }
export function isNo(text) { return NO.test(normalize(text)) }

// Cada regla devuelve { action, params } o null. El orden importa.
const RULES = [
  // Configuración
  (t) => {
    const m = t.match(/^(?:mi ciudad es|estoy en|vivo en|cambia(?:r)? (?:la )?ciudad a|usa la ciudad)\s+(.+)$/)
    return m ? { action: 'configurar_ciudad', params: { ciudad: m[1] } } : null
  },

  // Timers
  (t) => {
    const timerWord = /\b(timers?|temporizador(es)?|alarmas?|pomodoro|recordatorios?)\b/.test(t)
    const stopAtStart = /^(cancela|cancelar|cancelame|borra|borrar|para|parar|frena|frenar|deten|detene|apaga|apagar|saca|sacar|elimina|eliminar|quita|quitar)\b/.test(t)
    const cancelAnywhere = /\b(cancela|cancelar|cancelame|borra|borrar|elimina|eliminar)\b/.test(t)
    return timerWord && (stopAtStart || cancelAnywhere) ? { action: 'cancelar_timers', params: {} } : null
  },
  (t) => /\b(cuanto (falta|queda)|timers? activos?|que timers?|mis timers?)\b/.test(t)
    ? { action: 'ver_timers', params: {} } : null,
  (t) => /\bpomodoro\b/.test(t)
    ? { action: 'crear_timer', params: { segundos: 1500, etiqueta: 'Pomodoro' } } : null,
  (t) => {
    if (!TIMER_WORDS.test(t)) return null
    const d = parseDuration(t)
    if (!d) return { action: 'crear_timer', params: {} }
    const etiqueta = timerLabel(t, d)
    return { action: 'crear_timer', params: etiqueta ? { segundos: d.seconds, etiqueta } : { segundos: d.seconds } }
  },

  // Saludos y ayuda
  (t) => /^(hola\s+)?(buen dia|buenos dias|buenas tardes|buenas noches|buenas)\b/.test(t)
    ? { action: 'buen_dia', params: {} } : null,
  (t) => /^(hola|holis|hey|ey|que tal|como estas|como andas|como va)\b/.test(t)
    ? { action: 'saludo', params: {} } : null,
  (t) => /\b(gracias|genial|buenisimo|joya|excelente)\b/.test(t)
    ? { action: 'gracias', params: {} } : null,
  (t) => /\b(ayuda|ayudame|que (sabes |haces )?hacer|que haces|comandos|opciones)\b/.test(t)
    ? { action: 'ayuda', params: {} } : null,
  (t) => /\b(escondete|ocultate|anda a dormir|chau|adios|nos vemos|hasta luego)\b/.test(t)
    ? { action: 'ocultar', params: {} } : null,

  // Hora, fecha y clima
  (t) => /\b(que dia|que fecha|fecha de hoy|dia es hoy|dia de hoy)\b/.test(t)
    ? { action: 'decir_hora', params: { fecha: true } } : null,
  (t) => /\b(que hora|hora es|la hora|hora)\b/.test(t)
    ? { action: 'decir_hora', params: {} } : null,
  (t) => /\b(clima|tiempo hace|temperatura|llueve|llover|lluvia|hace frio|hace calor|pronostico|paraguas|abrigo)\b/.test(t)
    ? { action: 'clima', params: {} } : null,

  // Estado de la compu
  (t) => /\b(como (esta|anda|va) (la|mi) (compu|pc|computadora)|estado de (la|mi) (compu|pc|computadora)|memoria|ram|cpu|procesador|rendimiento)\b/.test(t)
    ? { action: 'estado_pc', params: {} } : null,

  // Sistema
  (t) => /\b(bloquea|bloquear|bloqueame|bloquea la|bloquee)\b/.test(t)
    ? { action: 'bloquear_pc', params: {} } : null,
  (t) => /\b(captura|capturas|screenshot|recorte|recorta)\b/.test(t)
    ? { action: 'captura', params: {} } : null,

  // Volumen
  (t) => /\b(silencia|silenciar|silencio|mutea|mutear|mute|desmutea|sin sonido)\b/.test(t)
    ? { action: 'volumen', params: { cambio: 'silenciar' } } : null,
  (t) => {
    if (!/\b(volumen|sonido|audio)\b/.test(t)) return null
    const up = /\b(subi|sube|subir|subile|subime|aumenta|aumentar|mas|arriba|alto)\b/.test(t)
    const down = /\b(baja|bajar|bajale|bajame|disminui|disminuir|menos|abajo|bajo)\b/.test(t)
    if (up === down) return null
    const n = t.match(/\b(\d{1,3})\b/)
    const pasos = n ? Math.min(50, Math.max(1, Math.round(parseInt(n[1], 10) / 2))) : 5
    return { action: 'volumen', params: { cambio: up ? 'subir' : 'bajar', pasos } }
  },

  // Búsquedas (antes que música y abrir, para que "poné X en youtube" busque)
  (t) => {
    const m = t.match(/^(?:busca|buscame|buscar|pone|poneme|reproduci|reproducime|mira|ver|quiero ver)\s+(.+?)\s+en youtube$/)
    return m ? { action: 'buscar', params: { sitio: 'youtube', consulta: m[1] } } : null
  },
  (t) => {
    const m = t.match(/^(?:busca|buscame|buscar|googlea|googleame|investiga)\s+(?:en google\s+)?(.+?)(?:\s+en google)?$/)
    return m ? { action: 'buscar', params: { sitio: 'google', consulta: m[1] } } : null
  },

  // Música
  (t) => /\b(siguiente|proxima (cancion|tema)|pasa (la cancion|el tema|de tema|de cancion)|salta(la|lo)?( el tema| la cancion)?|skip)\b/.test(t) &&
    !/\b(abri|abre|abrir)\b/.test(t)
    ? { action: 'musica', params: { control: 'siguiente' } } : null,
  (t) => /\b(anterior|volve (el tema|la cancion)|tema de antes)\b/.test(t)
    ? { action: 'musica', params: { control: 'anterior' } } : null,
  (t) => {
    const mediaVerb = /\b(pausa|pausar|pausala|pausalo|play|reanuda|reanudar|continua|segui)\b/.test(t)
    const stopVerb = /\b(para|frena|deten|detene|pone|pon|dale)\b/.test(t) &&
      /\b(musica|cancion|tema|spotify|video)\b/.test(t)
    return mediaVerb || stopVerb ? { action: 'musica', params: { control: 'pausa' } } : null
  },

  // Cerrar y abrir cosas
  (t) => {
    const m = t.match(/^(?:cerra|cierra|cerrar|cerrame|mata|matar)\s+(?:el |la |los |las |mi |mis )?(.+)$/)
    return m ? { action: 'cerrar_app', params: { objetivo: m[1] } } : null
  },
  (t) => {
    const m = t.match(/^(?:abri|abre|abrir|abrime|entra a|entra en|entrar a|anda a|ir a|ve a|lanza|ejecuta|inicia|arranca|pone|poneme|mostrame)\s+(?:el |la |los |las |mi |mis )?(.+)$/)
    return m ? { action: 'abrir', params: { objetivo: m[1] } } : null
  }
]

function applyRules(t) {
  for (const rule of RULES) {
    const result = rule(t)
    if (result) return result
  }
  return null
}

export function interpret(text) {
  const t = normalize(text)
  if (!t) return null
  // "hola, abrí YouTube": primero se prueba sin el saludo.
  if (GREETING_LEAD.test(t)) {
    const result = applyRules(t.replace(GREETING_LEAD, ''))
    if (result) return result
  }
  return applyRules(t)
}
