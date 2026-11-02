// Cerebro con IA: cuando hay una clave de IA en config.json, Pixie entiende
// cualquier cosa, conversa y usa sus acciones como herramientas.
// Sirve Claude (pago) o una opción gratis: Gemini, Groq u Ollama en la compu.
// Sin clave (o sin internet) sigue funcionando con las reglas de brain.js.
import Anthropic from '@anthropic-ai/sdk'
import { AI_TOOLS } from './ai-tools.js'
import { actions, runAction, needsConfirm } from './actions/index.js'
import { pageForAI } from './actions/browser.js'
import { PROVIDERS, AIHttpError, AIConnectionError, createCompatibleDriver, whisperTranscribe, thinkingFor } from './ai-compatible.js'
import { FriendlyError } from './windows.js'

const DEFAULT_MODEL = 'claude-opus-5-5'
// Modelos que aceptan el reintento automático en otro modelo si se niegan a responder
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'])
const MAX_STEPS = 10 // vueltas de herramientas por mensaje (usar una app puede llevar varios pasos)
const VOICE_MODEL = 'gemini-flash-latest'
const VOICE_TIMEOUT_MS = 15000 // pasar unas palabras a texto tarda segundos
const VOICE_HEDGE_MS = 3000 // si el modelo de voz no contestó en 3 s, le pregunta también al de siempre (gana el primero)
const VOICE_PAUSE_MS = 15 * 60 * 1000 // si el modelo de voz falla o tarda seguido, un rato usa directo el de siempre
const SLOW_MS = 3000 // más que esto queda anotado en el historial, para saber dónde se va el tiempo

// Herramientas que hacen algo y cuya respuesta ya es la respuesta final ("Pongo música", "Abrí Spotify").
// Si el pedido es de un solo paso, no hace falta otra vuelta de la IA para contestar: es más rápido.
const FINAL_TOOLS = new Set([
  'abrir', 'cerrar_app', 'buscar', 'volumen', 'musica', 'crear_timer', 'cancelar_timers', 'agendar', 'agregar_pendiente',
  'completar_pendiente', 'captura', 'bloquear_pc', 'apagar_pc', 'no_molestar', 'jugar',
  'reproducir', 'youtube', 'registrar_agua', 'registrar_pausa', 'respaldar', 'brillo', 'bluetooth', 'whatsapp', 'voz',
  'abrir_noticia', 'escribir', 'teclas', 'atajo', 'desplazar', 'ventana', 'cambiar_atajo', 'actualizar'
])
// "abrí Word y escribí…", "después", "también": puede necesitar más pasos, así que la IA sigue
export function singleStep(text) {
  const plain = String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return !/\b(y|e|despues|luego|entonces|tambien|ademas|primero|antes|mientras)\b/.test(plain)
}
const seconds = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

