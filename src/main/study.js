// Estudio: el plan de un Pomodoro (bloques de estudio y descansos según el tiempo que tenés), qué
// técnica de estudio conviene según la materia, el mini test de repaso y cómo darse cuenta de que
// estás hablando de estudiar. Todo anda sin IA; con IA el plan y el test salen más a tu medida.

export const METHODS = {
  clasico: { nombre: 'Pomodoro clásico', estudio: 25, descanso: 5, largo: 15, cada: 4, corto: '25 minutos de estudio y 5 de descanso' },
  largo: { nombre: 'Bloques largos', estudio: 50, descanso: 10, largo: 20, cada: 3, corto: '50 minutos de estudio y 10 de descanso' }
}
export const DEFAULT_MINUTES = 120
export const MIN_MINUTES = 15
export const MAX_MINUTES = 8 * 60
export const clampMinutes = (v) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(Number(v) || DEFAULT_MINUTES)))

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const hhmm = (d) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// El plan: los bloques uno atrás del otro hasta llenar el tiempo que tenés.
// Después de cada bloque, un descanso (cada tantos, uno largo); el último bloque no tiene descanso.
// metodo: 'clasico', 'largo' o 'auto' (según el tipo de tarea: para ejercicios, bloques largos)
export function buildPlan({ minutos = DEFAULT_MINUTES, metodo = 'auto', inicio = new Date(), materia = null, tipo = null } = {}) {
  const kind = TASK_TYPES[tipo] ? tipo : taskTypeForSubject(materia)
  const auto = !METHODS[metodo]
  const chosen = auto ? (TASK_TYPES[kind]?.metodo ?? 'clasico') : metodo
  const m = METHODS[chosen]
  const total = clampMinutes(minutos)
  const bloques = []
  let left = total
  let n = 0
  let t = new Date(inicio).getTime()
  const push = (tipo, min) => {
    bloques.push({ tipo, minutos: min, desde: new Date(t).toISOString(), hasta: new Date(t + min * 60000).toISOString(), ...(tipo === 'estudio' ? { n: n } : {}) })
    t += min * 60000
    left -= min
  }
  while (left >= Math.min(m.estudio, 15)) {
    n++
    push('estudio', Math.min(m.estudio, left))
    const longBreak = n % m.cada === 0
    const pause = longBreak ? m.largo : m.descanso
    // Solo hay descanso si después entra otro bloque de al menos 15 minutos
    if (left - pause < 15) break
    push(longBreak ? 'largo' : 'descanso', pause)
  }
  const estudioMin = bloques.filter((b) => b.tipo === 'estudio').reduce((s, b) => s + b.minutos, 0)
  return { metodo: chosen, auto, tipo: kind ?? null, materia: materia || null, bloques, estudioMin, totalMin: bloques.reduce((s, b) => s + b.minutos, 0), bloquesEstudio: n }
}

const minutesText = (min) => {
  const mins = (n) => (n === 1 ? '1 minuto' : `${n} minutos`)
  if (min < 60) return mins(min)
  const h = Math.floor(min / 60)
  const r = min % 60
  const hs = h === 1 ? '1 hora' : `${h} horas`
  return r ? `${hs} y ${mins(r)}` : hs
}
export { minutesText }

// Qué técnica de estudio conviene según la materia o lo que vas a hacer
const TECHNIQUES = {
  recuperacion: { nombre: 'Recuperación activa', como: 'Cerrá el apunte y tratá de acordarte o escribir lo que leíste. Después fijate qué te faltó.', hacer: 'cerrá el apunte y escribí lo que te acordás' },
  feynman: { nombre: 'Técnica Feynman', como: 'Explicá el tema en voz alta como si se lo contaras a alguien que no sabe nada. Donde te trabás, ahí tenés que repasar.', hacer: 'explicalo en voz alta como si se lo contaras a alguien' },
  ejercicios: { nombre: 'Práctica con ejercicios', como: 'Resolvé ejercicios sin mirar la resolución y mezclá de distintos tipos. Corregí al final de cada bloque.', hacer: 'resolvé ejercicios sin mirar la resolución' },
  espaciada: { nombre: 'Repaso espaciado', como: 'Repasá lo mismo hoy, mañana y en unos días, en vez de todo junto el día antes.', hacer: 'repasá lo de los bloques anteriores' },
  mapas: { nombre: 'Mapa conceptual', como: 'Armá un esquema con las ideas principales y cómo se conectan. Sirve para temas con muchos conceptos.', hacer: 'armá un mapa conceptual' },
  fichas: { nombre: 'Fichas de pregunta y respuesta', como: 'Escribí preguntas de un lado y respuestas del otro, y tomate examen a vos mismo.', hacer: 'hacé fichas de pregunta y respuesta' },
  cornell: { nombre: 'Apuntes Cornell', como: 'Dividí la hoja: apuntes a la derecha, preguntas clave a la izquierda y un resumen abajo.', hacer: 'pasá tus apuntes al formato Cornell' },
  resumen: { nombre: 'Resumen propio', como: 'Después de leer, escribí con tus palabras lo más importante, sin mirar el texto. Si no te sale, volvé a leer esa parte.', hacer: 'escribí un resumen con tus palabras, sin mirar' }
}

