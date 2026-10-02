import { useCallback, useEffect, useRef, useState } from 'react'
import Face from './face/Face.jsx'
import PongGame from './games/PongGame.jsx'
import { api, isPreview } from './api.js'
import { speak, stopSpeaking, beep, hasSpanishVoice, onVoicesReady, setNaturalVoice, isSpeaking } from './voice.js'
import { playSound, hasSound } from './sounds.js'
import { listen } from './audio.js'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const STARTERS = ['buen día', '¿qué tengo esta semana?', 'anotá comprar cartuchos', 'contame un chiste']
const SLEEP_AFTER_MS = 2 * 60 * 1000 // se duerme si no lo usás un rato
const SLEEP_WHEN_TIRED_MS = 45 * 1000
const WAKE_DISTANCE = 140 // se despierta si acercás el mouse
const COLLAPSE_AFTER_BLUR_MS = 10 * 1000 // si usás otra ventana, se achica cuando termina y pasa este rato

function loadPref(key) {
  try {
    return localStorage.getItem(key) !== 'no'
  } catch {
    return true
  }
}

function savePref(key, on) {
  try {
    localStorage.setItem(key, on ? 'si' : 'no')
  } catch {
    // sin almacenamiento: la preferencia dura hasta cerrar la app
  }
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [reply, setReply] = useState(null) // { text, confirm, suggestions }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [reaction, setReaction] = useState(null)
  const [speech, setSpeech] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [asleep, setAsleep] = useState(false)
  const [voiceOn, setVoiceOn] = useState(() => loadPref('pixie.voz'))
  const [soundsOn, setSoundsOn] = useState(() => loadPref('pixie.sonidos'))
  const [booting, setBooting] = useState(true) // animación al arrancar
  const [voiceAvailable, setVoiceAvailable] = useState(hasSpanishVoice)
  const [shortcut, setShortcut] = useState('Ctrl+Espacio')
  const [notice, setNotice] = useState(null) // aviso que Pixie da por su cuenta
  const [feeling, setFeeling] = useState('normal')
  const [game, setGame] = useState(null) // 'pong' mientras se juega
  const [listening, setListening] = useState(false) // grabando lo que decís
  const [micLevel, setMicLevel] = useState(0)
  const [youSaid, setYouSaid] = useState(null) // lo que Pixie entendió de tu voz
  const [voiceShortcut, setVoiceShortcut] = useState(null)
  const inputRef = useRef(null)
  const faceRef = useRef(null)
  const history = useRef([])
  const historyPos = useRef(-1)
  const lastActivity = useRef(Date.now())
  const asleepRef = useRef(false)
  const expandedRef = useRef(false)
  const gameRef = useRef(null)
  const noticeTimer = useRef(null)
  const recording = useRef(null)
  const busyRef = useRef(false)
  const listeningRef = useRef(false)
  const replyRef = useRef(null)
  busyRef.current = busy
  listeningRef.current = listening
  replyRef.current = reply
  const startListeningRef = useRef(() => {})

  const soundsRef = useRef(soundsOn)
  soundsRef.current = soundsOn
  const sound = useCallback((name) => {
    if (soundsRef.current && hasSound(name)) playSound(name)
  }, [])

  // Reacción de la cara, con su sonido
  const react = useCallback((type) => {
    setReaction({ type, id: Date.now() + Math.random() })
    sound(type)
  }, [sound])

  // Al arrancar: aparece con un salto, abre los ojos y hace su sonidito
  useEffect(() => {
    const wakeUp = setTimeout(() => react('boot'), 250)
    const done = setTimeout(() => setBooting(false), 1000)
    return () => {
      clearTimeout(wakeUp)
      clearTimeout(done)
    }
  }, [react])

  const wake = useCallback(() => {
    lastActivity.current = Date.now()
    if (asleepRef.current) {
      asleepRef.current = false
      setAsleep(false)
      react('wake')
    }
  }, [react])

  const show = useCallback((result) => {
    if (result.game) {
      // Pixie transforma su cara en el juego
      setExpanded(false)
      setNotice(null)
      setGame(result.game)
    }
    setReply(result)
    if (result.face && result.face !== 'idle') react(result.face)
    const talkingVoice = voiceOn && voiceAvailable && result.speak !== false
    const perChar = talkingVoice ? 62 : 28
    setSpeech({ id: Date.now(), ms: Math.min(6000, Math.max(500, result.text.length * perChar)) })
    if (result.speak === false) stopSpeaking()
    else if (voiceOn) speak(result.text, result.face)
  }, [react, voiceOn, voiceAvailable])

  const open = useCallback(() => {
    wake()
    clearTimeout(noticeTimer.current)
    setNotice(null)
    setExpanded(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [wake])

  // Se achica pero sigue hablando; la última respuesta queda en el globito de arriba
  const minimize = useCallback(() => {
    lastActivity.current = Date.now()
    setExpanded(false)
    const last = replyRef.current
    if (last?.text) {
      setNotice({ text: last.text, suggestions: last.confirm ? ['sí', 'no'] : last.suggestions })
      clearTimeout(noticeTimer.current)
      noticeTimer.current = setTimeout(() => setNotice(null), Math.max(8000, last.text.length * 90))
    }
  }, [])

  const close = useCallback(() => {
    lastActivity.current = Date.now()
    setExpanded(false)
    stopSpeaking()
  }, [])

  // La ventana cambia de tamaño según el modo.
  useEffect(() => {
    expandedRef.current = expanded
    api.setMode(game ? 'game' : expanded ? 'expanded' : notice ? 'notice' : 'compact')
    if (expanded) inputRef.current?.focus()
  }, [expanded, notice, game])

  // Mensajes de Pixie durante el juego (con voz si está activada)
  const sayInGame = useCallback((text) => {
    if (voiceOn) speak(text)
  }, [voiceOn])

  const endGame = useCallback((winner) => {
    setGame(null)
    lastActivity.current = Date.now()
    if (winner) api.gameResult?.({ juego: 'pong', ganador: winner })
    react(winner === 'user' ? 'love' : 'happy')
  }, [react])

  useEffect(() => {
    api.info().then((info) => {
      setShortcut(info.shortcut)
      setVoiceShortcut(info.voiceShortcut ?? null)
      setNaturalVoice(info.naturalVoice)
      setVoiceAvailable(hasSpanishVoice())
      if (info.feeling) setFeeling(info.feeling)
    }).catch(() => {})
    const stopVoices = onVoicesReady(() => setVoiceAvailable(hasSpanishVoice()))
    const stopEvents = api.onEvent((event) => {
      if (event.type === 'open' && !gameRef.current) open()
      if (event.type === 'listen' && !gameRef.current) startListeningRef.current()
      if (event.type === 'cursor') {
        setCursor({ x: event.x, y: event.y, at: Date.now() })
        const r = faceRef.current?.getBoundingClientRect()
        if (r && asleepRef.current) {
          const dx = event.x - (window.screenX + r.left + r.width / 2)
          const dy = event.y - (window.screenY + r.top + r.height / 2)
          if (Math.hypot(dx, dy) < WAKE_DISTANCE) wake()
        }
      }
      if (event.type === 'feeling') setFeeling(event.feeling)
      if (event.type === 'presence') {
        if (event.away) {
          asleepRef.current = true
          setAsleep(true)
        } else {
          wake()
        }
      }
      // Pixie habla por su cuenta: aparece arriba de la cara sin sacarte el teclado
      if (event.type === 'notice') {
        wake()
        if (expandedRef.current) {
          setReply({ text: event.text, suggestions: event.suggestions })
        } else {
          setNotice({ text: event.text, suggestions: event.suggestions })
          clearTimeout(noticeTimer.current)
          noticeTimer.current = setTimeout(() => setNotice(null), Math.max(8000, event.text.length * 90))
        }
        if (event.face && event.face !== 'idle') react(event.face)
        else sound('notice')
        setSpeech({ id: Date.now(), ms: Math.min(6000, Math.max(600, event.text.length * 45)) })
        if (voiceOn && event.voice !== false) speak(event.text, event.face)
      }
      if (event.type === 'alarm') {
        open()
        setReply({ text: event.text, suggestions: event.suggestions })
        react('alarm')
        beep()
        setSpeech({ id: Date.now(), ms: 2500 })
        if (voiceOn) setTimeout(() => speak(event.text), 900)
      }
    })
    return () => {
      stopVoices()
      stopEvents()
    }
  }, [open, react, sound, voiceOn, wake])

  // Si no lo usás por un rato, se duerme.
  useEffect(() => {
    const id = setInterval(() => {
      const after = feeling === 'cansado' ? SLEEP_WHEN_TIRED_MS : SLEEP_AFTER_MS
      if (!expanded && !notice && !game && !asleepRef.current && Date.now() - lastActivity.current > after) {
        asleepRef.current = true
        setAsleep(true)
      }
    }, 5000)
    return () => clearInterval(id)
  }, [expanded, notice, feeling, game])

  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Si hacés clic en otra ventana, Pixie no se calla: termina lo que está haciendo
  // (pensar, escuchar o hablar) y recién un rato después se achica.
  useEffect(() => {
    if (isPreview) return
    let timer = null
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (document.hasFocus() || gameRef.current || !expandedRef.current) return
        if (busyRef.current || listeningRef.current || isSpeaking()) return later()
        minimize()
      }, COLLAPSE_AFTER_BLUR_MS)
    }
    const onFocus = () => clearTimeout(timer)
    window.addEventListener('blur', later)
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('blur', later)
      window.removeEventListener('focus', onFocus)
    }
  }, [minimize])

  const mood = busy ? 'thinking' : expanded ? 'listening' : asleep ? 'sleeping' : 'idle'

  async function send(text, { spoken = false } = {}) {
    const clean = text.trim()
    if (!clean || busy) return
    if (!spoken) setYouSaid(null)
    lastActivity.current = Date.now()
    history.current = [clean, ...history.current.filter((h) => h !== clean)].slice(0, 30)
    historyPos.current = -1
    setInput('')
    setBusy(true)
    try {
      show(await api.ask(clean))
    } catch {
      show({ text: 'Algo falló adentro mío. Probá de nuevo.', face: 'confused' })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  async function answer(yes) {
    setBusy(true)
    try {
      show(await api.confirm(yes))
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  // Hablarle: graba hasta que dejás de hablar, la IA lo pasa a texto y se manda solo
  async function startListening() {
    if (listening || busy) return
    open()
    stopSpeaking()
    if (!api.transcribe) {
      show({ text: 'La voz anda en la app de escritorio.', face: 'confused' })
      return
    }
    let rec
    try {
      rec = await listen({ onLevel: setMicLevel })
    } catch {
      show({ text: 'No pude usar el micrófono. Fijate en Configuración de Windows → Privacidad → Micrófono que las apps de escritorio tengan permiso.', face: 'confused' })
      return
    }
    recording.current = rec
    setListening(true)
    sound('wake')
    const { wav, heard } = await rec.done
    recording.current = null
    setListening(false)
    setMicLevel(0)
    if (!wav) {
      if (!heard) show({ text: 'No te escuché. Tocá el micrófono y hablame.', face: 'confused' })
      return
    }
    setBusy(true)
    let result
    try {
      result = await api.transcribe(wav)
    } catch {
      result = { error: 'Algo falló adentro mío. Probá de nuevo.' }
    }
    setBusy(false)
    if (result.error) return show({ text: result.error, face: 'confused' })
    if (!result.text) return show({ text: 'No te entendí bien. ¿Me lo repetís?', face: 'confused' })
    setYouSaid(result.text)
    send(result.text, { spoken: true })
  }
  startListeningRef.current = startListening

  function stopListening(keep = true) {
    if (keep) recording.current?.stop()
    else recording.current?.cancel()
  }

  function onKeyDown(e) {
    if (game) return // el juego maneja sus teclas
    if (e.key === 'Escape' && listening) {
      e.preventDefault()
      stopListening(false)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const list = history.current
      if (!list.length) return
      e.preventDefault()
      const next = e.key === 'ArrowUp'
        ? Math.min(historyPos.current + 1, list.length - 1)
        : Math.max(historyPos.current - 1, -1)
      historyPos.current = next
      setInput(next === -1 ? '' : list[next])
    }
  }

  function toggleVoice() {
    const next = !voiceOn
    setVoiceOn(next)
    if (!next) stopSpeaking()
    savePref('pixie.voz', next)
  }

  function toggleSounds() {
    const next = !soundsOn
    setSoundsOn(next)
    savePref('pixie.sonidos', next)
    if (next) playSound('happy')
  }

  const chips = reply?.suggestions ?? (reply ? null : STARTERS)

  if (game === 'pong') {
    return (
      <div className="pixie is-game">
        <PongGame say={sayInGame} onExit={endGame} />
      </div>
    )
  }

  return (
    <div className={`pixie ${expanded ? 'is-expanded' : 'is-compact'}${booting ? ' is-booting' : ''}`} onKeyDown={onKeyDown}>
      {expanded && (
        <section className="panel" aria-label="Hablar con Pixie">
          <button type="button" className="close" aria-label="Achicar (sigue hablando)" title="Achicar" onClick={minimize}>
            ×
          </button>
          <div className="bubble" aria-live="polite">
            {youSaid && !listening && <p className="said">«{youSaid}»</p>}
            {listening ? (
              <div className="listening">
                <p>Te escucho…</p>
                <div className="meter" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.min(1, micLevel * 12)})` }} />
                </div>
              </div>
            ) : busy ? (
              <p className="muted">Pensando…</p>
            ) : (
              <p>{reply?.text ?? 'Hola, soy Pixie. ¿Qué necesitás?'}</p>
            )}
            {reply?.confirm && !busy && !listening && (
              <div className="confirm">
                <button type="button" className="primary" onClick={() => answer(true)}>Sí, dale</button>
                <button type="button" onClick={() => answer(false)}>No</button>
              </div>
            )}
            {chips && !busy && !listening && (
              <div className="chips">
                {chips.map((c) => (
                  <button key={c} type="button" className="chip" onClick={() => send(c)}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              ref={inputRef}
              id="pixie-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pedile algo a Pixie…"
              autoComplete="off"
              spellCheck="false"
              maxLength={500}
            />
            <button
              type="button"
              className={`mic${listening ? ' on' : ''}`}
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={busy}
              aria-label={listening ? 'Dejar de escuchar' : 'Hablarle'}
              title={listening ? 'Listo' : voiceShortcut ? `Hablarle (${voiceShortcut})` : 'Hablarle'}
            >
              <MicIcon />
            </button>
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>
          <div className="footer">
            <button type="button" className="link" onClick={toggleVoice} title={voiceAvailable ? '' : 'Windows no tiene una voz en español instalada'}>
              {voiceAvailable ? (voiceOn ? 'Voz: sí' : 'Voz: no') : 'Sin voz en español'}
            </button>
            <button type="button" className="link" onClick={toggleSounds}>
              {soundsOn ? 'Sonidos: sí' : 'Sonidos: no'}
            </button>
            <span>{voiceShortcut ? `${voiceShortcut}: hablar` : 'Esc para cerrar'}</span>
          </div>
        </section>
      )}

      {!expanded && notice && (
        <section className="notice" aria-live="polite" onClick={open}>
          <p>{notice.text}</p>
          {notice.suggestions && (
            <div className="chips">
              {notice.suggestions.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  onClick={(e) => {
                    e.stopPropagation()
                    open()
                    send(c)
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="close"
            aria-label="Cerrar aviso"
            onClick={(e) => {
              e.stopPropagation()
              setNotice(null)
            }}
          >
            ×
          </button>
        </section>
      )}

      <div className="face" ref={faceRef} title="Arrastrame para moverme">
        <Face mood={mood} reaction={reaction} speech={speech} cursor={cursor} feeling={feeling} />
      </div>

      {!expanded && !notice && (
        <button type="button" className="talk" onClick={open}>
          {shortcut}
        </button>
      )}
    </div>
  )
}
