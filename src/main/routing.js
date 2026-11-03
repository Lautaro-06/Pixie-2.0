// ¿Este mensaje lo contesta la IA o lo hacen las reglas al instante?
// - La IA: la charla, las preguntas y lo que las reglas no entienden.
// - Las reglas: las órdenes que entienden (instantáneas, gratis y sin depender de internet).
// Una frase larga va a la IA (la entiende mejor), salvo que sea un pedido que las reglas entienden bien.

// Charla: la IA contesta mejor
export const AI_PREFERRED = new Set(['saludo', 'charla', 'gracias', 'ayuda', 'consultar_memoria'])
// Usar las apps: si las reglas lo entendieron, se hace tal cual (el texto a escribir no pasa por la IA)
export const DIRECT = new Set(['escribir', 'teclas', 'atajo', 'clic', 'desplazar', 'ventana', 'ir_a', 'ver_elementos'])
// Pedidos que las reglas entienden bien aunque la frase sea larga («recordame mañana a las 8 que tengo que
// llevar el TP de química»): se hacen al instante, sin esperar a la IA
export const LONG_OK = new Set([
  'agendar', 'crear_timer', 'ver_agenda', 'agregar_pendiente', 'completar_pendiente', 'ver_pendientes', 'recordar_dato', 'recordar_charla',
  'olvidar_charlas', 'ver_datos', 'pomodoro', 'temario', 'estudio_resumen', 'ver_seguimiento', 'que_me_perdi', 'como_llego', 'mi_casa',
  'colectivo', 'clima', 'decir_hora', 'classroom', 'conectar_calendario', 'ver_timers', 'pausar_timer', 'cancelar_timers', 'mails'
])

export function wantsAI(input, intents) {
  if (intents?.some((i) => DIRECT.has(i.action))) return false
  if (!intents) return true
  if (intents.every((i) => AI_PREFERRED.has(i.action) || i.knowledge)) return true
  const words = String(input ?? '').trim().split(/\s+/).length
  // Una fecha suelta en una charla larga («mañana tengo prueba y estoy nervioso…») la entiende mejor la IA;
  // si lo pediste con un verbo («recordame», «agendá»), va directo
  const sure = intents.every((i) => LONG_OK.has(i.action) && (i.action !== 'agendar' || i.pedido))
  return words > 10 && !sure
}
