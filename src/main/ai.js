// Cerebro con IA: cuando hay una clave de IA en config.json, Pixie entiende
// cualquier cosa, conversa y usa sus acciones como herramientas.
// Sirve Claude (pago) o una opción gratis: Gemini, Groq u Ollama en la compu.
// Sin clave (o sin internet) sigue funcionando con las reglas de brain.js.
import Anthropic from '@anthropic-ai/sdk'
import { AI_TOOLS } from './ai-tools.js'
import { actions, runAction } from './actions/index.js'
import { pageForAI } from './actions/browser.js'
import { PROVIDERS, AIHttpError, AIConnectionError, createCompatibleDriver, whisperTranscribe } from './ai-compatible.js'
import { FriendlyError } from './windows.js'

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
- A Pixie la usan chicos y público en general (por ejemplo en una feria). Nunca muestres, describas, abras ni busques contenido sexual, violencia explícita o gore, ni cómo conseguir cosas ilegales (drogas, armas, contrabando, documentos falsos). Si te lo piden, decí que no con buena onda y ofrecé otra cosa, sin sugerir dónde encontrarlo. Si una herramienta contesta que algo está bloqueado, no intentes otra forma de abrirlo.
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

// Qué IA usar según config.json. La clave dice de dónde es: sk-ant- (Claude), AIza o AQ. (Gemini), gsk_ (Groq).
export function pickProvider(cfg, env = process.env) {
  if (cfg.ia === false) return null
  const key = cfg.claveIA?.trim() || null
  let name = cfg.proveedorIA
  if (!name && key) name = /^(AIza|AQ\.)/.test(key) ? 'gemini' : key.startsWith('gsk_') ? 'groq' : 'claude'
  if (!name && env.ANTHROPIC_API_KEY) name = 'claude'
  if (!name) return null
  if (name === 'claude') {
    const apiKey = key || env.ANTHROPIC_API_KEY
    return apiKey ? { name, apiKey, model: cfg.modeloIA || DEFAULT_MODEL } : null
  }
  const preset = PROVIDERS[name] ?? (cfg.urlIA ? { url: cfg.urlIA, model: cfg.modeloIA, timeout: 120000 } : null)
  if (!preset) return null
  if (!preset.local && !key && !cfg.urlIA) return null
  return {
    name,
    apiKey: key,
    model: cfg.modeloIA || preset.model,
    preset: cfg.urlIA ? { ...preset, url: cfg.urlIA } : preset
  }
}

function createClaudeDriver({ getClient, model, effort }) {
  return {
    user: (text) => ({ role: 'user', content: text }),

    async step(history, { tools = true } = {}) {
      const params = {
        model,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: history,
        output_config: { effort }
      }
      if (tools) params.tools = AI_TOOLS
      if (FALLBACK_MODELS.has(model)) {
        params.betas = ['server-side-fallback-2026-07-01']
        params.fallbacks = 'default'
      }
      const response = await getClient().beta.messages.create(params)
      const toolCalls = response.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input }))
      const stop =
        response.stop_reason === 'refusal' ? 'refusal'
          : response.stop_reason === 'pause_turn' ? 'pause'
            : response.stop_reason === 'tool_use' && toolCalls.length ? 'tool'
              : 'end'
      return {
        assistant: [{ role: 'assistant', content: response.content }],
        toolCalls,
        text: response.content.filter((b) => b.type === 'text').map((b) => b.text).join(' '),
        stop
      }
    },

    results: (results) => [
      { role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) }
    ]
  }
}

// Cómo está la IA, en palabras: para la terminal y para «estado de la IA»
export function describeAI(cfg, env = process.env) {
  if (cfg.ia === false) return { on: false, text: 'La IA está apagada en config.json ("ia": false).' }
  const p = pickProvider(cfg, env)
  const names = { gemini: 'Gemini', groq: 'Groq', claude: 'Claude', ollama: 'Ollama' }
  if (p) return { on: true, text: `Estoy usando la IA de ${names[p.name] ?? p.name} (${p.model}).` }
  if (cfg.proveedorIA) return { on: false, text: `En config.json dice "proveedorIA": "${cfg.proveedorIA}", pero falta la clave ("claveIA").` }
  return { on: false, text: 'No encuentro la clave de IA en config.json ("claveIA"). Abrilo desde mi ícono → Abrir config.json.' }
}

