// Animaciones de Pixie. Todo es una función del tiempo (ms) que devuelve
// parámetros para renderFace, así se pueden combinar y probar.

// Interpola entre cuadros clave: los números se suavizan, el resto cambia de golpe.
export function keyframes(t, frames) {
  if (t <= frames[0][0]) return { ...frames[0][1] }
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, a] = frames[i]
    const [t1, b] = frames[i + 1]
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0)
      const out = {}
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const va = a[key]
        const vb = b[key]
        if (typeof va === 'number' && typeof vb === 'number') out[key] = va + (vb - va) * k
        else out[key] = k < 1 && va !== undefined ? va : vb
      }
      return out
    }
  }
  return { ...frames[frames.length - 1][1] }
}

const loop = (t, period) => (t % period) / period
const shake = (t, every = 80) => (Math.floor(t / every) % 2 ? 1 : -1)

// Estados que duran mientras estén activos.
export const MOODS = {
  idle: () => ({}),
  listening: () => ({ lookX: -0.5, lookY: -0.4 }),
  thinking: (t) => ({ lookX: 0.5, lookY: -1, openL: 0.8, openR: 0.8, mouth: 'none', extra: 'dots', extraT: loop(t, 1400) }),
  sleeping: (t) => ({
    openL: 0.06,
    openR: 0.06,
    lookY: 0.6,
    mouth: 'flat',
    extra: 'zzz',
    extraT: loop(t, 2600),
    dy: Math.round(Math.sin(t / 900))
  })
}

