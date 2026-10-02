import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAI, pickProvider, aiErrorText, describeAI } from '../src/main/ai.js'
import { COMPATIBLE_TOOLS, cleanText, AIHttpError, AIConnectionError } from '../src/main/ai-compatible.js'
import { createMemory } from '../src/main/memory.js'

// fetch de mentira: devuelve las respuestas del guion y guarda los pedidos
function fakeFetch(script) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    const next = script.shift()
    if (!next) throw new Error('el guion se terminó')
    if (next instanceof Error) throw next
    const status = next.status ?? 200
    return { ok: status < 300, status, json: async () => next.body ?? next }
  }
  return { fn, calls }
}

const reply = (content, toolCalls) => ({
  choices: [{ finish_reason: toolCalls ? 'tool_calls' : 'stop', message: { role: 'assistant', content, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }]
})
const call = (id, name, args, extra) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) }, ...extra })

function setup(script, config) {
  const memory = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-ia-gratis-')), 'memoria.json'))
  const ctx = {
    memory,
    log: () => {},
    emit: () => {},
    notify: () => {},
    getConfig: () => ({}),
    saveConfig: () => {},
    shortcutLabel: () => 'Ctrl+Espacio',
    setPending: () => {},
    readPage: async () => ({ kind: 'mail', subject: 'Reunión', sender: 'Profe', text: 'Mañana no hay clases.' })
  }
  const f = fakeFetch(script)
  const ai = createAI({ getConfig: () => config, ctx, clientFactory: () => assert.fail('no debería usar Claude'), fetchImpl: f.fn })
  return { ai, memory, calls: f.calls }
}

test('reconoce la IA por la clave', () => {
  const env = {}
  assert.equal(pickProvider({ claveIA: 'AIzaSyPrueba' }, env).name, 'gemini')
  assert.equal(pickProvider({ claveIA: 'AQ.Ab8Prueba' }, env).name, 'gemini') // las claves nuevas de AI Studio
  assert.equal(pickProvider({ claveIA: ' AIzaSyPrueba ' }, env).apiKey, 'AIzaSyPrueba') // sin espacios de más
  assert.equal(pickProvider({ claveIA: 'gsk_prueba' }, env).name, 'groq')
  assert.equal(pickProvider({ claveIA: 'sk-ant-prueba' }, env).name, 'claude')
  assert.equal(pickProvider({ proveedorIA: 'ollama' }, env).name, 'ollama') // en la compu: sin clave
  assert.equal(pickProvider({ proveedorIA: 'gemini' }, env), null) // Gemini sin clave no anda
  assert.equal(pickProvider({}, env), null)
  assert.equal(pickProvider({ claveIA: 'AIzaSyPrueba', ia: false }, env), null)
  assert.equal(pickProvider({ claveIA: 'AIzaSyPrueba' }, env).model, 'gemini-flash-lite-latest')
  assert.equal(pickProvider({ claveIA: 'AIzaSyPrueba', modeloIA: 'gemini-2.5-flash' }, env).model, 'gemini-2.5-flash')
})

test('las herramientas van en el formato que acepta Gemini', () => {
  const abrir = COMPATIBLE_TOOLS.find((t) => t.function.name === 'abrir')
  assert.equal(abrir.type, 'function')
  assert.deepEqual(abrir.function.parameters.required, ['objetivo'])
  assert.ok(!JSON.stringify(COMPATIBLE_TOOLS).includes('additionalProperties'))
  const jugar = COMPATIBLE_TOOLS.find((t) => t.function.name === 'jugar')
  assert.equal(jugar.function.parameters, undefined) // sin parámetros: ni se mandan
})

test('con Gemini conversa, usa herramientas y devuelve lo que Gemini necesita', async () => {
  const signature = { extra_content: { google: { thought_signature: 'abc' } } }
  const { ai, memory, calls } = setup(
    [reply(null, [call('c1', 'recordar_dato', { texto: 'mi perro se llama Toby' }, signature)]), reply('[amor] ¡Qué lindo nombre, Toby!')],
    { claveIA: 'AIzaSyPrueba' }
  )
  const r = await ai.chat('te cuento que mi perro se llama Toby', 'Ahora: martes 18:00.')
  assert.deepEqual(r, { text: '¡Qué lindo nombre, Toby!', face: 'love', confirm: false, game: undefined })
  assert.equal(memory.listFacts()[0].texto, 'mi perro se llama Toby')

  const [first, second] = calls
  assert.match(first.url, /generativelanguage\.googleapis\.com\/v1beta\/openai\/chat\/completions$/)
  assert.equal(first.headers.authorization, 'Bearer AIzaSyPrueba')
  assert.equal(first.body.model, 'gemini-flash-lite-latest')
  assert.equal(first.body.messages[0].role, 'system')
  assert.match(first.body.messages[1].content, /<contexto>\nAhora: martes 18:00\.\n<\/contexto>\n\nte cuento/)
  const [, , assistant, tool] = second.body.messages
  assert.deepEqual(assistant.tool_calls[0].extra_content, signature.extra_content)
  assert.deepEqual(tool, { role: 'tool', tool_call_id: 'c1', content: 'Listo, me lo guardo: tu perro se llama Toby.' })
})

