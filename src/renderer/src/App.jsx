import { useCallback, useEffect, useRef, useState } from 'react'
import Face from './face/Face.jsx'
import { api, isPreview } from './api.js'
import { speak, stopSpeaking, beep, hasSpanishVoice, onVoicesReady } from './voice.js'

const STARTERS = ['buen día', '¿qué tengo esta semana?', 'anotá comprar cartuchos', 'contame un chiste']
const SLEEP_AFTER_MS = 2 * 60 * 1000 // se duerme si no lo usás un rato
const SLEEP_WHEN_TIRED_MS = 45 * 1000
const WAKE_DISTANCE = 140 // se despierta si acercás el mouse

function loadVoicePref() {
  try {
    return localStorage.getItem('pixie.voz') !== 'no'
  } catch {
    return true
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
  const [voiceOn, setVoiceOn] = useState(loadVoicePref)
  const [voiceAvailable, setVoiceAvailable] = useState(hasSpanishVoice)
  const [shortcut, setShortcut] = useState('Ctrl+Espacio')
  const [notice, setNotice] = useState(null) // aviso que Pixie da por su cuenta
  const [feeling, setFeeling] = useState('normal')
  const inputRef = useRef(null)
  const faceRef = useRef(null)
  const history = useRef([])
  const historyPos = useRef(-1)
  const lastActivity = useRef(Date.now())
  const asleepRef = useRef(false)
  const expandedRef = useRef(false)
  const noticeTimer = useRef(null)

  const react = useCallback((type) => setReaction({ type, id: Date.now() + Math.random() }), [])

  const wake = useCallback(() => {
    lastActivity.current = Date.now()
    if (asleepRef.current) {
      asleepRef.current = false
      setAsleep(false)
      react('wake')
    }
  }, [react])

  const show = useCallback((result) => {
    setReply(result)
    if (result.face && result.face !== 'idle') react(result.face)
    const talkingVoice = voiceOn && voiceAvailable && result.speak !== false
    const perChar = talkingVoice ? 62 : 28
    setSpeech({ id: Date.now(), ms: Math.min(6000, Math.max(500, result.text.length * perChar)) })
    if (result.speak === false) stopSpeaking()
    else if (voiceOn) speak(result.text)
  }, [react, voiceOn, voiceAvailable])

  const open = useCallback(() => {
    wake()
    clearTimeout(noticeTimer.current)
    setNotice(null)
    setExpanded(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [wake])

  const close = useCallback(() => {
    lastActivity.current = Date.now()
    setExpanded(false)
    stopSpeaking()
  }, [])

  // La ventana cambia de tamaño según el modo.
  useEffect(() => {
    expandedRef.current = expanded
    api.setMode(expanded ? 'expanded' : notice ? 'notice' : 'compact')
    if (expanded) inputRef.current?.focus()
  }, [expanded, notice])

  useEffect(() => {
    api.info().then((info) => {
      setShortcut(info.shortcut)
      if (info.feeling) setFeeling(info.feeling)
    }).catch(() => {})
    const stopVoices = onVoicesReady(() => setVoiceAvailable(hasSpanishVoice()))
    const stopEvents = api.onEvent((event) => {
      if (event.type === 'open') open()
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
        setSpeech({ id: Date.now(), ms: Math.min(6000, Math.max(600, event.text.length * 45)) })
        if (voiceOn && event.voice !== false) speak(event.text)
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
  }, [open, react, voiceOn, wake])

  // Si no lo usás por un rato, se duerme.
  useEffect(() => {
    const id = setInterval(() => {
      const after = feeling === 'cansado' ? SLEEP_WHEN_TIRED_MS : SLEEP_AFTER_MS
      if (!expanded && !notice && !asleepRef.current && Date.now() - lastActivity.current > after) {
        asleepRef.current = true
        setAsleep(true)
      }
    }, 5000)
    return () => clearInterval(id)
  }, [expanded, notice, feeling])

  // Si hacés clic en otra ventana, Pixie se achica.
  useEffect(() => {
    if (isPreview) return
    const onBlur = () => setTimeout(() => !document.hasFocus() && close(), 150)
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [close])

  const mood = busy ? 'thinking' : expanded ? 'listening' : asleep ? 'sleeping' : 'idle'

  async function send(text) {
    const clean = text.trim()
    if (!clean || busy) return
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

  function onKeyDown(e) {
    if (e.key === 'Escape') {
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
    try {
      localStorage.setItem('pixie.voz', next ? 'si' : 'no')
    } catch {
      // sin almacenamiento: la preferencia dura hasta cerrar la app
    }
  }

  const chips = reply?.suggestions ?? (reply ? null : STARTERS)

  return (
    <div className={`pixie ${expanded ? 'is-expanded' : 'is-compact'}`} onKeyDown={onKeyDown}>
      {expanded && (
        <section className="panel" aria-label="Hablar con Pixie">
          <div className="bubble" aria-live="polite">
            {busy ? (
              <p className="muted">Pensando…</p>
            ) : (
              <p>{reply?.text ?? 'Hola, soy Pixie. ¿Qué necesitás?'}</p>
            )}
            {reply?.confirm && !busy && (
              <div className="confirm">
                <button type="button" className="primary" onClick={() => answer(true)}>Sí, dale</button>
                <button type="button" onClick={() => answer(false)}>No</button>
              </div>
            )}
            {chips && !busy && (
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
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>
          <div className="footer">
            <button type="button" className="link" onClick={toggleVoice} title={voiceAvailable ? '' : 'Windows no tiene una voz en español instalada'}>
              {voiceAvailable ? (voiceOn ? 'Voz: sí' : 'Voz: no') : 'Sin voz en español'}
            </button>
            <span>Esc para cerrar</span>
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
