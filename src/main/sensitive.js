// Temas sensibles y datos privados.
// - Lo sensible o muy personal (salud, la familia, la pareja, la plata, las creencias…) Pixie lo recuerda,
//   pero nunca lo saca ella: no pregunta «¿cómo te fue con el psicólogo?» ni lo nombra en un resumen.
//   Solo lo usa si vos lo volvés a traer.
// - Las contraseñas, los números de tarjeta, el CBU, el DNI o las claves no se guardan nunca: se tapan.
// - Si alguien dice que se quiere hacer daño, Pixie responde con cuidado y con a quién llamar.

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const CATEGORIES = [
  ['salud mental', /\b(depresi\w*|deprimid\w*|ansiedad|ataques? de panico|psicolog\w*|psiquiatr\w*|terapia|terapeuta|trastorno\w*|anorexia|bulimia|autolesi\w*|me corto|cortarme|suicid\w*|me quiero morir|no quiero vivir|estoy muy mal|me siento solo|me siento sola)\b/],
  ['salud', /\b(enferm\w*|medic[oa]s?|hospital|guardia|internad[oa]|diagnostic\w*|cancer|tumor|diabetes|operacion|cirugia|pastillas?|medicacion|medicamentos?|remedios?|embarazad[oa]|embarazo|aborto|analisis de sangre|vih|its)\b/],
  ['familia', /\b(divorci\w*|se separaron|se estan separando|separacion|mis viejos se pelean|se pelean en casa|violencia|me pega|le pega|maltrato|abus\w*|murio|fallecio|falleci\w*|velorio|duelo|mi papa se fue|mi mama se fue)\b/],
  ['pareja', /\b(sexo|sexual\w*|virgen|mi novi[oa]|me gusta (un chico|una chica|alguien|un pibe|una piba)|estoy enamorad[oa]|cortamos|me dejo|me engano|me cortaron|crush)\b/],
  ['identidad', /\b(gay|lesbiana|bisexual|trans|orientacion sexual|salir del closet)\b/],
  ['dinero', /\b(deudas?|debo plata|no tenemos plata|no nos alcanza|me prestaron plata|sueldo|cuenta bancaria|estamos endeudados)\b/],
  ['creencias', /\b(religion|religios[oa]|iglesia|ateo|politic\w*|votar|voto a|peronis\w*|kirchner\w*|macris\w*|milei|libertari\w*)\b/],
  ['legal', /\b(policia|denuncia\w*|juicio|abogad[oa]|me robaron|me asaltaron|drogas?|porro|faso|merca|borrach[oa]|preso|carcel)\b/]
]

// Lo de la escuela no es personal: «prueba de Política y Ciudadanía», «TP de enfermedades»
const SCHOOL = /\b(prueba|examen|parcial|final|clase|tp|trabajo practico|materia|leccion|exposicion|estudiar|tarea|profe|escuela|colegio)\b/

// ¿Es un tema sensible? → la categoría ('salud', 'familia'…) o null
export function sensitiveTopic(text) {
  const t = fold(text)
  if (!t) return null
  const found = CATEGORIES.find(([, re]) => re.test(t))?.[0] ?? null
  if (found && ['creencias', 'salud', 'legal'].includes(found) && SCHOOL.test(t)) return null
  return found
}

// Señales de que alguien se quiere hacer daño
const CRISIS = /\b(me quiero morir|quiero morirme|no quiero (vivir|seguir viviendo)|me quiero matar|matarme|suicidarme|suicidio|me voy a matar|cortarme|me corto (los brazos|las munecas)|hacerme dano|lastimarme a proposito|no vale la pena vivir)\b/
export const crisisRisk = (text) => CRISIS.test(fold(text))

export const CRISIS_TEXT =
  'Me importa mucho lo que me contás y no estás solo ni sola con esto. Hablalo ya con alguien: podés llamar gratis al 135 (Centro de Asistencia al Suicida, desde CABA y Gran Buenos Aires) o al (011) 5275-1135 desde todo el país, las 24 horas. Si estás en peligro ahora, llamá al 911. Y contale a un adulto de confianza. Si querés, contame qué pasó: te escucho.'

// Tapa los datos privados antes de guardar nada
const SECRETS = [
  // «mi contraseña es…», «la clave del wifi es…»
  [/\b((?:contrase(?:ñ|n)a|password|clave|pin|codigo|código)(?:\s+del?\s+(?:la\s+|mi\s+)?[\wáéíóúñ]+(?:\s+[\wáéíóúñ]+)?)?\s*(?:es|:|=)\s*)\S+/gi, '$1[dato privado]'],
  // tarjetas (13 a 19 números, con o sin espacios o guiones)
  [/\b(?:\d[ -]?){13,19}\b/g, '[dato privado]'],
  // CBU / CVU (22 números)
  [/\b\d{22}\b/g, '[dato privado]'],
  // DNI
  [/\b(dni|documento)(\s*(?:es|:|n[°º]?)?\s*)\d{1,2}\.?\d{3}\.?\d{3}\b/gi, '$1$2[dato privado]'],
  // claves de servicios (Gemini, Groq, Claude)
  [/\b(AIza[\w-]{20,}|AQ\.[\w.-]{20,}|gsk_[A-Za-z0-9]{20,}|sk-[\w-]{20,})\b/g, '[dato privado]']
]
export function redactSecrets(text) {
  let out = String(text ?? '')
  for (const [re, by] of SECRETS) out = out.replace(re, by)
  return out
}