// Animaciones de una sola vez: [duración en ms, función del tiempo].
export const REACTIONS = {
  blink: [170, (t) => keyframes(t, [[0, { openL: 1, openR: 1 }], [70, { openL: 0, openR: 0 }], [170, { openL: 1, openR: 1 }]])],
  doubleBlink: [440, (t) => keyframes(t, [
    [0, { openL: 1, openR: 1 }], [70, { openL: 0, openR: 0 }], [170, { openL: 1, openR: 1 }],
    [270, { openL: 1, openR: 1 }], [340, { openL: 0, openR: 0 }], [440, { openL: 1, openR: 1 }]
  ])],
  glanceLeft: [1250, (t) => keyframes(t, [[0, { lookX: 0 }], [140, { lookX: -1 }], [1100, { lookX: -1 }], [1250, { lookX: 0 }]])],
  glanceRight: [1250, (t) => keyframes(t, [[0, { lookX: 0 }], [140, { lookX: 1 }], [1100, { lookX: 1 }], [1250, { lookX: 0 }]])],
  lookAround: [2200, (t) => keyframes(t, [
    [0, { lookX: 0, lookY: 0 }], [150, { lookX: -1, lookY: -0.3 }], [800, { lookX: -1, lookY: -0.3 }],
    [1000, { lookX: 1, lookY: -0.3 }], [1700, { lookX: 1, lookY: -0.3 }], [2200, { lookX: 0, lookY: 0 }]
  ])],
  happy: [1300, (t) => ({
    eyes: 'happy',
    mouth: 'smile',
    dy: keyframes(t, [[0, { dy: 0 }], [120, { dy: -2 }], [240, { dy: 0 }], [360, { dy: -2 }], [480, { dy: 0 }]]).dy
  })],
  love: [1800, (t) => ({ eyes: 'heart', mouth: 'smile', dy: Math.floor(t / 250) % 2 ? -1 : 0 })],
  wink: [800, (t) => ({
    ...keyframes(t, [[0, { openR: 1 }], [80, { openR: 0 }], [600, { openR: 0 }], [700, { openR: 1 }]]),
    mouth: 'smile'
  })],
  confused: [1800, (t) => ({
    extra: 'question',
    mouth: 'flat',
    brow: 'sad',
    ...keyframes(t, [[0, { lookX: 0 }], [200, { lookX: -0.7 }], [700, { lookX: -0.7 }], [900, { lookX: 0.7 }], [1500, { lookX: 0.7 }], [1800, { lookX: 0 }]])
  })],
  angry: [1500, (t) => ({ brow: 'angry', mouth: 'frown', dx: t < 480 ? shake(t) : 0 })],
  sad: [2200, (t) => ({
    brow: 'sad',
    mouth: 'frown',
    ...keyframes(t, [[0, { lookY: 0, openL: 1, openR: 1 }], [300, { lookY: 0.8, openL: 0.75, openR: 0.75 }]])
  })],
  surprised: [1000, (t) => ({ eyes: 'wide', mouth: 'o', dy: t < 150 ? -2 : 0 })],
  alarm: [2600, (t) => ({ eyes: 'wide', mouth: 'o', extra: 'exclaim', dx: t < 2000 ? shake(t) : 0, dy: t < 2000 ? (Math.floor(t / 160) % 2 ? -1 : 0) : 0 })],
  music: [2600, (t) => ({ eyes: 'happy', mouth: 'smile', extra: 'notes', extraT: loop(t, 1300), dy: Math.floor(t / 300) % 2 ? -1 : 0 })],
  // Al arrancar: ojos cerrados, se abren grandes y sonríe
  boot: [1700, (t) => ({
    ...keyframes(t, [[0, { openL: 0, openR: 0 }], [350, { openL: 0, openR: 0 }], [600, { openL: 1, openR: 1 }]]),
    eyes: t < 1000 ? 'wide' : 'happy',
    mouth: t < 600 ? 'none' : t < 1000 ? 'o' : 'smile',
    dy: t > 1000 && t < 1300 ? -1 : 0
  })],
  wake: [900, (t) => keyframes(t, [[0, { openL: 0.1, openR: 0.1, eyes: 'wide' }], [200, { openL: 1, openR: 1, eyes: 'wide' }], [900, { openL: 1, openR: 1, eyes: 'normal' }]])],
  // Según cómo se siente
  yawn: [1800, (t) => ({
    ...keyframes(t, [[0, { openL: 1, openR: 1 }], [300, { openL: 0.3, openR: 0.3 }], [1400, { openL: 0.3, openR: 0.3 }], [1800, { openL: 1, openR: 1 }]]),
    mouth: t > 200 && t < 1500 ? 'o' : 'small',
    dy: t > 300 && t < 1400 ? -1 : 0
  })],
  sigh: [1600, (t) => ({
    brow: 'sad',
    mouth: 'flat',
    ...keyframes(t, [[0, { lookY: 0, openL: 1, openR: 1 }], [400, { lookY: 0.8, openL: 0.7, openR: 0.7 }], [1200, { lookY: 0.8, openL: 0.7, openR: 0.7 }], [1600, { lookY: 0, openL: 1, openR: 1 }]])
  })],
  wiggle: [900, (t) => ({ eyes: t < 450 ? 'happy' : 'normal', dx: Math.round(Math.sin(t / 70)), dy: t % 300 < 150 ? -1 : 0 })],
  // Jajaja: ojos felices, boca que se abre y se cierra, saltitos
  laugh: [1600, (t) => ({ eyes: 'happy', mouth: Math.floor(t / 120) % 2 ? 'o' : 'talk', dy: Math.floor(t / 120) % 2 ? -1 : 0 })]
}

// Qué hace solo, de vez en cuando, según cómo se siente.
export const IDLE_BY_FEELING = {
  contento: [[0.15, 'wiggle'], [0.25, 'happy']],
  aburrido: [[0.2, 'sigh'], [0.3, 'lookAround']],
  cansado: [[0.3, 'yawn']],
  normal: []
}

// Boca que se mueve mientras Pixie "habla".
export function talking(t) {
  const step = Math.floor(t / 110)
  return { mouth: step % 3 === 1 ? 'small' : step % 2 ? 'o' : 'talk' }
}

// Combina el estado de ánimo con las animaciones activas.
// overlays: [{ fn, start, duration }] en orden; las últimas mandan.
export function compose(mood, moodStart, overlays, now, { still = false, follow = null, tired = false } = {}) {
  const base = MOODS[mood] ?? MOODS.idle
  const params = { ...base(now - moodStart) }
  if (mood === 'idle' && follow) Object.assign(params, follow)
  if (tired && mood !== 'sleeping') {
    params.openL = Math.min(params.openL ?? 1, 0.75)
    params.openR = Math.min(params.openR ?? 1, 0.75)
  }
  for (const o of overlays) Object.assign(params, o.fn(now - o.start))
  if (still) {
    params.dx = 0
    params.dy = 0
  }
  return params
}
