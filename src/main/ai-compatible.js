// IA gratis: servicios que hablan el formato "chat completions" (Gemini y Groq
// tienen planes gratis; Ollama corre en la compu). Pixie los usa igual que a
// Claude: le pasa sus acciones como herramientas y el contexto en cada mensaje.
import { AI_TOOLS } from './ai-tools.js'

export const PROVIDERS = {
  // Flash-Lite responde en un segundo; si se acaba su límite gratis o está saturado, prueba con Flash
  // (si en 25 segundos no contestó, está trabada: se prueba con el otro modelo en vez de esperar más)
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-flash-lite-latest', fallback: 'gemini-flash-latest', timeout: 25000 },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', timeout: 60000 },
  ollama: { url: 'http://127.0.0.1:11434/v1/chat/completions', model: 'qwen2.5:7b', timeout: 180000, local: true }
}

export class AIHttpError extends Error {
  constructor(status, message, { model, local } = {}) {
    super(message || `HTTP ${status}`)
    this.status = status
    this.model = model
    this.local = local
  }
}

// timeout: la IA no contestó a tiempo (hay internet, pero tardó demasiado)
export class AIConnectionError extends Error {
  constructor(message, { timeout = false } = {}) {
    super(message)
    this.timeout = timeout
  }
}

// Groq transcribe audio con Whisper (gratis): otro endpoint, mismo formato de errores
export async function whisperTranscribe({ apiKey, wav, fetchImpl = fetch }) {
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'voz.wav')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'es')
  let res
  try {
    res = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30000)
    })
  } catch (err) {
    throw new AIConnectionError(`No me pude conectar con la IA: ${err.message}`)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new AIHttpError(res.status, errorMessage(body), { model: 'whisper-large-v3-turbo' })
  return String(body.text ?? '').trim()
}

// Gemini no acepta additionalProperties ni objetos sin propiedades: se limpian
function cleanSchema(schema) {
  const { additionalProperties, ...rest } = schema
  if (rest.properties) rest.properties = Object.fromEntries(Object.entries(rest.properties).map(([k, v]) => [k, cleanSchema(v)]))
  if (Array.isArray(rest.required) && !rest.required.length) delete rest.required
  return rest
}

export const COMPATIBLE_TOOLS = AI_TOOLS.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    ...(Object.keys(t.input_schema.properties ?? {}).length ? { parameters: cleanSchema(t.input_schema) } : {})
  }
}))

// Algunos modelos piensan en voz alta (<think>) o usan markdown: el globito no lo necesita
export function cleanText(text) {
  return String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/\*\*|__|^#+\s*/gm, '')
    .trim()
}

// Cuánto piensa Gemini antes de contestar. Para abrir una app o pasar tu voz a texto no hace falta
// pensar: los modelos 2.5 pueden no pensar nada y los 3 en adelante, lo mínimo. Contestan mucho más rápido.
export function thinkingFor(model) {
  const m = String(model ?? '').toLowerCase()
  if (!m.includes('gemini') || /gemini-(1|2\.0)/.test(m)) return null
  if (m.includes('2.5-pro')) return 'low'
  if (m.includes('2.5')) return 'none'
  return 'minimal'
}
const NO_THINKING_SETTING = new Set() // modelos que no aceptaron reasoning_effort
const withoutThinking = ({ reasoning_effort: _ignored, ...rest }) => rest

function errorMessage(body) {
  const e = Array.isArray(body) ? body[0]?.error : body?.error
  return typeof e === 'string' ? e : e?.message ?? ''
}

// Fallas que se arreglan probando con otro modelo o un ratito después: límite gratis (429), el servicio
// saturado o caído un momento (500, 502, 503, 504) o que no contestó a tiempo
const OVERLOADED = new Set([500, 502, 503, 504])
export const transientError = (err) =>
  (err instanceof AIHttpError && (err.status === 429 || OVERLOADED.has(err.status))) || (err instanceof AIConnectionError && err.timeout)

