import { test } from 'node:test'
import assert from 'node:assert/strict'
import { downsample, encodeWav, level } from '../src/renderer/src/audio.js'

test('baja la frecuencia del audio a 16 kHz', () => {
  const samples = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 10))
  const out = downsample(samples, 48000)
  assert.equal(out.length, 16000)
  assert.ok(Math.abs(out[100] - (samples[300] + samples[301] + samples[302]) / 3) < 1e-6)
})

test('arma un WAV válido de 16 bits', () => {
  const wav = encodeWav(Float32Array.from([0, 0.5, -0.5, 1, -1]))
  const v = new DataView(wav.buffer)
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF')
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE')
  assert.equal(v.getUint32(24, true), 16000)
  assert.equal(v.getUint32(40, true), 10)
  assert.equal(v.getInt16(44 + 2, true), 16383)
  assert.equal(v.getInt16(44 + 8, true), -32768)
})

test('mide el volumen', () => {
  assert.equal(level(new Float32Array(100)), 0)
  assert.ok(level(Float32Array.from({ length: 100 }, () => 0.5)) > 0.49)
})

test('convierte la voz natural (PCM de 16 bits) aunque llegue cortada', async () => {
  const { pcmToFloat } = await import('../src/renderer/src/audio.js')
  const pcm = new Uint8Array(new Int16Array([0, 16384, -32768]).buffer) // 6 bytes
  const a = pcmToFloat(pcm.subarray(0, 3)) // llega un byte suelto
  assert.deepEqual([...a.samples], [0])
  assert.equal(a.carry.length, 1)
  const b = pcmToFloat(pcm.subarray(3), a.carry)
  assert.deepEqual([...b.samples], [0.5, -1])
  assert.equal(b.carry, null)
})
