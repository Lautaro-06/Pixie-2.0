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
export function buildPlan({ minutos = DEFAULT_MINUTES, metodo = 'clasico', inicio = new Date(), materia = null } = {}) {
  const m = METHODS[metodo] ?? METHODS.clasico
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
  return { metodo: metodo in METHODS ? metodo : 'clasico', materia: materia || null, bloques, estudioMin, totalMin: bloques.reduce((s, b) => s + b.minutos, 0), bloquesEstudio: n }
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
  cornell: { nombre: 'Apuntes Cornell', como: 'Dividí la hoja: apuntes a la derecha, preguntas clave a la izquierda y un resumen abajo.', hacer: 'pasá tus apuntes al formato Cornell' }
}
const BY_SUBJECT = [
  [/\b(matematica|mate|algebra|geometria|calculo|fisica|quimica|contabilidad|estadistica|programacion|electronica|electricidad)\b/, ['ejercicios', 'feynman', 'espaciada']],
  [/\b(historia|biologia|geografia|ciudadania|construccion|anatomia|economia|derecho|sociales|naturales|filosofia)\b/, ['recuperacion', 'mapas', 'espaciada']],
  [/\b(lengua|literatura|redaccion|ensayo|monografia|informe)\b/, ['mapas', 'feynman', 'cornell']],
  [/\b(ingles|frances|portugues|italiano|aleman|idioma|vocabulario)\b/, ['fichas', 'espaciada', 'recuperacion']]
]
export function recommendTechniques(materia) {
  const t = fold(materia)
  const keys = BY_SUBJECT.find(([re]) => re.test(t))?.[1] ?? ['recuperacion', 'feynman', 'espaciada']
  return keys.map((k) => TECHNIQUES[k])
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
  const breaks = study.length > 1 ? ` con descansos de ${m.descanso} minutos${plan.bloques.some((b) => b.tipo === 'largo') ? ` (y uno largo de ${m.largo})` : ''}` : ''
  const about = plan.materia ? ` de ${plan.materia}` : ''
  const tech = recommendTechniques(plan.materia)[0]
  return `Te armé ${blocks}${about}${breaks}: de ${hhmm(first.desde)} a ${hhmm(last.hasta)}, ${minutesText(plan.estudioMin)} de estudio. Te recomiendo ${tech.nombre.toLowerCase()}: ${tech.como.charAt(0).toLowerCase()}${tech.como.slice(1)}`
}

// Qué hacer en cada bloque (sin IA): empezar entendiendo, después practicar y al final repasar
export function blockTips(plan) {
  const study = plan.bloques.filter((b) => b.tipo === 'estudio')
  const n = study.length
  if (!n) return []
  // Las técnicas de la materia, sin el repaso espaciado (que va al final)
  const tech = recommendTechniques(plan.materia).filter((t) => t.hacer !== TECHNIQUES.espaciada.hacer)
  return study.map((b, i) => {
    const what =
      n === 1
        ? `leé lo principal y al final ${tech[0].hacer}`
        : i === 0
          ? 'leé la teoría y marcá lo más importante (sin copiar todo)'
          : i === n - 1
            ? 'repasá lo de los bloques anteriores y aprovechá el mini test del final'
            : tech[(i - 1) % tech.length].hacer
    return `Bloque ${b.n}: ${what}.`
  })
}

// Con IA: consejos a medida para el plan (si no hay IA o falla, se usan los de blockTips)
export function advicePrompt(plan) {
  const study = plan.bloques.filter((b) => b.tipo === 'estudio')
  const about = plan.materia ? `de ${plan.materia}` : ''
  return `Voy a estudiar ${about} ${minutesText(plan.estudioMin)} con la técnica Pomodoro: ${study.length} ${study.length === 1 ? 'bloque' : 'bloques'} de ${study[0]?.minutos ?? 25} minutos con descansos. Decime qué conviene hacer en cada bloque para aprovecharlo (una línea por bloque, empezando con «Bloque 1:»), y un consejo para los descansos. En español rioplatense, corto, sin markdown ni asteriscos.`.replace(/\s+/g, ' ')
}

// Lo que muestra Ajustes → Pomodoro: lo elegido, el plan que sale con eso y cómo va la sesión (st: pomodoro.status())
export function pomodoroView(cfg = {}, st = null, inicio = new Date()) {
  const minutos = clampMinutes(cfg.minutos)
  const metodo = METHODS[cfg.metodo] ? cfg.metodo : 'clasico'
  const materia = String(cfg.materia ?? '')
  const plan = buildPlan({ minutos, metodo, materia: materia || null, inicio })
  const blocks = (list) => list.map((b) => ({ tipo: b.tipo, minutos: b.minutos, desde: b.desde, hasta: b.hasta, n: b.n ?? null }))
  return {
    minutos,
    metodo,
    materia,
    metodos: Object.entries(METHODS).map(([id, m]) => ({ id, nombre: m.nombre, texto: m.corto })),
    ofrecer: cfg.ofrecer !== false,
    distracciones: cfg.distracciones !== false,
    plan: { bloques: blocks(plan.bloques), estudioMin: plan.estudioMin, totalMin: plan.totalMin, texto: planText(plan), consejos: blockTips(plan) },
    tecnicas: recommendTechniques(materia),
    sesion: st?.activo
      ? { activo: true, fase: st.fase, bloque: st.bloque, bloques: st.bloques, indice: st.indice, restanteMs: st.restanteMs, pausado: st.pausado, materia: st.materia, plan: blocks(st.plan.bloques) }
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
    .replace(/\s+[-–|·]\s+(Word|Excel|PowerPoint|Bloc de notas|Notepad|Visual Studio Code|Adobe Acrobat.*|Documentos de Google|Google Docs|Presentaciones de Google|Classroom|Wikipedia.*|YouTube)$/i, '')
    .replace(/\.(docx?|pptx?|xlsx?|pdf|txt|odt)$/i, '')
    .replace(/^[●•*]\s*/, '')
    .trim()
    .slice(0, 80)
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
