// Modo Pomodoro: «armá un pomodoro», «quiero estudiar química 2 horas», «arrancá un pomodoro»,
// «pausá el pomodoro», «saltá el descanso», «terminá el pomodoro», «tomame un mini test».
// La sesión vive en pomodoro.js y el plan en study.js; acá está lo que dice Pixie.
import { buildPlan, planText, minutesText, recommendTechniques, selfTest, quizPrompt, METHODS, DEFAULT_MINUTES } from '../study.js'

const leftText = (ms) => {
  const min = Math.ceil(ms / 60000)
  return min <= 1 ? 'menos de un minuto' : `${min} minutos`
}

// Lo que pidió, completado con lo que elegiste en Ajustes → Pomodoro
function planFor({ minutos, materia, metodo }, ctx) {
  const cfg = ctx.getConfig()
  return buildPlan({
    minutos: minutos || cfg.pomodoroMinutos || DEFAULT_MINUTES,
    metodo: metodo || cfg.pomodoroMetodo || 'clasico',
    materia: materia || null,
    inicio: new Date()
  })
}

export function startText(st) {
  const first = st.plan.bloques[0]
  const about = st.materia ? ` de ${st.materia}` : ''
  return `¡Arrancamos${about}! Bloque 1 de ${st.bloques}: ${first.minutos} minutos. Es momento de que no haya distracciones: vuelvo en el descanso. No te voy a molestar, pero sigo acá si necesitás ayuda con lo que estudiás.`
}

export const studyActions = [
  {
    name: 'pomodoro',
    description: 'Modo Pomodoro para estudiar: arma el plan de bloques según el tiempo que tenés, lo arranca, lo pausa, sigue, saltea el descanso o lo termina',
    run: async ({ accion = 'plan', minutos, materia, metodo }, ctx) => {
      const p = ctx.pomodoro
      if (!p) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      const st = p.status()
      if (accion === 'estado') {
        if (!st.activo) return { text: 'No hay un Pomodoro andando. Decime «armá un pomodoro» y lo planeamos.', face: 'idle' }
        const fase = st.fase === 'estudio' ? `Estás en el bloque ${st.bloque} de ${st.bloques}` : 'Estás en el descanso'
        return { text: `${fase}: ${st.pausado ? 'en pausa, ' : ''}faltan ${leftText(st.restanteMs)}.`, face: 'happy' }
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
        return { text: `Listo, terminé el Pomodoro. Estudiaste ${minutesText(Math.max(1, r.estudiadoMin))}.`, face: 'happy' }
      }
      if (st.activo) {
        const fase = st.fase === 'estudio' ? `el bloque ${st.bloque} de ${st.bloques}` : 'un descanso'
        return { text: `Ya hay un Pomodoro andando: estás en ${fase}. Si querés empezar de nuevo, decime «terminá el pomodoro».`, face: 'idle' }
      }
      const plan = planFor({ minutos, materia, metodo }, ctx)
      if (!plan.bloques.length) return { text: planText(plan), face: 'confused' }
      if (accion === 'empezar') {
        const started = p.start(plan)
        return { text: startText(started), face: 'happy', pomodoro: true }
      }
      // Plan: lo muestra y pregunta si arranca
      ctx.setPending?.({ action: 'pomodoro', params: { accion: 'empezar', minutos: plan.totalMin, materia: plan.materia, metodo: plan.metodo } })
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
    description: 'Recomienda técnicas de estudio según la materia',
    run: ({ materia }) => {
      const list = recommendTechniques(materia)
      const about = materia ? ` para ${materia}` : ''
      return { text: `Te recomiendo${about}: ${list.map((t) => `${t.nombre.toLowerCase()} (${t.como.charAt(0).toLowerCase()}${t.como.slice(1, -1)})`).join('; ')}.`, face: 'happy' }
    }
  }
]

export { METHODS }
