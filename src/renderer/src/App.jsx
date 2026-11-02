import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Face from './face/Face.jsx'
import PongGame from './games/PongGame.jsx'
import { api, isPreview } from './api.js'
import { speak, stopSpeaking, beep, hasSpanishVoice, onVoicesReady, setNaturalVoice, isSpeaking } from './voice.js'
import { playSound, hasSound } from './sounds.js'
import { listen } from './audio.js'
import { startWakeListener, HandsFreeError } from './wake-listener.js'

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
const MAX_VOICE_TURNS = 8 // en una charla por voz, cuántas veces seguidas te escucha sin que la vuelvas a llamar

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
  const [standbyMode, setStandbyMode] = useState('cara') // qué muestra en reposo: cara | reloj | resumen
  const [weather, setWeather] = useState(null) // { temp, icon } para el resumen
  const [game, setGame] = useState(null) // 'pong' mientras se juega
  const [listening, setListening] = useState(false) // grabando lo que decís
  const [micLevel, setMicLevel] = useState(0)
  const [youSaid, setYouSaid] = useState(null) // lo que Pixie entendió de tu voz
  const [voiceShortcut, setVoiceShortcut] = useState(null)
  const [wakeCfg, setWakeCfg] = useState(null) // «Pixie, ¿estás?»: { activa, plantillas, sensibilidad, pausada }
  const [wakeRestart, setWakeRestart] = useState(0)
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
  const wakeRef = useRef(null) // el que escucha la palabra mágica
  const wakePaused = useRef(false) // mientras la probás en Ajustes
  const lastMic = useRef(null) // con qué micrófono escucha (para el historial)
  const silentRestarts = useRef(0) // veces seguidas que lo reabrió porque estaba mudo
  const away = useRef(false)
  const voiceSession = useRef(null) // charla que empezó con «Pixie, ¿estás?»: { turns }
  const onWakeRef = useRef(() => {})
  const handsFreeWarned = useRef(false)
  const micFailures = useRef(0)

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
      if (info.pantallaReposo) setStandbyMode(info.pantallaReposo)
      if (info.clima) setWeather(info.clima)
      if (info.palabra) setWakeCfg(info.palabra)
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
      if (event.type === 'ajustes' && event.pantallaReposo) setStandbyMode(event.pantallaReposo)
      if (event.type === 'clima') setWeather({ temp: event.temp, icon: event.icon })
      // Volviste de suspender o desbloqueaste la compu: el micrófono suele quedar muerto, se reabre
      if (event.type === 'microfono') {
        if (!listeningRef.current) {
          api.wakeLog?.(`${event.motivo ?? 'volviste'}: vuelvo a abrir el micrófono`)
          setWakeRestart((n) => n + 1)
        }
      }
      if (event.type === 'palabra') {
        wakePaused.current = Boolean(event.pausada)
        // Si es la misma voz grabada, no vuelve a abrir el micrófono
        setWakeCfg((old) => (old && old.activa === event.activa && old.sensibilidad === event.sensibilidad && old.huella === event.huella ? old : event))
      }
      // "Probar voz" desde los ajustes: habla aunque la voz esté apagada
      if (event.type === 'prueba-voz') speak(event.text, 'happy')
      if (event.type === 'presence') {
        away.current = Boolean(event.away)
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

  // «Pixie, ¿estás?»: escucha todo el tiempo (en la compu) mientras esté prendido
  const wakeTemplates = wakeCfg?.activa ? wakeCfg.plantillas : null
  const wakeLearned = wakeCfg?.aprendidas
  const wakeSensitivity = wakeCfg?.sensibilidad ?? 'normal'
  useEffect(() => {
    if (isPreview || !wakeTemplates) return
    let stopped = false
    let listener = null
    let watchdog = null
    let devicesTimer = null
    // Si el micrófono se murió sin avisar, lo vuelve a abrir (antes se quedaba escuchando «nada»)
    const restart = (why) => {
      if (stopped || listeningRef.current) return
      api.wakeLog?.(why)
      setWakeRestart((n) => n + 1)
    }
    const onDevices = () => {
      clearTimeout(devicesTimer)
      devicesTimer = setTimeout(() => restart('cambiaron los micrófonos de la compu: vuelvo a abrir el que corresponde'), 1500)
    }
    navigator.mediaDevices?.addEventListener?.('devicechange', onDevices)
    startWakeListener({
      templates: wakeTemplates,
      learned: wakeLearned ?? [],
      sensibilidad: wakeSensitivity,
      onCandidate: ({ distance, limit, almost }) => {
        if (almost) api.wakeLog?.(`casi te escuché (distancia ${distance.total.toFixed(3)} de ${limit.total.toFixed(3)}); si lo repetís, me despierto`)
      },
      onWake: (info) => onWakeRef.current(info),
      onLost: () => !stopped && setTimeout(() => setWakeRestart((n) => n + 1), 3000)
    })
      .then((l) => {
        if (stopped) return l.stop()
        micFailures.current = 0
        listener = l
        wakeRef.current = l
        const first = l.health()
        if (first.micro !== lastMic.current) {
          lastMic.current = first.micro
          api.wakeLog?.(`escucho «Pixie, ¿estás?» con ${first.micro}`)
        }
        const started = performance.now()
        watchdog = setInterval(() => {
          if (listeningRef.current) return // te está escuchando con este mismo audio
          const h = l.health()
          // Llega sonido de verdad: el micrófono anda
          if (performance.now() - started > 10000 && h.silencioMs === 0 && h.sinAudioMs < 1000) silentRestarts.current = 0
          const silenceLimit = 45000 * Math.min(8, 2 ** silentRestarts.current)
          if (h.terminado) restart(`${h.micro} se desconectó: lo vuelvo a abrir`)
          else if (h.sinAudioMs > 8000) restart(`no me llega audio de ${h.micro}: lo vuelvo a abrir`)
          else if (h.silencioMs > silenceLimit) {
            silentRestarts.current++
            restart(`${h.micro} está en silencio total${h.muteado ? ' (parece silenciado en Windows)' : ''}: lo vuelvo a abrir`)
          }
        }, 5000)
      })
      .catch((err) => {
        if (err instanceof HandsFreeError) {
          api.wakeLog?.(`no escucho todo el tiempo con el micrófono de los auriculares (${err.message})`)
          if (!handsFreeWarned.current) {
            handsFreeWarned.current = true
            setNotice({
              text: 'Con el micrófono de tus auriculares Bluetooth no me quedo escuchando «Pixie, ¿estás?»: tu música sonaría como una llamada. Llamame con el atajo o conectá otro micrófono.'
            })
          }
        } else {
          // Sin permiso o sin micrófono: prueba de nuevo cada vez más espaciado (hasta cada 10 minutos)
          const fails = micFailures.current++
          if (fails % 5 === 0) api.wakeLog?.(`no pude abrir el micrófono: ${err.message}`)
          if (!stopped) setTimeout(() => setWakeRestart((n) => n + 1), Math.min(30000 * 2 ** fails, 10 * 60 * 1000))
        }
      })
    return () => {
      stopped = true
      clearInterval(watchdog)
      clearTimeout(devicesTimer)
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDevices)
      listener?.stop()
      wakeRef.current = null
    }
  }, [wakeTemplates, wakeLearned, wakeSensitivity, wakeRestart])

  // No busca la frase mientras habla (para no escucharse a sí misma), te escucha, piensa o jugás
  useEffect(() => {
    if (!wakeTemplates) return
    let quietSince = 0
    let state = { listener: null, paused: null }
    const id = setInterval(() => {
      const l = wakeRef.current
      if (!l) return
      if (l !== state.listener) state = { listener: l, paused: null }
      const speaking = isSpeaking()
      if (speaking) quietSince = Date.now()
      const pause =
        listeningRef.current || busyRef.current || speaking || Date.now() - quietSince < 800 || wakePaused.current || away.current || Boolean(gameRef.current)
      if (pause !== state.paused) {
        state.paused = pause
        if (pause) l.pause()
        else l.resume()
      }
    }, 200)
    return () => clearInterval(id)
  }, [wakeTemplates])

  onWakeRef.current = (info) => {
    if (listeningRef.current || busyRef.current || gameRef.current) return
    api.wakeLog?.(`me llamaste (distancia ${info.distance.total.toFixed(3)} de ${info.limit.total.toFixed(3)}${info.repeated ? ', a la segunda' : ''})`)
    api.show?.()
    voiceSession.current = { turns: 0, frames: info.frames }
    startListeningRef.current({ byVoice: true })
  }

  // Terminó la charla por voz (no dijiste nada más): se achica y vuelve a esperar «Pixie, ¿estás?».
  // Si te habló, la última respuesta queda un rato en el globito de arriba.
  function endVoiceSession(talked) {
    voiceSession.current = null
    if (talked) minimize()
    else setExpanded(false) // la llamaste sin querer (o era la tele): se achica sin decir nada
  }

  // En una charla por voz, cuando termina de contestar te vuelve a escuchar un ratito.
  // Si no decís nada, vuelve a esperar «Pixie, ¿estás?».
  function keepListening() {
    const session = voiceSession.current
    if (!session) return
    session.turns++
    if (session.turns >= MAX_VOICE_TURNS) {
      voiceSession.current = null
      return
    }
    const started = Date.now()
    const check = () => {
      if (voiceSession.current !== session) return
      if (isSpeaking() && Date.now() - started < 30000) return setTimeout(check, 250)
      setTimeout(() => voiceSession.current === session && startListeningRef.current({ followUp: true }), 400)
    }
    setTimeout(check, 600)
  }

  const mood = busy ? 'thinking' : expanded ? 'listening' : asleep ? 'sleeping' : 'idle'
  // En reposo puede mostrar la hora o el resumen; mientras la usás, siempre la cara
  const resting = !expanded && !notice && !game && !listening && !busy
  const standby = useMemo(
    () => (resting && standbyMode !== 'cara' ? { mode: standbyMode, weather } : null),
    [resting, standbyMode, weather]
  )

  async function send(text, { spoken = false } = {}) {
    const clean = text.trim()
    if (!clean || busy) return
    if (!spoken) {
      setYouSaid(null)
      voiceSession.current = null // si escribís, deja de escucharte sola
    }
    lastActivity.current = Date.now()
    history.current = [clean, ...history.current.filter((h) => h !== clean)].slice(0, 30)
    historyPos.current = -1
    setInput('')
    setBusy(true)
    try {
      const result = await api.ask(clean)
      show(result)
      if (spoken && !result.game) keepListening()
      else voiceSession.current = null
    } catch {
      voiceSession.current = null
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

  // Hablarle: graba hasta que dejás de hablar, la IA lo pasa a texto y se manda solo.
  // byVoice: la llamaste con «Pixie, ¿estás?»; followUp: sigue la charla por voz.
  async function startListening({ byVoice = false, followUp = false } = {}) {
    if (listening || busy) return
    const quietly = byVoice || followUp // si no decís nada, no te reta: vuelve a esperar
    if (!quietly) voiceSession.current = null
    open()
    stopSpeaking()
    if (!api.transcribe) {
      show({ text: 'La voz anda en la app de escritorio.', face: 'confused' })
      return
    }
    let rec
    let loudest = 0 // para el historial: si no te escuchó, cuánto volumen llegó
    try {
      rec = await listen({
        onLevel: (l) => {
          loudest = Math.max(loudest, l)
          setMicLevel(l)
        },
        waitMs: followUp ? 5000 : 6000,
        tap: wakeRef.current
      })
    } catch {
      voiceSession.current = null
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
      if (byVoice && !heard) api.wakeLog?.(`me llamaste pero después no te escuché (volumen máximo ${loudest.toFixed(3)})`)
      if (quietly) endVoiceSession(followUp)
      else if (!heard) show({ text: 'No te escuché. Tocá el micrófono y hablame.', face: 'confused' })
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
    if (result.error) {
      voiceSession.current = null
      return show({ text: result.error, face: 'confused' })
    }
    if (!result.text) {
      if (followUp) return endVoiceSession(true)
      return show({ text: 'No te entendí bien. ¿Me lo repetís?', face: 'confused' })
    }
    setYouSaid(result.text)
    // Te despertó y entendió el pedido: era tu voz llamándola. Aprende esa forma de decirlo.
    const session = voiceSession.current
    if (session?.frames && session.turns === 0) {
      api.wakeLearn?.(session.frames.map((f) => Array.from(f)))
      session.frames = null
    }
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
      voiceSession.current = null
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
    <div
      className={`pixie ${expanded ? 'is-expanded' : 'is-compact'}${booting ? ' is-booting' : ''}`}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => {
        // Clic derecho en cualquier parte de Pixie: el mismo menú que el ícono al lado del reloj
        if (e.target.closest('input')) return
        e.preventDefault()
        api.menu?.()
      }}
    >
      {expanded && (
        <section className="panel" aria-label="Hablar con Pixie">
          <button type="button" className="menu-button" aria-label="Menú (ajustes, actualizaciones, cerrar)" title="Menú: ajustes, actualizaciones, cerrar" onClick={() => api.menu?.()}>
            ⋯
          </button>
          <button type="button" className="close" aria-label="Achicar (sigue hablando)" title="Achicar" onClick={minimize}>
            ×
          </button>
          <div className="bubble" aria-live="polite">
            {youSaid && !listening && <p className="said">«{youSaid}»</p>}
            {listening ? (
              <div className="listening">
                <p>{voiceSession.current?.turns === 0 ? 'Acá estoy, te escucho…' : 'Te escucho…'}</p>
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
            <span>{wakeTemplates ? 'Decí «Pixie, ¿estás?»' : voiceShortcut ? `${voiceShortcut}: hablar` : 'Esc para cerrar'}</span>
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

      <div className="face" ref={faceRef} title="Arrastrame para moverme · clic derecho: menú">
        <Face mood={mood} reaction={reaction} speech={speech} cursor={cursor} feeling={feeling} standby={standby} />
      </div>

      {!expanded && !notice && (
        <button type="button" className="talk" onClick={open} title={wakeTemplates ? `O con ${shortcut}` : undefined}>
          {wakeTemplates ? '«Pixie, ¿estás?»' : shortcut}
        </button>
      )}
    </div>
  )
}
