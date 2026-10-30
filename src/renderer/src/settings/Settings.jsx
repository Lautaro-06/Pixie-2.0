// La ventana de Ajustes: todo lo que antes había que tocar en config.json.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Card, Row, Toggle, TextSetting, ShortcutPicker, StandbyPicker, KeyWizard, LedScreen, WakeTrainer, CalendarWizard } from './parts.jsx'

const SECTIONS = [
  ['general', 'General'],
  ['personalizacion', 'Personalización'],
  ['agenda', 'Agenda'],
  ['noticias', 'Noticias'],
  ['ia', 'Inteligencia artificial'],
  ['voz', 'Voz'],
  ['actualizaciones', 'Actualizaciones'],
  ['ayuda', 'Ayuda']
]

const VOICES = [
  ['natural', 'Natural (argentina)', 'Suena más humana y anda sin internet. Se baja una sola vez (unos 135 MB).'],
  ['windows', 'La de Windows', 'La voz que ya trae la compu.'],
  ['gemini', 'Gemini', 'Muy natural, pero solo 10 frases gratis por día; después vuelve a la de Windows.']
]

export default function Settings({ section: initial = 'general' }) {
  const [s, setS] = useState(null)
  const [section, setSection] = useState(SECTIONS.some(([id]) => id === initial) ? initial : 'general')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const say = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  const load = useCallback(() => api.settings.get().then(setS).catch(() => {}), [])
  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const change = async (patch) => {
    const r = await api.settings.set(patch)
    setS(r)
    if (r?.mensajes?.length) say(r.mensajes.join(' '))
  }

  if (!s) return <div className="settings loading">Cargando…</div>

  return (
    <div className="settings">
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          <LedScreen scale={1.5} />
          <div>
            <strong>Pixie</strong>
            <span>Versión {s.version}</span>
          </div>
        </div>
        {SECTIONS.map(([id, name]) => (
          <button key={id} type="button" className={`nav${section === id ? ' active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>
            {name}
          </button>
        ))}
      </nav>

      <main className="content">
        {section === 'general' && <General s={s} change={change} />}
        {section === 'personalizacion' && <Personalization s={s} change={change} />}
        {section === 'agenda' && <AgendaSection s={s} setS={setS} say={say} />}
        {section === 'noticias' && <NewsSection s={s} change={change} say={say} />}
        {section === 'ia' && <AISection s={s} change={change} reload={load} say={say} />}
        {section === 'voz' && <VoiceSection s={s} setS={setS} change={change} say={say} />}
        {section === 'actualizaciones' && <Updates s={s} setS={setS} say={say} />}
        {section === 'ayuda' && <Help s={s} say={say} />}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function Header({ title, text }) {
  return (
    <header className="section-head">
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </header>
  )
}

function General({ s, change }) {
  const g = s.general
  return (
    <>
      <Header title="General" text="Lo básico: cómo te llamás, dónde estás y cómo llamarme." />
      <Card title="Vos">
        <Row label="Tu nombre" hint="Así te saludo." htmlFor="nombre">
          <TextSetting id="nombre" value={g.nombre} placeholder="¿Cómo te llamás?" onSave={(nombre) => change({ nombre })} />
        </Row>
        <Row label="Tu ciudad" hint="Para el clima." htmlFor="ciudad">
          <TextSetting id="ciudad" value={g.ciudad} placeholder="Buenos Aires" onSave={(ciudad) => change({ ciudad })} />
        </Row>
      </Card>
      <Card title="Cómo llamarme" note="También podés decir «Pixie, ¿estás?» (se activa en Voz) o tocar mi cara. Clic derecho en mi cara abre mi menú.">
        <Row label="Atajo de teclado" hint="Tiene que llevar Ctrl o Alt. Si otro programa ya lo usa, te aviso.">
          <ShortcutPicker current={g.atajo} onChange={(atajo) => change({ atajo })} />
        </Row>
      </Card>
      <Card title="Comportamiento">
        <Row label="Arrancar con Windows" hint="Me abro sola cuando prendés la compu.">
          <Toggle label="Arrancar con Windows" on={g.arrancarConWindows} onChange={(v) => change({ arrancarConWindows: v })} />
        </Row>
        <Row label="Recordatorios de salud" hint="Te pregunto si tomaste agua y te propongo pausas.">
          <Toggle label="Recordatorios de salud" on={g.recordatoriosSalud} onChange={(v) => change({ recordatoriosSalud: v })} />
        </Row>
        <Row label="Avisos al celular" hint="Si no estás frente a la compu, los recordatorios te llegan por WhatsApp (si lo configuraste).">
          <Toggle label="Avisos al celular" on={g.avisosAlCelular} onChange={(v) => change({ avisosAlCelular: v })} />
        </Row>
      </Card>
    </>
  )
}

function Personalization({ s, change }) {
  return (
    <>
      <Header title="Personalización" text="Elegí qué muestro en mi pantallita cuando no me estás usando." />
      <Card note="Cuando te hablo, reacciono o me llamás, vuelve mi cara. El clima del resumen se actualiza cada media hora.">
        <StandbyPicker value={s.apariencia.pantallaReposo} onChange={(pantallaReposo) => change({ pantallaReposo })} />
      </Card>
    </>
  )
}

function AgendaSection({ s, setS, say }) {
  const list = s.agenda.calendarios
  const hint = (c) => {
    if (c.error) return `No lo pude leer: ${c.error}`
    if (!c.proximos) return 'Nada en los próximos 7 días.'
    return `${c.proximos} ${c.proximos === 1 ? 'cosa' : 'cosas'} en los próximos 7 días.`
  }
  return (
    <>
      <Header title="Agenda" text="Sumá tu Google Calendar y las materias de Classroom: te aviso antes de cada cosa y te las cuento cuando me preguntás «¿qué tengo hoy?»." />
      {list.length > 0 && (
        <Card title="Tus calendarios" note="El interruptor es para los avisos: 15 minutos antes de cada clase o evento, y la noche anterior y a la mañana de cada entrega.">
          {list.map((c) => (
            <Row key={c.id} label={c.nombre} hint={hint(c)}>
              <div className="buttons">
                <Toggle label={`Avisarme de ${c.nombre}`} on={c.avisos} onChange={async (v) => setS(await api.settings.calendarAlerts(c.id, v))} />
                <button
                  type="button"
                  className="button danger"
                  onClick={async () => {
                    setS(await api.settings.removeCalendar(c.id))
                    say(`Saqué «${c.nombre}».`)
                  }}
                >
                  Quitar
                </button>
              </div>
            </Row>
          ))}
        </Card>
      )}
      <Card title={list.length ? 'Sumar otro calendario' : 'Sumar un calendario'}>
        <CalendarWizard
          onAdded={(r) => {
            setS(r)
            say(r.mensaje)
          }}
        />
      </Card>
      <Card
        title="Privacidad"
        note="Con la dirección secreta cualquiera puede ver tu calendario: la guardo cifrada solo en esta compu (no va al respaldo) y no se la paso a nadie. Si la querés anular, en Google Calendar tocá «Restablecer» al lado de la dirección secreta."
      />
    </>
  )
}

const NEWS_ALERT_OPTIONS = [
  ['nunca', 'Nunca', 'Solo cuando me las pedís.'],
  ['aveces', 'A veces', 'Unas 2 veces por día te cuento un titular nuevo.'],
  ['seguido', 'Más seguido', 'Unas 4 veces por día.']
]
const NEWS_EXAMPLES = ['«¿Qué noticias hay?»', '«Noticias de TN»', '«Noticias sobre el dólar»', '«Más noticias»', '«Abrí la segunda»']

function NewsSection({ s, change, say }) {
  const n = s.noticias
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const setSource = (id, on) => {
    const next = on ? [...new Set([...n.fuentes, id])] : n.fuentes.filter((f) => f !== id)
    if (!next.length) return say('Dejá al menos un diario prendido.')
    change({ noticiasFuentes: next })
  }
  return (
    <>
      <Header title="Noticias" text="Te cuento lo último de Infobae y TN cuando me lo pedís y, si querés, de vez en cuando por mi cuenta." />
      <Card title="De dónde">
        <Row label="Infobae">
          <Toggle label="Infobae" on={n.fuentes.includes('infobae')} onChange={(v) => setSource('infobae', v)} />
        </Row>
        <Row label="TN">
          <Toggle label="TN" on={n.fuentes.includes('tn')} onChange={(v) => setSource('tn', v)} />
        </Row>
      </Card>
      <Card title="Por mi cuenta" note="Solo de 9 a 22, y nunca mientras estudiás, jugás o estás en una reunión. No leo titulares para adultos ni violentos.">
        <div className="choices" role="radiogroup" aria-label="Noticias por mi cuenta">
          {NEWS_ALERT_OPTIONS.map(([id, name, text]) => (
            <button key={id} type="button" role="radio" aria-checked={n.avisos === id} className={`choice${n.avisos === id ? ' selected' : ''}`} onClick={() => change({ noticiasAvisos: id })}>
              <span className="choice-title">{name}</span>
              <span className="choice-text">{text}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Lo último">
        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setPreview(await api.settings.previewNews())
            setLoading(false)
          }}
        >
          {loading ? 'Buscando…' : 'Ver los titulares'}
        </button>
        {preview &&
          (preview.ok ? (
            <ul className="examples headlines">
              {preview.titulares.map((t) => (
                <li key={t.titulo}>
                  {t.titulo} <span className="source">({t.fuente})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status error">{preview.mensaje}</p>
          ))}
      </Card>
      <Card title="Cosas para pedirme">
        <ul className="examples">
          {NEWS_EXAMPLES.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function AISection({ s, change, reload, say }) {
  const ia = s.ia
  const [replacing, setReplacing] = useState(false)
  const [testing, setTesting] = useState(false)
  const test = async () => {
    setTesting(true)
    const r = await api.settings.testKey(null)
    setTesting(false)
    say(r.mensaje)
  }
  return (
    <>
      <Header title="Inteligencia artificial" text="Con la IA entiendo cualquier frase, charlo, miro tu pantalla y te entiendo cuando me hablás." />
      <Card title={ia.tieneClave ? `Conectada a ${ia.proveedor ?? 'la IA'}` : 'Todavía sin IA'}>
        <Row label="Usar la IA" hint="Si la apagás, sigo funcionando con mis reglas para las órdenes cortas.">
          <Toggle label="Usar la IA" on={ia.activa} onChange={(v) => change({ iaActiva: v })} />
        </Row>
        {ia.tieneClave && !replacing && (
          <Row label="Clave" hint={`${ia.clave} · guardada cifrada en esta compu${ia.modelo ? ` · modelo ${ia.modelo}` : ''}`}>
            <div className="buttons">
              <button type="button" className="button secondary" onClick={test} disabled={testing}>
                {testing ? 'Probando…' : 'Probar'}
              </button>
              <button type="button" className="button secondary" onClick={() => setReplacing(true)}>
                Cambiar
              </button>
              <button
                type="button"
                className="button danger"
                onClick={async () => {
                  await api.settings.forgetKey()
                  reload()
                  say('Borré la clave.')
                }}
              >
                Borrar
              </button>
            </div>
          </Row>
        )}
        {(!ia.tieneClave || replacing) && (
          <KeyWizard
            onDone={() => {
              setReplacing(false)
              reload()
            }}
          />
        )}
      </Card>
      <Card
        title="Gratis"
        note="El plan gratis de Gemini alcanza para unos 500 pedidos por día. En el plan gratis, Google puede usar lo que le mandás para mejorar sus productos: no le pases datos privados."
      />
    </>
  )
}

function VoiceSection({ s, setS, change, say }) {
  return (
    <>
      <Header title="Voz" text="Cómo me llamás con la voz y cómo sueno cuando te contesto." />
      <Card
        title="Llamame con la voz"
        note="Te escucho solo en esta compu: no mando audio a internet hasta que me llamás. Mientras esté prendido, Windows muestra el ícono del micrófono en la barra de tareas. Para entender lo que me pedís después de llamarme, uso la IA."
      >
        <WakeTrainer palabra={s.voz.palabra} change={change} setS={setS} />
      </Card>
      <Card title="Cómo sueno">
        <div className="choices" role="radiogroup" aria-label="Voz">
          {VOICES.map(([id, name, text]) => (
            <button key={id} type="button" role="radio" aria-checked={s.voz.modo === id} className={`choice${s.voz.modo === id ? ' selected' : ''}`} onClick={() => change({ vozModo: id })}>
              <span className="choice-title">{name}</span>
              <span className="choice-text">{text}</span>
            </button>
          ))}
        </div>
        <p className="note">{s.voz.estado}</p>
        <button
          type="button"
          className="button"
          onClick={async () => {
            await api.settings.testVoice()
            say('¡Escuchá a Pixie!')
          }}
        >
          Probar voz
        </button>
      </Card>
    </>
  )
}

function Updates({ s, setS, say }) {
  const u = s.actualizaciones
  const [checking, setChecking] = useState(false)
  return (
    <>
      <Header title="Actualizaciones" text="Me fijo sola si hay una versión nueva al arrancar y cada 6 horas." />
      <Card title={`Versión ${s.version}`}>
        <p className="big-status">{u.texto}</p>
        <div className="buttons">
          {u.state === 'ready' ? (
            <button type="button" className="button" onClick={() => api.settings.installUpdate()}>
              Instalar la {u.available} y reiniciar
            </button>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={checking || u.state === 'dev' || u.state === 'downloading'}
              onClick={async () => {
                setChecking(true)
                const r = await api.settings.checkUpdates()
                setChecking(false)
                setS(r)
                say(r.actualizaciones.texto)
              }}
            >
              {checking ? 'Buscando…' : 'Buscar ahora'}
            </button>
          )}
        </div>
      </Card>
    </>
  )
}

const EXAMPLES = ['«Poné música para estudiar»', '«Recordame la prueba del jueves»', '«¿Qué tengo que entregar?»', '«¿Qué noticias hay?»', '«¿Qué ves en mi pantalla?»', '«Cambiá el atajo a Ctrl+Alt+P»', '«Juguemos»']

function Help({ s, say }) {
  return (
    <>
      <Header title="Ayuda" text="Si algo no anda, mandale el informe al equipo." />
      <Card title="Si algo falla" note="El informe trae la versión, la IA y la voz que uso y mis últimos errores, sin claves, contraseñas ni teléfonos.">
        <Row label="Informe de diagnóstico" hint={s.ayuda.errores ? `Anoté ${s.ayuda.errores} error${s.ayuda.errores === 1 ? '' : 'es'} desde que arranqué.` : 'No anoté errores desde que arranqué.'}>
          <button
            type="button"
            className="button"
            onClick={async () => {
              await api.settings.copyReport()
              say('¡Copiado! Pegalo con Ctrl+V donde lo quieras mandar.')
            }}
          >
            Copiar informe
          </button>
        </Row>
        <Row label="Mi carpeta" hint="Donde guardo la configuración, la memoria y los errores.">
          <button type="button" className="button secondary" onClick={() => api.settings.openFolder()}>
            Abrir carpeta
          </button>
        </Row>
      </Card>
      <Card title="Cosas para pedirme">
        <ul className="examples">
          {EXAMPLES.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Card>
    </>
  )
}
