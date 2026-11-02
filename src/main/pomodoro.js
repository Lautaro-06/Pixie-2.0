// La sesión de Pomodoro: va pasando por los bloques del plan (estudio, descanso, descanso largo),
// se puede pausar, seguir, saltar o terminar, y avisa:
//   bloque    → empieza un bloque de estudio
//   ultimos2  → faltan 2 minutos para que termine el bloque (para ofrecer el mini test)
//   descanso  → empieza un descanso
//   fin       → terminó todo (o lo terminaste)
//   cambio    → cambió algo (para mostrarlo en la pantallita y en Ajustes)

const TWO_MIN = 2 * 60 * 1000

export function createPomodoro({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, on = () => {} } = {}) {
  let s = null // { plan, i, finAt, pausado (ms que faltaban), inicio, estudiado (ms) }
  let timers = []

  const clear = () => {
    timers.forEach((t) => clearTimer(t))
    timers = []
  }
  const block = () => (s ? s.plan.bloques[s.i] : null)
  const studyBlocks = () => s.plan.bloques.filter((b) => b.tipo === 'estudio').length

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
      plan: s.plan
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
    if (block().tipo === 'estudio') s.estudiado += block().minutos * 60000
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
    const summary = { completo, estudiadoMin: Math.round(s.estudiado / 60000), bloquesHechos: hechos, materia: s.plan.materia }
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
      s = { plan, i: 0, finAt: 0, pausado: null, inicio: now(), estudiado: 0 }
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
      if (block().tipo === 'estudio') s.estudiado += block().minutos * 60000 - (s.pausado ?? Math.max(0, s.finAt - now()))
      if (s.i + 1 >= s.plan.bloques.length) {
        finish(true)
        return status()
      }
      enter(s.i + 1)
      return status()
    },
    stop: () => finish(false)
  }
}
