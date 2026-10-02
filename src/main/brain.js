// Cerebro de Pixie: convierte lo que escribe la persona en acciones de la lista.
// Usa reglas flexibles: entiende sinónimos, voseo, errores de tipeo en nombres
// de apps y varios pedidos juntos ("abrí YouTube y subí el volumen").
// Más adelante se puede sumar una IA que elija entre las mismas acciones.
import { APPS, SITES, FOLDERS } from './catalog.js'
import { toExpression } from './calc.js'
import { parseWhen, withoutSpans } from './dates.js'

// ───────────── Normalización ─────────────

const SLANG = {
  q: 'que', k: 'que', xq: 'por que', pq: 'por que', porq: 'por que', tmb: 'tambien', tb: 'tambien',
  vol: 'volumen', min: 'minutos', mins: 'minutos', seg: 'segundos', segs: 'segundos',
  hr: 'hora', hrs: 'horas', hs: 'horas', porfa: '', porfis: '', plis: '', pls: '', please: '', xfa: '',
  wpp: 'whatsapp', wsp: 'whatsapp', whats: 'whatsapp', guasap: 'whatsapp', wasap: 'whatsapp', blutu: 'bluetooth', bluetu: 'bluetooth'
}

const FILLERS = [
  'por favor', 'me podrias', 'me podes', 'me puedes', 'podrias', 'podes', 'puedes', 'quiero que',
  'necesito que', 'quisiera que', 'te pido que', 'dale y', 'che', 'oye', 'bueno', 'pixie', 'eh'
]

