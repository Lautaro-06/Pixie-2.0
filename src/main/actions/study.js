// Modo Pomodoro: «armá un pomodoro», «quiero estudiar química 2 horas», «arrancá un pomodoro»,
// «pausá el pomodoro», «saltá el descanso», «terminá el pomodoro», «tomame un mini test».
// La sesión vive en pomodoro.js y el plan en study.js; acá está lo que dice Pixie.
import { buildPlan, planText, minutesText, recommendTechniques, selfTest, quizPrompt, taskTypeForSubject, METHODS, TASK_TYPES, DEFAULT_MINUTES } from '../study.js'

const leftText = (ms) => {
  const min = Math.ceil(ms / 60000)
  return min <= 1 ? 'menos de un minuto' : `${min} minutos`
}

// Lo que pidió, completado con lo que elegiste en Ajustes → Pomodoro
function planFor({ minutos, materia, metodo, tipo }, ctx) {
  const cfg = ctx.getConfig()
  return buildPlan({
    minutos: minutos || cfg.pomodoroMinutos || DEFAULT_MINUTES,
    metodo: metodo || cfg.pomodoroMetodo || 'auto',
    materia: materia || null,
    tipo: TASK_TYPES[tipo] ? tipo : null,
    inicio: new Date()
  })
}

// Cuando no sabe qué vas a estudiar, pregunta (y con la respuesta elige el método)
export const STUDY_QUESTION = {
  text: '¿Qué vas a estudiar? Decime la materia y si vas a memorizar, resolver ejercicios o leer teoría, y te armo el plan con el método que mejor va.',
  suggestions: ['memorizar', 'resolver ejercicios', 'leer teoría', 'armalo igual']
}

const TASK_WHAT = { memorizar: 'memorizar', practica: 'resolver ejercicios', teoria: 'leer teoría' }

export function startText(st) {
  const first = st.plan.bloques[0]
  const about = st.materia ? ` de ${st.materia}` : ''
  return `¡Arrancamos${about}! Bloque 1 de ${st.bloques}: ${first.minutos} minutos. Es momento de que no haya distracciones: vuelvo en el descanso. No te voy a molestar, pero sigo acá si necesitás ayuda con lo que estudiás.`
}

