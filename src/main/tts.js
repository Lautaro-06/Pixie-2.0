// Voz natural de Pixie con Gemini (gratis, unas 100 frases por día). El audio
// llega en pedacitos mientras se genera, así empieza a hablar en menos de un
// segundo. Si se acaba el límite o no hay internet, la interfaz usa la voz de Windows.
import { pickProvider } from './ai.js'

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview'
const DEFAULT_VOICE = 'Leda'
const PAUSE_AFTER_LIMIT_MS = 60 * 60 * 1000
const CACHE_SIZE = 40
const MAX_CHARS = 500

const TONES = {
  happy: 'alegre', love: 'tierna y cariñosa', laugh: 'divertida, como riéndote', wink: 'pícara', surprised: 'sorprendida',
  sad: 'triste y suave', angry: 'un poco enojada', confused: 'dudosa', alarm: 'urgente', music: 'cantarina'
}

export function voicePrompt(text, face) {
  return `Leé en español con acento argentino rioplatense, con voz ${TONES[face] ?? 'amable'} y natural, como una amiga: ${text}`
}

export function cleanForVoice(text) {
  return String(text ?? '').replace(/[«»*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
}

// Lee los eventos "data: {...}" de una respuesta en streaming
async function* sseEvents(body) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const part of body) {
    buffer += decoder.decode(part, { stream: true }).replace(/\r/g, '')
    let i
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, i)
      buffer = buffer.slice(i + 2)
      const line = event.split('\n').find((l) => l.startsWith('data: '))
      if (line) {
        try {
          yield JSON.parse(line.slice(6))
        } catch {
          // evento incompleto: se ignora
        }
      }
    }
  }
}

export function createTTS({ getConfig, fetchImpl = (...a) => fetch(...a), log = () => {} }) {
  const cache = new Map() // frase → pedazos de audio
  const running = new Map() // id → AbortController
  let pausedUntil = 0

  function settings() {
    const cfg = getConfig()
    const p = pickProvider(cfg)
    if (p?.name !== 'gemini' || cfg.vozNatural === false || Date.now() < pausedUntil) return null
    return { apiKey: p.apiKey, model: cfg.modeloVoz || DEFAULT_MODEL, voice: cfg.vozIA || DEFAULT_VOICE }
  }

  // onChunk recibe PCM de 16 bits, 24 kHz, mono. Devuelve { ok } (ok: false → usar la voz de Windows)
  async function stream(id, text, face, onChunk) {
    const s = settings()
    const clean = cleanForVoice(text)
    if (!s || !clean) return { ok: false }
    const key = `${s.voice}|${face}|${clean}`
    if (cache.has(key)) {
      const parts = cache.get(key)
      cache.delete(key)
      cache.set(key, parts) // queda como la más reciente
      for (const p of parts) onChunk(p)
      return { ok: true, cached: true }
    }

    const controller = new AbortController()
    running.set(id, controller)
    const timer = setTimeout(() => controller.abort(), 30000)
    const parts = []
    try {
      const res = await fetchImpl(`${URL_BASE}/${encodeURIComponent(s.model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': s.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: voicePrompt(clean, face) }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } } }
        }),
        signal: controller.signal
      })
      if (res.status === 429) {
        pausedUntil = Date.now() + PAUSE_AFTER_LIMIT_MS
        log('voz natural: se terminó el límite gratis, uso la voz de Windows por una hora')
        return { ok: false }
      }
      if (!res.ok) {
        log(`voz natural: error ${res.status}`)
        return { ok: false }
      }
      for await (const event of sseEvents(res.body)) {
        const data = event.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data
        if (!data) continue
        const chunk = new Uint8Array(Buffer.from(data, 'base64'))
        parts.push(chunk)
        onChunk(chunk)
      }
      if (parts.length && clean.length <= 160 && !controller.signal.aborted) {
        cache.set(key, parts)
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value)
      }
      return { ok: parts.length > 0 }
    } catch (err) {
      if (!controller.signal.aborted) log(`voz natural: ${err.message}`)
      return { ok: parts.length > 0 }
    } finally {
      clearTimeout(timer)
      running.delete(id)
    }
  }

  return {
    available: () => Boolean(settings()),
    stream,
    stop: (id) => running.get(id)?.abort()
  }
}
