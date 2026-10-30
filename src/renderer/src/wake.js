// «Pixie, ¿estás?»: reconoce la frase con la que la llamás comparándola con tres grabaciones
// de tu voz. Todo pasa en la compu: no se manda audio a ningún lado hasta que te escucha llamarla.
// Cómo: corta el audio en frases cortas (entre silencios), saca su "huella" (MFCC: cómo cambia
// el sonido cada 10 ms) y la compara con las grabaciones estirando el tiempo (DTW), porque
// nunca decimos la frase igual de rápido.

export const RATE = 16000
const FRAME = 400 // 25 ms
const HOP = 160 // 10 ms
const NFFT = 512
const MELS = 26
const COEFS = 13 // se usan del 1 al 12: el 0 es el volumen y depende de qué tan cerca estés

// ───────────── La huella del sonido (MFCC) ─────────────

const hamming = Float32Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)))

const melOf = (hz) => 2595 * Math.log10(1 + hz / 700)
const hzOf = (mel) => 700 * (10 ** (mel / 2595) - 1)

// Filtros triangulares en la escala mel (como escucha el oído), de 60 Hz a 7600 Hz
const filters = (() => {
  const lo = melOf(60)
  const hi = melOf(7600)
  const bins = Array.from({ length: MELS + 2 }, (_, i) => Math.floor(((NFFT + 1) * hzOf(lo + ((hi - lo) * i) / (MELS + 1))) / RATE))
  return Array.from({ length: MELS }, (_, m) => {
    const w = new Float32Array(NFFT / 2 + 1)
    for (let k = bins[m]; k < bins[m + 1]; k++) w[k] = (k - bins[m]) / Math.max(1, bins[m + 1] - bins[m])
    for (let k = bins[m + 1]; k < bins[m + 2]; k++) w[k] = (bins[m + 2] - k) / Math.max(1, bins[m + 2] - bins[m + 1])
    return w
  })
})()

const dct = Array.from({ length: COEFS }, (_, c) => Float32Array.from({ length: MELS }, (_, m) => Math.cos((Math.PI * c * (m + 0.5)) / MELS)))

// FFT de 512 puntos (in-place, radix 2)
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cr = Math.cos(ang * k)
        const ci = Math.sin(ang * k)
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

// Muestras a 16 kHz → una lista de vectores (uno cada 10 ms), centrados para que no dependan del micrófono
export function features(samples) {
  const re = new Float32Array(NFFT)
  const im = new Float32Array(NFFT)
  const mels = []
  let loudest = -Infinity
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < FRAME; i++) {
      const prev = start + i > 0 ? samples[start + i - 1] : 0
      re[i] = (samples[start + i] - 0.97 * prev) * hamming[i]
    }
    fft(re, im)
    const power = new Float32Array(NFFT / 2 + 1)
    for (let k = 0; k <= NFFT / 2; k++) power[k] = re[k] * re[k] + im[k] * im[k]
    const logMel = filters.map((w) => {
      let sum = 0
      for (let k = 0; k < w.length; k++) sum += w[k] * power[k]
      return Math.log(sum + 1e-10)
    })
    for (const l of logMel) loudest = Math.max(loudest, l)
    mels.push(logMel)
  }
  // Lo que está muy por debajo de lo más fuerte se aplana: así el ruido de fondo (un ventilador,
  // la compu) cambia poco la huella. 35 dB de rango, como un oído con algo de ruido alrededor.
  const floor = loudest - (35 / 10) * Math.log(10)
  const frames = mels.map((logMel) => {
    const v = new Float32Array(COEFS - 1)
    for (let c = 1; c < COEFS; c++) {
      let sum = 0
      for (let m = 0; m < MELS; m++) sum += dct[c][m] * Math.max(floor, logMel[m])
      v[c - 1] = sum
    }
    return v
  })
  // Se resta el promedio de cada coeficiente (así da igual el micrófono o la habitación)
  if (frames.length) {
    const mean = new Float32Array(COEFS - 1)
    for (const f of frames) for (let i = 0; i < f.length; i++) mean[i] += f[i] / frames.length
    for (const f of frames) for (let i = 0; i < f.length; i++) f[i] -= mean[i]
  }
  return frames
}

