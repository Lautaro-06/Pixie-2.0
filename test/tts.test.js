import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTTS, voicePrompt, cleanForVoice } from '../src/main/tts.js'

// Respuesta en streaming como la de Gemini: eventos "data: {...}" separados por línea en blanco
function sseResponse(chunks, status = 200) {
  const encoder = new TextEncoder()
  const events = chunks.map((b64) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: b64 } }] } }] })}\r\n\r\n`)
  const text = events.join('')
  return {
    ok: status < 300,
    status,
    body: (async function* () {
      // se manda partido en pedazos raros, como en la red
      for (let i = 0; i < text.length; i += 37) yield encoder.encode(text.slice(i, i + 37))
    })()
  }
}

function setup({ config = { claveIA: 'AQ.prueba' }, responses } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    return responses.shift()
  }
  return { tts: createTTS({ getConfig: () => config, fetchImpl }), calls }
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

test('la voz natural llega en pedacitos', async () => {
  const { tts, calls } = setup({ responses: [sseResponse([b64([1, 2, 3, 4]), b64([5, 6])])] })
  const got = []
  const r = await tts.stream(1, '¡Hola! Soy Pixie.', 'happy', (c) => got.push([...c]))
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(got, [[1, 2, 3, 4], [5, 6]])
  assert.match(calls[0].url, /gemini-3\.1-flash-tts-preview:streamGenerateContent\?alt=sse$/)
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'AQ.prueba')
  assert.equal(calls[0].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Leda')
  assert.match(calls[0].body.contents[0].parts[0].text, /voz alegre .*: ¡Hola! Soy Pixie\.$/)
})

test('las frases repetidas no gastan el límite', async () => {
  const { tts, calls } = setup({ responses: [sseResponse([b64([7, 8])])] })
  await tts.stream(1, 'Listo.', 'happy', () => {})
  const got = []
  assert.deepEqual(await tts.stream(2, 'Listo.', 'happy', (c) => got.push([...c])), { ok: true, cached: true })
  assert.deepEqual(got, [[7, 8]])
  assert.equal(calls.length, 1)
})

test('si se acaba el límite gratis, deja la voz de Windows por un rato', async () => {
  const { tts, calls } = setup({ responses: [{ ok: false, status: 429 }] })
  assert.deepEqual(await tts.stream(1, 'Hola', 'happy', () => {}), { ok: false })
  assert.equal(tts.available(), false)
  assert.deepEqual(await tts.stream(2, 'Hola de nuevo', 'happy', () => {}), { ok: false })
  assert.equal(calls.length, 1)
})

test('sin Gemini (o con la voz natural apagada) usa la de Windows', async () => {
  assert.equal(setup({ config: { claveIA: 'sk-ant-x' }, responses: [] }).tts.available(), false)
  assert.equal(setup({ config: { claveIA: 'AQ.x', vozNatural: false }, responses: [] }).tts.available(), false)
  assert.equal(setup({ config: { claveIA: 'AQ.x' }, responses: [] }).tts.available(), true)
})

test('arma el pedido con el tono de la emoción', () => {
  assert.match(voicePrompt('Uh, qué bajón.', 'sad'), /voz triste y suave/)
  assert.match(voicePrompt('Hola', undefined), /voz amable/)
  assert.equal(cleanForVoice('«Hola» **vos**'), 'Hola vos')
})
