// Los textos largos se leen enteros (en pedazos) y sin emojis
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { speechChunks, speechText, noEmoji } from '../src/main/speech-text.js'
import { createTTS } from '../src/main/tts.js'
import { dayStatus } from '../src/main/study-stats.js'

const LONG =
  'La fotosíntesis es el proceso por el cual las plantas, las algas y algunas bacterias transforman la energía de la luz en energía química. ' +
  'Ocurre en los cloroplastos, que tienen clorofila, el pigmento verde que absorbe la luz. ' +
  'En la fase luminosa se rompe el agua, se libera oxígeno y se produce ATP y NADPH, que son como pilas cargadas para la célula; ' +
  'en la fase oscura, también llamada ciclo de Calvin, se usa esa energía para fijar el dióxido de carbono del aire y armar glucosa, ' +
  'que la planta usa para crecer, para respirar y para guardar reservas en forma de almidón. ' +
  '¿Querés que te haga unas preguntas para repasar?'

test('un texto largo se parte en frases, sin perder ni una palabra', () => {
  const chunks = speechChunks(LONG, 240)
  assert.ok(chunks.length >= 3)
  assert.ok(chunks.every((c) => c.length <= 240), 'ningún pedazo se pasa del largo')
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), LONG.replace(/\s+/g, ' '), 'están todas las palabras, en orden')
  assert.match(chunks.at(-1), /¿Querés que te haga unas preguntas para repasar\?$/)
})

test('las frases cortas van juntas y una frase larguísima se corta en las comas', () => {
  assert.deepEqual(speechChunks('Hola. ¿Cómo andás? Todo bien.', 240), ['Hola. ¿Cómo andás? Todo bien.'])
  const long = Array.from({ length: 30 }, (_, i) => `cosa número ${i + 1}`).join(', ')
  const parts = speechChunks(long, 100)
  assert.ok(parts.length > 3)
  assert.ok(parts.every((p) => p.length <= 100))
  assert.ok(parts.slice(0, -1).every((p) => p.endsWith(',')), 'corta después de una coma, no a mitad de palabra')
  assert.deepEqual(speechChunks('', 240), [])
})

test('lo que se lee no tiene emojis, comillas raras ni links', () => {
  assert.equal(speechText('«Hola» **vos** 😄 mirá https://youtu.be/abc'), 'Hola vos mirá el link')
  assert.equal(noEmoji('¡Listo! 🎉 Te lo anoté 📝.'), '¡Listo! Te lo anoté.')
  assert.equal(noEmoji('Vamos 🇦🇷 👍🏽 ❤️'), 'Vamos')
  assert.equal(noEmoji('Del 1 → 2, © 2026'), 'Del 1 → 2, © 2026', 'las flechas y los signos quedan')
  assert.equal(noEmoji(null), null)
})

test('Mi estudio dice cómo te fue el día con palabras, no con emojis', () => {
  assert.deepEqual(dayStatus(100, 60), { nivel: 'alto', texto: '¡Imparable!' })
  assert.deepEqual(dayStatus(60, 60), { nivel: 'bien', texto: 'Bien hecho' })
  assert.deepEqual(dayStatus(10, 60), { nivel: 'poco', texto: 'Dale que podés' })
  assert.equal(dayStatus(0, 60), null)
})

// La voz de Gemini con un texto largo: la pide de a pedazos, uno atrás del otro
function sse(bytes) {
  const data = Buffer.from(bytes).toString('base64')
  const text = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data } }] } }] })}\n\n`
  return { ok: true, status: 200, body: (async function* () { yield new TextEncoder().encode(text) })() }
}
const quota = () => ({ ok: false, status: 429, text: async () => '"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"' })

test('la voz de Gemini lee un texto largo entero, pidiéndolo de a pedazos', async () => {
  const responses = [sse([1]), sse([2]), sse([3]), sse([4]), sse([5])]
  const sent = []
  const tts = createTTS({ getConfig: () => ({ claveIA: 'AQ.prueba', vozNatural: 'gemini' }), fetchImpl: async (_u, init) => (sent.push(JSON.parse(init.body).contents[0].parts[0].text), responses.shift()) })
  const text = `${LONG} ${LONG}`
  const got = []
  assert.deepEqual(await tts.stream(1, text, 'happy', (c) => got.push(...c)), { ok: true })
  assert.ok(sent.length >= 2, 'lo pidió en varios pedazos')
  assert.ok(sent.every((s) => s.length < 600))
  assert.equal(got.length, sent.length, 'llegó el audio de cada pedazo')
  assert.match(sent.at(-1), /preguntas para repasar\?$/, 'llegó hasta el final')
})

test('si Gemini se corta a mitad (límite gratis), devuelve lo que falta para la voz de Windows', async () => {
  const responses = [sse([1]), quota()]
  const tts = createTTS({ getConfig: () => ({ claveIA: 'AQ.prueba', vozNatural: 'gemini' }), fetchImpl: async () => responses.shift() })
  const r = await tts.stream(1, `${LONG} ${LONG}`, 'happy', () => {})
  assert.equal(r.ok, true)
  assert.match(r.resto, /preguntas para repasar\?$/, 'lo que falta llega hasta el final')
  assert.ok(r.resto.length < `${LONG} ${LONG}`.length)
})

test('si se corta la voz a mitad (le hablás), no pide los pedazos que faltan', async () => {
  let calls = 0
  let tts
  tts = createTTS({
    getConfig: () => ({ claveIA: 'AQ.prueba', vozNatural: 'gemini' }),
    fetchImpl: async () => {
      calls++
      tts.stop(7)
      return sse([1])
    }
  })
  await tts.stream(7, `${LONG} ${LONG}`, 'happy', () => {})
  assert.equal(calls, 1)
})