export const studyActions = [
  {
    name: 'pomodoro',
    description: 'Modo Pomodoro para estudiar: arma el plan de bloques según el tiempo que tenés, lo arranca, lo pausa, sigue, saltea el descanso o lo termina',
    run: async ({ accion = 'plan', minutos, materia, metodo, tipo, directo = false }, ctx) => {
      const p = ctx.pomodoro
      if (!p) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      const st = p.status()
      if (accion === 'estado') {
        if (!st.activo) return { text: 'No hay un Pomodoro andando. Decime «armá un pomodoro» y lo planeamos.', face: 'idle' }
        const fase = st.fase === 'estudio' ? `Estás en el bloque ${st.bloque} de ${st.bloques}` : 'Estás en el descanso'
        const done = Math.round(st.estudiadoMs / 60000)
        const plan = Math.round(st.planeadoMs / 60000)
        const focus = st.estudiadoMs >= 60000 ? Math.round((1 - Math.min(st.distraidoMs, st.estudiadoMs) / st.estudiadoMs) * 100) : null
        const far = done >= 1 ? ` Llevás ${minutesText(done)} de ${minutesText(plan)}${focus !== null ? `, con ${focus}% de foco` : ''}.` : ''
        return { text: `${fase}: ${st.pausado ? 'en pausa, ' : ''}faltan ${leftText(st.restanteMs)}.${far}`, face: 'happy' }
      }
      if (accion === 'pausar' || accion === 'seguir') {
        if (!st.activo) return { text: 'No hay un Pomodoro andando.', face: 'confused' }
        const r = accion === 'pausar' ? p.pause() : p.resume()
        return r.pausado
          ? { text: `Pausé el Pomodoro (faltan ${leftText(r.restanteMs)}). Tocá la pantallita o decime «seguí con el pomodoro».`, face: 'idle' }
          : { text: '¡Seguimos!', face: 'happy' }
      }
      if (accion === 'saltar') {
        if (!st.activo) return { text: 'No hay un Pomodoro andando.', face: 'confused' }
        const r = p.skip()
        if (!r.activo) return { text: 'Era el último bloque: terminamos.', face: 'love' }
        return { text: r.fase === 'estudio' ? `Listo, saltamos al bloque ${r.bloque} de ${r.bloques}.` : 'Listo, pasamos al descanso.', face: 'happy' }
      }
      if (accion === 'terminar') {
        if (!st.activo) return { text: 'No había un Pomodoro andando.', face: 'idle' }
        const r = p.stop()
        // El resumen lo arma quien anota la sesión (con lo de hoy, la racha y el temario)
        const summary = ctx.lastStudySummary?.()
        return { text: summary ?? `Listo, terminé el Pomodoro. Estudiaste ${minutesText(Math.max(1, r.estudiadoMin))}.`, face: 'proud', suggestions: ['mostrame mi seguimiento'] }
      }
      if (st.activo) {
        const fase = st.fase === 'estudio' ? `el bloque ${st.bloque} de ${st.bloques}` : 'un descanso'
        return { text: `Ya hay un Pomodoro andando: estás en ${fase}. Si querés empezar de nuevo, decime «terminá el pomodoro».`, face: 'idle' }
      }
      // No sabe qué vas a estudiar: pregunta (si no le dijiste «armalo igual»)
      if (accion === 'plan' && !materia && !TASK_TYPES[tipo] && !directo && ctx.askStudy) {
        ctx.askStudy({ minutos, metodo })
        return { text: STUDY_QUESTION.text, face: 'happy', suggestions: STUDY_QUESTION.suggestions }
      }
      const plan = planFor({ minutos, materia, metodo, tipo }, ctx)
      if (!plan.bloques.length) return { text: planText(plan), face: 'confused' }
      if (accion === 'empezar') {
        const started = p.start(plan)
        return { text: startText(started), face: 'happy', pomodoro: true }
      }
      // Plan: lo muestra y pregunta si arranca
      ctx.setPending?.({ action: 'pomodoro', params: { accion: 'empezar', minutos: plan.totalMin, materia: plan.materia, metodo: plan.metodo, tipo: plan.tipo } })
      return { text: `${planText(plan)} ¿Arrancamos?`, face: 'happy', confirm: true }
    }
  },
  {
    name: 'mini_test',
    description: 'Toma un mini test de repaso sobre lo que estás estudiando (con IA, preguntas de verdad; sin IA, preguntas para repasar solo)',
    run: async ({ tema }, ctx) => {
      const about = String(tema ?? '').trim() || ctx.studyTopic?.() || ctx.pomodoro?.status().materia || null
      if (ctx.ai?.enabled()) {
        // Si lo que estudiás está abierto en Chrome, la IA pregunta sobre eso
        let page = ''
        if (ctx.browser?.connected()) {
          try {
            const r = await ctx.browser.request('leer', { que: 'pagina' }, 6000)
            if (r?.text && (!about || String(r.title ?? '').toLowerCase().includes(String(about).toLowerCase().slice(0, 12)))) page = r.text
          } catch {
            page = ''
          }
        }
        try {
          return await ctx.ai.chat(quizPrompt(about, page), ctx.contextText?.() ?? '')
        } catch {
          // sin internet: las preguntas de siempre
        }
      }
      return { text: selfTest(about), face: 'happy' }
    }
  },
  {
    name: 'que_me_perdi',
    description: 'Te cuenta los avisos que Pixie se guardó mientras estudiabas (mails, noticias, recordatorios)',
    run: (_, ctx) => {
      const list = ctx.missedNotices?.() ?? []
      if (!list.length) return { text: 'No te perdiste nada: no me guardé ningún aviso.', face: 'happy' }
      return { text: `Mientras estudiabas: ${list.slice(0, 6).join(' ')}${list.length > 6 ? ` Y ${list.length - 6} más.` : ''}`, face: 'happy' }
    }
  },
  {
    name: 'tecnicas_estudio',
    description: 'Recomienda el método y las técnicas de estudio según lo que vas a hacer (memorizar, ejercicios, teoría) o la materia',
    run: ({ materia, tipo }) => {
      const kind = TASK_TYPES[tipo] ? tipo : taskTypeForSubject(materia)
      const list = recommendTechniques(materia, kind)
      const about = TASK_TYPES[tipo] ? ` para ${TASK_WHAT[tipo]}` : materia ? ` para ${materia}` : ''
      const method = kind ? ` ${TASK_TYPES[kind].porque} Te conviene el ${METHODS[TASK_TYPES[kind].metodo].nombre.toLowerCase()} (${METHODS[TASK_TYPES[kind].metodo].corto}).` : ''
      return {
        text: `Te recomiendo${about}: ${list.map((t) => `${t.nombre.toLowerCase()} (${t.como.charAt(0).toLowerCase()}${t.como.slice(1, -1)})`).join('; ')}.${method}`,
        face: 'happy',
        suggestions: [materia ? `armá un pomodoro de ${materia}` : 'armá un pomodoro']
      }
    }
  },
  {
    name: 'estudio_resumen',
    description: 'Cuánto estudiaste con el Pomodoro: hoy, esta semana, este mes o la racha de días seguidos',
    run: ({ periodo = 'hoy' }, ctx) => {
      const p = ['hoy', 'semana', 'mes', 'racha'].includes(periodo) ? periodo : 'hoy'
      const text = ctx.studyLog?.stats(p) ?? 'Todavía no anoté nada de lo que estudiaste.'
      return { text, face: 'happy', suggestions: ['mostrame mi seguimiento'], noOffer: true }
    }
  },
  {
    name: 'ver_seguimiento',
    description: 'Abre el seguimiento de estudio (días, ciclos, adherencia, racha y temario) en Ajustes → Mi estudio',
    run: (_, ctx) => {
      ctx.openSettings?.('ajustes/estudio')
      return { text: 'Te abrí tu seguimiento de estudio.', face: 'happy', noOffer: true }
    }
  },
  {
    name: 'temario',
    description: 'El temario: qué temas ya viste y cuáles faltan, o guardar la lista de temas (temas separados por comas)',
    run: ({ temas, materia }, ctx) => {
      const log = ctx.studyLog
      if (!log) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      if (temas) {
        const t = log.setTemario(materia ?? null, String(temas).split(/,|\by\b/).join('\n'))
        if (!t) return { text: 'No entendí los temas. Decímelos separados por comas, o soltá la lista en Ajustes → Mi estudio.', face: 'confused' }
        return { text: `Anoté ${t.temas.length === 1 ? '1 tema' : `${t.temas.length} temas`}${t.materia ? ` de ${t.materia}` : ''}. Mientras estudiás voy tachando los que veo.`, face: 'happy', noOffer: true }
      }
      const t = log.temario()
      if (!t?.temas?.length) return { text: 'No tengo tu temario. Soltá la lista de temas en Ajustes → Mi estudio o decime «los temas son: …».', face: 'idle', suggestions: ['mostrame mi seguimiento'], noOffer: true }
      const seen = t.temas.filter((x) => x.visto).map((x) => x.texto)
      const missing = t.temas.filter((x) => !x.visto).map((x) => x.texto)
      const list = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a.at(-1)}`)
      if (!missing.length) return { text: `¡Ya viste los ${t.temas.length} temas${t.materia ? ` de ${t.materia}` : ''}!`, face: 'love', noOffer: true }
      return {
        text: `Llevás ${seen.length} de ${t.temas.length} temas${t.materia ? ` de ${t.materia}` : ''}. Te ${missing.length === 1 ? 'falta' : 'faltan'}: ${list(missing.slice(0, 6))}${missing.length > 6 ? ` y ${missing.length - 6} más` : ''}.`,
        face: 'happy',
        noOffer: true
      }
    }
  }
]

export { METHODS }