// thinking: cuánto piensa el modelo (ver thinkingFor); null = lo que traiga el modelo
// hedgeMs: si el modelo no contestó en ese tiempo, le pregunta también al otro (gana el primero que contesta)
export function createCompatibleDriver({ preset, apiKey, model, system, fetchImpl = fetch, thinking = null, hedgeMs = 0, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const fallbackBody = (body) => {
    const next = withoutThinking({ ...body, model: preset.fallback })
    const effort = body.reasoning_effort && thinkingFor(preset.fallback)
    return effort ? { ...next, reasoning_effort: effort } : next
  }

  async function post(body) {
    const alt = preset.fallback && body.model !== preset.fallback ? fallbackBody(body) : null
    let first
    try {
      return await (alt ? withFallback(body, alt) : sendTuned(body))
    } catch (err) {
      if (!transientError(err)) throw err
      first = err
    }
    // «Saturado» (503) suele durar segundos: un ratito después, otra vez con el mismo modelo.
    // Si fue el límite gratis o no contestó a tiempo, reintentar enseguida no sirve.
    if (!(first instanceof AIHttpError && OVERLOADED.has(first.status))) throw first
    await wait(900)
    return sendTuned(body)
  }

  // Le pide al modelo; si falla de forma pasajera, al otro (tiene su propio límite y capacidad). Si tarda más
  // de hedgeMs, le pregunta también al otro sin esperar: se queda con la primera respuesta y corta la otra.
  // Si fallan los dos, devuelve el error del primero.
  function withFallback(body, alt) {
    return new Promise((resolve, reject) => {
      let settled = false
      let altStarted = false
      let running = 0
      let firstErr = null
      let timer = null
      const controllers = []
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        for (const c of controllers) c.abort()
        fn(value)
      }
      const launch = (b) => {
        const c = new AbortController()
        controllers.push(c)
        running++
        sendTuned(b, c.signal).then(
          (res) => {
            controllers.splice(controllers.indexOf(c), 1)
            finish(resolve, res)
          },
          (err) => {
            running--
            if (settled) return
            firstErr ??= err
            if (!transientError(err)) return finish(reject, err)
            if (!altStarted) return startAlt()
            if (!running) finish(reject, firstErr)
          }
        )
      }
      const startAlt = () => {
        if (altStarted || settled) return
        altStarted = true
        clearTimeout(timer)
        launch(alt)
      }
      launch(body)
      if (hedgeMs > 0) timer = setTimeout(startAlt, hedgeMs)
    })
  }

  // Si el modelo no acepta que le digan cuánto pensar, se manda sin eso (y no se le vuelve a decir)
  async function sendTuned(body, signal) {
    if (body.reasoning_effort && NO_THINKING_SETTING.has(body.model)) body = withoutThinking(body)
    try {
      return await send(body, signal)
    } catch (err) {
      if (!(body.reasoning_effort && err instanceof AIHttpError && err.status === 400)) throw err
      const res = await send(withoutThinking(body), signal)
      NO_THINKING_SETTING.add(body.model) // sin eso anduvo: era eso
      return res
    }
  }

  async function send(body, signal) {
    const headers = { 'content-type': 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const limit = AbortSignal.timeout(preset.timeout)
    let res
    try {
      res = await fetchImpl(preset.url, { method: 'POST', headers, body: JSON.stringify(body), signal: signal ? AbortSignal.any([limit, signal]) : limit })
    } catch (err) {
      const where = preset.local ? ' (¿está abierto Ollama?)' : ''
      const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      throw new AIConnectionError(`No me pude conectar con la IA${where} (${body.model}): ${err.message}`, { timeout })
    }
    if (!res.ok) {
      let msg = ''
      try {
        msg = errorMessage(await res.json())
      } catch {
        // sin cuerpo
      }
      throw new AIHttpError(res.status, msg, { model: body.model, local: preset.local })
    }
    return res.json()
  }

  return {
    user: (text) => ({ role: 'user', content: text }),

    // extra: campos de más para este pedido (por ejemplo, cuánto piensa el modelo)
    async step(history, { tools = true, persona = true, extra = {} } = {}) {
      const body = { ...extra, model, messages: persona ? [{ role: 'system', content: system }, ...history] : history }
      if (thinking && !('reasoning_effort' in body)) body.reasoning_effort = thinking
      if (tools) body.tools = COMPATIBLE_TOOLS
      const res = await post(body)
      const choice = res.choices?.[0] ?? {}
      const msg = choice.message ?? {}
      // Se devuelven tal cual (Gemini guarda ahí datos que necesita en la vuelta siguiente)
      const calls = (msg.tool_calls ?? []).map((c, i) => ({ ...c, id: c.id || `pixie_${Date.now()}_${i}` }))
      const toolCalls = calls.map((c) => {
        try {
          const args = c.function?.arguments
          return { id: c.id, name: c.function?.name, input: args ? (typeof args === 'string' ? JSON.parse(args) : args) : {} }
        } catch {
          return { id: c.id, name: c.function?.name, input: {}, bad: true }
        }
      })
      const assistant = { role: 'assistant', content: msg.content ?? (preset.local ? '' : null) }
      if (calls.length) assistant.tool_calls = calls
      return {
        assistant: [assistant],
        toolCalls,
        text: cleanText(msg.content),
        stop: choice.finish_reason === 'content_filter' ? 'refusal' : calls.length ? 'tool' : 'end'
      }
    },

    results: (results) => results.map((r) => ({ role: 'tool', tool_call_id: r.id, content: r.content }))
  }
}
