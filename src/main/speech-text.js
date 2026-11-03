// Para que la voz lea los textos largos enteros: se parten en frases (y las frases muy largas, en
// pedazos por las comas). Así ninguna voz se corta a mitad: la natural, la de Gemini ni la de Windows.
// Lo usan el proceso principal (voces naturales) y la ventanita (voz de Windows).

const MAX_TOTAL = 6000 // un texto más largo que esto no se lee entero (son varios minutos)

// Sin emojis: Pixie no los usa (ni en lo que dice ni en lo que muestra), aunque vengan de la IA, un mail
// o un titular. Saca también las banderas, los tonos de piel y los «pegamentos» entre emojis.
const EMOJI = /(?:\p{Extended_Pictographic}(?<![©®™↔→←↑↓])|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|\uFE0F|\u200D|\u20E3)/gu
export function noEmoji(text) {
  if (typeof text !== 'string') return text
  return text.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim()
}

export function speechText(text) {
  return noEmoji(String(text ?? ''))
    .replace(/[«»*_#`]/g, '')
    .replace(/https?:\/\/\S+/g, 'el link')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TOTAL)
}

// Una frase larga se parte en las comas, los dos puntos o, si hace falta, entre palabras
function splitLong(sentence, max) {
  const out = []
  let rest = sentence
  while (rest.length > max) {
    const window = rest.slice(0, max)
    const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '), window.lastIndexOf(' y '))
    const at = cut > max * 0.4 ? cut + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : max
    out.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) out.push(rest)
  return out
}

// "Hola. ¿Cómo andás? Te cuento…" → ['Hola. ¿Cómo andás?', 'Te cuento…'] (pedazos de hasta max letras)
export function speechChunks(text, max = 240) {
  const clean = speechText(text)
  if (!clean) return []
  const sentences = clean.split(/(?<=[.!?…])\s+(?=\S)/).flatMap((s) => (s.length > max ? splitLong(s, max) : [s]))
  const chunks = []
  for (const s of sentences) {
    const last = chunks.at(-1)
    if (last && last.length + 1 + s.length <= max) chunks[chunks.length - 1] = `${last} ${s}`
    else chunks.push(s)
  }
  return chunks
}