// Qué vas a hacer: memorizar, resolver ejercicios o leer teoría. Cada cosa tiene su método y sus técnicas.
export const TASK_TYPES = {
  memorizar: {
    nombre: 'Memorizar',
    corto: 'fechas, vocabulario, fórmulas, definiciones',
    metodo: 'clasico',
    tecnicas: ['recuperacion', 'espaciada', 'fichas'],
    porque: 'Para memorizar conviene bloques cortos con repaso activo y repetición espaciada.'
  },
  practica: {
    nombre: 'Ejercicios y problemas',
    corto: 'cálculo, problemas, programación',
    metodo: 'largo',
    tecnicas: ['ejercicios', 'feynman', 'espaciada'],
    porque: 'Para resolver ejercicios conviene bloques largos, así no cortás el ritmo a mitad de un problema.'
  },
  teoria: {
    nombre: 'Leer teoría',
    corto: 'capítulos, apuntes, textos',
    metodo: 'clasico',
    tecnicas: ['resumen', 'feynman', 'mapas'],
    porque: 'Para leer teoría conviene leer un bloque y después hacer tu propio resumen o explicarlo con la técnica Feynman.'
  }
}
const TASK_WORDS = [
  ['practica', /\b(ejercicios?|ejercitar|problemas?|resolver|resuelvo|calcul\w*|program\w*|codigo|codear|integrales?|derivadas?|ecuaciones?|algoritmos?|practicar|practica)\b/],
  ['memorizar', /\b(memoriz\w*|de memoria|vocabulario|fechas|formulas|verbos|definiciones|tabla periodica|capitales|aprenderme|fichas)\b/],
  ['teoria', /\b(leer|lectura|teoria|capitulos?|apuntes?|textos?|libros?|resumir|resumen|entender)\b/]
]
// «tengo que resolver ejercicios de física» → practica
export function taskTypeFrom(text) {
  const t = fold(text)
  return TASK_WORDS.find(([, re]) => re.test(t))?.[0] ?? null
}
// Según la materia: qué técnicas y qué tipo de tarea suele ser
const BY_SUBJECT = [
  [/\b(matematica|mate|algebra|geometria|calculo|fisica|quimica|contabilidad|estadistica|programacion|electronica|electricidad|informatica)\b/, ['ejercicios', 'feynman', 'espaciada'], 'practica'],
  [/\b(historia|biologia|geografia|ciudadania|construccion|anatomia|economia|derecho|sociales|naturales|filosofia|sociologia|psicologia)\b/, ['recuperacion', 'mapas', 'espaciada'], 'teoria'],
  [/\b(lengua|literatura|redaccion|ensayo|monografia|informe)\b/, ['mapas', 'feynman', 'cornell'], 'teoria'],
  [/\b(ingles|frances|portugues|italiano|aleman|idioma|vocabulario)\b/, ['fichas', 'espaciada', 'recuperacion'], 'memorizar']
]
export function taskTypeForSubject(materia) {
  const t = fold(materia)
  return (t && BY_SUBJECT.find(([re]) => re.test(t))?.[2]) || null
}
// tipo (memorizar, practica, teoria) manda sobre la materia
export function recommendTechniques(materia, tipo = null) {
  if (TASK_TYPES[tipo]) return TASK_TYPES[tipo].tecnicas.map((k) => TECHNIQUES[k])
  const t = fold(materia)
  const keys = BY_SUBJECT.find(([re]) => re.test(t))?.[1] ?? ['recuperacion', 'feynman', 'espaciada']
  return keys.map((k) => TECHNIQUES[k])
}