test('con Ollama no hace falta clave y limpia lo que piensa en voz alta', async () => {
  const { ai, calls } = setup([reply('<think>mmm</think>[risa] **Jaja**, buenísimo')], { proveedorIA: 'ollama' })
  const r = await ai.chat('contame algo', 'ctx')
  assert.equal(r.text, 'Jaja, buenísimo')
  assert.equal(r.face, 'laugh')
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions')
  assert.equal(calls[0].headers.authorization, undefined)
  assert.equal(calls[0].body.model, 'qwen2.5:7b')
})

test('puede jugar y leer el mail con Groq', async () => {
  const { ai, calls } = setup(
    [
      reply(null, [call('c1', 'jugar', {})]),
      reply('[feliz] ¡A jugar!'),
      reply(null, [call('c2', 'leer_pagina', { que: 'mail' })]),
      reply('[normal] Dice que mañana no hay clases.')
    ],
    { claveIA: 'gsk_prueba' }
  )
  assert.equal((await ai.chat('juguemos', 'ctx')).game, 'pong')
  assert.equal((await ai.chat('¿qué dice el mail?', 'ctx')).text, 'Dice que mañana no hay clases.')
  const tool = calls[3].body.messages.at(-1)
  assert.equal(tool.tool_call_id, 'c2')
  assert.match(tool.content, /Asunto: Reunión/)
})

test('si se acaba el límite gratis de un modelo, prueba con el otro', async () => {
  const { ai, calls } = setup([{ status: 429, body: { error: { message: 'Quota exceeded' } } }, reply('[feliz] ¡Hola!')], { claveIA: 'AIzaSyPrueba' })
  assert.equal((await ai.chat('hola', 'ctx')).text, '¡Hola!')
  assert.deepEqual(calls.map((c) => c.body.model), ['gemini-flash-lite-latest', 'gemini-flash-latest'])
})

test('si falla, la charla queda como estaba y el error se explica', async () => {
  const exhausted = { status: 429, body: { error: { message: 'Resource exhausted' } } }
  const { ai, calls } = setup([exhausted, exhausted, reply('[feliz] ¡Hola!')], { claveIA: 'AIzaSyPrueba' })
  const err = await ai.chat('hola', 'ctx').catch((e) => e)
  assert.match(aiErrorText(err), /límite de uso gratis/)
  await ai.chat('hola de nuevo', 'ctx')
  assert.equal(calls[2].body.messages.length, 2) // system + el mensaje nuevo, sin restos del que falló
})

test('explica los errores de las IA gratis', () => {
  assert.match(aiErrorText(new AIHttpError(400, 'API key not valid. Please pass a valid API key.')), /clave de IA no funciona/)
  assert.match(aiErrorText(new AIHttpError(404, 'not found', { model: 'gemini-x' })), /«gemini-x»/)
  assert.match(aiErrorText(new AIHttpError(404, 'not found', { model: 'qwen2.5:7b', local: true })), /ollama pull qwen2\.5:7b/)
  assert.equal(aiErrorText(new AIConnectionError('sin internet')), null) // siguen las reglas
  assert.equal(aiErrorText(new AIHttpError(400, 'tool_use_failed')), null)
  assert.equal(cleanText('## Hola **vos**'), 'Hola vos')
})

test('explica por qué no hay IA', () => {
  assert.match(describeAI({}, {}).text, /No encuentro la clave de IA en config.json/)
  assert.match(describeAI({ claveIA: 'AQ.x', ia: false }, {}).text, /apagada/)
  assert.match(describeAI({ proveedorIA: 'gemini' }, {}).text, /falta la clave/)
  assert.equal(describeAI({ claveIA: 'AQ.x' }, {}).text, 'Estoy usando la IA de Gemini (gemini-flash-lite-latest).')
})
