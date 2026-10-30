// Piezas de la ventana de Ajustes y de la bienvenida.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { renderFace, WIDTH, HEIGHT } from '../face/draw.js'
import { renderStandby } from '../face/standby.js'
import { listen } from '../audio.js'
import { learnSample, compare } from '../wake.js'
import { startWakeListener, HandsFreeError } from '../wake-listener.js'

export function Card({ title, children, note }) {
  return (
    <section className="card">
      {title && <h2>{title}</h2>}
      {children}
      {note && <p className="note">{note}</p>}
    </section>
  )
}

export function Row({ label, hint, children, htmlFor }) {
  return (
    <div className="row">
      <div className="row-text">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

// Un texto que se guarda al salir del campo o con Enter
export function TextSetting({ id, value, placeholder, onSave, label }) {
  const [text, setText] = useState(value ?? '')
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setText(value ?? '')
  }, [value])
  const save = () => {
    editing.current = false
    if (text.trim() !== (value ?? '')) onSave(text.trim())
  }
  return (
    <input
      id={id}
      className="field"
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

// La pantallita de Pixie en chiquito: la cara, el reloj o el resumen
export function LedScreen({ mode = 'cara', scale = 3, weather = null, face = null }) {
  const ref = useRef(null)
  const faceKey = JSON.stringify(face ?? {})
  const temp = weather?.temp
  const icon = weather?.icon
  useEffect(() => {
    const expression = JSON.parse(faceKey)
    const sky = Number.isFinite(temp) ? { temp, icon } : null
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(canvas)
    const on = styles.getPropertyValue('--pixel').trim() || '#9cd3ff'
    const off = styles.getPropertyValue('--screen').trim() || '#04060a'
    let blinkUntil = 0
    const draw = () => {
      const now = Date.now()
      if (now > blinkUntil + 3500 + Math.random() * 2500) blinkUntil = now + 160
      const closed = now < blinkUntil
      const bits0 = renderFace({ ...expression, ...(closed ? { openL: 0, openR: 0 } : {}) })
      const bits = mode === 'cara' ? bits0 : renderStandby(mode, bits0, new Date(), sky)
      ctx.fillStyle = off
      ctx.fillRect(0, 0, WIDTH * scale, HEIGHT * scale)
      ctx.fillStyle = on
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (bits[y * WIDTH + x]) ctx.fillRect(x * scale, y * scale, scale - (scale > 2 ? 0.5 : 0), scale - (scale > 2 ? 0.5 : 0))
    }
    draw()
    const id = setInterval(draw, 120)
    return () => clearInterval(id)
  }, [mode, scale, temp, icon, faceKey])
  return <canvas ref={ref} className="led" width={WIDTH * scale} height={HEIGHT * scale} role="img" aria-label={`Vista previa: ${mode}`} />
}

const STANDBY_OPTIONS = [
  ['cara', 'Carita', 'Mi cara de siempre: parpadeo, miro el mouse y me duermo.'],
  ['reloj', 'Reloj', 'La hora grande y la fecha, dibujadas con mis píxeles.'],
  ['resumen', 'Resumen', 'Mi carita en chiquito, la hora y el clima de tu ciudad.']
]
const SAMPLE_WEATHER = { temp: 23, icon: 'sol' }

export function StandbyPicker({ value, onChange }) {
  return (
    <div className="standby" role="radiogroup" aria-label="Qué muestro en reposo">
      {STANDBY_OPTIONS.map(([mode, title, text]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          className={`standby-option${value === mode ? ' selected' : ''}`}
          onClick={() => onChange(mode)}
        >
          <LedScreen mode={mode} scale={3} weather={SAMPLE_WEATHER} />
          <span className="standby-title">{title}</span>
          <span className="standby-text">{text}</span>
        </button>
      ))}
    </div>
  )
}

// Elegir el atajo apretando las teclas
const MOD_NAMES = { Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Super: 'Windows' }
function keyFromEvent(e) {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3)
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5)
  if (e.code === 'Space') return 'Space'
  if (/^F([1-9]|1[0-2])$/.test(e.code)) return e.code
  return null
}

