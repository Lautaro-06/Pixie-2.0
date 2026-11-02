// Micrófono: graba hasta que dejás de hablar y lo pasa a WAV (16 kHz, mono)
// para que la IA lo transcriba. Nada se graba si no tocás el micrófono.

const TARGET_RATE = 16000
// Cuánto tiene que sobresalir la voz del ruido de la habitación. No es un volumen fijo: con un
// micrófono bajito (o lejos) también te escucha, y mientras hablás alcanza con menos (las pausas
// entre palabras y las sílabas suaves no cortan la grabación).
const START_OVER_NOISE = 3
const KEEP_OVER_NOISE = 1.8
const MIN_START_LEVEL = 0.007
const MIN_KEEP_LEVEL = 0.004
const NOISE_WINDOW_MS = 1500

// Decide, pedacito a pedacito, si estás hablando. El ruido de la habitación es lo más bajo del
// último segundo y medio (entre palabra y palabra siempre hay un silencio): así sirve igual si
// empezaste a hablar enseguida, si el micrófono está bajito o si hay un ventilador.
export function createVoiceGate() {
  const recent = [] // [momento, volumen]
  let heard = false
  return {
    push(l, now) {
      recent.push([now, l])
      while (recent.length > 1 && now - recent[0][0] > NOISE_WINDOW_MS) recent.shift()
      const floor = Math.min(...recent.map(([, v]) => v))
      const start = Math.max(MIN_START_LEVEL, floor * START_OVER_NOISE)
      const keep = Math.max(MIN_KEEP_LEVEL, floor * KEEP_OVER_NOISE)
      const speaking = heard ? l > keep : l > start
      if (speaking) heard = true
      return { heard, speaking }
    }
  }
}

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
// Devuelve { done: Promise<{ wav, samples, heard }>, stop(), cancel() } (samples: a 16 kHz, para aprender tu voz)
// Los micrófonos de auriculares Bluetooth pasan los auriculares a "manos libres"
// y todo el sonido de la compu queda como de llamada. Si hay otro micrófono, se usa ese.
export function isHandsFree(label) {
  return /hands-?free|manos libres|AG Audio|bluetooth/i.test(label ?? '')
}

export function pickMicrophone(devices) {
  const mics = devices.filter((d) => d.kind === 'audioinput')
  const preferred = mics.find((d) => d.deviceId === 'default') ?? mics[0]
  if (!preferred || !isHandsFree(preferred.label)) return null
  const other = mics.find((d) => !['default', 'communications'].includes(d.deviceId) && !isHandsFree(d.label))
  return other?.deviceId ?? null
}

async function microphoneId() {
  try {
    return pickMicrophone(await navigator.mediaDevices.enumerateDevices())
  } catch {
    return null
  }
}

// El mismo micrófono y el mismo filtrado para grabar tu voz y para escucharte después
export async function openMicrophone() {
  const deviceId = await microphoneId()
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }
  })
}

// tap: si Pixie ya está escuchando el micrófono (esperando «Pixie, ¿estás?»), se cuelga de ese mismo
// audio: no hay que esperar a que se abra otro micrófono ni a que se acomode el volumen, y no se
// pierden las primeras palabras.
export async function listen({ onLevel = () => {}, silenceMs = 1500, maxMs = 30000, waitMs = 7000, tap = null } = {}) {
  const chunks = []
  const started = performance.now()
  let heard = false
  let lastVoice = started
  let finished = false
  let rate = 48000
  const gate = createVoiceGate()
  let resolveDone
  let close = () => {}
  let lastChunk = performance.now()
  // Si el audio deja de llegar (se desenchufó el micrófono), no se queda escuchando para siempre
  const watchdog = setInterval(() => performance.now() - lastChunk > 3000 && finish(), 1000)

  const done = new Promise((resolve) => {
    resolveDone = resolve
  })

  function finish(keep = true) {
    if (finished) return
    finished = true
    clearInterval(watchdog)
    close()
    if (!keep || !heard) return resolveDone({ wav: null, samples: null, heard })
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
    let offset = 0
    for (const c of chunks) {
      all.set(c, offset)
      offset += c.length
    }
    const samples = downsample(all, rate)
    resolveDone({ wav: encodeWav(samples), samples, heard })
  }

  function onChunk(data, sampleRate) {
    if (finished) return
    lastChunk = performance.now()
    rate = sampleRate
    chunks.push(data)
    const now = performance.now()
    const l = level(data)
    onLevel(l)
    const g = gate.push(l, now)
    if (g.speaking) lastVoice = now
    heard = g.heard
    if ((heard && now - lastVoice > silenceMs) || now - started > maxMs || (!heard && now - started > waitMs)) finish()
  }

  if (tap?.live()) {
    tap.setTap(onChunk)
    close = () => tap.setTap(null)
  } else {
    const stream = await openMicrophone()
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    proc.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate)
    source.connect(proc)
    proc.connect(ctx.destination) // la salida queda en silencio: solo hace falta para que procese
    close = () => {
      proc.disconnect()
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      ctx.close()
    }
  }

  return { done, stop: () => finish(true), cancel: () => finish(false) }
}
