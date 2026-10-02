import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPiper, PIPER_ZIP, VOICE_URL, piperLine } from '../src/main/piper.js'
import { createVoices } from '../src/main/voices.js'
import { pickMicrophone, isHandsFree } from '../src/renderer/src/audio.js'
import { interpretAll } from '../src/main/brain.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'pixie-voz-'))

// Descargas de mentira: devuelve bytes y anota qué se pidió
function fakeFetch(fail = false) {
  const urls = []
  const fn = async (url) => {
    urls.push(url)
    if (fail) return { ok: false, status: 503 }
    const text = url.endsWith('.json') ? JSON.stringify({ audio: { sample_rate: 22050 } }) : 'x'.repeat(1000)
    return { ok: true, status: 200, body: (async function* () { yield Buffer.from(text) })() }
  }
  return { fn, urls }
}

// "Descomprime" creando piper/piper.exe
const fakeExtract = async (_zip, dest) => {
  mkdirSync(join(dest, 'piper'), { recursive: true })
  writeFileSync(join(dest, 'piper', 'piper.exe'), '')
}

// Piper de mentira: lee el texto y devuelve audio en dos pedazos
function fakeSpawn() {
  const calls = []
  const fn = (exe, args, opts) => {
    const child = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => child.emit('close', null)
    let input = ''
    child.stdin.on('data', (d) => (input += d))
    child.stdin.on('end', () => {
      calls.push({ exe, args, opts, input })
      setImmediate(() => {
        child.stdout.write(Buffer.from([1, 2, 3]))
        child.stdout.write(Buffer.from([4]))
        setImmediate(() => child.emit('close', 0))
      })
    })
    return child
  }
  return { fn, calls }
}

test('baja Piper y la voz argentina una sola vez', async () => {
  const dir = tmp()
  const f = fakeFetch()
  const progress = []
  const piper = createPiper({ dir, fetchImpl: f.fn, extract: fakeExtract })
  assert.equal(piper.installed(), false)
  await piper.install((p) => progress.push(p))
  assert.equal(piper.installed(), true)
  assert.deepEqual(f.urls, [PIPER_ZIP, `${VOICE_URL}.json`, VOICE_URL])
  assert.ok(existsSync(join(dir, 'es_AR-daniela-high.onnx')))
  assert.ok(!existsSync(join(dir, 'piper.zip'))) // el zip se borra
  await piper.install()
  assert.equal(f.urls.length, 3) // no baja de nuevo
})

test('habla con Piper: el audio llega en pedacitos con su frecuencia', async () => {
  const dir = tmp()
  const s = fakeSpawn()
  const piper = createPiper({ dir, fetchImpl: fakeFetch().fn, extract: fakeExtract, spawnImpl: s.fn })
  await piper.install()
  const got = []
  const r = await piper.speak(1, '«Hola», ¿qué tal?\nTodo bien.', 'sad', (c, rate) => got.push([[...c], rate]))
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(got, [[[1, 2, 3], 22050], [[4], 22050]])
  assert.equal(s.calls[0].input, 'Hola, ¿qué tal? Todo bien.\n')
  assert.ok(s.calls[0].args.includes('--output-raw'))
  assert.equal(s.calls[0].args[s.calls[0].args.indexOf('--length_scale') + 1], '1.08') // triste: más lento, sin tocar el tono
})

test('si no está instalada o falla la descarga, no habla (usa la de Windows)', async () => {
  const dir = tmp()
  const piper = createPiper({ dir, fetchImpl: fakeFetch(true).fn, extract: fakeExtract })
  assert.deepEqual(await piper.speak(1, 'Hola', 'happy', () => {}), { ok: false })
  await assert.rejects(piper.install(), /no se pudo bajar/)
  assert.equal(piper.installed(), false)
})

test('elige la voz: natural de la compu, Gemini solo si se pide, o Windows', async () => {
  const dir = tmp()
  let cfg = { claveIA: 'AQ.x' }
  const said = []
  const voices = createVoices({
    getConfig: () => cfg,
    saveConfig: (patch) => (cfg = { ...cfg, ...patch }),
    dataDir: dir,
    fetchImpl: fakeFetch().fn,
    extract: fakeExtract,
    spawnImpl: fakeSpawn().fn,
    announce: (text) => said.push(text)
  })
  assert.equal(voices.engine(), null) // sin instalar: Windows (Gemini no se usa solo)
  assert.match(voices.status(), /instalá la voz natural/)
  assert.equal(voices.install(), 'empezando')
  assert.equal(voices.install(), 'bajando')
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(voices.engine(), 'piper')
  assert.match(said.at(-1), /Ya tengo mi voz natural/)
  assert.match(voices.status(), /Daniela/)
  voices.use(false)
  assert.equal(voices.engine(), null)
  voices.use('gemini')
  assert.equal(voices.engine(), 'gemini')
})

test('evita el micrófono de auriculares Bluetooth si hay otro', () => {
  const bt = { kind: 'audioinput', deviceId: 'default', label: 'Predeterminado - Auriculares (WH-1000XM4 Hands-Free AG Audio)' }
  const btReal = { kind: 'audioinput', deviceId: 'bt1', label: 'Auriculares (WH-1000XM4 Hands-Free AG Audio)' }
  const laptop = { kind: 'audioinput', deviceId: 'mic1', label: 'Micrófono (Realtek(R) Audio)' }
  assert.equal(pickMicrophone([bt, btReal, laptop]), 'mic1')
  assert.equal(pickMicrophone([bt, btReal]), null) // si es el único, se usa ese
  assert.equal(pickMicrophone([{ ...laptop, deviceId: 'default' }, btReal]), null) // el de siempre ya está bien
  assert.ok(isHandsFree('Manos libres'))
  assert.ok(!isHandsFree('Micrófono (USB Audio)'))
})

test('entiende los pedidos sobre su voz', () => {
  const act = (q) => interpretAll(q)?.map((i) => [i.action, i.params.accion])
  assert.deepEqual(act('instalá la voz natural'), [['voz', 'instalar']])
  assert.deepEqual(act('usá la voz de Windows'), [['voz', 'windows']])
  assert.deepEqual(act('usá la voz natural'), [['voz', 'natural']])
  assert.deepEqual(act('¿qué voz usás?'), [['voz', 'estado']])
  assert.deepEqual(act('tu voz suena rara'), [['voz', 'estado']])
  assert.equal(piperLine('«Hola»\n**vos**'), 'Hola vos')
})
