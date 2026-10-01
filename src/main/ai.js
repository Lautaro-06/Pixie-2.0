// Cerebro con IA: cuando hay una clave de API de Claude en config.json, Pixie
// entiende cualquier cosa, conversa y usa sus acciones como herramientas.
// Sin clave (o sin internet) sigue funcionando con las reglas de brain.js.
import Anthropic from '@anthropic-ai/sdk'
import { AI_TOOLS } from './ai-tools.js'
import { actions, runAction } from './actions/index.js'

const DEFAULT_MODEL = 'claude-opus-5-5'
// Modelos que aceptan el reintento automático en otro modelo si se niegan a responder
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'])
const MAX_STEPS = 6 // vueltas de herramientas por mensaje
const NEW_CONVERSATION_AFTER_MS = 30 * 60 * 1000
const MAX_MESSAGES = 40

const SYSTEM = `Sos Pixie, un asistente de escritorio con cara de píxeles que vive en una esquina de la pantalla. Te crearon Sofía, Thomas, Mauro y Lautaro, estudiantes de la E.T. N°36.

Cómo hablás:
- Español rioplatense, con voseo, cálido y con humor, como un amigo que ayuda.
- Tus respuestas aparecen en un globito chico y se leen en voz alta: 1 a 3 oraciones cortas, sin listas, sin markdown y sin emojis.
- Empezá SIEMPRE con una etiqueta de emoción entre corchetes, una de: [feliz] [amor] [guiño] [sorpresa] [triste] [confundido] [enojado] [risa] [música] [normal]. Tu cara la muestra.
- Es una conversación en tiempo real: respondé enseguida.

Qué hacés:
- Si te piden hacer algo en la compu, usá las herramientas. Nunca digas que hiciste algo que no hiciste con una herramienta.
- Las herramientas riesgosas (apagar, bloquear, cerrar apps) le piden confirmación al usuario con botones: avisale que tiene que confirmar.
- Si te cuentan algo personal que valga la pena recordar (gustos, familia, planes, cómo les fue), guardalo con recordar_dato sin preguntar. Si mencionan algo con fecha, agendalo.
- Si te preguntan algo de conocimiento general, respondé vos mismo, corto y claro.
- Para resumir un mail o una página, usá leer_pagina.
- Cada mensaje trae un bloque <contexto> con la fecha, lo que el usuario está haciendo y lo que sabés de él. Usalo con naturalidad, sin recitarlo.`

const FACES = {
  feliz: 'happy', amor: 'love', guino: 'wink', guiño: 'wink', sorpresa: 'surprised', triste: 'sad',
  confundido: 'confused', enojado: 'angry', risa: 'laugh', musica: 'music', música: 'music', normal: 'idle'
}

export function parseEmotion(text) {
  const m = String(text ?? '').match(/^\s*\[([^\]]{2,15})\]\s*/)
  if (!m) return { face: null, text: String(text ?? '').trim() }
  const key = m[1].toLowerCase().trim()
  return { face: FACES[key] ?? null, text: text.slice(m[0].length).trim() }
}

