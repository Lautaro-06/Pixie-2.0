// 0.16.1: los pedidos van al instante, la IA saturada no frena nada y el informe trae lo que sirve
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCompatibleDriver, PROVIDERS, AIHttpError, AIConnectionError, transientError } from '../src/main/ai-compatible.js'
import { aiErrorText, voiceErrorText } from '../src/main/ai.js'
import { wantsAI } from '../src/main/routing.js'
import { interpretAll } from '../src/main/brain.js'
import { runAction } from '../src/main/actions/index.js'
import { createMemory } from '../src/main/memory.js'
import { createDiagnostics, usefulLogLines, tailFile } from '../src/main/diagnostics.js'

// Gemini de mentira: contesta lo que diga el guion, en orden
function gemini(script) {
  const calls = []
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body.model)
    const next = script.shift()
    if (next.status) return { ok: false, status: next.status, json: async () => ({ error: { message: next.message ?? 'The model is overloaded.' } }) }
    return { ok: true, json: async () => ({ choices: [{ message: { content: next.text }, finish_reason: 'stop' }] }) }
  }
  const waits = []
  const d = createCompatibleDriver({ preset: PROVIDERS.gemini, apiKey: 'x', model: PROVIDERS.gemini.model, system: 'sos Pixie', fetchImpl, wait: async (ms) => waits.push(ms) })
  return { d, calls, waits }
}
const ask = (d) => d.step([d.user('hola')], { tools: false })

test('si Gemini está saturado (503), prueba con el otro modelo', async () => {
  const { d, calls } = gemini([{ status: 503 }, { text: 'Hola' }])
  assert.equal((await ask(d)).text, 'Hola')
  assert.deepEqual(calls, ['gemini-flash-lite-latest', 'gemini-flash-latest'])
})

test('si los dos están saturados, espera un segundo y prueba otra vez', async () => {
  const { d, calls, waits } = gemini([{ status: 503 }, { status: 503 }, { text: 'Ahora sí' }])
  assert.equal((await ask(d)).text, 'Ahora sí')
  assert.deepEqual(calls, ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest'])
  assert.deepEqual(waits, [900])
})

test('si sigue saturada, el error se explica sin números; con la clave mal no reintenta', async () => {
  const { d, calls } = gemini([{ status: 503 }, { status: 503 }, { status: 503 }])
  const err = await ask(d).catch((e) => e)
  assert.equal(err.status, 503)
  assert.equal(calls.length, 3)
  assert.doesNotMatch(aiErrorText(err), /503/)
  assert.match(aiErrorText(err), /saturada/)
  assert.match(voiceErrorText(err), /saturada/)
  const bad = gemini([{ status: 400, message: 'API key not valid' }])
  await assert.rejects(ask(bad.d))
  assert.equal(bad.calls.length, 1)
  // Con el límite gratis agotado en los dos no reintenta enseguida (no sirve)
  const quota = gemini([{ status: 429 }, { status: 429 }])
  await assert.rejects(ask(quota.d))
  assert.deepEqual(quota.waits, [])
})

test('qué cuenta como falla pasajera', () => {
  for (const s of [429, 500, 502, 503, 504]) assert.equal(transientError(new AIHttpError(s, 'x')), true, String(s))
  assert.equal(transientError(new AIHttpError(400, 'x')), false)
  assert.equal(transientError(new AIConnectionError('x', { timeout: true })), true)
  assert.equal(transientError(new AIConnectionError('sin internet')), false)
  assert.ok(PROVIDERS.gemini.timeout <= 30000, 'no se queda un minuto esperando a una IA trabada')
})

test('lo que las reglas entienden se hace al instante, aunque la frase sea larga', () => {
  const route = (t) => (wantsAI(t, interpretAll(t)) ? 'IA' : 'reglas')
  assert.equal(route('recordame mañana a las 8 que tengo que llevar el TP de química a la escuela'), 'reglas')
  assert.equal(route('¿me podés agendar en el calendar que el viernes tengo prueba de historia?'), 'reglas')
  assert.equal(route('poné un timer de 10 minutos para sacar los fideos del fuego por favor'), 'reglas')
  assert.equal(route('quiero estudiar química dos horas porque tengo prueba el viernes'), 'reglas')
  assert.equal(route('¿qué tengo que entregar en classroom esta semana?'), 'reglas')
  assert.equal(route('abrí Spotify'), 'reglas')
  // La charla y lo que no es un pedido claro, a la IA
  assert.equal(route('mañana tengo prueba de química y estoy re nervioso, ¿me ayudás a estudiar?'), 'IA')
  assert.equal(route('estoy re cansado porque ayer me quedé jugando hasta tarde'), 'IA')
  assert.equal(route('hola, ¿cómo andás?'), 'IA')
})

test('«agendá en el Google Calendar…» lo guarda en su agenda y aclara que al Calendar no puede escribir', async () => {
  const [it] = interpretAll('¿me podés agendar en el calendar que el viernes tengo prueba de historia?')
  assert.equal(it.action, 'agendar')
  assert.equal(it.params.texto, 'prueba de historia')
  assert.equal(it.params.calendario, true)
  assert.equal(interpretAll('agendame en el calendario la prueba de historia del viernes')[0].params.texto, 'prueba de historia')
  const memory = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-')), 'memoria.json'))
  const r = await runAction('agendar', it.params, { memory, log: () => {} })
  assert.match(r.text, /^Agendado: prueba de historia, (el viernes|pasado mañana|mañana|hoy)\./)
  assert.match(r.text, /En tu Google Calendar no puedo escribir \(solo lo leo\)/)
  assert.equal(memory.eventsBetween(new Date(it.params.cuando), new Date(it.params.cuando)).length, 1)
})

test('el informe trae lo último de «Pixie, ¿estás?», lo que tardó, la IA y Classroom (sin lo demás)', () => {
  const log = [
    '2026-11-03T18:00:00.000Z  palabra mágica: escucho «Pixie, ¿estás?» con Micrófono (Realtek)',
    '2026-11-03T18:01:00.000Z  agenda: guardé algo personal',
    '2026-11-03T18:02:00.000Z  palabra mágica: casi te escuché (distancia 0.412 de 0.380)',
    '2026-11-03T18:03:00.000Z  IA (gemini): 503 The model is overloaded.',
    '2026-11-03T18:03:05.000Z  tardé 6.2 s en contestar «hola» (IA falló, reglas)',
    '2026-11-03T18:04:00.000Z  whatsapp: te mandé «comprar pan»',
    '2026-11-03T18:05:00.000Z  classroom: No pude leer Classroom.'
  ].join('\n')
  const lines = usefulLogLines(log)
  assert.equal(lines.length, 5)
  assert.match(lines[0], /^2026-11-03 18:00:00 {2}palabra mágica: escucho/)
  assert.doesNotMatch(lines.join('\n'), /whatsapp|personal/)
  const file = join(mkdtempSync(join(tmpdir(), 'pixie-')), 'historial.txt')
  writeFileSync(file, `${'x'.repeat(5000)}\n${log}\n`)
  assert.match(tailFile(file, 600), /classroom: No pude leer/)
  assert.doesNotMatch(tailFile(file, 600), /^x/, 'no empieza con un renglón cortado')
  assert.equal(tailFile(join(tmpdir(), 'no-existe-pixie.txt')), '')
  const report = createDiagnostics().report(['Versión: 0.16.1'], lines)
  assert.match(report, /Lo último del historial \(5 renglones\):/)
})
