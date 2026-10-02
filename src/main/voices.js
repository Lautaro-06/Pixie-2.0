// Qué voz usa Pixie:
//   - la natural de la compu (Piper, voz argentina, sin límite) si está instalada
//   - la de Gemini solo si la pedís ("vozNatural": "gemini"): son 10 frases gratis por día
//   - si no, la de Windows (la maneja la interfaz)
import { join } from 'node:path'
import { createTTS } from './tts.js'
import { createPiper } from './piper.js'

export function createVoices({ getConfig, saveConfig = () => {}, dataDir, log = () => {}, announce = () => {}, fetchImpl, spawnImpl, extract }) {
  const gemini = createTTS({ getConfig, fetchImpl, log })
  const piper = createPiper({ dir: join(dataDir, 'voz'), fetchImpl, spawnImpl, extract, log })

  function engine() {
    const mode = getConfig().vozNatural
    if (mode === false) return null
    if (mode === 'gemini') return gemini.available() ? 'gemini' : null
    return piper.installed() ? 'piper' : null
  }

  function install() {
    if (piper.installed()) return 'ya'
    if (piper.installing()) return 'bajando'
    announce('Empiezo a bajar mi voz natural. Son unos 135 MB, una sola vez. Te aviso cuando esté.', 'happy')
    piper
      .install((pct) => pct % 25 === 0 && announce(`Bajando mi voz nueva: ${pct}%.`, 'idle'))
      .then(() => {
        if (getConfig().vozNatural === false) saveConfig({ vozNatural: true })
        announce('¡Listo! Ya tengo mi voz natural. ¿Qué te parece cómo hablo ahora?', 'love')
      })
      .catch((err) => {
        log(`instalar voz natural: ${err.message}`)
        announce('No pude bajar la voz natural. ¿Hay internet? Probá de nuevo más tarde con «instalá la voz natural».', 'sad')
      })
    return 'empezando'
  }

  function status() {
    const mode = getConfig().vozNatural
    if (piper.installing()) return `Estoy bajando mi voz natural: va por el ${piper.progress()}%.`
    if (mode === false) return 'Uso la voz de Windows porque así lo pediste. Para la natural, decime «usá la voz natural».'
    if (mode === 'gemini') {
      return gemini.available()
        ? 'Uso la voz de Gemini: son 10 frases gratis por día y después vuelvo a la de Windows.'
        : 'Pediste la voz de Gemini, pero se terminaron las frases gratis de hoy: uso la de Windows.'
    }
    if (piper.installed()) return 'Uso mi voz natural, la de Daniela, con acento argentino. Anda en la compu, sin internet y sin límite.'
    return 'Uso la voz de Windows. Si querés una voz natural con acento argentino, decime «instalá la voz natural» (baja unos 135 MB una sola vez).'
  }

  return {
    available: () => engine() !== null,
    engine,
    // onChunk(chunk, rate): PCM de 16 bits mono
    stream(id, text, face, onChunk) {
      const e = engine()
      if (e === 'piper') return piper.speak(id, text, face, onChunk)
      if (e === 'gemini') return gemini.stream(id, text, face, (c) => onChunk(c, 24000))
      return Promise.resolve({ ok: false })
    },
    stop(id) {
      piper.stop(id)
      gemini.stop(id)
    },
    install,
    status,
    use(mode) {
      saveConfig({ vozNatural: mode })
    }
  }
}