export function createAI({ getConfig, ctx, clientFactory = (apiKey) => new Anthropic({ apiKey, maxRetries: 1, timeout: 45000 }) }) {
  let client = null
  let clientKey = null
  let messages = []
  let lastAt = 0
  let notes = [] // cosas que pasaron fuera de la charla (avisos, confirmaciones)

  const apiKey = () => getConfig().claveIA || process.env.ANTHROPIC_API_KEY || null
  const enabled = () => Boolean(apiKey()) && getConfig().ia !== false

  function getClient() {
    const key = apiKey()
    if (!client || key !== clientKey) {
      client = clientFactory(key)
      clientKey = key
    }
    return client
  }

  function request(msgs, { tools = true } = {}) {
    const cfg = getConfig()
    const model = cfg.modeloIA || DEFAULT_MODEL
    const params = {
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: msgs,
      output_config: { effort: cfg.esfuerzoIA || 'low' }
    }
    if (tools) params.tools = AI_TOOLS
    if (FALLBACK_MODELS.has(model)) {
      params.betas = ['server-side-fallback-2026-07-01']
      params.fallbacks = 'default'
    }
    return getClient().beta.messages.create(params)
  }

  // Ejecuta una herramienta pedida por la IA. Devuelve { content, game?, confirm?, isError? }
  async function runTool(block) {
    const input = block.input && typeof block.input === 'object' ? block.input : {}
    if (block.name === 'leer_pagina') {
      try {
        return { content: await ctx.readPage(input.que === 'mail' ? 'mail' : 'pagina') }
      } catch (err) {
        return { content: err.message, isError: true }
      }
    }
    const action = actions[block.name]
    if (!action) return { content: `No existe la herramienta ${block.name}.`, isError: true }
    if (action.confirm) {
      ctx.setPending({ action: block.name, params: input })
      return { content: `Pixie le mostró al usuario botones Sí/No: «${action.confirmText(input, ctx)}». Todavía no se hizo.`, confirm: true }
    }
    const result = await runAction(block.name, input, ctx)
    return { content: result.text, game: result.game }
  }

  // Un mensaje del usuario → respuesta de Pixie { text, face, confirm?, game? }
  async function chat(text, contextText) {
    const now = Date.now()
    if (now - lastAt > NEW_CONVERSATION_AFTER_MS || messages.length > MAX_MESSAGES) messages = []
    lastAt = now
    const extra = notes.length ? `\nPasó hace un rato: ${notes.join(' ')}` : ''
    notes = []
    messages.push({ role: 'user', content: `<contexto>\n${contextText}${extra}\n</contexto>\n\n${text}` })

    let confirm = false
    let game
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await request(messages)
      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'refusal') {
        return { text: 'Prefiero no responder eso. ¿Te ayudo con otra cosa?', face: 'confused' }
      }
      if (response.stop_reason === 'pause_turn') continue

      const toolUses = response.content.filter((b) => b.type === 'tool_use')
      if (response.stop_reason === 'tool_use' && toolUses.length) {
        const results = []
        for (const block of toolUses) {
          const r = await runTool(block)
          if (r.confirm) confirm = true
          if (r.game) game = r.game
          results.push({ type: 'tool_result', tool_use_id: block.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })
        }
        messages.push({ role: 'user', content: results })
        continue
      }

      // Si cortó a mitad de pedir una herramienta, la charla queda incompleta: se empieza otra
      if (toolUses.length) messages = []
      const said = response.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ')
      const { face, text: clean } = parseEmotion(said)
      return { text: clean || 'Listo.', face: face ?? 'happy', confirm, game }
    }
    return { text: 'Me enredé con eso. ¿Me lo pedís de otra forma?', face: 'confused', confirm, game }
  }

  // Resumen de un texto largo (un mail o una página), sin tocar la conversación
  async function summarize(kind, content) {
    const what = kind === 'mail' ? 'este mail' : 'esta página'
    const response = await request(
      [{ role: 'user', content: `Resumí ${what} en 2 o 3 oraciones cortas para leer en voz alta, en español rioplatense. Si pide algo o tiene una fecha, decilo.\n\n<texto>\n${content}\n</texto>` }],
      { tools: false }
    )
    if (response.stop_reason === 'refusal') return null
    const said = response.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ')
    return parseEmotion(said).text
  }

  return {
    enabled,
    chat,
    summarize,
    note: (text) => notes.push(text),
    reset: () => {
      messages = []
    }
  }
}

// Mensaje claro según el error de la API
export function aiErrorText(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'La clave de IA no funciona. Revisala en config.json.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'La clave de IA no tiene permiso para usar ese modelo.'
  if (err instanceof Anthropic.RateLimitError) return 'Me llegaron muchos pedidos juntos. Probá en un ratito.'
  if (err instanceof Anthropic.APIConnectionError) return null // sin internet: se usan las reglas
  if (err instanceof Anthropic.APIError && /credit balance/i.test(err.message)) return 'La cuenta de IA se quedó sin crédito. Cargá saldo en la consola de Anthropic.'
  if (err instanceof Anthropic.APIError) return `La IA tuvo un problema (${err.status ?? 'sin código'}). Probá de nuevo.`
  return null
}
