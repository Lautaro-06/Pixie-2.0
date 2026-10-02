// Micrófono: graba hasta que dejás de hablar y lo pasa a WAV (16 kHz, mono)
// para que la IA lo transcriba. Nada se graba si no tocás el micrófono.

const TARGET_RATE = 16000
const SPEECH_LEVEL = 0.02 // volumen a partir del cual cuenta como voz

// Promedia muestras para bajar la frecuencia (por ejemplo de 48 kHz a 16 kHz)
export function downsample(samples, fromRate, toRate = TARGET_RATE) {
  if (fromRate === toRate) return samples
  const ratio = fromRate / toRate
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

// PCM de 16 bits con cabecera WAV
export function encodeWav(samples, rate = TARGET_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buffer)
  const text = (offset, s) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buffer)
}

// PCM de 16 bits → muestras para Web Audio (guarda el byte suelto si el pedazo es impar)
export function pcmToFloat(bytes, carry = null) {
  let data = bytes
  if (carry) {
    data = new Uint8Array(carry.length + bytes.length)
    data.set(carry)
    data.set(bytes, carry.length)
  }
  const odd = data.length % 2 ? data.subarray(data.length - 1) : null
  const even = odd ? data.subarray(0, data.length - 1) : data
  const view = new DataView(even.buffer, even.byteOffset, even.byteLength)
  const out = new Float32Array(even.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return { samples: out, carry: odd ? new Uint8Array(odd) : null }
}

export function level(samples) {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / Math.max(1, samples.length))
}

// Empieza a escuchar. Termina sola cuando dejás de hablar (o con stop()).
// Devuelve { done: Promise<{ wav, heard }>, stop(), cancel() }
export async function listen({ onLevel = () => {}, silenceMs = 1300, maxMs = 15000, waitMs = 6000 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const chunks = []
  const started = performance.now()
  let heard = false
  let lastVoice = started
  let finished = false
  let resolveDone

  const done = new Promise((resolve) => {
    resolveDone = resolve
  })

  function finish(keep = true) {
    if (finished) return
    finished = true
    proc.disconnect()
    source.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    const rate = ctx.sampleRate
    ctx.close()
    if (!keep || !heard) return resolveDone({ wav: null, heard })
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
    let offset = 0
    for (const c of chunks) {
      all.set(c, offset)
      offset += c.length
    }
    resolveDone({ wav: encodeWav(downsample(all, rate)), heard })
  }

  proc.onaudioprocess = (e) => {
    if (finished) return
    const data = new Float32Array(e.inputBuffer.getChannelData(0))
    chunks.push(data)
    const now = performance.now()
    const l = level(data)
    onLevel(l)
    if (l > SPEECH_LEVEL) {
      heard = true
      lastVoice = now
    }
    if ((heard && now - lastVoice > silenceMs) || now - started > maxMs || (!heard && now - started > waitMs)) finish()
  }
  source.connect(proc)
  proc.connect(ctx.destination) // la salida queda en silencio: solo hace falta para que procese

  return { done, stop: () => finish(true), cancel: () => finish(false) }
}
