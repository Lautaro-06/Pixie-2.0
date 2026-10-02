// Voz de Pixie. Si hay IA de Gemini usa una voz natural que llega en pedacitos
// (empieza a hablar enseguida); si no, o si se acabó el límite gratis, usa las
// voces de Windows. Mientras habla, avisa para pausar la música que esté sonando.
import { api } from './api.js'
import { pcmToFloat } from './audio.js'

const RATE = 24000 // la voz natural llega como PCM de 16 bits a 24 kHz
const PAUSE_MUSIC_FROM = 35 // frases cortas no pausan la música

let current = 0 // número de la frase que se está diciendo
let natural = false
let ctx = null
let sources = []
let nextAt = 0
let leftover = null
let streamDone = true
let received = 0
let pauseMusic = false
let speakingNow = false

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
  return natural || Boolean(spanishVoice())
}

export function setNaturalVoice(on) {
  natural = Boolean(on) && Boolean(api.voice)
}

export function onVoicesReady(callback) {
  if (!('speechSynthesis' in window)) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', callback)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

function setSpeaking(on) {
  if (on && !pauseMusic) return
  if (on === speakingNow) return
  speakingNow = on
  api.speaking?.(on)
}

// El tono cambia según cómo está: más agudo si está contento o sorprendido, más grave si está triste.
const TONE = {
  happy: { pitch: 1.15, rate: 1.08 },
  love: { pitch: 1.1, rate: 1 },
  laugh: { pitch: 1.2, rate: 1.12 },
  wink: { pitch: 1.1, rate: 1.05 },
  surprised: { pitch: 1.25, rate: 1.1 },
  sad: { pitch: 0.85, rate: 0.92 },
  angry: { pitch: 0.9, rate: 1.1 },
  confused: { pitch: 1.05, rate: 0.98 },
  alarm: { pitch: 1.2, rate: 1.12 }
}

function systemSpeak(text, face, id) {
  const voice = spanishVoice()
  if (!voice || id !== current) return
  const utterance = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''))
  const tone = TONE[face] ?? { pitch: 1.05, rate: 1.05 }
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = tone.rate
  utterance.pitch = tone.pitch
  utterance.onstart = () => id === current && setSpeaking(true)
  utterance.onend = utterance.onerror = () => id === current && setSpeaking(false)
  window.speechSynthesis.speak(utterance)
}

function playChunk(id, chunk) {
  if (id !== current) return
  const { samples, carry } = pcmToFloat(chunk, leftover)
  leftover = carry
  if (!samples.length) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const buffer = ctx.createBuffer(1, samples.length, RATE)
    buffer.getChannelData(0).set(samples)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    const now = ctx.currentTime
    if (nextAt < now + 0.03) nextAt = now + 0.12 // un colchoncito para que no se corte
    src.start(nextAt)
    nextAt += buffer.duration
    sources.push(src)
    received++
    setSpeaking(true)
    src.onended = () => {
      sources = sources.filter((s) => s !== src)
      if (!sources.length && streamDone && id === current) setSpeaking(false)
    }
  } catch {
    // sin audio: no pasa nada
  }
}

api.onEvent((event) => {
  if (event.type === 'voz') playChunk(event.id, event.chunk)
})

// ¿Está hablando ahora (o por empezar)?
export function isSpeaking() {
  const system = 'speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)
  return system || sources.length > 0 || !streamDone
}

export function speak(text, face) {
  stopSpeaking()
  if (!text) return
  const id = ++current
  pauseMusic = text.length > PAUSE_MUSIC_FROM
  if (!natural) return systemSpeak(text, face, id)
  streamDone = false
  received = 0
  api
    .voice({ id, text, face })
    .catch(() => ({ ok: false }))
    .then((r) => {
      if (id !== current) return
      streamDone = true
      if (!r?.ok && !received) systemSpeak(text, face, id) // sin voz natural: la de Windows
      else if (!sources.length) setSpeaking(false)
    })
}

export function stopSpeaking() {
  api.voiceStop?.(current)
  current++
  for (const s of sources) {
    try {
      s.stop()
    } catch {
      // ya había terminado
    }
  }
  sources = []
  nextAt = 0
  leftover = null
  streamDone = true
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  setSpeaking(false)
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
