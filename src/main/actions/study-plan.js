// Plan de estudio sin IA: función pura, fácil de probar. La IA (si hay clave) puede
// personalizarlo después, pero este plan base siempre funciona.

// Un bloque de estudio o de descanso más corto que esto no sirve.
export const MIN_BLOQUE = 10

// Ritmos: cuánto se estudia, cuánto se descansa y cada cuántos bloques va el descanso largo.
export const RITMOS = {
  pomodoro: {
    nombre: 'Pomodoro clásico (25/5)',
    estudio: 25,
    descansoCorto: 5,
    descansoLargo: 15,
    cadaCuantos: 4,
    cuandoConviene: 'Para arrancar, o cuando cuesta concentrarse. Bloques cortos son más fáciles de empezar.'
  },
  largos: {
    nombre: 'Bloques largos (50/10)',
    estudio: 50,
    descansoCorto: 10,
    descansoLargo: 20,
    cadaCuantos: 3,
    cuandoConviene: 'Para materias que piden meterse a fondo: problemas, programación, armar un resumen.'
  }
}

// Técnicas de estudio: cómo estudiar, no cuánto tiempo. Se eligen según el tipo de tarea.
const TECNICAS = [
  {
    id: 'repaso-activo',
    nombre: 'Repaso activo y repetición espaciada',
    porQue: 'Para memorizar: tapá los apuntes, tratá de recordar y recién después fijate. Repetí a distintos días, no todo junto.',
    ritmo: 'pomodoro',
    palabras: ['memorizar', 'memoria', 'vocabulario', 'fechas', 'definiciones', 'formulas', 'aprender de memoria']
  },
  {
    id: 'practica',
    nombre: 'Práctica de ejercicios',
    porQue: 'Para cálculo, física o programación: resolvé sin mirar la resolución y revisá los errores al final del bloque.',
    ritmo: 'largos',
    palabras: ['problemas', 'ejercicios', 'calculo', 'matematica', 'fisica', 'programar', 'programacion', 'codigo', 'practica']
  },
  {
    id: 'feynman',
    nombre: 'Técnica Feynman',
    porQue: 'Para entender teoría: explicá el tema con tus palabras, como si se lo contaras a alguien. Donde te trabás es lo que falta repasar.',
    ritmo: 'pomodoro',
    palabras: ['teoria', 'entender', 'leer', 'lectura', 'resumen', 'concepto', 'conceptos', 'historia', 'explicar']
  }
]

const TECNICA_POR_DEFECTO = TECNICAS[0]

function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Sugiere una técnica según lo que la persona dice que va a estudiar.
export function recomendarTecnica(tarea) {
  const texto = normalizar(tarea)
  const encontrada = TECNICAS.find((t) => t.palabras.some((p) => texto.includes(p)))
  const t = encontrada ?? TECNICA_POR_DEFECTO
  return { id: t.id, nombre: t.nombre, porQue: t.porQue, ritmo: t.ritmo, reconocida: Boolean(encontrada) }
}

// Arma los bloques para `minutos` de tiempo disponible. Siempre termina con un bloque de estudio
// (nunca con un descanso) y avisa cuántos minutos sobran si no alcanzan para otro bloque útil.
export function buildStudyPlan({ minutos, ritmo = 'pomodoro' } = {}) {
  const r = RITMOS[ritmo] ?? RITMOS.pomodoro
  const total = Math.floor(Number(minutos))
  if (!Number.isFinite(total) || total < MIN_BLOQUE) {
    return { ok: false, motivo: `Necesito al menos ${MIN_BLOQUE} minutos para armar un plan.` }
  }

  const bloques = []
  let restante = total
  let estudios = 0

  while (restante >= MIN_BLOQUE) {
    const estudio = Math.min(r.estudio, restante)
    bloques.push({ tipo: 'estudio', minutos: estudio })
    restante -= estudio
    estudios++

    let descanso = estudios % r.cadaCuantos === 0 ? r.descansoLargo : r.descansoCorto
    // Si no alcanza para un descanso largo y seguir estudiando, probar con el corto.
    if (restante < descanso + MIN_BLOQUE) descanso = r.descansoCorto
    // Si ni así alcanza para descansar y estudiar de nuevo, el plan termina acá.
    if (restante < descanso + MIN_BLOQUE) break

    bloques.push({ tipo: descanso === r.descansoLargo && descanso !== r.descansoCorto ? 'descanso-largo' : 'descanso', minutos: descanso })
    restante -= descanso
  }

  const suma = (tipo) => bloques.filter((b) => b.tipo === tipo).reduce((acc, b) => acc + b.minutos, 0)
  const minutosEstudio = suma('estudio')
  const minutosDescanso = bloques.reduce((acc, b) => acc + b.minutos, 0) - minutosEstudio

  return {
    ok: true,
    ritmo: ritmo in RITMOS ? ritmo : 'pomodoro',
    nombre: r.nombre,
    bloques,
    bloquesDeEstudio: estudios,
    minutosEstudio,
    minutosDescanso,
    sobran: restante
  }
}