// Las materias de la escuela, para entender «química» o «tengo historia» sin un verbo antes
const SUBJECTS = {
  matematica: 'matemática', algebra: 'álgebra', geometria: 'geometría', fisica: 'física', quimica: 'química', biologia: 'biología',
  historia: 'historia', geografia: 'geografía', ingles: 'inglés', frances: 'francés', portugues: 'portugués', italiano: 'italiano',
  lengua: 'lengua', literatura: 'literatura', filosofia: 'filosofía', economia: 'economía', contabilidad: 'contabilidad',
  programacion: 'programación', informatica: 'informática', electronica: 'electrónica', electricidad: 'electricidad',
  ciudadania: 'ciudadanía', sociologia: 'sociología', psicologia: 'psicología', estadistica: 'estadística', anatomia: 'anatomía',
  tecnologia: 'tecnología', derecho: 'derecho', mate: 'matemática'
}
const SUBJECT_RE = new RegExp(`\\b(${Object.keys(SUBJECTS).join('|')})\\b`)
export function subjectIn(text) {
  const m = SUBJECT_RE.exec(fold(text))
  return m ? SUBJECTS[m[1]] : null
}

// Lo que dice Pixie del plan (corto, para leer en voz alta)
export function planText(plan) {
  const m = METHODS[plan.metodo]
  const study = plan.bloques.filter((b) => b.tipo === 'estudio')
  if (!study.length) return 'Con tan poco tiempo no entra un bloque de estudio. Probá con 15 minutos o más.'
  const first = plan.bloques[0]
  const last = plan.bloques.at(-1)
  const sizes = [...new Set(study.map((b) => b.minutos))]
  const blocks = study.length === 1 ? `un bloque de ${study[0].minutos} minutos` : `${study.length} bloques de ${sizes.length === 1 ? `${sizes[0]} minutos` : 'estudio'}`
  const pauses = plan.bloques.filter((b) => b.tipo !== 'estudio').length
  const breaks = pauses === 1 ? ` con un descanso de ${plan.bloques.find((b) => b.tipo !== 'estudio').minutos} minutos` : pauses > 1 ? ` con descansos de ${m.descanso} minutos${plan.bloques.some((b) => b.tipo === 'largo') ? ` (y uno largo de ${m.largo})` : ''}` : ''
  const about = plan.materia ? ` de ${plan.materia}` : ''
  const tech = recommendTechniques(plan.materia, plan.tipo)[0]
  // Si el método lo eligió ella por el tipo de tarea, dice por qué
  const why = plan.auto && TASK_TYPES[plan.tipo] ? `${TASK_TYPES[plan.tipo].porque} ` : ''
  return `${why}Te armé ${blocks}${about}${breaks}: de ${hhmm(first.desde)} a ${hhmm(last.hasta)}, ${minutesText(plan.estudioMin)} de estudio. Te recomiendo ${tech.nombre.toLowerCase()}: ${tech.como.charAt(0).toLowerCase()}${tech.como.slice(1)}`
}

// Qué hacer en cada bloque (sin IA): empezar entendiendo, después practicar y al final repasar
export function blockTips(plan) {
  const study = plan.bloques.filter((b) => b.tipo === 'estudio')
  const n = study.length
  if (!n) return []
  // Las técnicas de la tarea o la materia, sin el repaso espaciado (que va al final)
  const tech =
    plan.tipo === 'memorizar'
      ? [TECHNIQUES.recuperacion, { hacer: 'tomate examen con tus fichas sin mirar las respuestas' }]
      : recommendTechniques(plan.materia, plan.tipo).filter((t) => t.hacer !== TECHNIQUES.espaciada.hacer)
  const first = { memorizar: 'leé y armá fichas de pregunta y respuesta', practica: 'mirá la teoría y un ejercicio resuelto', teoria: 'leé y marcá lo más importante (sin copiar todo)' }[plan.tipo] ?? 'leé la teoría y marcá lo más importante (sin copiar todo)'
  const lastTip =
    plan.tipo === 'memorizar'
      ? 'repasá todo sin mirar y aprovechá el mini test (mañana repasalo de nuevo)'
      : plan.tipo === 'practica'
        ? 'hacé ejercicios mezclados, corregí y aprovechá el mini test'
        : 'repasá lo de los bloques anteriores y aprovechá el mini test del final'
  return study.map((b, i) => {
    const what = n === 1 ? `${first} y al final ${tech[0].hacer}` : i === 0 ? first : i === n - 1 ? lastTip : tech[(i - 1) % tech.length].hacer
    return `Bloque ${b.n}: ${what}.`
  })
}