export function ShortcutPicker({ current, onChange }) {
  const [capturing, setCapturing] = useState(false)
  const [hint, setHint] = useState('')
  const onKeyDown = (e) => {
    e.preventDefault()
    if (e.key === 'Escape') {
      setCapturing(false)
      setHint('')
      return
    }
    const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
    const key = keyFromEvent(e)
    if (!key) {
      setHint(mods.length ? `${mods.map((m) => MOD_NAMES[m]).join('+')}+…` : 'Apretá las teclas juntas…')
      return
    }
    if (!(e.ctrlKey || e.altKey || e.metaKey)) {
      setHint('Tiene que llevar Ctrl o Alt.')
      return
    }
    setCapturing(false)
    setHint('')
    onChange([...mods, key].join('+'))
  }
  return capturing ? (
    <button type="button" className="shortcut capturing" autoFocus onKeyDown={onKeyDown} onBlur={() => setCapturing(false)}>
      {hint || 'Apretá las teclas juntas… (Esc cancela)'}
    </button>
  ) : (
    <div className="shortcut-wrap">
      <kbd className="shortcut">{current}</kbd>
      <button type="button" className="button secondary" onClick={() => setCapturing(true)}>
        Cambiar
      </button>
    </div>
  )
}

// El asistente para conseguir y guardar la clave de Gemini
export function KeyWizard({ onDone }) {
  const [status, setStatus] = useState({ kind: 'waiting', text: 'Cuando la copies, la encuentro sola.' })
  const [manual, setManual] = useState('')
  const [guide, setGuide] = useState(false)
  const busy = useRef(false)
  const lastTried = useRef(null)

  const finish = (res) => {
    busy.current = false
    setStatus(res.ok ? { kind: 'ok', text: res.mensaje } : { kind: 'error', text: res.mensaje })
    if (res.ok) onDone?.()
  }

  useEffect(() => {
    if (status.kind === 'ok') return
    const id = setInterval(async () => {
      if (busy.current) return
      const r = await api.settings.clipboardKey()
      if (!r?.encontrada || r.clave === lastTried.current) return
      busy.current = true
      lastTried.current = r.clave
      setStatus({ kind: 'testing', text: `Encontré una clave copiada (${r.clave}). La estoy probando…` })
      finish(await api.settings.saveKey(null))
    }, 1200)
    return () => clearInterval(id)
  }, [status.kind])

  const tryManual = async () => {
    if (!manual.trim() || busy.current) return
    busy.current = true
    setStatus({ kind: 'testing', text: 'La estoy probando…' })
    finish(await api.settings.saveKey(manual.trim()))
  }

  return (
    <div className="wizard">
      {guide ? (
        <Guide steps={KEY_GUIDE} onClose={() => setGuide(false)} onAction={() => api.settings.openKeyPage()} actionLabel="Abrir Google AI Studio" />
      ) : (
        <>
          <ol className="steps">
            <li>
              <span>
                <b>Abrí Google AI Studio</b> y entrá con tu cuenta de Google.
              </span>
              <button type="button" className="button" onClick={() => api.settings.openKeyPage()}>
                Abrir AI Studio
              </button>
            </li>
            <li>
              <span>
                Tocá <b>«Create API key»</b> (Crear clave de API) y copiala con el botón de copiar.
              </span>
            </li>
            <li>
              <span>
                <b>Listo:</b> yo la encuentro, la pruebo y la guardo cifrada en esta compu.
              </span>
            </li>
          </ol>
          <button type="button" className="button secondary guide-open" onClick={() => setGuide(true)}>
            No entiendo nada: explicame paso a paso
          </button>
        </>
      )}
      <p className={`status ${status.kind}`} role="status" aria-live="polite">
        {status.text}
      </p>
      {status.kind !== 'ok' && (
        <div className="manual">
          <input
            className="field mono"
            placeholder="O pegá la clave acá"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryManual()}
            aria-label="Clave de Gemini"
          />
          <button type="button" className="button secondary" onClick={tryManual} disabled={!manual.trim() || status.kind === 'testing'}>
            Probar y guardar
          </button>
        </div>
      )}
    </div>
  )
}

