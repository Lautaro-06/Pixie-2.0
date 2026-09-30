import { useEffect, useRef, useState } from 'react'
import { newGame, step, renderPong, renderMorph, PADDLE_H } from './pong.js'
import { renderFace, WIDTH, HEIGHT } from '../face/draw.js'
import { REACTIONS } from '../face/animations.js'

const SCALE = 5
const MORPH_MS = 700
const KEY_SPEED = 0.045 // píxeles por ms con las flechas

const LAUGHS = ['¡Jajaja!', '¡Jajaja, te la gané!', '¡Ja! Muy lenta esa.', '¡Jiji, punto para mí!']
const CHEERS = ['¡Uh, bien ahí!', '¡Qué tiro!', 'Ok, esa fue buena.', '¡No la vi venir!']
const pick = (list) => list[Math.floor(Math.random() * list.length)]

// Pong contra Pixie. say(text, face) muestra/lee un mensaje; onExit(winner) vuelve a la cara.
export default function PongGame({ say, onExit }) {
  const canvasRef = useRef(null)
  const [message, setMessage] = useState('Movés la paleta de la izquierda con el mouse o las flechas ↑ ↓. ¡A 3 puntos!')
  const [finished, setFinished] = useState(null) // 'user' | 'pixie'
  const state = useRef(null)

  const reset = () => {
    state.current = {
      game: newGame(),
      stage: 'morphIn', // morphIn | play | face | end | morphOut
      stageStart: performance.now(),
      face: null, // { reaction, until }
      target: (HEIGHT - PADDLE_H) / 2,
      keys: { up: false, down: false },
      last: performance.now()
    }
    setFinished(null)
  }

  if (!state.current) reset()

  const talk = (text, face) => {
    setMessage(text)
    say?.(text, face)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(canvas)
    const on = styles.getPropertyValue('--pixel').trim() || '#9cd3ff'
    const off = styles.getPropertyValue('--screen').trim() || '#04060a'
    let raf = 0

    const paint = (bits) => {
      ctx.fillStyle = off
      ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
      ctx.fillStyle = on
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) if (bits[y * WIDTH + x]) ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)
      }
    }

    const frame = (now) => {
      const s = state.current
      const dt = Math.min(40, now - s.last)
      s.last = now
      const since = now - s.stageStart

      if (s.stage === 'morphIn') {
        paint(renderMorph(since / MORPH_MS))
        if (since >= MORPH_MS) Object.assign(s, { stage: 'play', stageStart: now })
      } else if (s.stage === 'morphOut') {
        paint(renderMorph(1 - since / MORPH_MS))
        if (since >= MORPH_MS) {
          onExit?.(s.game.winner)
          return
        }
      } else if (s.stage === 'face' || s.stage === 'end') {
        const [duration, fn] = REACTIONS[s.face.reaction]
        paint(renderFace(fn(Math.min(since, duration - 1))))
        if (s.stage === 'face' && since >= s.face.hold) Object.assign(s, { stage: 'play', stageStart: now })
      } else {
        if (s.keys.up) s.target -= KEY_SPEED * dt
        if (s.keys.down) s.target += KEY_SPEED * dt
        s.target = Math.max(0, Math.min(HEIGHT - PADDLE_H, s.target))
        const { game, events } = step(s.game, dt, { userY: s.target })
        s.game = game
        paint(renderPong(game))
        const score = `${game.score.user} a ${game.score.pixie}`
        if (events.includes('fin')) {
          const userWon = game.winner === 'user'
          s.face = { reaction: userWon ? 'love' : 'laugh' }
          Object.assign(s, { stage: 'end', stageStart: now })
          setFinished(game.winner)
          talk(
            userWon
              ? `¡Me ganaste ${game.score.user} a ${game.score.pixie}! Sos un crack, te felicito.`
              : `¡Jajaja, te gané ${game.score.pixie} a ${game.score.user}! ¿La revancha?`,
            userWon ? 'love' : 'laugh'
          )
        } else if (events.includes('punto_pixie')) {
          s.face = { reaction: 'laugh', hold: 1300 }
          Object.assign(s, { stage: 'face', stageStart: now })
          talk(`${pick(LAUGHS)} Vamos ${score}.`, 'laugh')
        } else if (events.includes('punto_usuario')) {
          s.face = { reaction: 'surprised', hold: 1100 }
          Object.assign(s, { stage: 'face', stageStart: now })
          talk(`${pick(CHEERS)} Vamos ${score}.`, 'surprised')
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onExit])

  // Controles: mouse sobre la pantalla o flechas / W S
  useEffect(() => {
    const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' }
    const down = (e) => {
      if (e.key === 'Escape') {
        exit()
        return
      }
      const k = keyMap[e.key]
      if (k) {
        e.preventDefault()
        state.current.keys[k] = true
      }
    }
    const up = (e) => {
      const k = keyMap[e.key]
      if (k) state.current.keys[k] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  function onMouseMove(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const gridY = ((e.clientY - r.top) / r.height) * HEIGHT
    state.current.target = gridY - PADDLE_H / 2
  }

  function exit() {
    const s = state.current
    if (s.stage === 'morphOut') return
    Object.assign(s, { stage: 'morphOut', stageStart: performance.now() })
  }

  function rematch() {
    reset()
    talk('¡Revancha! Esta vez no te la dejo fácil.', 'happy')
  }

  return (
    <div className="game">
      <div className="game-bubble" aria-live="polite">
        <p>{message}</p>
        <div className="chips">
          {finished && (
            <button type="button" className="chip" onClick={rematch}>
              Revancha
            </button>
          )}
          <button type="button" className="chip" onClick={exit}>
            {finished ? 'Salir' : 'Salir (Esc)'}
          </button>
        </div>
      </div>
      <div className="game-screen">
        <canvas
          ref={canvasRef}
          className="screen big"
          width={WIDTH * SCALE}
          height={HEIGHT * SCALE}
          onMouseMove={onMouseMove}
          aria-label="Pong contra Pixie"
          role="img"
        />
      </div>
    </div>
  )
}
