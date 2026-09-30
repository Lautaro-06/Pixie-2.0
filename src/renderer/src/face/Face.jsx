import { useEffect, useRef } from 'react'
import { renderFace, WIDTH, HEIGHT } from './draw.js'
import { REACTIONS, IDLE_BY_FEELING, compose, talking } from './animations.js'

const SCALE = 2
const FOLLOW_MS = 4000 // sigue al mouse hasta 4 s después de que se deja de mover
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// mood: idle | listening | thinking | sleeping
// reaction: { type, id } — una animación de REACTIONS
// speech: { id, ms } — mueve la boca durante ms
// cursor: { x, y, at } — posición del mouse en la pantalla
// feeling: contento | normal | aburrido | cansado — cambia lo que hace cuando está solo
export default function Face({ mood = 'idle', reaction = null, speech = null, cursor = null, feeling = 'normal' }) {
  const canvasRef = useRef(null)
  const engine = useRef({ mood, moodStart: performance.now(), overlays: [], follow: null, lastKey: '', feeling })

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

  // Pestañeos y miradas al azar, como alguien que está vivo.
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
          if (e.mood === 'idle' && !following) {
            if (r < 0.12) type = 'glanceLeft'
            else if (r < 0.24) type = 'glanceRight'
            else if (r < 0.3) type = 'lookAround'
          }
          if (e.mood === 'idle') {
            const r2 = Math.random()
            const special = (IDLE_BY_FEELING[e.feeling] ?? []).find(([p]) => r2 < p)
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

  // Dibuja unas 30 veces por segundo, solo si la cara cambió.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(canvas)
    const on = styles.getPropertyValue('--pixel').trim() || '#9cd3ff'
    const off = styles.getPropertyValue('--screen').trim() || '#04060a'
    // Con "reducir movimiento" de Windows no salta ni tiembla, pero sigue pestañeando y gesticulando.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const tick = () => {
      const e = engine.current
      const now = performance.now()
      e.overlays = e.overlays.filter((o) => now - o.start < o.duration)
      const follow = e.follow && Date.now() - e.follow.at < FOLLOW_MS ? e.follow.look : null
      const bits = renderFace(compose(e.mood, e.moodStart, e.overlays, now, { still, follow, tired: e.feeling === 'cansado' }))
      const key = bits.join('')
      if (key === e.lastKey) return
      e.lastKey = key
      ctx.fillStyle = off
      ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
      ctx.fillStyle = on
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          if (bits[y * WIDTH + x]) ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)
        }
      }
    }
    tick()
    const id = setInterval(tick, 33)
    return () => clearInterval(id)
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
