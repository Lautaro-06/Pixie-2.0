// El estado de ánimo de Pixie: se pone contento cuando le hablás, se aburre
// si lo ignorás y tiene sueño de noche. La cara lo muestra.

const clamp = (v) => Math.max(0, Math.min(100, v))
const HOUR = 60 * 60 * 1000

const EFFECT = { mensaje: 3, gracias: 8, carino: 12, chiste: 4, insulto: -20 }

// Ánimo de ahora: si nadie le habla, baja 4 puntos por hora (hasta 25).
export function currentMood(mood, now = Date.now()) {
  const valor = mood?.valor ?? 65
  if (!mood?.ultimoContacto) return valor
  const hours = Math.floor((now - mood.ultimoContacto) / HOUR)
  return Math.max(Math.min(valor, 25), valor - hours * 4)
}

// Qué pasa con el ánimo cuando la persona hace algo.
export function afterInteraction(mood, kind, now = Date.now()) {
  return { valor: clamp(currentMood(mood, now) + (EFFECT[kind] ?? EFFECT.mensaje)), ultimoContacto: now }
}

// Energía según la hora del día.
export function energy(date = new Date()) {
  const h = date.getHours()
  if (h >= 2 && h < 7) return 15
  if (h >= 23 || h < 2) return 35
  if (h >= 7 && h < 9) return 60
  if (h >= 20) return 60
  return 90
}

// contento | normal | aburrido | cansado
export function feeling(mood, date = new Date()) {
  const valor = currentMood(mood, date.getTime())
  if (energy(date) < 40) return 'cansado'
  if (valor >= 75) return 'contento'
  if (valor < 40) return 'aburrido'
  return 'normal'
}

const ANSWERS = {
  contento: ['¡Re bien! Estoy contentísimo de que me hables.', '¡Mejor imposible! ¿Qué hacemos?'],
  normal: ['Todo piola por acá. ¿Y vos?', 'Bien, con ganas de ayudarte. ¿Qué necesitás?'],
  aburrido: ['Un poco aburrido… casi no me hablás. ¡Pedime algo!', 'Medio aburrido, la verdad. ¿Jugamos a algo?'],
  cansado: ['Con un poco de sueño, ya es tarde. ¿Vos no deberías descansar?', 'Cansadito… pero acá estoy para lo que necesites.']
}

export function howAreYou(mood, date = new Date()) {
  const list = ANSWERS[feeling(mood, date)]
  return list[Math.floor(Math.random() * list.length)]
}