// La guía para quien nunca sacó una clave: un paso por vez, con palabras simples (y Pixie te la puede leer)
const KEY_GUIDE = [
  {
    title: 'Vamos a sacar tu clave gratis',
    text: 'La clave es como una contraseña que me deja usar la inteligencia artificial de Google. No cuesta nada, no pide tarjeta y tarda unos dos minutos.',
    note: 'Necesitás una cuenta de Google (la de Gmail). Google pide que sea de alguien mayor de 18 años: si sos menor, pedile a un adulto que la saque con su cuenta.'
  },
  {
    title: 'Abrí la página de Google',
    text: 'Tocá el botón de abajo. Se abre la página «Google AI Studio» en tu navegador. Si te pide, entrá con tu cuenta de Google.',
    action: 'abrir'
  },
  {
    title: 'Aceptá las condiciones',
    text: 'La primera vez aparece un cartel con las condiciones de Google. Tildá la casilla y tocá «Aceptar» (o «Continuar»). Si no aparece ningún cartel, pasá al paso siguiente.'
  },
  {
    title: 'Creá la clave',
    text: 'Buscá el botón «Crear clave de API» (en inglés dice «Create API key») y tocalo. Si te pregunta por un proyecto, elegí el que aparece o tocá «Crear proyecto».'
  },
  {
    title: 'Copiala',
    text: 'Aparece una clave larga que empieza con «AIza» o con «AQ.». Al lado tiene un botoncito para copiar (dos cuadraditos): tocalo. También podés seleccionarla y apretar Ctrl + C.'
  },
  {
    title: 'Volvé acá',
    text: 'Cuando la copies, la encuentro sola, la pruebo y la guardo cifrada en esta compu. No hace falta pegarla en ningún lado.',
    note: '¿Algo no sale? Si Google dice que no está disponible, suele ser por la edad de la cuenta: probá con la de un adulto. Si la página está en inglés, los botones son «Get API key» y «Create API key».'
  }
]

