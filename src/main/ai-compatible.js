// IA gratis: servicios que hablan el formato "chat completions" (Gemini y Groq
// tienen planes gratis; Ollama corre en la compu). Pixie los usa igual que a
// Claude: le pasa sus acciones como herramientas y el contexto en cada mensaje.
import { AI_TOOLS } from './ai-tools.js'

export const PROVIDERS = {
  // Flash-Lite responde en un segundo; si se acaba su límite gratis o está saturado, prueba con Flash
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-flash-lite-latest', fallback: 'gemini-flash-latest', timeout: 60000 },
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

export class AIConnectionError extends Error {}

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

function errorMessage(body) {
  const e = Array.isArray(body) ? body[0]?.error : body?.error
  return typeof e === 'string' ? e : e?.message ?? ''
}

export function createCompatibleDriver({ preset, apiKey, model, system, fetchImpl = fetch }) {
  async function post(body) {
    try {
      return await send(body)
    } catch (err) {
      // Límite gratis agotado (429) o servicio saturado (503): cada modelo tiene su propio límite
      const busy = err instanceof AIHttpError && (err.status === 429 || err.status === 503)
      if (busy && preset.fallback && body.model !== preset.fallback) return send({ ...body, model: preset.fallback })
      throw err
    }
  }

  async function send(body) {
    const headers = { 'content-type': 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    let res
    try {
      res = await fetchImpl(preset.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(preset.timeout) })
    } catch (err) {
      const where = preset.local ? ' (¿está abierto Ollama?)' : ''
      throw new AIConnectionError(`No me pude conectar con la IA${where}: ${err.message}`)
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

    async step(history, { tools = true, persona = true } = {}) {
      const body = { model, messages: persona ? [{ role: 'system', content: system }, ...history] : history }
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
