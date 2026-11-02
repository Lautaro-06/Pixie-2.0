// La sesión de Pomodoro: va pasando por los bloques del plan (estudio, descanso, descanso largo),
// se puede pausar, seguir, saltar o terminar, y avisa:
//   bloque    → empieza un bloque de estudio
//   ultimos2  → faltan 2 minutos para que termine el bloque (para ofrecer el mini test)
//   descanso  → empieza un descanso
//   fin       → terminó todo (o lo terminaste): cuánto estudiaste, los ciclos, el foco y la adherencia
//   cambio    → cambió algo (para mostrarlo en la pantallita y en Ajustes)

const TWO_MIN = 2 * 60 * 1000
// Un bloque salteado cuenta como ciclo si ya llevabas casi todo
const CYCLE_DONE = 0.8

export function createPomodoro({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, on = () => {} } = {}) {
  let s = null // { plan, i, finAt, pausado (ms que faltaban), inicio, estudiado (ms), distraido (ms), ciclos }
  let timers = []

  const clear = () => {
    timers.forEach((t) => clearTimer(t))
    timers = []
  }
  const block = () => (s ? s.plan.bloques[s.i] : null)
  const studyBlocks = () => s.plan.bloques.filter((b) => b.tipo === 'estudio').length
  const plannedMs = () => s.plan.bloques.filter((b) => b.tipo === 'estudio').reduce((t, b) => t + b.minutos * 60000, 0)
  // Lo que lleva estudiado, contando el bloque de ahora
  const studiedMs = () => {
    const b = block()
    if (!b || b.tipo !== 'estudio') return s.estudiado
    return s.estudiado + b.minutos * 60000 - (s.pausado ?? Math.max(0, s.finAt - now()))
  }

  function status() {
    if (!s) return { activo: false }
    const b = block()
    const left = s.pausado ?? Math.max(0, s.finAt - now())
    const total = b.minutos * 60000
    return {
      activo: true,
      fase: b.tipo, // estudio | descanso | largo
      indice: s.i, // en qué parte del plan va (para marcarla en Ajustes)
      bloque: b.n ?? s.plan.bloques.slice(0, s.i).filter((x) => x.tipo === 'estudio').length,
      bloques: studyBlocks(),
      restanteMs: left,
      totalMs: total,
      finAt: s.pausado === null ? s.finAt : null,
      pausado: s.pausado !== null,
      progreso: Math.min(1, Math.max(0, 1 - left / total)),
      materia: s.plan.materia,
      metodo: s.plan.metodo,
      tipo: s.plan.tipo ?? null,
      plan: s.plan,
      // Para «¿cómo voy?» y Ajustes: cuánto llevás de lo planeado y qué parte fue con foco
      estudiadoMs: studiedMs(),
      distraidoMs: s.distraido,
      planeadoMs: plannedMs(),
      ciclos: s.ciclos
    }
  }

  // Programa lo que pasa en este bloque: el aviso de los 2 minutos y el paso al siguiente
  function schedule() {
    clear()
    const b = block()
    const left = s.finAt - now()
    if (b.tipo === 'estudio' && left > TWO_MIN && b.minutos >= 6) {
      timers.push(setTimer(() => on('ultimos2', status()), left - TWO_MIN))
    }
    timers.push(setTimer(next, Math.max(0, left)))
  }

  function enter(i) {
    s.i = i
    s.finAt = now() + block().minutos * 60000
    s.pausado = null
    schedule()
    const st = status()
    on(block().tipo === 'estudio' ? 'bloque' : 'descanso', st)
    on('cambio', st)
  }

  function next() {
    if (!s) return
    if (block().tipo === 'estudio') {
      s.estudiado += block().minutos * 60000
      s.ciclos++
    }
    if (s.i + 1 >= s.plan.bloques.length) return finish(true)
    enter(s.i + 1)
  }

  function finish(completo) {
    if (!s) return null
    clear()
    const b = block()
    // Si lo cortás a mitad de un bloque, cuenta lo que llevabas
    if (!completo && b?.tipo === 'estudio') s.estudiado += b.minutos * 60000 - (s.pausado ?? Math.max(0, s.finAt - now()))
    const hechos = completo ? studyBlocks() : s.plan.bloques.slice(0, s.i).filter((x) => x.tipo === 'estudio').length
    const estudiado = Math.round(s.estudiado / 60000)
    const distraido = Math.min(estudiado, Math.round(s.distraido / 60000))
    const planeado = Math.round(plannedMs() / 60000)
    const summary = {
      completo,
      estudiadoMin: estudiado,
      bloquesHechos: hechos,
      materia: s.plan.materia,
      tipo: s.plan.tipo ?? null,
      metodo: s.plan.metodo,
      inicio: new Date(s.inicio).toISOString(),
      fin: new Date(now()).toISOString(),
      ciclos: s.ciclos,
      ciclosPlaneados: studyBlocks(),
      planeadoMin: planeado,
      distraidoMin: distraido,
      focoMin: estudiado - distraido,
      // Adherencia: de lo que planeaste estudiar, cuánto estudiaste sin distraerte
      adherencia: planeado ? Math.min(100, Math.round(((estudiado - distraido) / planeado) * 100)) : 0
    }
    s = null
    on('fin', summary)
    on('cambio', status())
    return summary
  }

  return {
    status,
    activo: () => Boolean(s),
    // ¿Está en un bloque de estudio (no en un descanso ni en pausa)?
    enFoco: () => Boolean(s) && block().tipo === 'estudio' && s.pausado === null,
    start(plan) {
      if (!plan?.bloques?.length) return null
      if (s) clear()
      s = { plan, i: 0, finAt: 0, pausado: null, inicio: now(), estudiado: 0, distraido: 0, ciclos: 0 }
      enter(0)
      return status()
    },
    pause() {
      if (!s || s.pausado !== null) return status()
      s.pausado = Math.max(0, s.finAt - now())
      clear()
      on('cambio', status())
      return status()
    },
    resume() {
      if (!s || s.pausado === null) return status()
      s.finAt = now() + s.pausado
      s.pausado = null
      schedule()
      on('cambio', status())
      return status()
    },
    toggle() {
      return s?.pausado !== null ? this.resume() : this.pause()
    },
    // Pasa al bloque siguiente (por ejemplo, saltear el descanso)
    skip() {
      if (!s) return status()
      if (block().tipo === 'estudio') {
        const total = block().minutos * 60000
        const done = total - (s.pausado ?? Math.max(0, s.finAt - now()))
        s.estudiado += done
        if (done >= total * CYCLE_DONE) s.ciclos++
      }
      if (s.i + 1 >= s.plan.bloques.length) {
        finish(true)
        return status()
      }
      enter(s.i + 1)
      return status()
    },
    stop: () => finish(false),
    // Estuvo distraído un rato (en Instagram, un juego…) durante un bloque de estudio
    noteDistraction(ms) {
      if (s && block().tipo === 'estudio' && s.pausado === null) s.distraido += Math.max(0, ms)
    }
  }
}
