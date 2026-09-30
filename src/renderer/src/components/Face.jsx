import { useEffect, useMemo, useRef } from 'react'
import { FACES } from '../faces.js'

const BLINK = ['blink1', 'blink2', 'blink3', 'blink4', 'blink3', 'blink2', 'blink1', 'open']

// Animaciones de reacción: [cuadros, ms por cuadro, ms que se queda en el último]
const REACTIONS = {
  happy: [[...BLINK, ...BLINK], 28, 0],
  confused: [['angry1', 'angry2', 'angry1', 'angry2', 'angry1'], 110, 900],
  alarm: [Array.from({ length: 14 }, (_, i) => (i % 2 ? 'blink4' : 'open')), 120, 0]
}

function decode(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

// La cara de Pixie: 64x32 px dibujados al doble, como en la pantallita del ESP32.
export default function Face({ thinking = false, reaction = null }) {
  const canvasRef = useRef(null)
  const lastReaction = useRef(null)
  const frames = useMemo(
    () => Object.fromEntries(Object.entries(FACES).map(([name, hex]) => [name, decode(hex)])),
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(canvas)
    const on = styles.getPropertyValue('--pixel').trim() || '#9cd3ff'
    const off = styles.getPropertyValue('--screen').trim() || '#04060a'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))

    const draw = (name) => {
      const bits = frames[name]
      ctx.fillStyle = off
      ctx.fillRect(0, 0, 128, 64)
      ctx.fillStyle = on
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 64; x++) {
          if ((bits[y * 8 + (x >> 3)] >> (7 - (x & 7))) & 1) ctx.fillRect(x * 2, y * 2, 2, 2)
        }
      }
    }

    const play = (sequence, step, hold, done) => {
      sequence.forEach((name, i) => later(() => draw(name), i * step))
      later(done, sequence.length * step + hold)
    }

    const idle = () => {
      draw('open')
      if (reduceMotion) return
      later(() => play(BLINK, 30, 0, idle), 2500 + Math.random() * 3500)
    }

    if (thinking) {
      draw('blink2')
    } else if (reaction && reaction.id !== lastReaction.current) {
      lastReaction.current = reaction.id
      const [sequence, step, hold] = REACTIONS[reaction.type] ?? REACTIONS.happy
      if (reduceMotion) {
        draw(sequence[0])
        later(idle, 800)
      } else {
        play(sequence, step, hold, idle)
      }
    } else {
      idle()
    }
    return () => timers.forEach(clearTimeout)
  }, [thinking, reaction, frames])

  return <canvas ref={canvasRef} className="screen" width="128" height="64" aria-label="Cara de Pixie" role="img" />
}
