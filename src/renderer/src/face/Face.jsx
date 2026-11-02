import { useEffect, useRef } from 'react'
import { renderFace, WIDTH, HEIGHT } from './draw.js'
import { REACTIONS, IDLE_BY_FEELING, IDLE_BY_SCENE, compose, talking } from './animations.js'
import { renderStandby } from './standby.js'
import { drawScene, drawNightcap, PALETTE } from './props.js'

const SCALE = 2
const FOLLOW_MS = 4000 // sigue al mouse hasta 4 s después de que se deja de mover
const EXIT_MS = 280 // lo que tarda en sacarse un disfraz
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Fluidez: los números (hacia dónde mira, cuánto abre los ojos, los saltitos) no saltan de golpe:
// se acercan rápido al valor nuevo. Cada uno con su tiempo (ms): pestañear tiene que ser rápido.
const SMOOTH = { lookX: 70, lookY: 70, openL: 16, openR: 16, dx: 28, dy: 28 }
// Brillo que queda al apagarse un píxel, como una pantallita de LEDs (ms)
const GLOW_MS = 55

// mood: idle | listening | thinking | sleeping
// reaction: { type, id } — una animación de REACTIONS
// speech: { id, ms } — mueve la boca durante ms
// cursor: { x, y, at } — posición del mouse en la pantalla
// feeling: contento | normal | aburrido | cansado — cambia lo que hace cuando está solo
// standby: { mode: 'reloj' | 'resumen', weather } — en reposo muestra eso en vez de la cara
//          (la cara vuelve sola mientras habla o reacciona)
// scene: { escena, auris } — el disfraz según lo que estás haciendo (anteojos 3D, auriculares…)
export default function Face({ mood = 'idle', reaction = null, speech = null, cursor = null, feeling = 'normal', standby = null, scene = null }) {
  const canvasRef = useRef(null)
  const engine = useRef({ mood, moodStart: performance.now(), overlays: [], follow: null, feeling, standby, scene: null, prev: null })

  useEffect(() => {
    engine.current.standby = standby
  }, [standby])

  useEffect(() => {
    engine.current.feeling = feeling
  }, [feeling])

  useEffect(() => {
    const e = engine.current
    if (e.mood !== mood) {
      e.mood = mood
      e.moodStart = performance.now()
    }
  }, [mood])

  // Cambió lo que estás haciendo: se saca el disfraz anterior y se pone el nuevo
  const sceneName = scene?.escena ?? null
  const sceneAuris = Boolean(scene?.auris)
  useEffect(() => {
    const e = engine.current
    const now = performance.now()
    if ((e.scene?.name ?? null) === sceneName && (e.scene?.auris ?? false) === sceneAuris) return
    const changedName = (e.scene?.name ?? null) !== sceneName
    if (e.scene && changedName) e.prev = { ...e.scene, exitAt: now }
    e.scene = sceneName || sceneAuris ? { name: sceneName, auris: sceneAuris, start: changedName ? now + (e.prev ? EXIT_MS : 0) : (e.scene?.start ?? now) } : null
  }, [sceneName, sceneAuris])

  useEffect(() => {
    const def = reaction && REACTIONS[reaction.type]
    if (!def) return
    const e = engine.current
    e.overlays = e.overlays.filter((o) => o.kind !== 'reaction' && o.kind !== 'idle')
    e.overlays.push({ kind: 'reaction', duration: def[0], fn: def[1], start: performance.now() })
  }, [reaction])

  useEffect(() => {
    if (!speech) return
    const e = engine.current
    e.overlays = e.overlays.filter((o) => o.kind !== 'talk')
    e.overlays.unshift({ kind: 'talk', duration: speech.ms, fn: talking, start: performance.now() })
  }, [speech])

  // Mira hacia el mouse.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!cursor || !canvas) return
    const r = canvas.getBoundingClientRect()
    const cx = window.screenX + r.left + r.width / 2
    const cy = window.screenY + r.top + r.height / 2
    engine.current.follow = {
      at: cursor.at,
      look: {
        lookX: Math.round(clamp((cursor.x - cx) / 450, -1, 1) * 4) / 4,
        lookY: Math.round(clamp((cursor.y - cy) / 300, -1, 1) * 3) / 3
      }
    }
  }, [cursor])

  // Pestañeos, miradas y gestos al azar, como alguien que está vivo (y según lo que estás haciendo)
  useEffect(() => {
    let timer
    const next = () => {
      timer = setTimeout(() => {
        const e = engine.current
        const busy = e.overlays.some((o) => o.kind === 'reaction' || o.kind === 'idle')
        if (!busy && e.mood !== 'sleeping' && e.mood !== 'thinking') {
          const following = e.follow && Date.now() - e.follow.at < FOLLOW_MS
          const r = Math.random()
          let type = r < 0.18 ? 'doubleBlink' : 'blink'
          if (e.mood === 'idle' && !following && !e.scene?.name) {
            if (r < 0.12) type = 'glanceLeft'
            else if (r < 0.24) type = 'glanceRight'
            else if (r < 0.3) type = 'lookAround'
          }
          if (e.mood === 'idle') {
            const r2 = Math.random()
            const pool = e.scene?.name ? IDLE_BY_SCENE[e.scene.name] : IDLE_BY_FEELING[e.feeling]
            const special = (pool ?? []).find(([p]) => r2 < p)
            if (special) type = special[1]
          }
          const [duration, fn] = REACTIONS[type]
          e.overlays.push({ kind: 'idle', duration, fn, start: performance.now() })
        }
        next()
      }, 1600 + Math.random() * 3600)
    }
    next()
    return () => clearTimeout(timer)
  }, [])

  // Dibuja a 60 cuadros por segundo con suavizado y el brillo de los LEDs
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(canvas)
    const on = styles.getPropertyValue('--pixel').trim() || '#9cd3ff'
    const off = styles.getPropertyValue('--screen').trim() || '#04060a'
    const palette = PALETTE.map((c, i) => (i === 1 ? on : c))
    // Con "reducir movimiento" de Windows no salta ni tiembla, pero sigue pestañeando y gesticulando.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const glow = new Float32Array(WIDTH * HEIGHT)
    const color = new Uint8Array(WIDTH * HEIGHT)
    const shown = {}
    let last = performance.now()
    let raf = 0
    let quietFrames = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const e = engine.current
      const now = performance.now()
      const dt = Math.min(100, now - last)
      last = now
      e.overlays = e.overlays.filter((o) => now - o.start < o.duration)
      if (e.prev && now - e.prev.exitAt > EXIT_MS) e.prev = null
      const follow = e.follow && Date.now() - e.follow.at < FOLLOW_MS ? e.follow.look : null
      const target = compose(e.mood, e.moodStart, e.overlays, now, { still, follow, tired: e.feeling === 'cansado', scene: e.scene?.name ? e.scene : null })
      // Suavizado
      const params = { ...target }
      for (const [key, ms] of Object.entries(SMOOTH)) {
        const goal = target[key] ?? (key.startsWith('open') ? 1 : 0)
        shown[key] = shown[key] === undefined ? goal : shown[key] + (goal - shown[key]) * (1 - Math.exp(-dt / ms))
        if (Math.abs(shown[key] - goal) < 0.02) shown[key] = goal
        params[key] = shown[key]
      }
      const talkingNow = e.overlays.some((o) => o.kind === 'talk')
      const expressive = talkingNow || e.overlays.some((o) => o.kind === 'reaction')
      let bits = renderFace(params)
      if (e.standby?.mode && !expressive) {
        bits = renderStandby(e.standby.mode, bits, new Date(), e.standby.weather)
      } else if (e.mood === 'sleeping') {
        const h = new Date().getHours()
        if (h >= 22 || h < 7) drawNightcap(bits, params)
      } else {
        // Lo que tiene en la mano se ve tranquilo; mientras te escucha o habla, solo lo que lleva puesto
        const props = e.mood === 'idle' && !talkingNow
        if (e.prev) drawScene(bits, { name: e.prev.name, auris: e.prev.auris, t: now - e.prev.exitAt, exit: true, props }, params)
        if (e.scene && now >= e.scene.start) drawScene(bits, { name: e.scene.name, auris: e.scene.auris, t: now - e.scene.start, props }, params)
      }

      // Brillo: lo que se prende, se prende enseguida; lo que se apaga, se apaga de a poco
      const fade = Math.exp(-dt / GLOW_MS)
      let changed = false
      for (let i = 0; i < bits.length; i++) {
        const c = bits[i]
        if (c) {
          if (glow[i] !== 1 || color[i] !== c) changed = true
          glow[i] = 1
          color[i] = c
        } else if (glow[i] > 0) {
          glow[i] = glow[i] * fade < 0.04 ? 0 : glow[i] * fade
          changed = true
        }
      }
      // Si no cambió nada, no vuelve a dibujar (ahorra batería)
      if (!changed && quietFrames++ > 2) return
      if (changed) quietFrames = 0
      ctx.globalAlpha = 1
      ctx.fillStyle = off
      ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
      let fill = null
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const i = y * WIDTH + x
          const g = glow[i]
          if (!g) continue
          const c = palette[color[i]] ?? on
          if (c !== fill) {
            ctx.fillStyle = c
            fill = c
          }
          ctx.globalAlpha = g
          ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="screen"
      width={WIDTH * SCALE}
      height={HEIGHT * SCALE}
      aria-label="Cara de Pixie"
      role="img"
    />
  )
}