export function fold(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalize(text) {
  let t = fold(text)
    .replace(/[¿?¡!;:"«»]/g, ' ')
    .replace(/(\d),(\d)/g, '$1‚$2') // coma decimal protegida
    .replace(/,/g, ' , ')
    .replace(/‚/g, ',')
    .replace(/\.(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.split(' ').map((w) => (w in SLANG ? SLANG[w] : w)).join(' ')
  for (const f of FILLERS) t = t.replace(new RegExp(`(^|\\s)${f}(?=\\s|$)`, 'g'), ' ')
  return t.replace(/\s+/g, ' ').replace(/^(\s*,\s*)+|(\s*,\s*)+$/g, '').replace(/(\s*,\s*)+/g, ' , ').trim()
}

// Respuesta a "¿cómo te fue?": 'bien' | 'masomenos' | 'mal' | null
export function howItWent(text) {
  const t = normalize(text)
  if (/\b(mas o menos|maso|masomenos|ahi nomas|ahi va|regular|normal|ni bien ni mal|zafa|zafe|zafo)\b/.test(t)) return 'masomenos'
  if (/\b(no (me fue |salio |estuvo )?(tan |muy |re )?bien|mal|malisimo|horrible|pesimo|desaprobe|un desastre|fatal|para atras)\b/.test(t)) return 'mal'
  if (/\b(bien|genial|joya|excelente|barbaro|aprobe|de diez|espectacular|buenisimo|increible|perfecto|zarpado|me saque un (7|8|9|10|siete|ocho|nueve|diez))\b/.test(t)) return 'bien'
  return null
}

// ───────────── Apps, sitios y carpetas ─────────────

function buildIndex(customApps = []) {
  const entries = []
  const add = (list, tipo) => {
    for (const item of list) for (const alias of item.alias ?? []) entries.push({ alias: fold(alias).trim(), tipo, nombre: item.nombre })
  }
  add(FOLDERS, 'carpeta')
  add(SITES, 'sitio')
  add(customApps, 'app')
  add(APPS, 'app')
  return entries
}
const DEFAULT_INDEX = buildIndex()

// Distancia entre palabras contando letras cambiadas, de más, de menos o invertidas.
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/

// Busca un nombre conocido dentro del texto. Devuelve { alias, nombre, tipo } o null.
export function findEntity(t, index = DEFAULT_INDEX, { loose = false } = {}) {
  const words = t.split(' ').filter((w) => w && w !== ',')
  for (let n = Math.min(4, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      const hit = index.find((e) => e.alias === phrase)
      if (hit) return hit
    }
  }
  const domain = words.find((w) => DOMAIN.test(w))
  if (domain) return { alias: domain, nombre: domain, tipo: 'sitio' }
  let best = null
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      if (phrase.length < 5) continue
      for (const e of index) {
        if (e.alias.length < 5 || e.alias.split(' ').length !== n) continue
        const max = (e.alias.length >= 7 ? 2 : 1) + (loose ? 1 : 0)
        const dist = distance(phrase, e.alias)
        if (dist <= max && (!best || dist < best.dist)) best = { ...e, dist }
      }
    }
  }
  return best
}

// ───────────── Duraciones ─────────────

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

function toNumber(word) {
  if (word in NUMBER_WORDS) return NUMBER_WORDS[word]
  return parseFloat(word.replace(',', '.'))
}

// Devuelve { seconds, start, end } con todas las duraciones sumadas, o null.
export function parseDuration(t) {
  const fixed = [
    [/\bhora y media\b/, 5400],
    [/\bmedia hora\b/, 1800],
    [/\bun cuarto de hora\b/, 900],
    [/\bun minuto y medio\b/, 90]
  ]
  for (const [re, seconds] of fixed) {
    const m = re.exec(t)
    if (m) return { seconds, start: m.index, end: m.index + m[0].length }
  }
  let seconds = 0
  let start = -1
  let end = -1
  for (const m of t.matchAll(DURATION_RE)) {
    const unit = m[2]
    const factor = unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1
    seconds += toNumber(m[1]) * factor
    if (start < 0) start = m.index
    end = m.index + m[0].length
  }
  return seconds > 0 ? { seconds: Math.round(seconds), start, end } : null
}

const TIMER_WORDS = /\b(timer|temporizador|alarma|cronometro|cronometra|avisame|avisa|avises|recordame|recorda|recuerdame|recordarme|despertame|acordate|acordame)\b/
const LABEL_LEAD = /^(pone|poneme|pon|crea|crear|arma|un|una|unos|timer|temporizador|alarma|cronometro|cronometra|avisame|avisa|avises|recordame|recorda|recuerdame|recordarme|despertame|acordate|acordame|que|para|de|en|dentro de|y|el|la)\b\s*/
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
  return cleanLabel(t.slice(d.end)) || cleanLabel(t.slice(0, d.start))
}

// ───────────── Confirmaciones ─────────────

const YES = /^(si|sii|dale|ok|okey|okay|de una|confirmo|hacelo|hazlo|obvio|claro|si dale|mandale)$/
const NO = /^(no|nop|cancela|cancelar|mejor no|deja|dejalo|para|no gracias)$/

export function isYes(text) { return YES.test(normalize(text).replace(/ , /g, ' ')) }
export function isNo(text) { return NO.test(normalize(text).replace(/ , /g, ' ')) }

// ───────────── Reglas ─────────────

const OPEN_VERBS = new Set([
  'abri', 'abre', 'abrir', 'abras', 'abrime', 'abrilo', 'abrila', 'abrimelo', 'abrimela', 'entra', 'entrar',
  'entres', 'entrame', 'anda', 'ir', 've', 'vamos', 'lanza', 'lanzar', 'ejecuta', 'ejecutar', 'inicia',
  'iniciar', 'arranca', 'arrancar', 'pone', 'poner', 'pongas', 'poneme', 'mostrame', 'muestra', 'mostrar',
  'necesito', 'quiero', 'dame', 'traeme', 'llevame', 'prende', 'prendeme', 'activa', 'usa', 'usar',
  'jugar', 'juguemos', 'conectame', 'conecta'
])
const ARTICLES = /^(?:el |la |los |las |mi |mis |un |una |al |a )+/
const has = (re) => (t) => re.test(t)
const intent = (action, params = {}) => ({ action, params })
const chat = (tema) => intent('charla', { tema })

const MUSIC_WORDS = /\b(musica|cancion|canciones|tema|temazo|playlist|video)\b/
const VOLUME_WORDS = /\b(volumen|sonido|audio)\b/
const KNOWLEDGE = /^(que es|que son|que significa|quien es|quien fue|quienes son|quienes fueron|como se hace|como hago|como se|como funciona|cuando fue|cuando es|cuando nacio|cuando murio|por que|cual es|cuales son|cuanto mide|cuanto pesa|cuanto cuesta|cuanto sale|cuanto esta|cuanto es|cuantos|cuantas|de donde es|que paso)\b/

const REMEMBER_VERBS = /\b(acordate|acordame|recorda|recordate|guarda|guardate|memoriza|no te olvides)\b/
const NOTE_VERBS = /\b(anota|anotame|agrega|agregame|suma|sumame|apunta|apuntame|agenda|agendame|agendar)\b/
const REMIND_VERBS = /\b(recordame|recuerdame|recordarme|avisame|avisa|avises|despertame)\b/
const AGENDA_WORDS = /\b(tengo|tenemos|hay|me toca|voy a|vamos a|es el|es la|cumple|cumpleanos|examen|prueba|parcial|turno|entrega|reunion|partido|clase|viaje|cita|dentista|medico)\b/
const STOP_NAMES = new Set(['yo', 'un', 'una', 'el', 'la', 'la hora', 'algo'])
const EVENT_LEAD = /^(es|son|recordame|recorda|recuerdame|recordarme|acordate|acordame|avisame|avisa|avises|anota|anotame|agrega|agregame|suma|sumame|apunta|apuntame|agenda|agendame|agendar|despertame|guarda|guardate|memoriza|no te olvides|que|de|el|la|los|las|tengo|tenemos|hay|me toca|voy a|vamos a|para|y|en la lista|en mis pendientes|a la lista|a mis pendientes)\b\s*/
const EVENT_TAIL = /\s*\b(es|son|el|la|para|de|que|a|y|en la lista|a la lista|en mis pendientes|a mis pendientes|en pendientes)$/

function cleanEventText(s) {
  let out = s.trim()
  let prev
  do {
    prev = out
    out = out.replace(EVENT_LEAD, '').replace(EVENT_TAIL, '').trim()
  } while (out !== prev)
  return out
}

const RULES = [
  // Mirar la pantalla: "¿qué ves en mi pantalla?", "ayudame con esto", "explicame este error"
  (t) => {
    const screen =
      /\b(que ves|que hay|mira|lee|lees|lei|leeme|analiza|revisa|fijate)\b.*\b(pantalla|esto)\b/.test(t) ||
      /\b(ayudame|explicame|resolveme|que significa|que dice)\b.*\b(esto|aca|este (error|ejercicio|codigo|problema|mensaje)|lo que (tengo|estoy viendo|hay) en (la )?pantalla)\b/.test(t) ||
      /^que (es|dice) (esto|aca)$/.test(t)
    return screen ? intent('ver_pantalla', { pregunta: t }) : null
  },
  // WhatsApp a tu celular: "mandame por whatsapp que compre pan"
  (t) => {
    if (!/\bwhatsapp\b|\bmensaje al celu(lar)?\b/.test(t)) return null
    if (!/\b(manda|mandame|mandar|mandarme|envia|enviame|enviar|pasame|proba|probar|escribime)\b/.test(t)) return null
    const texto = t
      .replace(/\b(manda|mandame|mandar|mandarme|envia|enviame|enviar|pasame|proba|probar|escribime)\b/g, ' ')
      .replace(/\b(por|al|un|una|el|mi)?\s*(whatsapp|mensaje al celu(lar)?|celu(lar)?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^((que|diciendo|con|de)\s+)+/, '')
    return intent('whatsapp', { texto })
  },


  // Configuración
  (t) => {
    const m = t.match(/^(?:mi ciudad es|estoy en|vivo en|soy de|cambia(?:r)? (?:la )?ciudad a|usa la ciudad)\s+(.+)$/)
    return m ? intent('configurar_ciudad', { ciudad: m[1] }) : null
  },

  // Memoria: tu nombre y lo que le contás
  (t) => {
    const m = t.match(/^(?:me llamo|mi nombre es|llamame|decime)\s+([a-zñ]+(?: [a-zñ]+)?)$/)
    return m && !STOP_NAMES.has(m[1]) ? intent('guardar_nombre', { nombre: m[1] }) : null
  },
  (t) => (/\b(como me llamo|sabes (como me llamo|mi nombre)|quien soy|cual es mi nombre)\b/.test(t) ? intent('quien_soy') : null),
  (t) => (/\b(que sabes de mi|que sabes sobre mi|que te acordas|que recordas|que te conte|que tenes guardado)\b/.test(t) ? intent('ver_datos') : null),
  (t) => {
    const m = t.match(/^(?:olvidate|olvida|olvidar)\s+(?:de\s+)?(?:que\s+)?(.+)$/)
    if (!m) return null
    return /^(todo|todo lo que sabes)$/.test(m[1]) ? intent('olvidar_todo') : intent('olvidar', { buscar: m[1] })
  },

  // No molestar
  (t) => {
    if (!/\b(no (me )?molestes|modo no molestar|no hables|silencio por|dejame tranquil[oa]|dejame concentrar)\b/.test(t)) return null
    const d = parseDuration(t)
    return intent('no_molestar', { minutos: d ? Math.round(d.seconds / 60) : 60 })
  },
  (t) => (/\b(ya (podes )?hablar|desactiva(r)? (el )?no molestar|volve a hablar|ya (podes )?molestar)\b/.test(t) ? intent('molestar') : null),

  // Salud y respaldo
  (t) => {
    if (!/\b(tome|acabo de tomar|me tome)\b.*\b(agua|vasos?|botellas?)\b/.test(t)) return null
    if (/\b(recorda|recordame|avisame|acordame)\b/.test(t)) return null
    const n = t.match(/\b(un|una|dos|tres|cuatro|cinco|\d+)\s+(vasos?|botellas?)\b/)
    const count = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }
    return intent('registrar_agua', { vasos: n ? (count[n[1]] ?? parseInt(n[1], 10)) : 1 })
  },
  (t) => (/^(ya )?(me estire|estire|hice (la |una )?pausa|me levante un rato|camine un poco)$/.test(t) ? intent('registrar_pausa') : null),
  (t) => (/\b(cuanta agua (tome|llevo|van)|cuantos vasos|como vengo con (la salud|el agua)|registro de salud|como esta mi salud)\b/.test(t) ? intent('ver_salud') : null),
  (t) => (/\b(hace(me)? (un )?respaldo|respalda(r|me|te)?|backup|guarda(r)? una copia)\b/.test(t) ? intent('respaldar') : null),

  // Pendientes
  (t) => (/^(vacia|limpia)\b.*\b(lista|pendientes)\b|^(borra|borrame|elimina)\b.*\b(todos los pendientes|toda la lista)\b/.test(t) ? intent('limpiar_pendientes') : null),
  (t) => {
    const m = t.match(/^(?:tacha|tachame|borra|saca|elimina|completa|marca)\s+(?:el |la |lo )?(?:pendiente |numero |nro )?(\d{1,2})$/)
    return m ? intent('completar_pendiente', { numero: parseInt(m[1], 10) }) : null
  },
  (t) => {
    const m =
      t.match(/^(?:tacha|tachame|completa|marca como hech[oa]|marca)\s+(.+)$/) ||
      t.match(/^(?:borra|saca|elimina)\s+(.+?)\s+de (?:la lista|pendientes|mis pendientes|mis tareas)$/) ||
      t.match(/^ya ((?:hice|termine|complete|compre|llame|entregue|estudie|lave|limpie|arregle|mande|pague|saque|busque|lei|ordene|cocine|escribi|hable)\b.*)$/)
    return m ? intent('completar_pendiente', { buscar: m[1] }) : null
  },
  (t) => (/\b(que tengo pendiente|mis pendientes|los pendientes|pendientes|mis tareas|lista de tareas|que me falta hacer|que me falta|mi lista)\b/.test(t) ? intent('ver_pendientes') : null),

  // Agenda: consultar
  (t, ctx) => {
    if (!/\b(que tengo|tengo algo|que hay|mi agenda|la agenda|que eventos|proximos eventos|que me toca)\b/.test(t)) return null
    const when = parseWhen(t, ctx.now)
    if (when) return intent('ver_agenda', { dia: when.date.toISOString() })
    return intent('ver_agenda', { dias: 7 })
  },
  (t) => {
    const m =
      t.match(/^(?:cuando (?:es|era|tengo|tenia|cae|son)|para cuando es|que dia (?:es|era|tengo|cae))\s+(.+)$/) ||
      t.match(/^((?:cual|cuales|que|como se llama|como se llaman|donde)\b.*\b(?:mi|mis)\b.*)$/)
    if (!m || /^(hoy|manana|pasado manana)$/.test(m[1])) return null
    return intent('consultar_memoria', { buscar: m[1] })
  },

  // Agenda, pendientes y datos: guardar
  (t, ctx) => {
    const remember = REMEMBER_VERBS.test(t)
    const note = NOTE_VERBS.test(t)
    const remind = REMIND_VERBS.test(t)
    const when = parseDuration(t) ? null : parseWhen(t, ctx.now)
    if (when && (remember || note || remind || AGENDA_WORDS.test(t))) {
      const texto = cleanEventText(withoutSpans(t, when.spans))
      return intent('agendar', { texto, cuando: when.date.toISOString(), conHora: when.hasTime })
    }
    if (parseDuration(t)) return null // "recordame en 10 minutos…" es un timer
    if (note || remind) return intent('agregar_pendiente', { texto: cleanEventText(t) })
    if (remember) {
      const rest = t.replace(/^.*?\b(?:acordate|acordame|recorda|recordate|guarda|guardate|memoriza|no te olvides)\b\s*/, '')
      if (/^de\s/.test(rest)) return intent('agregar_pendiente', { texto: cleanEventText(rest) })
      return intent('recordar_dato', { texto: rest.replace(/^que\s+/, '') })
    }
    return null
  },

  // Cuentas
  (t) => {
    const withPrefix = t.match(/^(?:cuanto es|cuanto da|calcula(?:me)?|calcular|resolve(?:me)?|hace(?:me)? la cuenta)\s+(.+)$/)
    const expr = toExpression(withPrefix ? withPrefix[1] : t)
    return expr ? intent('calcular', { expresion: expr }) : null
  },

  // Timers
  (t) => {
    const timerWord = /\b(timers?|temporizador(es)?|alarmas?|pomodoro|recordatorios?|cronometro)\b/.test(t)
    const stopAtStart = /^(cancela|cancelar|cancelame|borra|borrar|para|parar|frena|frenar|deten|detene|apaga|apagar|saca|sacar|elimina|eliminar|quita|quitar)\b/.test(t)
    const cancelAnywhere = /\b(cancela|cancelar|cancelame|borra|borrar|elimina|eliminar)\b/.test(t)
    return timerWord && (stopAtStart || cancelAnywhere) ? intent('cancelar_timers') : null
  },
  (t) => (/\b(cuanto (falta|queda)|cuanto tiempo (falta|queda)|timers? activos?|que timers?|mis timers?)\b/.test(t) ? intent('ver_timers') : null),
  (t) => (/\bpomodoro\b/.test(t) ? intent('crear_timer', { segundos: 1500, etiqueta: 'Pomodoro' }) : null),
  (t) => {
    const d = parseDuration(t)
    if (TIMER_WORDS.test(t)) {
      if (!d) return /\b(timer|temporizador|alarma|cronometro)\b/.test(t) ? intent('crear_timer') : null
      const etiqueta = timerLabel(t, d)
      return intent('crear_timer', etiqueta ? { segundos: d.seconds, etiqueta } : { segundos: d.seconds })
    }
    // Solo una duración: "5 minutos", "en media hora"
    if (d && !cleanLabel(t.slice(0, d.start)) && !cleanLabel(t.slice(d.end))) return { ...intent('crear_timer', { segundos: d.seconds }), bare: true }
    return null
  },

  // Hora, fecha y clima
  (t) => (/\b(que dia|que fecha|fecha de hoy|dia es hoy|dia de hoy|a que estamos|en que mes)\b/.test(t) ? intent('decir_hora', { fecha: true }) : null),
  (t) => (/\b(que hora|hora es|la hora|tenes hora|hora)\b/.test(t) ? intent('decir_hora') : null),
  (t) => {
    const m = t.match(/\b(?:clima|tiempo|temperatura|pronostico)\s+(?:en|de|para)\s+(.+)$/)
    return m ? intent('clima', { ciudad: m[1] }) : null
  },
  (t) => (/\b(clima|tiempo hace|que tiempo|el tiempo|temperatura|llueve|llover|lluvia|frio|calor|pronostico|paraguas|abrigo|campera|nublado|soleado|como esta el dia)\b/.test(t) ? intent('clima') : null),

  // Jugar al Pong ("quiero jugar Minecraft" abre la app, no el Pong)
  (t, ctx) => {
    const wantsGame = /\b(pong|juguemos|jugamos|jugar con vos|jugar un rato|jugar a algo|jueguito|revancha|un partido)\b/.test(t) || /^(quiero )?jugar$/.test(t)
    if (!wantsGame) return null
    const e = /\bpong\b/.test(t) ? null : findEntity(t, ctx.index)
    return e && e.dist === undefined ? null : intent('jugar')
  },

  // Saludos y charla
  (t) => (/^(buen dia|buenos dias|buenas tardes|buenas noches)\b/.test(t) ? intent('buen_dia') : null),
  (t) => (/\b(quien sos|quien eres|que sos|que eres|como te llamas|tu nombre|presentate|quien te (hizo|creo|programo)|cuantos anos tenes|que edad tenes)\b/.test(t) ? chat('quien_sos') : null),
  (t) => (/\b(chistes?|algo gracioso|hace(me)? reir)\b/.test(t) ? chat('chiste') : null),
  (t) => (/\b(dato curioso|algo interesante|sabias que|contame algo)\b/.test(t) ? chat('dato') : null),
  (t) => (/\b(te quiero|te amo|te re quiero|sos (el |la |un |una )?(mejor|genio|crack|capo|groso|grosa|lindo|linda|hermoso|tierno|tierna)|(que|muy) (lindo|linda|tierno|tierna))\b/.test(t) ? chat('carino') : null),
  (t) => (/^(callate|silencio pixie|shh+)$/.test(t) ? chat('callate') : null),
  (t) => (/\b(tonto|tonta|boludo|boluda|inutil|idiota|estupido|estupida|pelotudo|basura|sos malo|sos feo|sos fea|te odio)\b/.test(t) ? chat('insulto') : null),
  (t) => (/\b(aburrido|aburrida|me aburro|no se que hacer)\b/.test(t) ? chat('aburrido') : null),
  (t) => (/\b(estoy triste|me siento mal|estoy mal|estoy cansad[oa]|que bajon|tuve un mal dia)\b/.test(t) ? chat('animo') : null),
  (t) => (/\b(tengo que estudiar|voy a estudiar|a estudiar|modo estudio|me pongo a estudiar|tengo tarea)\b/.test(t) ? chat('estudiar') : null),
  (t) => (/\b(como estas|como andas|como te va|todo bien|como te sentis|que tal)\b/.test(t) ? chat('como_estas') : null),
  (t) => (/^(hola|holis|hey|ey|buenas|que onda|como va)$/.test(t) ? intent('saludo') : null),
  (t) => (/^(ahora no|no ahora|no gracias|despues|mas tarde|otro dia|otro rato|en otro momento|paso)$/.test(t) ? chat('ahora_no') : null),
  (t) => (/^((ja|je|ji|js|aj){2,}[a-z]*|lol|xd+|me mori|me muero( de risa)?|que gracioso|que buen chiste)$/.test(t) ? chat('risa') : null),
  (t) => (/\b(gracias|genial|buenisimo|joya|excelente|perfecto|de diez|barbaro|espectacular)\b/.test(t) ? intent('gracias') : null),
  (t) => (/\b(ayuda|ayudame|que (sabes |haces )?hacer|que haces|comandos|opciones)\b/.test(t) ? intent('ayuda') : null),
  (t) => (/\b(escondete|ocultate|anda a dormir|chau|adios|nos vemos|hasta luego|hasta manana)\b/.test(t) ? intent('ocultar') : null),

  // Lo que estás haciendo y cuánto usaste la compu
  (t) => (/\b(que estoy haciendo|en que estoy|que app estoy usando|que estoy mirando)\b/.test(t) ? intent('que_hago') : null),
  (t) => {
    if (!/\b(cuanto (tiempo )?(use|estuve|llevo|pase|estoy|vengo)|tiempo de pantalla|uso de hoy|como use la compu)\b/.test(t)) return null
    const m = t.match(/\ben (?:el |la |los |las )?([a-z0-9 ]+?)(?: hoy)?$/)
    return intent('uso_hoy', m && !/^(la compu|la pc|la computadora)$/.test(m[1]) ? { buscar: m[1] } : {})
  },
  (t) => (/\b(resumen del dia|resumime el dia|como viene el dia)\b/.test(t) ? intent('buen_dia') : null),

  // Estado de la compu y sistema
  (t) => (/\b(como (esta|anda|va) (la|mi) (compu|pc|computadora)|estado de (la|mi) (compu|pc|computadora)|memoria|ram|cpu|procesador|rendimiento|(anda|va|esta) lenta|se tilda)\b/.test(t) ? intent('estado_pc') : null),
  (t) => (/\b(bloquea|bloquear|bloqueame|bloquees|bloquee|me voy|ya vuelvo|vuelvo en un rato|me tengo que ir)\b/.test(t) ? intent('bloquear_pc') : null),
  (t) => (/\b(cancela|cancelar|frena|para)\b.*\b(apagado|reinicio)\b/.test(t) ? intent('cancelar_apagado') : null),
  (t) => (/\b(apaga|apagar|apagues|apagame)\b.*\b(compu|pc|computadora|todo)\b/.test(t) ? intent('apagar_pc', { modo: 'apagar' }) : null),
  (t) => (/\b(reinicia|reiniciar|reinicies|reiniciame)\b.*\b(compu|pc|computadora)\b/.test(t) ? intent('apagar_pc', { modo: 'reiniciar' }) : null),
  (t) => (/\b(captura|capturas|screenshot|recorte|recorta|foto (a|de) la pantalla)\b/.test(t) ? intent('captura') : null),

  // Brillo y Bluetooth (antes que el volumen: "subile el brillo")
  (t) => {
    if (!/\bbrillo\b|\bpantalla\b.*\b(oscura|clara|brillante)\b|\bencandila\b/.test(t)) return null
    if (/\b(maximo|tope|todo)\b/.test(t)) return intent('brillo', { cambio: 'poner', valor: 100 })
    if (/\bminimo\b/.test(t)) return intent('brillo', { cambio: 'poner', valor: 10 })
    const n = t.match(/\b(?:al|en|a)\s+(\d{1,3})\b/)
    if (n) return intent('brillo', { cambio: 'poner', valor: Math.min(100, parseInt(n[1], 10)) })
    const up = /\b(subi|sube|subir|subile|subime|aumenta|mas|oscura)\b/.test(t)
    const down = /\b(baja|bajar|bajale|bajame|menos|brillante|clara|encandila)\b/.test(t)
    if (up === down) return intent('brillo', { cambio: 'ver' })
    return intent('brillo', { cambio: up ? 'subir' : 'bajar' })
  },
  (t) => {
    if (!/\bbluetooth\b/.test(t)) return null
    if (/\b(apaga|apagar|apagame|desactiva|desactivar|desconecta)\b/.test(t)) return intent('bluetooth', { estado: 'apagar' })
    if (/\b(prende|prender|prendeme|activa|activar|encende|encender|pone|conecta)\b/.test(t)) return intent('bluetooth', { estado: 'prender' })
    return intent('bluetooth', { estado: 'abrir' })
  },
  (t) => (/\b(que (cancion|tema|tema musical) es (esta|este)|que (esta sonando|suena|estoy escuchando)|como se llama (esta cancion|este tema)|quien canta( esto| esta cancion)?)\b/.test(t) ? intent('que_suena') : null),

  // Volumen
  (t) => (/\b(silencia|silenciar|silencio|mutea|mutear|mute|desmutea|sin sonido|sin volumen)\b/.test(t) ? intent('volumen', { cambio: 'silenciar' }) : null),
  (t) => {
    if (/\b(volumen al (maximo|tope|100)|a todo volumen|maximo volumen)\b/.test(t)) return intent('volumen', { cambio: 'subir', pasos: 50 })
    if (/\b(volumen al minimo|minimo volumen)\b/.test(t)) return intent('volumen', { cambio: 'bajar', pasos: 50 })
    const volWord = VOLUME_WORDS.test(t)
    const up = (volWord && /\b(subi|sube|subir|subas|subile|subime|aumenta|aumentar|mas|arriba|alto|fuerte)\b/.test(t)) ||
      /\b(subilo|subile|mas fuerte|mas alto|no (se )?escucho|no se escucha|no escucho nada|no oigo|se escucha (muy |re )?bajo)\b/.test(t)
    const down = (volWord && /\b(baja|bajar|bajes|bajale|bajame|disminui|disminuir|menos|abajo|bajo)\b/.test(t)) ||
      /\b(bajalo|bajale|mas bajo|mas despacio|muy fuerte|esta fuerte|me aturde)\b/.test(t)
    if (up === down) return null
    const n = t.match(/\b(\d{1,3})\b/)
    const pasos = n ? Math.min(50, Math.max(1, Math.round(parseInt(n[1], 10) / 2))) : 5
    return intent('volumen', { cambio: up ? 'subir' : 'bajar', pasos })
  },

  // YouTube (con la extensión de Chrome)
  (t) => (/\b(dislike|no me gusta este video|dale no me gusta)\b/.test(t) ? intent('youtube', { accion: 'dislike' }) : null),
  (t) => (/\b(dale like|dale me gusta|un like|like al video|me gusta este video|megusta|pone(le)? like|like)\b/.test(t) && !/\bdislike\b/.test(t) ? intent('youtube', { accion: 'like' }) : null),
  (t) => (/\b(suscribime|suscribirme|suscribite|suscribete|suscribir(me)? al canal|suscripcion al canal)\b/.test(t) ? intent('youtube', { accion: 'suscribir' }) : null),
  (t) => (/\b(salta|saltar|saltea|saltear|saca|sacar|skip|skipea)\b.*\b(anuncio|publicidad|propaganda|ad)\b/.test(t) ? intent('youtube', { accion: 'saltar_anuncio' }) : null),
  (t) => (/\b(subtitulos|subtitulado|captions)\b/.test(t) ? intent('youtube', { accion: 'subtitulos' }) : null),
  (t) => {
    const m = t.match(/\b(?:a|velocidad)\s*(\d(?:[.,]\d+)?)\s*x?\b/)
    if (m && /\b(velocidad|x)\b|\dx\b/.test(t)) return intent('youtube', { accion: 'velocidad', valor: parseFloat(m[1].replace(',', '.')) })
    if (/\bvelocidad normal\b/.test(t)) return intent('youtube', { accion: 'velocidad', valor: 1 })
    if (/\b(mas rapido|aceleralo|acelera el video)\b/.test(t)) return intent('youtube', { accion: 'mas_rapido' })
    if (/\b(mas lento|mas lenta)\b/.test(t)) return intent('youtube', { accion: 'mas_lento' })
    return null
  },
  (t) => {
    const fwd = /\b(adelanta|adelantame|adelantalo|avanza|avanzame|avanzalo)\b/.test(t)
    const back = /\b(atrasa|atrasame|atrasalo|retrocede|retrocedelo|rebobina)\b/.test(t)
    if (!fwd && !back) return null
    const n = t.match(/\b(\d{1,4})\b/)
    const mult = /\bminutos?\b/.test(t) ? 60 : 1
    return intent('youtube', { accion: fwd ? 'adelantar' : 'atrasar', valor: n ? parseInt(n[1], 10) * mult : 10 })
  },
  (t) => (/\b(siguiente video|proximo video|otro video|pasa de video)\b/.test(t) ? intent('youtube', { accion: 'siguiente' }) : null),
  (t) => (/\b(que estoy viendo|que video es este|que video es|de quien es este video|como se llama este video)\b/.test(t) ? intent('youtube', { accion: 'que_veo' }) : null),

  // Resumir el mail o la página abierta
  (t) => {
    if (!/\b(resumi|resumime|resumilo|resumila|resumen de|haceme un resumen|de que (se )?trata|que dice|lee|leeme|leelo)\b/.test(t)) return null
    if (/\b(del dia|de hoy)\b/.test(t)) return null
    return intent('resumir', { que: /\b(mail|correo|email|mensaje|gmail)\b/.test(t) ? 'mail' : 'pagina' })
  },

  // Búsquedas
  (t) => {
    const m =
      t.match(/^(?:busca(?:me)?|buscar|busques|pone(?:me)?|pongas|reproduci(?:me)?|mira|ver|quiero ver|quiero escuchar|escuchar|mostrame)\s+(.+?)\s+en (?:youtube|yt)$/) ||
      t.match(/^(?:youtube|yt)\s+(.+)$/) ||
      t.match(/\ben (?:youtube|yt)\s+(.+)$/) ||
      t.match(/^(?:pone(?:me)?|pongas|mostrame|quiero ver)\s+(?:un |unos )?videos? de\s+(.+)$/)
    if (m) return intent('buscar', { sitio: 'youtube', consulta: m[1] })
    const music = t.match(/^(?:pone(?:me)?|pongas|quiero escuchar|reproduci(?:me)?)\s+(?:musica|temas?|canciones?)\s+de\s+(.+)$/)
    return music ? intent('buscar', { sitio: 'youtube', consulta: `música de ${music[1]}` }) : null
  },
  (t) => {
    const m = t.match(/^(?:donde queda|donde esta|como llego a|como ir a|mapa de|ubicacion de)\s+(.+)$/)
    return m ? intent('buscar', { sitio: 'maps', consulta: m[1] }) : null
  },
  (t) => {
    const m = t.match(/^(?:busca(?:me)?|buscar|busques|googlea(?:me)?|googlear|investiga(?:me)?|averigua(?:me)?|fijate)\s+(?:en google\s+|en internet\s+|sobre\s+|que\s+|si\s+)?(.+?)(?:\s+en (?:google|internet))?$/)
    return m ? intent('buscar', { sitio: 'google', consulta: m[1] }) : null
  },

  // Música
  (t) => (/\b(siguiente|proxima (cancion|tema)|la que sigue|otra cancion|otro tema|cambia (de )?(tema|cancion)|pasa (la cancion|el tema|de tema|de cancion|esta)|saltala|saltalo|saltea|skip)\b/.test(t) ? intent('musica', { control: 'siguiente' }) : null),
  (t) => (/\b(anterior|volve (el tema|la cancion|a la anterior)|tema de antes|la de antes)\b/.test(t) ? intent('musica', { control: 'anterior' }) : null),
  (t) => {
    const mediaVerb = /\b(pausa|pausar|pausala|pausalo|play|reanuda|reanudar|continua|segui|resume)\b/.test(t) || /^reproduci$/.test(t)
    const withMusic = /\b(para|frena|deten|detene|pone|pon|poneme|pongas|dale|escuchar|corta|cortala|apaga)\b/.test(t) && MUSIC_WORDS.test(t)
    return mediaVerb || withMusic || /^(musica|algo de musica)$/.test(t) ? intent('musica', { control: 'pausa' }) : null
  },

  // Cerrar y abrir
  (t, ctx) => {
    const m = t.match(/^(?:cerra|cierra|cerrar|cierres|cerrame|mata|matar)\s+(.+)$/)
    if (!m) return null
    const rest = m[1].replace(ARTICLES, '')
    return intent('cerrar_app', { objetivo: findEntity(rest, ctx.index)?.alias ?? rest })
  },
  (t, ctx) => {
    const words = t.split(' ')
    if (!words.some((w) => OPEN_VERBS.has(w))) return null
    const e = findEntity(t, ctx.index)
    if (e) return intent('abrir', { objetivo: e.alias })
    const m = t.match(/^(?:abri|abre|abrir|abras|abrime|entra a|entra en|entrar a|anda a|ir a|ve a|lanza|ejecuta|inicia|arranca|mostrame)\s+(.+)$/)
    return m ? intent('abrir', { objetivo: m[1].replace(ARTICLES, '') }) : null
  },
  (t, ctx) => {
    const rest = t.replace(ARTICLES, '')
    const e = findEntity(rest, ctx.index)
    if (!e) return null
    const exact = e.alias === rest || (e.dist !== undefined && rest.split(' ').length === e.alias.split(' ').length)
    return exact ? { ...intent('abrir', { objetivo: e.alias }), implicit: true } : null
  },

  // Preguntas de conocimiento: se buscan en Google
  (t) => (KNOWLEDGE.test(t) ? { ...intent('buscar', { sitio: 'google', consulta: t }), knowledge: true } : null)
]

const GREETING_LEAD = /^(hola|holis|hey|ey|buenas|che)\s+/

function interpretSegment(segment, ctx) {
  const t = segment.replace(/ , /g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const tries = GREETING_LEAD.test(t) ? [t.replace(GREETING_LEAD, ''), t] : [t]
  for (const candidate of tries) {
    for (const rule of RULES) {
      const result = rule(candidate, ctx)
      if (result) return result
    }
  }
  return null
}

function context(options = {}) {
  return {
    index: options.customApps?.length ? buildIndex(options.customApps) : DEFAULT_INDEX,
    now: options.now ?? new Date()
  }
}

// Recupera las tildes del texto original: "reunion" → "reunión".
export function restoreAccents(original, phrase) {
  const src = String(original ?? '')
  const folded = fold(src) // misma longitud que el original
  const i = folded.indexOf(phrase)
  return i >= 0 && folded.length === src.length ? src.slice(i, i + phrase.length) : phrase
}

// Un solo pedido.
export function interpret(text, options) {
  return interpretSegment(normalize(text), context(options))
}

const SOCIAL = new Set(['saludo', 'gracias', 'charla'])
const SPLIT = /\s*(?:,|\by despues\b|\by luego\b|\by tambien\b|\bdespues\b|\bluego\b|\by\b)\s*/

// Uno o varios pedidos: "abrí YouTube y subí el volumen" → 2 acciones.
export function interpretAll(text, options) {
  const t = normalize(text)
  const ctx = context(options)
  const parts = t.split(SPLIT).filter(Boolean)
  if (parts.length > 1 && parts.length <= 5) {
    const intents = []
    for (const part of parts) {
      const r = interpretSegment(part, ctx)
      if (!r) break
      const prev = intents[intents.length - 1]
      // "cerrá Spotify y Discord": el segundo también se cierra
      if (r.implicit && prev?.action === 'cerrar_app') intents.push(intent('cerrar_app', r.params))
      else intents.push(r)
    }
    if (intents.length === parts.length && !intents.some((i) => i.bare)) {
      // "sos un genio, gracias": la charla sobra si hay acciones; si todo es charla, vale la última
      const useful = intents.some((i) => !SOCIAL.has(i.action))
        ? intents.filter((i) => !SOCIAL.has(i.action))
        : intents.slice(-1)
      const seen = new Set()
      return useful.filter((i) => {
        const key = JSON.stringify([i.action, i.params])
        return seen.has(key) ? false : seen.add(key)
      })
    }
  }
  const one = interpretSegment(t, ctx)
  return one ? [one] : null
}

// Ideas para cuando Pixie no entiende.
export function suggest(text, options) {
  const t = normalize(text).replace(/ , /g, ' ')
  const out = []
  const e = t && findEntity(t, context(options).index, { loose: true })
  if (e) out.push(`abrí ${e.nombre}`)
  if (/volum|sonid|audio/.test(t)) out.push('subí el volumen', 'bajá el volumen')
  if (/music|cancio|tema/.test(t)) out.push('pausá la música', 'siguiente canción')
  if (/timer|alarm|minut|avis|record/.test(t)) out.push('timer de 5 minutos')
  if (/clim|lluv|frio|calor|tiemp/.test(t)) out.push('¿cómo está el clima?')
  if (/hora|dia|fecha/.test(t)) out.push('¿qué hora es?')
  if (out.length < 2) out.push('¿qué podés hacer?')
  const original = String(text ?? '').trim()
  if (original && original.length <= 60) out.push(`buscá ${original}`)
  return [...new Set(out)].slice(0, 4)
}