// Con IA: consejos a medida para el plan (si no hay IA o falla, se usan los de blockTips)
export function advicePrompt(plan) {
  const study = plan.bloques.filter((b) => b.tipo === 'estudio')
  const about = plan.materia ? `de ${plan.materia}` : ''
  const what = TASK_TYPES[plan.tipo] ? ` (voy a ${{ memorizar: 'memorizar', practica: 'resolver ejercicios', teoria: 'leer teoría' }[plan.tipo]})` : ''
  return `Voy a estudiar ${about}${what} ${minutesText(plan.estudioMin)} con la técnica Pomodoro: ${study.length} ${study.length === 1 ? 'bloque' : 'bloques'} de ${study[0]?.minutos ?? 25} minutos con descansos. Decime qué conviene hacer en cada bloque para aprovecharlo (una línea por bloque, empezando con «Bloque 1:»), y un consejo para los descansos. En español rioplatense, corto, sin markdown ni asteriscos.`.replace(/\s+/g, ' ')
}

// Lo que muestra Ajustes → Pomodoro: lo elegido, el plan que sale con eso y cómo va la sesión (st: pomodoro.status())
export function pomodoroView(cfg = {}, st = null, inicio = new Date()) {
  const minutos = clampMinutes(cfg.minutos)
  const metodo = METHODS[cfg.metodo] ? cfg.metodo : 'auto'
  const materia = String(cfg.materia ?? '')
  const tipo = TASK_TYPES[cfg.tipo] ? cfg.tipo : ''
  const plan = buildPlan({ minutos, metodo, materia: materia || null, tipo: tipo || null, inicio })
  const blocks = (list) => list.map((b) => ({ tipo: b.tipo, minutos: b.minutos, desde: b.desde, hasta: b.hasta, n: b.n ?? null }))
  return {
    minutos,
    metodo,
    materia,
    tipo,
    tipos: Object.entries(TASK_TYPES).map(([id, t]) => ({ id, nombre: t.nombre, texto: t.corto })),
    // El método que quedó (si elegiste «según la tarea») y por qué
    metodoUsado: plan.metodo,
    porque: plan.auto && TASK_TYPES[plan.tipo] ? TASK_TYPES[plan.tipo].porque : null,
    metodos: [{ id: 'auto', nombre: 'Según la tarea', texto: 'Lo elijo yo según lo que vas a estudiar' }, ...Object.entries(METHODS).map(([id, m]) => ({ id, nombre: m.nombre, texto: m.corto }))],
    ofrecer: cfg.ofrecer !== false,
    distracciones: cfg.distracciones !== false,
    plan: { bloques: blocks(plan.bloques), estudioMin: plan.estudioMin, totalMin: plan.totalMin, texto: planText(plan), consejos: blockTips(plan) },
    tecnicas: recommendTechniques(materia, plan.tipo),
    sesion: st?.activo
      ? {
          activo: true,
          fase: st.fase,
          bloque: st.bloque,
          bloques: st.bloques,
          indice: st.indice,
          restanteMs: st.restanteMs,
          pausado: st.pausado,
          materia: st.materia,
          plan: blocks(st.plan.bloques),
          // Cuánto llevás de lo planeado y qué parte fue con foco
          estudiadoMin: Math.round((st.estudiadoMs ?? 0) / 60000),
          planeadoMin: Math.round((st.planeadoMs ?? 0) / 60000),
          foco: st.estudiadoMs >= 60000 ? Math.round((1 - Math.min(st.distraidoMs ?? 0, st.estudiadoMs) / st.estudiadoMs) * 100) : null
        }
      : { activo: false }
  }
}

// ¿Está hablando de estudiar? («tengo que estudiar para la prueba», «mañana tengo examen»)
const STUDY = /\b(estudi(ar|o|amos|e|ando)|repas(ar|o|emos)|tengo (una )?(prueba|examen|parcial|final|evaluacion|oral|leccion)|(prueba|examen|parcial|final|oral|leccion) (de|el|la|del|mañana|manana)|hacer (la |el |los )?(tarea|tp|trabajo practico|deberes|ejercicios)|tengo (tarea|tp|deberes)|preparar (la |el )?(prueba|examen|exposicion|oral))\b/
export const studyIntent = (text) => STUDY.test(fold(text))