// ───────────── Comparar dos frases (DTW) ─────────────

function cosineDistance(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return 1 - dot / (Math.sqrt(na * nb) || 1)
}

// Compara tu grabación (a) con una frase (b): { total, nombre }. 0 = iguales; cuanto más grande, más distintas.
// «nombre» mira solo el principio de tu grabación (el «Pixie»): ahí está la diferencia con
// «¿Pero estás?» o «Che, ¿estás?», que terminan igual.
const NAME_PART = 0.45
export function compare(a, b) {
  const n = a.length
  const m = b.length
  const far = { total: Infinity, nombre: Infinity }
  if (!n || !m || n > 1.8 * m || m > 1.8 * n) return far // una dura mucho más que la otra: no es la misma frase
  const cost = Array.from({ length: n }, (_, i) => Float32Array.from({ length: m }, (_, j) => cosineDistance(a[i], b[j])))
  const acc = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity))
  acc[0][0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) acc[i][j] = cost[i - 1][j - 1] + Math.min(acc[i - 1][j], acc[i][j - 1], acc[i - 1][j - 1])
  }
  // Se recorre el camino de atrás para adelante para medir cuánto se parece el principio
  let i = n
  let j = m
  let name = 0
  let steps = 0
  while (i > 0 && j > 0) {
    if (i - 1 < n * NAME_PART) {
      name += cost[i - 1][j - 1]
      steps++
    }
    const diag = acc[i - 1][j - 1]
    const up = acc[i - 1][j]
    const left = acc[i][j - 1]
    if (diag <= up && diag <= left) {
      i--
      j--
    } else if (up <= left) i--
    else j--
  }
  return { total: acc[n][m] / (n + m), nombre: name / Math.max(1, steps) }
}

// ───────────── Las grabaciones de tu voz ─────────────

// Saca el silencio del principio y del final de una grabación
export function trimSilence(samples, { floor = 0.01 } = {}) {
  const win = 320 // 20 ms
  const loud = []
  let peak = 0
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    const rms = Math.sqrt(sum / win)
    loud.push(rms)
    peak = Math.max(peak, rms)
  }
  const limit = Math.max(floor, peak * 0.1)
  const first = loud.findIndex((l) => l > limit)
  if (first < 0) return new Float32Array(0)
  let last = loud.length - 1
  while (last > first && loud[last] <= limit) last--
  const from = Math.max(0, (first - 5) * win)
  const to = Math.min(samples.length, (last + 6) * win)
  return samples.subarray(from, to)
}

// Revisa una grabación para "aprender" la frase. Devuelve { ok, frames, problema }
export function learnSample(samples) {
  const voice = trimSilence(samples)
  const seconds = voice.length / RATE
  if (seconds < 0.3) return { ok: false, problema: 'No te escuché. Acercate al micrófono y decilo un poco más fuerte.' }
  if (seconds > 2.6) return { ok: false, problema: 'Fue muy largo. Decí solo «Pixie, ¿estás?» y quedate callado después.' }
  return { ok: true, frames: features(voice), seconds }
}

// Qué tan distintas son tus propias grabaciones entre sí: de ahí sale cuánto se puede alejar una frase
// para seguir contando como «Pixie, ¿estás?». sensibilidad: 'baja' | 'normal' | 'alta'
const SENSITIVITY = { baja: 1.2, normal: 1.5, alta: 1.8 }
export function limitFor(templates, sensibilidad = 'normal') {
  const pairs = []
  for (let i = 0; i < templates.length; i++) for (let j = i + 1; j < templates.length; j++) pairs.push(compare(templates[i], templates[j]))
  const spread = (key, fallback) => {
    const values = pairs.map((p) => p[key]).filter(Number.isFinite)
    return values.length ? Math.max(...values) : fallback
  }
  const k = SENSITIVITY[sensibilidad] ?? SENSITIVITY.normal
  return {
    total: Math.min(0.3, Math.max(0.1, spread('total', 0.15) * k)),
    nombre: Math.min(0.35, Math.max(0.08, spread('nombre', 0.15) * k))
  }
}

