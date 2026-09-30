// Voz de Pixie con las voces que trae Windows. Solo habla si hay una voz en español.

function spanishVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => /^es-(AR|419|MX|US)/i.test(v.lang)) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('es')) ??
    null
  )
}

export function hasSpanishVoice() {
  return Boolean(spanishVoice())
}

export function onVoicesReady(callback) {
  if (!('speechSynthesis' in window)) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', callback)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

export function speak(text) {
  const voice = spanishVoice()
  if (!voice || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''))
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 1.05
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// Tres pitidos cortos para las alarmas.
export function beep() {
  try {
    const audio = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const start = audio.currentTime + i * 0.28
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(audio.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    }
    setTimeout(() => audio.close(), 1200)
  } catch {
    // sin audio: no pasa nada
  }
}