// La materia de lo que dijo: «estudiar química para el jueves» → «química»
export function subjectFrom(text) {
  const raw = String(text ?? '')
  const m = /\b(?:estudiar|repasar|prueba de|examen de|parcial de|final de|oral de|tarea de|tp de|lecci[oó]n de)\s+([a-záéíóúñü ]{3,40}?)(?:\s+(?:para|el|la|mañana|hoy|el lunes|el martes|el miércoles|el jueves|el viernes|porque|que|y)\b|[.,?!]|$)/i.exec(raw)
  const s = m?.[1]?.trim().replace(/^(la|el|los|las|un|una)\s+/i, '')
  return s && !/^(rato|un rato|mucho|poco|algo|todo|esto|eso|nada)$/i.test(s) ? s : null
}

// «2 horas», «una hora y media», «45 minutos», «1:30» → minutos
export function minutesFrom(text) {
  const t = fold(text)
  const hm = /\b(\d{1,2}):(\d{2})\s*(?:h|horas?)?\b/.exec(t)
  if (hm) return +hm[1] * 60 + +hm[2]
  const words = { una: 1, un: 1, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5 }
  let total = 0
  const h = /\b(\d+(?:[.,]\d+)?|una|un|dos|tres|cuatro|cinco)\s+horas?\b/.exec(t)
  if (h) total += (words[h[1]] ?? parseFloat(h[1].replace(',', '.'))) * 60
  if (/\bhoras? y media\b|\by media\b/.test(t) && h) total += 30
  if (/\bmedia hora\b/.test(t)) total += 30
  const m = /\b(\d+)\s*(?:minutos?|min)\b/.exec(t)
  if (m) total += +m[1]
  return total ? Math.round(total) : null
}

// Sobre qué estás estudiando: el nombre de lo que tuviste abierto («Fotosíntesis - Wikipedia» → «Fotosíntesis»)
export function topicFromTitle(title) {
  return String(title ?? '')
    .replace(/\s+[-–|·]\s+(Google Chrome|Microsoft Edge|Mozilla Firefox|Brave|Opera)$/i, '')
    .replace(/\s+[-–|·]\s+(Buscar con Google|Búsqueda de Google|Google Search|Google)$/i, '')
    .replace(/\s+[-–|·]\s+(Word|Excel|PowerPoint|Bloc de notas|Notepad|Visual Studio Code|Adobe Acrobat.*|Documentos de Google|Google Docs|Presentaciones de Google|Classroom|Wikipedia.*|YouTube)$/i, '')
    .replace(/\.(docx?|pptx?|xlsx?|pdf|txt|odt)$/i, '')
    .replace(/^[●•*]\s*/, '')
    .trim()
    .slice(0, 80)
}

// Lo que no es un tema: pestañas vacías, inicios, nombres de apps
const GENERIC = /^(nueva pestana|new tab|google|inicio|home|tareas|pendientes|novedades|trabajo de clase|classroom|gmail|bandeja de entrada|youtube|word|excel|powerpoint|documento sin titulo|presentacion sin titulo|hoja de calculo sin titulo|sin titulo|untitled|documento\d*|bloc de notas|configuracion|pixie|descargas|escritorio|explorador de archivos|chatgpt|gemini|whatsapp|.{0,2})$/

// Los temas que estuviste estudiando: los títulos que tuviste abiertos más de un minuto, limpios
// entries: [[título, ms], …] → ['Fotosíntesis', 'Respiración celular']
export function topicsFromTitles(entries, { minMs = 60000, max = 6 } = {}) {
  const seen = new Set()
  const out = []
  for (const [title, ms] of [...entries].sort((a, b) => b[1] - a[1])) {
    if (ms < minMs) continue
    const topic = topicFromTitle(title)
    const key = fold(topic).trim()
    if (!topic || GENERIC.test(key) || seen.has(key)) continue
    seen.add(key)
    out.push(topic)
    if (out.length >= max) break
  }
  return out
}