// Qué tan lejos está una frase de tus grabaciones: el promedio de las dos más parecidas
export function distanceTo(templates, frames) {
  const d = templates.map((t) => compare(t, frames)).sort((a, b) => a.total - b.total)
  if (!d.length) return { total: Infinity, nombre: Infinity }
  const best = d.slice(0, 2)
  const avg = (key) => best.reduce((sum, x) => sum + x[key], 0) / best.length
  return { total: avg('total'), nombre: avg('nombre') }
}

export function matches(distance, limit) {
  return distance.total <= limit.total && distance.nombre <= limit.nombre
}

// ───────────── Escuchar todo el tiempo ─────────────

// Corta el audio en frases cortas rodeadas de silencio. El nivel de ruido de la habitación se va
// ajustando solo, así con un ventilador o música bajita no cree que todo es voz.
export function createSegmenter({ onSegment, minMs = 300, maxMs = 2600, silenceMs = 350, preMs = 200 }) {
  const win = 320 // 20 ms
  let noise = 0.005
  let pending = new Float32Array(0)
  let current = null // { chunks, length, quietMs }
  let history = [] // lo último antes de que empiece la voz
  let historyLength = 0
  let tooLong = false // venía una charla larga: hasta que no haya un silencio de verdad, no se escucha
  let tooLongQuietMs = 0

  function handle(block) {
    let sum = 0
    for (const s of block) sum += s * s
    const rms = Math.sqrt(sum / block.length)
    const speech = rms > Math.max(0.012, noise * 3)
    // El ruido de fondo se mide solo cuando no hay voz
    if (!speech) noise = noise * 0.995 + rms * 0.005
    if (!current) {
      history.push(block)
      historyLength += block.length
      while (historyLength - history[0].length >= (preMs / 1000) * RATE) historyLength -= history.shift().length
      if (tooLong) {
        tooLongQuietMs = speech ? 0 : tooLongQuietMs + 20
        if (tooLongQuietMs >= silenceMs) tooLong = false
        return
      }
      if (!speech) return
      current = { chunks: [...history], length: historyLength, quietMs: 0, voiceMs: 0 }
      history = []
      historyLength = 0
      return
    }
    current.chunks.push(block)
    current.length += block.length
    if (speech) {
      current.quietMs = 0
      current.voiceMs += 20
    } else current.quietMs += 20
    const ms = (current.length / RATE) * 1000
    if (ms > maxMs + silenceMs) {
      // Habla larga (una charla, un video): se descarta y se espera a que haga silencio
      current = null
      tooLong = true
      tooLongQuietMs = 0
      return
    }
    if (current.quietMs >= silenceMs) {
      const voiceMs = current.voiceMs
      const all = new Float32Array(current.length)
      let off = 0
      for (const c of current.chunks) {
        all.set(c, off)
        off += c.length
      }
      current = null
      if (voiceMs >= minMs) onSegment(all)
    }
  }

  return {
    push(samples) {
      const joined = new Float32Array(pending.length + samples.length)
      joined.set(pending)
      joined.set(samples, pending.length)
      let i = 0
      for (; i + win <= joined.length; i += win) handle(joined.subarray(i, i + win))
      pending = joined.slice(i)
    },
    reset() {
      pending = new Float32Array(0)
      current = null
      history = []
      historyLength = 0
      tooLong = false
    },
    noise: () => noise
  }
}

// Junta todo: le pasás el audio y avisa cuando escucha la frase. templates: las huellas de tus grabaciones.
export function createWakeDetector({ templates, sensibilidad = 'normal', onWake, onCandidate = () => {} }) {
  const limit = limitFor(templates, sensibilidad)
  const segmenter = createSegmenter({
    onSegment: (samples) => {
      const voice = trimSilence(samples)
      if (voice.length < 0.3 * RATE) return
      const distance = distanceTo(templates, features(voice))
      const match = matches(distance, limit)
      onCandidate({ distance, limit, match })
      if (match) onWake({ distance, limit })
    }
  })
  return { push: segmenter.push, reset: segmenter.reset, limit }
}
