// Piezas de la ventana de Ajustes y de la bienvenida.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { renderFace, WIDTH, HEIGHT } from '../face/draw.js'
import { renderStandby } from '../face/standby.js'

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
