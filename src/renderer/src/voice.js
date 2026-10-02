// Voz de Pixie. Si está instalada la voz natural (o la de Gemini), el audio llega
// en pedacitos desde la app; si no, usa las voces de Windows. Mientras habla,
// avisa para pausar la música que esté sonando.
import { api } from './api.js'
import { pcmToFloat } from './audio.js'

const DEFAULT_RATE = 24000 // la voz natural llega como PCM de 16 bits (22 o 24 kHz)
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
  const spanish = (v) => v.lang?.toLowerCase().startsWith('es')
  return (
    voices.find((v) => spanish(v) && /natural|online/i.test(v.name)) ??
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

// Según cómo está habla un poco más rápido o más lento. El tono no se toca:
// en las voces de Windows suena distorsionado.
const SPEED = { happy: 1.08, laugh: 1.1, surprised: 1.08, alarm: 1.1, sad: 0.97, love: 1.02 }

function systemSpeak(text, face, id) {
  const voice = spanishVoice()
  if (!voice || id !== current) return
  const utterance = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''))
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = SPEED[face] ?? 1.05
  utterance.pitch = 1
  utterance.onstart = () => id === current && setSpeaking(true)
  utterance.onend = utterance.onerror = () => id === current && setSpeaking(false)
  window.speechSynthesis.speak(utterance)
}

function playChunk(id, chunk, rate = DEFAULT_RATE) {
  if (id !== current) return
  const { samples, carry } = pcmToFloat(chunk, leftover)
  leftover = carry
  if (!samples.length) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const buffer = ctx.createBuffer(1, samples.length, rate)
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
  if (event.type === 'voz') playChunk(event.id, event.chunk, event.rate)
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
  // La app decide si hay voz natural (si no, contesta enseguida y se usa la de Windows)
  if (!api.voice) return systemSpeak(text, face, id)
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
