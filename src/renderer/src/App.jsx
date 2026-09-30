import { useCallback, useEffect, useRef, useState } from 'react'
import Face from './components/Face.jsx'
import { api, isPreview } from './api.js'
import { speak, stopSpeaking, beep, hasSpanishVoice, onVoicesReady } from './voice.js'

const STARTERS = ['buen día', '¿qué hora es?', 'abrí YouTube', 'timer de 5 minutos']

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
  const [voiceOn, setVoiceOn] = useState(loadVoicePref)
  const [voiceAvailable, setVoiceAvailable] = useState(hasSpanishVoice)
  const [shortcut, setShortcut] = useState('Ctrl+Espacio')
  const inputRef = useRef(null)
  const history = useRef([])
  const historyPos = useRef(-1)

  const react = useCallback((type) => setReaction({ type, id: Date.now() + Math.random() }), [])

  const show = useCallback((result) => {
    setReply(result)
    if (result.face && result.face !== 'idle') react(result.face)
    if (voiceOn) speak(result.text)
  }, [react, voiceOn])

  const open = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const close = useCallback(() => {
    setExpanded(false)
    stopSpeaking()
  }, [])

  // La ventana cambia de tamaño según el modo.
  useEffect(() => {
    api.setMode(expanded ? 'expanded' : 'compact')
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    api.info().then((info) => setShortcut(info.shortcut)).catch(() => {})
    const stopVoices = onVoicesReady(() => setVoiceAvailable(hasSpanishVoice()))
    const stopEvents = api.onEvent((event) => {
      if (event.type === 'open') open()
      if (event.type === 'alarm') {
        open()
        setReply({ text: event.text })
        react('alarm')
        beep()
        if (voiceOn) setTimeout(() => speak(event.text), 900)
      }
    })
    return () => {
      stopVoices()
      stopEvents()
    }
  }, [open, react, voiceOn])

  // Si hacés clic en otra ventana, Pixie se achica.
  useEffect(() => {
    if (isPreview) return
    const onBlur = () => setTimeout(() => !document.hasFocus() && close(), 150)
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [close])

  async function send(text) {
    const clean = text.trim()
    if (!clean || busy) return
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

      <div className="face" title="Arrastrame para moverme">
        <Face thinking={busy} reaction={reaction} />
      </div>

      {!expanded && (
        <button type="button" className="talk" onClick={open}>
          {shortcut}
        </button>
      )}
    </div>
  )
}