export function createAI({
  getConfig,
  ctx,
  clientFactory = (apiKey) => new Anthropic({ apiKey, maxRetries: 1, timeout: 45000 }),
  fetchImpl = (...args) => fetch(...args)
}) {
  let client = null
  let clientKey = null
  let messages = []
  let messagesFor = null // de qué IA es la charla guardada (cada una tiene su formato)
  let lastAt = 0
  let notes = [] // cosas que pasaron fuera de la charla (avisos, confirmaciones)

  const provider = () => pickProvider(getConfig())
  const enabled = () => provider() !== null

  function getClient(key) {
    if (!client || key !== clientKey) {
      client = clientFactory(key)
      clientKey = key
    }
    return client
  }

  function driverFor(p) {
    if (p.name === 'claude') return createClaudeDriver({ getClient: () => getClient(p.apiKey), model: p.model, effort: getConfig().esfuerzoIA || 'low' })
    return createCompatibleDriver({ preset: p.preset, apiKey: p.apiKey, model: p.model, system: SYSTEM, fetchImpl })
  }

  // Ejecuta una herramienta pedida por la IA. Devuelve { content, game?, confirm?, isError? }
  async function runTool({ name, input, bad }) {
    if (bad) return { content: 'Los datos de la herramienta llegaron mal formados. Probá de nuevo.', isError: true }
    const params = input && typeof input === 'object' ? input : {}
    if (name === 'leer_pagina') {
      try {
        return { content: pageForAI(await ctx.readPage(params.que === 'mail' ? 'mail' : 'pagina')) }
      } catch (err) {
        return { content: err.message, isError: true }
      }
    }
    const action = actions[name]
    if (!action) return { content: `No existe la herramienta ${name}.`, isError: true }
    if (action.confirm) {
      ctx.setPending({ action: name, params })
      return { content: `Pixie le mostró al usuario botones Sí/No: «${action.confirmText(params, ctx)}». Todavía no se hizo.`, confirm: true }
    }
    const result = await runAction(name, params, ctx)
    return { content: String(result.text ?? 'Listo.'), game: result.game }
  }

  // Un mensaje del usuario → respuesta de Pixie { text, face, confirm?, game? }
  async function chat(text, contextText) {
    const p = provider()
    if (!p) throw new Error('No hay IA configurada')
    const d = driverFor(p)
    const now = Date.now()
    const key = `${p.name}:${p.model}`
    if (key !== messagesFor || now - lastAt > NEW_CONVERSATION_AFTER_MS || messages.length > MAX_MESSAGES) messages = []
    messagesFor = key
    lastAt = now
    const extra = notes.length ? `\nPasó hace un rato: ${notes.join(' ')}` : ''
    notes = []
    const before = messages.length
    messages.push(d.user(`<contexto>\n${contextText}${extra}\n</contexto>\n\n${text}`))

    let confirm = false
    let game
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await d.step(messages)
        messages.push(...r.assistant)

        if (r.stop === 'refusal') return { text: 'Prefiero no responder eso. ¿Te ayudo con otra cosa?', face: 'confused' }
        if (r.stop === 'pause') continue

        if (r.stop === 'tool') {
          const results = []
          for (const call of r.toolCalls) {
            const res = await runTool(call)
            if (res.confirm) confirm = true
            if (res.game) game = res.game
            results.push({ id: call.id, content: res.content, isError: res.isError })
          }
          messages.push(...d.results(results))
          continue
        }

        // Si cortó a mitad de pedir una herramienta, la charla queda incompleta: se empieza otra
        if (r.toolCalls.length) messages = []
        const { face, text: clean } = parseEmotion(r.text)
        return { text: clean || 'Listo.', face: face ?? 'happy', confirm, game }
      }
    } catch (err) {
      messages = messages.slice(0, before) // la charla vuelve a como estaba
      throw err
    }
    return { text: 'Me enredé con eso. ¿Me lo pedís de otra forma?', face: 'confused', confirm, game }
  }

  // Resumen de un texto largo (un mail o una página), sin tocar la conversación
  async function summarize(kind, content) {
    const p = provider()
    if (!p) return null
    const d = driverFor(p)
    const what = kind === 'mail' ? 'este mail' : 'esta página'
    const r = await d.step(
      [d.user(`Resumí ${what} en 2 o 3 oraciones cortas para leer en voz alta, en español rioplatense. Si pide algo o tiene una fecha, decilo.\n\n<texto>\n${content}\n</texto>`)],
      { tools: false }
    )
    if (r.stop === 'refusal') return null
    return parseEmotion(r.text).text
  }

  // Mira una captura de la pantalla y responde. La imagen no queda en la charla ni se guarda.
  async function look(imageBase64, question) {
    const p = provider()
    if (!p) throw new FriendlyError(`Para mirar tu pantalla necesito la IA. ${describeAI(getConfig()).text}`)
    if (p.name !== 'gemini' && p.name !== 'claude') throw new FriendlyError('Para mirar tu pantalla necesito la IA de Gemini o de Claude.')
    const prompt =
      'Esta es una captura de la pantalla del usuario. La carita de píxeles en una esquina sos vos: ignorala. ' +
      (question ? `Te pregunta: «${question}». ` : 'Contale en pocas palabras qué está haciendo y ofrecé una ayuda concreta. ') +
      'Respondé en 1 a 3 oraciones, en español rioplatense, empezando con tu etiqueta de emoción.'
    const content =
      p.name === 'claude'
        ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }, { type: 'text', text: prompt }]
        : [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }]
    const r = await driverFor(p).step([{ role: 'user', content }], { tools: false })
    if (r.stop === 'refusal') return { text: 'Prefiero no comentar lo que hay en tu pantalla.', face: 'confused' }
    const { face, text } = parseEmotion(r.text)
    return { text: text || 'No llegué a ver bien. ¿Me lo pedís de nuevo?', face: face ?? 'happy' }
  }

  // Pasa a texto lo que dijiste por el micrófono (un WAV). Devuelve '' si no se escuchó nada.
  async function transcribe(wav) {
    const p = provider()
    if (!p) throw new FriendlyError(`Para entenderte por voz necesito la IA. ${describeAI(getConfig()).text}`)
    if (p.name === 'groq') return whisperTranscribe({ apiKey: p.apiKey, wav, fetchImpl })
    if (p.name !== 'gemini') throw new FriendlyError('Para hablarme por voz necesito la IA de Gemini o de Groq.')
    const content = [
      { type: 'text', text: 'Transcribí exactamente lo que dice este audio, en español. Respondé solo con la transcripción, sin comillas ni nada más. Si no hay voz o no se entiende, respondé [nada].' },
      { type: 'input_audio', input_audio: { data: Buffer.from(wav).toString('base64'), format: 'wav' } }
    ]
    const r = await driverFor(p).step([{ role: 'user', content }], { tools: false, persona: false })
    const text = r.text.replace(/^["«]|["»]$/g, '').trim()
    return /^\[?nada\]?\.?$/i.test(text) ? '' : text
  }

  return {
    enabled,
    provider: () => provider()?.name ?? null,
    status: () => describeAI(getConfig()).text,
    chat,
    summarize,
    look,
    transcribe,
    note: (text) => notes.push(text),
    reset: () => {
      messages = []
    }
  }
}