// ¿Lo que tenés adelante es una distracción? A criterio de Pixie:
//   la música no (Spotify, YouTube Music); un video de YouTube sí, salvo que sea una clase o un tutorial;
//   las redes, el streaming, los juegos, las compras y las noticias sí; un chat, solo si te quedás un rato.
// ventana: { titulo, proceso, pantallaCompleta } → { tipo: 'estudio' | 'neutral' | 'chat' | 'distraccion', app } o null
const MUSIC = /\b(spotify|youtube music|deezer|soundcloud|tidal|apple music|amazon music|radio)\b/
const EDUCATIONAL = /\b(clases?|curso|tutorial|explicacion|explicado|ejercicios?|resuelto|resueltos|teoria|leccion|examen|parcial|final|repaso|resumen|aprende|aprender|como (se )?(resuelve|calcula|hace|funciona)|khan|julioprofe|unicoos|profe|matematica|fisica|quimica|biologia|historia|geografia|ingles|programacion|derivadas?|integrales?|ecuaciones?|funciones|gramatica|ted)\b/
const DISTRACTING = [
  [/instagram/, 'Instagram'],
  [/tiktok/, 'TikTok'],
  [/twitter|\/ x\b|^x$|^x \//, 'X'],
  [/facebook/, 'Facebook'],
  [/reddit/, 'Reddit'],
  [/9gag|taringa|pinterest/, 'las redes'],
  [/netflix/, 'Netflix'],
  [/twitch/, 'Twitch'],
  [/kick\.com|\bkick\b/, 'Kick'],
  [/cuevana|pelisplus|repelis|gnula|pelis ?24/, 'una página de películas'],
  [/disney\+|prime video|star\+|\bhbo\b|\bmax\b|paramount|crunchyroll|pluto ?tv|animeflv|jkanime|\bflow\b/, 'una plataforma de streaming'],
  [/mercado ?libre|\btemu\b|\bshein\b|aliexpress/, 'una página de compras'],
  [/infobae|clarin|la nacion|\bole\b|tyc sports|todo noticias/, 'las noticias']
]
const GAMES = /^(steam|robloxplayerbeta|league of legends|valorant|fortniteclient|minecraft|javaw|epicgameslauncher|riotclientservices|battle\.net|leagueclient|genshinimpact|gta5|fifa\d*|fc\d*)$/
const CHATS = [[/whatsapp/, 'WhatsApp'], [/discord/, 'Discord'], [/telegram/, 'Telegram'], [/messenger/, 'Messenger']]
export function focusKind(ventana, { materia = null } = {}) {
  if (!ventana) return null
  const t = fold(ventana.titulo)
  const proceso = fold(ventana.proceso).replace(/\.exe$/, '')
  if (!t && !proceso) return null
  if (/^(pixie|electron)$/.test(proceso)) return null
  if (MUSIC.test(t) || MUSIC.test(proceso)) return { tipo: 'neutral', app: 'la música' }
  // YouTube: una clase o algo de la materia es estudiar; lo demás, distraerse
  if (/youtube/.test(t)) {
    const edu = EDUCATIONAL.test(t) || (materia && t.includes(fold(materia)))
    return edu ? { tipo: 'estudio', app: 'YouTube' } : { tipo: 'distraccion', app: 'YouTube' }
  }
  for (const [re, app] of DISTRACTING) if (re.test(t)) return { tipo: 'distraccion', app }
  for (const [re, app] of CHATS) if (re.test(t) || re.test(proceso)) return { tipo: 'chat', app }
  if (GAMES.test(proceso)) return { tipo: 'distraccion', app: 'un juego' }
  // En pantalla completa y no es el navegador ni una app de estudio: casi seguro un juego
  if (ventana.pantallaCompleta && !/^(chrome|msedge|firefox|opera|brave|winword|powerpnt|excel|acrord32|acrobat|code|applicationframehost|vlc)$/.test(proceso)) {
    return { tipo: 'distraccion', app: 'un juego' }
  }
  return { tipo: 'estudio', app: null }
}

// Sin IA: preguntas de repaso que sirven para cualquier tema
export function selfTest(tema) {
  const about = tema ? ` sobre «${tema}»` : ''
  return [
    `Mini test de repaso${about}. Cerrá el apunte y respondé en voz alta o en un papel:`,
    '1) ¿Cuáles son las tres ideas más importantes de lo que estudiaste?',
    '2) ¿Cómo se lo explicarías a alguien que no sabe nada del tema?',
    '3) Inventá una pregunta que te podría tomar la profe y respondela sin mirar.',
    'Después abrí el apunte y fijate qué te faltó: eso es lo que hay que repasar.'
  ].join(' ')
}

export function quizPrompt(tema, texto = '') {
  const about = tema ? `sobre «${tema}»` : 'sobre lo que estuve estudiando'
  const source = texto ? `\n\nEsto es parte de lo que estuve leyendo:\n<texto>\n${texto.slice(0, 6000)}\n</texto>` : ''
  return `Tomame un mini test de repaso ${about}: 3 preguntas cortas, de a una por vez. Empezá con la primera y esperá mi respuesta; después decime si está bien y pasá a la siguiente.${source}`
}