// Un paso por vez, con «Leémelo en voz alta». step.action: muestra el botón que abre la página
export function Guide({ steps, onClose, onAction, actionLabel }) {
  const [step, setStep] = useState(0)
  const g = steps[step]
  const last = step === steps.length - 1
  return (
    <div className="guide" aria-live="polite">
      <p className="guide-count">
        Paso {step + 1} de {steps.length}
      </p>
      <h3>{g.title}</h3>
      <p className="guide-text">{g.text}</p>
      {g.action === 'abrir' && (
        <button type="button" className="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {g.note && <p className="note">{g.note}</p>}
      <div className="guide-nav">
        <button type="button" className="link" onClick={() => api.settings.speak?.(`${g.title}. ${g.text}`)}>
          Leémelo en voz alta
        </button>
        <span className="spacer" />
        {step > 0 ? (
          <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>
            Atrás
          </button>
        ) : (
          <button type="button" className="button secondary" onClick={onClose}>
            Volver
          </button>
        )}
        {!last && (
          <button type="button" className="button" onClick={() => setStep(step + 1)}>
            Listo, ¿y ahora?
          </button>
        )}
      </div>
    </div>
  )
}

// «Pixie, ¿estás?»: grabar tu voz tres veces, probarla y elegir qué tan fácil se despierta
const TAKES = 3
const SENSITIVITY_OPTIONS = [
  ['baja', 'Menos', 'Si me despierto sola'],
  ['normal', 'Normal', ''],
  ['alta', 'Más', 'Si no te escucho']
]

export function WakeTrainer({ palabra, change, setS, compact = false }) {
  const [training, setTraining] = useState(!palabra?.grabada)
  const [takes, setTakes] = useState([])
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [message, setMessage] = useState(null) // { kind, text }
  const [testing, setTesting] = useState(null) // { hits, misses }
  const tester = useRef(null)

  const stopTest = () => {
    tester.current?.stop()
    tester.current = null
    setTesting(null)
    api.settings.testingWake?.(false)
  }
  useEffect(() => () => {
    tester.current?.stop()
    api.settings.testingWake?.(false)
  }, [])

  async function record() {
    if (recording) return
    stopTest()
    setRecording(true)
    setMessage({ kind: 'testing', text: 'Te escucho: decí «Pixie, ¿estás?» y quedate callado.' })
    let rec
    try {
      rec = await listen({ onLevel: setLevel, silenceMs: 700, maxMs: 4000, waitMs: 5000 })
    } catch {
      setRecording(false)
      setMessage({ kind: 'error', text: 'No pude usar el micrófono. Fijate en Configuración de Windows → Privacidad → Micrófono que las apps de escritorio tengan permiso.' })
      return
    }
    const { samples } = await rec.done
    setRecording(false)
    setLevel(0)
    const r = samples ? learnSample(samples) : { ok: false, problema: 'No te escuché. Acercate al micrófono y probá de nuevo.' }
    if (!r.ok) return setMessage({ kind: 'error', text: r.problema })
    const next = [...takes, r.frames]
    if (next.length < TAKES) {
      setTakes(next)
      const left = TAKES - next.length
      return setMessage({ kind: 'ok', text: left === 1 ? '¡Bien! Una vez más.' : `¡Bien! Faltan ${left}.` })
    }
    // Si una salió muy distinta a las otras (un ruido, otra frase), se graban de nuevo
    const odd = next.some((a, i) => next.some((b, j) => j > i && compare(a, b).total > 0.4))
    if (odd) {
      setTakes([])
      return setMessage({ kind: 'error', text: 'Una de las tres salió muy distinta (¿un ruido?). Grabemos las tres de nuevo, como me llamarías siempre.' })
    }
    const res = await api.settings.saveWake(next.map((t) => t.map((f) => Array.from(f))))
    setTakes([])
    setMessage({ kind: res.ok ? 'ok' : 'error', text: res.mensaje })
    if (res.ok) {
      setTraining(false)
      setS?.(res)
    }
  }

  async function startTest() {
    const templates = await api.settings.wakeTemplates?.()
    if (!templates) return
    await api.settings.testingWake?.(true)
    try {
      tester.current = await startWakeListener({
        templates,
        sensibilidad: palabra.sensibilidad,
        onWake: () => setTesting((t) => t && { ...t, hits: t.hits + 1 }),
        onCandidate: ({ match }) => !match && setTesting((t) => t && { ...t, misses: t.misses + 1 })
      })
      setTesting({ hits: 0, misses: 0 })
    } catch (err) {
      api.settings.testingWake?.(false)
      setMessage({
        kind: 'error',
        text: err instanceof HandsFreeError ? 'Con el micrófono de los auriculares Bluetooth no puedo escucharte todo el tiempo. Conectá otro micrófono.' : 'No pude usar el micrófono.'
      })
    }
  }

  if (training) {
    return (
      <div className="wake">
        <p className="wake-lead">Decí <b>«Pixie, ¿estás?»</b> tres veces, como me llamarías siempre. Así aprendo tu voz.</p>
        <div className="wake-takes" aria-label={`${takes.length} de ${TAKES} grabaciones`}>
          {Array.from({ length: TAKES }, (_, i) => (
            <span key={i} className={i < takes.length ? 'done' : i === takes.length && recording ? 'on' : ''} />
          ))}
        </div>
        <div className="buttons">
          <button type="button" className="button" onClick={record} disabled={recording}>
            {recording ? 'Te escucho…' : `Grabar (${takes.length + 1} de ${TAKES})`}
          </button>
          {palabra?.grabada && (
            <button type="button" className="button secondary" onClick={() => setTraining(false)} disabled={recording}>
              Cancelar
            </button>
          )}
        </div>
        {recording && (
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, level * 12)})` }} />
          </div>
        )}
        {message && <p className={`status ${message.kind}`}>{message.text}</p>}
      </div>
    )
  }

  return (
    <div className="wake">
      {message && <p className={`status ${message.kind}`}>{message.text}</p>}
      <Row label="Escuchar «Pixie, ¿estás?»" hint="Me llamás sin tocar nada.">
        <Toggle label="Escuchar «Pixie, ¿estás?»" on={palabra.activa} onChange={(v) => change({ palabraMagica: v })} />
      </Row>
      {!compact && (
        <Row label="Qué tan fácil me despierto" hint="Si me despierto sola, elegí «Menos». Si no te escucho, «Más».">
          <div className="segmented" role="radiogroup" aria-label="Sensibilidad">
            {SENSITIVITY_OPTIONS.map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={palabra.sensibilidad === id}
                className={palabra.sensibilidad === id ? 'selected' : ''}
                onClick={() => {
                  stopTest()
                  change({ sensibilidadPalabra: id })
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </Row>
      )}
      <Row
        label="Probar"
        hint={
          testing
            ? `Decí «Pixie, ¿estás?». Te reconocí ${testing.hits} ${testing.hits === 1 ? 'vez' : 'veces'}${testing.misses ? ` · ${testing.misses} ${testing.misses === 1 ? 'frase no era' : 'frases no eran'} la mía` : ''}.`
            : 'Mientras probás, la ventanita no se despierta.'
        }
      >
        <button type="button" className={`button ${testing ? '' : 'secondary'}`} onClick={testing ? stopTest : startTest}>
          {testing ? 'Terminar la prueba' : 'Probar ahora'}
        </button>
      </Row>
      <div className="buttons wake-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            stopTest()
            setMessage(null)
            setTraining(true)
          }}
        >
          Grabar mi voz de nuevo
        </button>
        {!compact && (
          <button
            type="button"
            className="button danger"
            onClick={async () => {
              stopTest()
              setS?.(await api.settings.forgetWake())
              setTraining(true)
              setMessage(null)
            }}
          >
            Borrar mi voz
          </button>
        )}
      </div>
    </div>
  )
}

// Sumar un calendario (Google Calendar o una materia de Classroom) con su dirección secreta iCal
const CALENDAR_GUIDE = [
  {
    title: 'Abrí Google Calendar en la compu',
    text: 'Tocá el botón de abajo: se abre la configuración de Google Calendar en tu navegador. Si te pide, entrá con tu cuenta de Google (la misma que usás en Classroom).',
    action: 'abrir'
  },
  {
    title: 'Elegí el calendario',
    text: 'A la izquierda, en «Configuración de mis calendarios», tocá el nombre de tu calendario (el que tiene tu nombre). Las materias de Classroom no sirven acá: Google no da su dirección. Esas las leo con la extensión de Chrome (más arriba, en «Classroom»).'
  },
  {
    title: 'Copiá la dirección secreta',
    text: 'Bajá hasta la parte «Integrar el calendario». Buscá «Dirección secreta en formato iCal» y tocá el botoncito de copiar que tiene al lado.',
    note: 'Tiene que ser la «secreta», no la «pública». Google te avisa que no la compartas: está bien, yo la guardo cifrada solo en esta compu.'
  },
  {
    title: 'Volvé acá',
    text: 'Cuando la copies, la encuentro sola, la pruebo y la sumo a mi agenda. Si tenés otro calendario tuyo, repetí desde el paso 2.',
    note: 'Si no aparece «Dirección secreta en formato iCal», ese calendario no es tuyo (es de otra persona) o tu colegio la desactivó.'
  }
]

export function CalendarWizard({ onAdded }) {
  const [status, setStatus] = useState({ kind: 'waiting', text: 'Cuando copies la dirección secreta, la encuentro sola.' })
  const [manual, setManual] = useState('')
  const [guide, setGuide] = useState(false)
  const busy = useRef(false)

  const finish = (res) => {
    busy.current = false
    setStatus({ kind: res.ok ? 'ok' : 'error', text: res.mensaje })
    if (res.ok) {
      setManual('')
      onAdded?.(res)
    }
  }

  useEffect(() => {
    const id = setInterval(async () => {
      if (busy.current) return
      const r = await api.settings.clipboardCalendar?.()
      if (!r?.encontrada) return
      busy.current = true
      setStatus({ kind: 'testing', text: 'Encontré la dirección de un calendario. La estoy probando…' })
      finish(await api.settings.addCalendar(null))
    }, 1200)
    return () => clearInterval(id)
  }, [status.kind])

  const tryManual = async () => {
    if (!manual.trim() || busy.current) return
    busy.current = true
    setStatus({ kind: 'testing', text: 'La estoy probando…' })
    finish(await api.settings.addCalendar(manual.trim()))
  }

  return (
    <div className="wizard">
      {guide ? (
        <Guide steps={CALENDAR_GUIDE} onClose={() => setGuide(false)} onAction={() => api.settings.openGoogleCalendar?.()} actionLabel="Abrir Google Calendar" />
      ) : (
        <>
          <ol className="steps">
            <li>
              <span>
                En <b>Google Calendar</b> (en la compu), entrá a la configuración de tu calendario.
              </span>
              <button type="button" className="button" onClick={() => api.settings.openGoogleCalendar?.()}>
                Abrir Google Calendar
              </button>
            </li>
            <li>
              <span>
                En «Integrar el calendario», copiá la <b>dirección secreta en formato iCal</b>.
              </span>
            </li>
            <li>
              <span>
                <b>Listo:</b> la encuentro, la pruebo y la sumo a mi agenda.
              </span>
            </li>
          </ol>
          <button type="button" className="button secondary guide-open" onClick={() => setGuide(true)}>
            No sé dónde está: explicame paso a paso
          </button>
        </>
      )}
      <p className={`status ${status.kind}`} role="status" aria-live="polite">
        {status.text}
      </p>
      <div className="manual">
        <input
          className="field mono"
          placeholder="O pegá la dirección acá (termina en .ics)"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value)
            if (status.kind === 'error') setStatus({ kind: 'waiting', text: 'Cuando copies la dirección secreta, la encuentro sola.' })
          }}
          onKeyDown={(e) => e.key === 'Enter' && tryManual()}
          aria-label="Dirección del calendario"
        />
        <button type="button" className="button secondary" onClick={tryManual} disabled={!manual.trim() || status.kind === 'testing'}>
          Sumar
        </button>
      </div>
    </div>
  )
}
