import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAI, parseEmotion } from '../src/main/ai.js'
import { createMemory } from '../src/main/memory.js'

// Cliente de mentira: devuelve las respuestas del guion y guarda los pedidos
function fakeClient(script) {
  const calls = []
  return {
    calls,
    factory: () => ({
      beta: {
        messages: {
          create: async (params) => {
            calls.push(structuredClone(params))
            const next = script.shift()
            if (!next) throw new Error('el guion se terminó')
            return next
          }
        }
      }
    })
  }
}

const text = (t) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: t }] })
const toolUse = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] })

function setup(script, config = {}) {
  const memory = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-ia-')), 'memoria.json'))
  const pending = []
  const ctx = {
    memory,
    log: () => {},
    emit: () => {},
    notify: () => {},
    getConfig: () => ({}),
    saveConfig: () => {},
    shortcutLabel: () => 'Ctrl+Espacio',
    setPending: (p) => pending.push(p),
    readPage: async () => ({ kind: 'mail', subject: 'Reunión', sender: 'Profe', text: 'Mañana no hay clases.' })
  }
  const client = fakeClient(script)
  const ai = createAI({ getConfig: () => ({ claveIA: 'sk-prueba', ...config }), ctx, clientFactory: client.factory })
  return { ai, ctx, memory, pending, calls: client.calls }
}

test('sin clave la IA está apagada', () => {
  const ai = createAI({ getConfig: () => ({}), ctx: {}, clientFactory: () => ({}) })
  const before = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  assert.equal(ai.enabled(), false)
  if (before) process.env.ANTHROPIC_API_KEY = before
})

test('responde con la cara que eligió y manda el contexto', async () => {
  const { ai, calls } = setup([text('[risa] ¡Jaja, qué buena!')])
  const r = await ai.chat('contame algo', 'Ahora: martes 18:00.')
  assert.deepEqual(r, { text: '¡Jaja, qué buena!', face: 'laugh', confirm: false, game: undefined })
  const req = calls[0]
  assert.equal(req.model, 'claude-opus-5-5')
  assert.equal(req.fallbacks, 'default')
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01'])
  assert.deepEqual(req.output_config, { effort: 'low' })
  assert.equal(req.system[0].cache_control.type, 'ephemeral')
  assert.ok(req.tools.some((t) => t.name === 'abrir'))
  assert.match(req.messages[0].content, /<contexto>\nAhora: martes 18:00\.\n<\/contexto>\n\ncontame algo/)
})

test('usa las herramientas y sigue la charla con el resultado', async () => {
  const { ai, memory, calls } = setup([
    toolUse('t1', 'recordar_dato', { texto: 'mi perro se llama Toby' }),
    text('[amor] ¡Qué lindo nombre, Toby!')
  ])
  const r = await ai.chat('te cuento que mi perro se llama Toby', 'ctx')
  assert.equal(r.text, '¡Qué lindo nombre, Toby!')
  assert.equal(memory.listFacts()[0].texto, 'mi perro se llama Toby')
  const second = calls[1].messages
  assert.equal(second[1].role, 'assistant')
  assert.equal(second[2].content[0].type, 'tool_result')
  assert.equal(second[2].content[0].tool_use_id, 't1')
})

test('lo riesgoso no se hace: pide confirmación', async () => {
  const { ai, pending, calls } = setup([toolUse('t1', 'bloquear_pc', {}), text('[normal] ¿Seguro? Tocá Sí para bloquearla.')])
  const r = await ai.chat('bloqueá la compu que me voy', 'ctx')
  assert.equal(r.confirm, true)
  assert.deepEqual(pending, [{ action: 'bloquear_pc', params: {} }])
  assert.match(calls[1].messages[2].content[0].content, /Todavía no se hizo/)
})

test('puede empezar el Pong y leer el mail', async () => {
  const { ai, calls } = setup([
    toolUse('t1', 'jugar', {}),
    text('[feliz] ¡A jugar!'),
    toolUse('t2', 'leer_pagina', { que: 'mail' }),
    text('[normal] Dice que mañana no hay clases.')
  ])
  assert.equal((await ai.chat('juguemos a algo', 'ctx')).game, 'pong')
  const r = await ai.chat('¿qué dice el mail?', 'ctx')
  assert.equal(r.text, 'Dice que mañana no hay clases.')
  const toolResult = calls[3].messages.at(-1).content[0]
  assert.equal(toolResult.tool_use_id, 't2')
})

test('la conversación se va agregando, sin reescribir lo anterior', async () => {
  const { ai, calls } = setup([text('[feliz] Hola'), text('[feliz] ¡Bien!')])
  await ai.chat('hola', 'ctx 1')
  await ai.chat('¿todo bien?', 'ctx 2')
  const [first, second] = calls
  assert.deepEqual(second.messages.slice(0, first.messages.length), first.messages)
  assert.equal(second.messages.length, 3)
})

test('las notas llegan en el mensaje siguiente', async () => {
  const { ai, calls } = setup([text('[feliz] ¡Qué bueno!')])
  ai.note('Pixie le dijo por su cuenta: «¿Cómo te fue en la prueba?».')
  await ai.chat('me fue re bien', 'ctx')
  assert.match(calls[0].messages[0].content, /Pasó hace un rato: Pixie le dijo por su cuenta/)
})

test('si se niega, responde amable', async () => {
  const { ai } = setup([{ stop_reason: 'refusal', content: [] }])
  const r = await ai.chat('algo raro', 'ctx')
  assert.equal(r.face, 'confused')
})

test('con otro modelo no manda el reintento automático', async () => {
  const { ai, calls } = setup([text('[feliz] Hola')], { modeloIA: 'claude-haiku-4-5' })
  await ai.chat('hola', 'ctx')
  assert.equal(calls[0].model, 'claude-haiku-4-5')
  assert.equal(calls[0].fallbacks, undefined)
  assert.equal(calls[0].betas, undefined)
})

test('resume sin herramientas y sin tocar la charla', async () => {
  const { ai, calls } = setup([text('[normal] Es de la profe: mañana no hay clases.')])
  const s = await ai.summarize('mail', 'Asunto: Reunión\n\nMañana no hay clases.')
  assert.equal(s, 'Es de la profe: mañana no hay clases.')
  assert.equal(calls[0].tools, undefined)
})

test('lee la etiqueta de emoción', () => {
  assert.deepEqual(parseEmotion('[sorpresa] ¡No te puedo creer!'), { face: 'surprised', text: '¡No te puedo creer!' })
  assert.deepEqual(parseEmotion('Sin etiqueta'), { face: null, text: 'Sin etiqueta' })
  assert.deepEqual(parseEmotion('[inventada] Hola'), { face: null, text: 'Hola' })
})