// Mensaje claro según el error de la IA. null = seguir con las reglas sin decir nada.
export function aiErrorText(err) {
  if (err instanceof FriendlyError) return err.message
  if (err instanceof AIConnectionError) return null
  if (err instanceof AIHttpError) {
    if (err.status === 401 || err.status === 403 || /api.?key/i.test(err.message)) return 'La clave de IA no funciona. Revisala en config.json.'
    if (err.status === 404 && err.local) return `No tengo el modelo «${err.model}» en Ollama. Bajalo con «ollama pull ${err.model}».`
    if (err.status === 404) return `No encontré el modelo de IA «${err.model}». Revisá modeloIA en config.json.`
    if (err.status === 429) return 'Llegué al límite de uso gratis de la IA por ahora. Probá en un rato.'
    if (/tool_use_failed|failed to call a function/i.test(err.message)) return null // el modelo se trabó: siguen las reglas
    return `La IA tuvo un problema (${err.status}). Probá de nuevo.`
  }
  if (err instanceof Anthropic.AuthenticationError) return 'La clave de IA no funciona. Revisala en config.json.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'La clave de IA no tiene permiso para usar ese modelo.'
  if (err instanceof Anthropic.RateLimitError) return 'Me llegaron muchos pedidos juntos. Probá en un ratito.'
  if (err instanceof Anthropic.APIConnectionError) return null // sin internet: se usan las reglas
  if (err instanceof Anthropic.APIError && /credit balance/i.test(err.message)) return 'La cuenta de IA se quedó sin crédito. Cargá saldo en la consola de Anthropic.'
  if (err instanceof Anthropic.APIError) return `La IA tuvo un problema (${err.status ?? 'sin código'}). Probá de nuevo.`
  return null
}
