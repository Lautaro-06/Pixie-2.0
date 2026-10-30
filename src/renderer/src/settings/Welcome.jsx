// La bienvenida: la primera vez deja a Pixie lista en un minuto (nombre, IA gratis y cómo llamarla).
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { TextSetting, ShortcutPicker, KeyWizard, LedScreen, WakeTrainer } from './parts.jsx'

const STEPS = ['hola', 'ia', 'llamar', 'listo']

export default function Welcome() {
  const [step, setStep] = useState(0)
  const [s, setS] = useState(null)
  const [message, setMessage] = useState('')
  const [hasAI, setHasAI] = useState(false)

  useEffect(() => {
    api.settings.get().then((r) => {
      setS(r)
      setHasAI(r.ia.tieneClave)
    })
  }, [])

  const change = async (patch) => {
    const r = await api.settings.set(patch)
    setS(r)
    setMessage(r?.mensajes?.join(' ') ?? '')
  }

  if (!s) return <div className="welcome loading">Cargando…</div>
  const name = STEPS[step]
  const next = () => setStep((n) => Math.min(n + 1, STEPS.length - 1))
  const back = () => setStep((n) => Math.max(n - 1, 0))

  return (
    <div className="welcome">
      <div className="dots" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
        {STEPS.map((id, i) => (
          <span key={id} className={i === step ? 'on' : i < step ? 'done' : ''} />
        ))}
      </div>

      {name === 'hola' && (
        <section className="welcome-step">
          <LedScreen scale={5} face={{ mouth: 'smile' }} />
          <h1>¡Hola! Soy Pixie</h1>
          <p className="lead">Vivo en una esquina de tu pantalla y te ayudo con la compu. Vamos a dejarme lista en un minuto.</p>
          <div className="form">
            <label htmlFor="w-nombre">¿Cómo te llamás?</label>
            <TextSetting id="w-nombre" value={s.general.nombre} placeholder="Tu nombre" onSave={(nombre) => change({ nombre })} />
            <label htmlFor="w-ciudad">¿En qué ciudad estás? (para el clima)</label>
            <TextSetting id="w-ciudad" value={s.general.ciudad} placeholder="Buenos Aires" onSave={(ciudad) => change({ ciudad })} />
          </div>
          <div className="actions">
            <button type="button" className="button" onClick={next}>
              Siguiente
            </button>
          </div>
        </section>
      )}

      {name === 'ia' && (
        <section className="welcome-step">
          <h1>Mi cerebro con IA (gratis)</h1>
          <p className="lead">
            Con la IA de Google (Gemini) entiendo cualquier frase, charlo y te entiendo cuando me hablás. Es gratis: solo hace falta una clave de tu cuenta de Google.
          </p>
          {hasAI ? <p className="status ok">¡Ya tengo IA! Podés seguir.</p> : <KeyWizard onDone={() => setHasAI(true)} />}
          <div className="actions">
            <button type="button" className="button secondary" onClick={back}>
              Atrás
            </button>
            {hasAI ? (
              <button type="button" className="button" onClick={next}>
                Siguiente
              </button>
            ) : (
              <button type="button" className="link" onClick={next}>
                Seguir sin IA por ahora
              </button>
            )}
          </div>
        </section>
      )}

      {name === 'llamar' && (
        <section className="welcome-step">
          <h1>Cómo llamarme</h1>
          <p className="lead">La forma más fácil: decime «Pixie, ¿estás?». Para eso tengo que aprender tu voz (lo hacés una sola vez, acá abajo).</p>
          <div className="welcome-card">
            <WakeTrainer palabra={s.voz.palabra} change={change} setS={setS} compact />
          </div>
          <p className="lead small">O con este atajo de teclado, desde cualquier lado. También podés tocar mi cara.</p>
          <div className="center">
            <ShortcutPicker current={s.general.atajo} onChange={(atajo) => change({ atajo })} />
          </div>
          {message && <p className="status">{message}</p>}
          <div className="actions">
            <button type="button" className="button secondary" onClick={back}>
              Atrás
            </button>
            <button type="button" className="button" onClick={next}>
              Siguiente
            </button>
          </div>
        </section>
      )}

      {name === 'listo' && (
        <section className="welcome-step">
          <LedScreen scale={5} face={{ eyes: 'happy', mouth: 'smile' }} />
          <h1>¡Listo{s.general.nombre ? `, ${s.general.nombre}` : ''}!</h1>
          <p className="lead">
            {hasAI ? 'Ya tengo todo.' : 'Ya estoy, aunque sin IA: entiendo las órdenes cortas. La podés sumar cuando quieras desde mis Ajustes.'} Probá pedirme «poné música»,
            «¿qué clima hace?» o «juguemos». Todo esto lo podés cambiar después en mis <b>Ajustes</b>: hacé clic derecho en mi cara y aparece mi menú (ahí también me podés cerrar).
          </p>
          <div className="actions">
            <button type="button" className="button" onClick={() => api.settings.finishWelcome()}>
              Empezar
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