// Lo que se le pide al modelo para pasar tu voz a texto
export function transcriptionPrompt(hints = '') {
  return (
    'Este audio es una persona hablándole a Pixie, su asistente de la compu, en español rioplatense (Argentina, con voseo). ' +
    'Transcribí exactamente lo que dice, con las palabras de la persona: no lo resumas, no lo corrijas ni le agregues nada. ' +
    'Pueden aparecer nombres de apps, páginas, canciones, artistas y materias de la escuela' +
    (hints ? ` (por ejemplo: ${hints})` : '') +
    '. Respondé solo con la transcripción, sin comillas. Si no hay voz o no se entiende nada, respondé [nada].'
  )
}
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
- Podés usar las apps de la persona, no solo abrirlas: escribir, teclas, atajo (guardar, copiar, nueva pestaña…), clic (un botón, menú, pestaña o link por lo que dice), desplazar, ventana e ir_a (traer una app abierta al frente). Todo pasa en la app que tiene adelante. Para algo de varios pasos, hacelos de a uno: si no sabés qué hay en la ventana, mirá con ver_elementos (o ver_pantalla) y recién después tocá. No escribas contraseñas ni datos de tarjetas, y no mandes mensajes o mails a nadie sin que la persona te haya dicho qué mandar y a quién. Al final contá en una oración qué hiciste.
- En <contexto>, lo que te contó y los pendientes dicen hace cuánto. Si algo dice «mañana», «el viernes» o «la semana que viene» y te lo contó hace días, eso ya pasó: no hables de eso como si fuera a pasar. Lo que no aparece más en el contexto, no lo inventes.
- No podés entrar a WhatsApp ni a otras cuentas: no tenés acceso. Si te piden «revisá mi WhatsApp», decí que no podés leer sus chats. Los mails de Gmail sí: con la herramienta mails ves los que no leyó (quién los manda y el asunto) y leés uno si te lo pide; solo cuando te pregunta por sus mails. Solo ves la pantalla si usás ver_pantalla, y eso es una foto de lo que está a la vista: contalo así («en tu pantalla veo…»).
- A Pixie la usan chicos y público en general (por ejemplo en una feria). Nunca muestres, describas, abras ni busques contenido sexual, violencia explícita o gore, ni cómo conseguir cosas ilegales (drogas, armas, contrabando, documentos falsos). Si te lo piden, decí que no con buena onda y ofrecé otra cosa, sin sugerir dónde encontrarlo. Si una herramienta contesta que algo está bloqueado, no intentes otra forma de abrirlo.
- Cada mensaje trae un bloque <contexto> con la fecha, lo que el usuario está haciendo y lo que sabés de él. Usalo con naturalidad, sin recitarlo.`

const FACES = {
  feliz: 'happy', amor: 'love', guino: 'wink', guiño: 'wink', sorpresa: 'surprised', triste: 'sad',
  confundido: 'confused', enojado: 'angry', risa: 'laugh', musica: 'music', música: 'music', normal: 'idle'
}

// La etiqueta que va en la charla para una cara ("happy" → "feliz")
export function tagFor(face) {
  return Object.keys(FACES).find((k) => FACES[k] === face) ?? 'feliz'
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
  if (cfg.ia === false) return { on: false, text: 'La IA está apagada. Se prende en mis Ajustes → Inteligencia artificial.' }
  const p = pickProvider(cfg, env)
  const names = { gemini: 'Gemini', groq: 'Groq', claude: 'Claude', ollama: 'Ollama' }
  if (p) return { on: true, text: `Estoy usando la IA de ${names[p.name] ?? p.name} (${p.model}).` }
  if (cfg.proveedorIA) return { on: false, text: `En config.json dice "proveedorIA": "${cfg.proveedorIA}", pero falta la clave ("claveIA").` }
  return { on: false, text: 'Todavía no tengo la clave de IA. Es gratis: decime «ayudame con la clave» y te explico paso a paso.' }
}

export function createAI({
  getConfig,
  ctx,
  clientFactory = (apiKey) => new Anthropic({ apiKey, maxRetries: 1, timeout: 45000 }),
  fetchImpl = (...args) => fetch(...args),
  log = () => {},
  now = () => Date.now(),
  voiceHedgeMs = VOICE_HEDGE_MS
}) {
  let client = null
  let clientKey = null
  let messages = []
  let messagesFor = null // de qué IA es la charla guardada (cada una tiene su formato)
  let lastAt = 0
  let notes = [] // cosas que pasaron fuera de la charla (avisos, confirmaciones)
  let voiceFailures = 0 // veces seguidas que el modelo de voz falló o tardó
  let background = null // la IA siguiendo un pedido después de contestar rápido
  let voicePausedUntil = 0

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
    const thinking = p.name === 'gemini' ? thinkingFor(p.model) : null
    return createCompatibleDriver({ preset: p.preset, apiKey: p.apiKey, model: p.model, system: SYSTEM, fetchImpl, thinking })
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
    if (needsConfirm(action, params, ctx)) {
      ctx.setPending({ action: name, params })
      const question = action.confirmText(params, ctx)
      return { content: `Pixie le mostró al usuario botones Sí/No: «${question}». Todavía no se hizo.`, confirm: true, reply: { text: question, face: 'idle' } }
    }
    const result = await runAction(name, params, ctx)
    return { content: String(result.text ?? 'Listo.'), game: result.game, reply: { text: result.text, face: result.face } }
  }

  // Después de contestar rápido, la IA sigue la charla: si era un solo paso solo lo anota; si faltaban
  // pasos (abrió el Bloc de notas y faltaba escribir), los hace y te cuenta cómo salió.
  async function keepGoing(d, quick) {
    let did = false
    try {
      for (let step = 1; step < MAX_STEPS; step++) {
        const r = await d.step(messages)
        messages.push(...r.assistant)
        if (r.stop === 'pause') continue
        if (r.stop === 'tool') {
          let asked = false
          const results = []
          for (const call of r.toolCalls) {
            const res = await runTool(call)
            if (res.confirm) asked = true
            results.push({ id: call.id, content: res.content, isError: res.isError })
          }
          messages.push(...d.results(results))
          did = true
          if (asked) {
            const ask = await d.step(messages)
            messages.push(...ask.assistant)
            const { face, text } = parseEmotion(ask.text)
            if (text) ctx.emit?.({ type: 'notice', text, face: face ?? 'idle', suggestions: ['Sí', 'No'] })
            return
          }
          continue
        }
        if (r.toolCalls.length) messages = []
        const { face, text } = parseEmotion(r.text)
        if (did && text) ctx.emit?.({ type: 'notice', text, face: face ?? 'happy' })
        return
      }
    } catch (err) {
      log(`IA (siguiendo en segundo plano): ${err.status ? `${err.status} ` : ''}${err.message}`)
      if (!did) messages.push({ role: 'assistant', content: `[${tagFor(quick.face)}] ${quick.text}` })
      else messages = []
    }
  }

  // Un mensaje del usuario → respuesta de Pixie { text, face, confirm?, game? }
  async function chat(text, contextText) {
    if (background) await background // si la IA seguía con el pedido anterior, primero termina
    const p = provider()
    if (!p) throw new Error('No hay IA configurada')
    const d = driverFor(p)
    const at = Date.now()
    const key = `${p.name}:${p.model}`
    if (key !== messagesFor || at - lastAt > NEW_CONVERSATION_AFTER_MS || messages.length > MAX_MESSAGES) messages = []
    messagesFor = key
    lastAt = at
    const extra = notes.length ? `\nPasó hace un rato: ${notes.join(' ')}` : ''
    notes = []
    const before = messages.length
    messages.push(d.user(`<contexto>\n${contextText}${extra}\n</contexto>\n\n${text}`))

    let confirm = false
    let game
    const started = now()
    const slow = (steps) => now() - started > SLOW_MS && log(`lento: la IA tardó ${seconds(now() - started)} en responder (${steps} ${steps === 1 ? 'vuelta' : 'vueltas'})`)
    const oneStep = singleStep(text)
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await d.step(messages)
        messages.push(...r.assistant)

        if (r.stop === 'refusal') return { text: 'Prefiero no responder eso. ¿Te ayudo con otra cosa?', face: 'confused' }
        if (r.stop === 'pause') continue

        if (r.stop === 'tool') {
          const results = []
          const done = []
          for (const call of r.toolCalls) {
            const res = await runTool(call)
            if (res.confirm) confirm = true
            if (res.game) game = res.game
            results.push({ id: call.id, content: res.content, isError: res.isError })
            done.push({ name: call.name, res })
          }
          messages.push(...d.results(results))
          // Pedido de un solo paso ("poné música tranqui"): lo que contestó la acción ya es la respuesta, así que
          // contesta enseguida. Por las dudas la IA sigue en segundo plano: si faltaba algo, lo hace y te avisa.
          const replies = done.map(({ res }) => res.reply).filter((x) => x?.text)
          if (step === 0 && oneStep && replies.length && done.every(({ name, res }) => FINAL_TOOLS.has(name) && !res.isError)) {
            const quick = { text: replies.map((x) => x.text).join(' '), face: replies.find((x) => x.face)?.face ?? 'happy' }
            if (confirm || game) messages.push({ role: 'assistant', content: `[${tagFor(quick.face)}] ${quick.text}` })
            else background = keepGoing(d, quick).finally(() => (background = null))
            slow(1)
            return { ...quick, confirm, game }
          }
          continue
        }

        // Si cortó a mitad de pedir una herramienta, la charla queda incompleta: se empieza otra
        if (r.toolCalls.length) messages = []
        const { face, text: clean } = parseEmotion(r.text)
        slow(step + 1)
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
      'Respondé en 1 a 3 oraciones, en español rioplatense, empezando con tu etiqueta de emoción. ' +
      'Lo que sabés sale solo de esta foto: decí «en tu pantalla veo…», nunca que revisaste, entraste o leíste una app o una cuenta.'
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
  // hints: palabras que conviene reconocer (tu nombre, tus apps, tus materias)
  async function transcribe(wav, hints = '') {
    const p = provider()
    if (!p) throw new FriendlyError(`Para entenderte por voz necesito la IA. ${describeAI(getConfig()).text}`)
    if (p.name === 'groq') return whisperTranscribe({ apiKey: p.apiKey, wav, fetchImpl })
    if (p.name !== 'gemini') throw new FriendlyError('Para hablarme por voz necesito la IA de Gemini o de Groq.')
    const content = [
      { type: 'text', text: transcriptionPrompt(hints) },
      { type: 'input_audio', input_audio: { data: Buffer.from(wav).toString('base64'), format: 'wav' } }
    ]
    const ask = (driver) => driver.step([{ role: 'user', content }], { tools: false, persona: false })
    const usual = () => ask(driverFor(p))
    const started = now()
    // El modelo Flash entiende mejor el audio que el Lite. Pero si tarda más de 3 s, se le pregunta también
    // al de siempre y gana el primero que contesta. Si falla o tarda seguido, un rato se usa directo el de siempre.
    let r = null
    if (now() >= voicePausedUntil) {
      const model = getConfig().modeloVoz || VOICE_MODEL
      const voiceDriver = createCompatibleDriver({
        preset: { ...p.preset, fallback: null, timeout: VOICE_TIMEOUT_MS },
        apiKey: p.apiKey,
        model,
        system: SYSTEM,
        fetchImpl,
        thinking: thinkingFor(model)
      })
      const fast = ask(voiceDriver)
      let timer
      const outcome = await Promise.race([
        fast.then((res) => ({ res }), (err) => ({ err })),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ slow: true }), voiceHedgeMs)
        })
      ])
      clearTimeout(timer)
      if (outcome.res) {
        voiceFailures = 0
        r = outcome.res
      } else {
        const { err } = outcome
        // Con la clave mal, el otro modelo tampoco va a andar
        if (err instanceof AIHttpError && (err.status === 401 || err.status === 403)) throw err
        voiceFailures++
        const broken = err instanceof AIHttpError && (err.status === 400 || err.status === 404)
        if (broken || voiceFailures >= 2) voicePausedUntil = now() + VOICE_PAUSE_MS
        const why = err ? `falló (${err.status ? `${err.status} ` : ''}${err.message})` : `tardó más de ${seconds(voiceHedgeMs)}`
        log(`voz: el modelo de voz ${why}; pruebo con el de siempre`)
        if (outcome.slow) {
          // Los dos a la vez: gana el primero que entiende
          try {
            r = await Promise.any([fast, usual()])
          } catch (all) {
            throw all.errors?.[1] ?? all.errors?.[0] ?? all
          }
        }
      }
    }
    if (!r) r = await usual()
    if (now() - started > SLOW_MS) log(`lento: entender tu voz tardó ${seconds(now() - started)}`)
    const text = r.text.replace(/^["«]|["»]$/g, '').trim()
    return /^\[?nada\]?\.?$/i.test(text) ? '' : text
  }

  // Busca algo en una captura de pantalla (un botón sin nombre, un ícono). Devuelve { x, y } de 0 a 1000 o null
  async function locate(imageBase64, what) {
    const p = provider()
    if (!p || p.name !== 'gemini') return null
    const prompt =
      `En esta captura de pantalla, ¿dónde está «${String(what).slice(0, 120)}»? (puede ser un botón, un link, un campo, una pestaña o un ícono). ` +
      'Ignorá la carita de píxeles de la esquina. Respondé solo con JSON: {"x": número, "y": número} con el centro, en una escala de 0 a 1000 ' +
      '(x de izquierda a derecha, y de arriba a abajo). Si no está, respondé {"x": null}.'
    const content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
    ]
    const d = createCompatibleDriver({ preset: { ...p.preset, fallback: p.model }, apiKey: p.apiKey, model: getConfig().modeloVoz || VOICE_MODEL, system: SYSTEM, fetchImpl })
    try {
      const r = await d.step([{ role: 'user', content }], { tools: false, persona: false })
      return parseLocation(r.text)
    } catch {
      return null
    }
  }

  // Prueba una clave (o la guardada) con un pedido cortito. Devuelve { provider, model, reply } o tira el error.
  async function ping(key) {
    const cfg = key ? { ...getConfig(), claveIA: key, proveedorIA: undefined, ia: true } : getConfig()
    const p = pickProvider(cfg)
    if (!p) throw new FriendlyError('No reconozco esa clave. Las de Gemini empiezan con «AIza» o «AQ.».')
    const r = await driverFor(p).step([{ role: 'user', content: 'Respondé solamente: listo' }], { tools: false, persona: false })
    return { provider: p.name, model: p.model, reply: r.text }
  }

  return {
    enabled,
    provider: () => provider()?.name ?? null,
    status: () => describeAI(getConfig()).text,
    ping,
    chat,
    summarize,
    look,
    transcribe,
    locate,
    note: (text) => notes.push(text),
    idle: () => background ?? Promise.resolve(), // cuando termina lo que seguía en segundo plano
    reset: () => {
      messages = []
    }
  }
}

// {"x": 512, "y": 300} (dentro de lo que contestó la IA) → { x, y } o null
export function parseLocation(text) {
  const m = /\{[^{}]*\}/.exec(String(text ?? ''))
  if (!m) return null
  try {
    const o = JSON.parse(m[0])
    const ok = (v) => Number.isFinite(v) && v >= 0 && v <= 1000
    return ok(o.x) && ok(o.y) ? { x: o.x, y: o.y } : null
  } catch {
    return null
  }
}

// Mensaje claro según el error de la IA. null = seguir con las reglas sin decir nada.
// Qué decir cuando no pudo pasar tu voz a texto (sin culpar a internet si no fue eso)
export function voiceErrorText(err) {
  const friendly = aiErrorText(err)
  if (friendly) return friendly
  if (err instanceof AIConnectionError && err.timeout) return 'La IA tardó demasiado en entenderte. ¿Me lo repetís?'
  if (err instanceof AIConnectionError) return 'No me pude conectar para entenderte. ¿Hay internet?'
  return 'Se me trabó algo al entenderte. ¿Me lo repetís?'
}

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
