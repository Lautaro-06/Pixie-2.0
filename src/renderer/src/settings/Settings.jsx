// La ventana de Ajustes: todo lo que antes había que tocar en config.json.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Card, Row, Toggle, TextSetting, ShortcutPicker, StandbyPicker, KeyWizard, LedScreen, WakeTrainer, CalendarWizard } from './parts.jsx'

// El menú, agrupado: lo de Pixie, el estudio, lo que se conecta con otras cosas y el sistema
const NAV = [
  [null, [['inicio', 'Inicio']]],
  ['Pixie', [['general', 'Vos y Pixie'], ['voz', 'Voz y escucha'], ['ia', 'Inteligencia artificial'], ['memoria', 'Memoria y privacidad']]],
  ['Trabajo', [['trabajo', 'Modo Trabajo']]],
  ['Estudio', [['pomodoro', 'Pomodoro'], ['estudio', 'Mi estudio']]],
  ['Conexiones', [['whatsapp', 'WhatsApp'], ['agenda', 'Agenda y Gmail'], ['noticias', 'Noticias'], ['apps', 'Apps y mapas']]],
  ['Sistema', [['actualizaciones', 'Actualizaciones y ayuda']]]
]
const SECTIONS = NAV.flatMap(([, items]) => items)
// Los nombres viejos de las secciones (desde el menú de Pixie o pedidos por voz)
const ALIASES = { personalizacion: 'general', mapas: 'apps', ayuda: 'actualizaciones' }
const sectionFor = (id) => ALIASES[id] ?? (SECTIONS.some(([x]) => x === id) ? id : 'inicio')

const VOICES = [
  ['natural', 'Natural (argentina)', 'Suena más humana y anda sin internet. Se baja una sola vez (unos 135 MB).'],
  ['windows', 'La de Windows', 'La voz que ya trae la compu.'],
  ['gemini', 'Gemini', 'Muy natural, pero solo 10 frases gratis por día; después vuelve a la de Windows.']
]

export default function Settings({ section: initial = 'inicio' }) {
  const [s, setS] = useState(null)
  const [section, setSection] = useState(sectionFor(initial))
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
        {NAV.map(([group, items]) => (
          <div key={group ?? 'inicio'} className="nav-group">
            {group && <p className="nav-label">{group}</p>}
            {items.map(([id, name]) => (
              <button key={id} type="button" className={`nav${section === id ? ' active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>
                {name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <main className="content">
        {section === 'inicio' && <Home s={s} go={setSection} />}
        {section === 'general' && <General s={s} change={change} />}
        {section === 'memoria' && <MemorySection s={s} setS={setS} say={say} />}
        {section === 'trabajo' && <WorkSection s={s} setS={setS} change={change} say={say} />}
        {section === 'whatsapp' && <WhatsAppSection s={s} setS={setS} change={change} say={say} />}
        {section === 'agenda' && <AgendaSection s={s} setS={setS} change={change} say={say} />}
        {section === 'pomodoro' && <PomodoroSection s={s} setS={setS} change={change} say={say} />}
        {section === 'estudio' && <StudySection s={s} setS={setS} change={change} say={say} />}
        {section === 'noticias' && <NewsSection s={s} change={change} say={say} />}
        {section === 'apps' && (
          <>
            <AppsSection s={s} setS={setS} change={change} say={say} />
            <MapsSection s={s} change={change} />
          </>
        )}
        {section === 'ia' && <AISection s={s} change={change} reload={load} say={say} />}
        {section === 'voz' && <VoiceSection s={s} setS={setS} change={change} say={say} />}
        {section === 'actualizaciones' && (
          <>
            <Updates s={s} setS={setS} say={say} />
            <Help s={s} say={say} />
          </>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Inicio: cómo está todo, de un vistazo ──
function Home({ s, go }) {
  const ext = s.agenda?.mails?.extension ?? s.agenda?.classroom?.extension ?? {}
  const w = s.whatsapp
  const e = s.estudio?.resumen
  const items = [
    {
      id: 'ia',
      title: 'Inteligencia artificial',
      ok: s.ia.tieneClave && s.ia.activa,
      text: !s.ia.tieneClave ? 'Sin clave: entiendo solo pedidos simples. Es gratis y lleva un minuto.' : s.ia.activa ? `Conectada a ${s.ia.proveedor ?? 'la IA'}.` : 'Está apagada.'
    },
    {
      id: 'voz',
      title: '«Pixie, ¿estás?»',
      ok: s.voz.palabra.grabada && s.voz.palabra.activa,
      text: !s.voz.palabra.grabada ? 'Falta grabar tu voz para que me llames sin tocar nada.' : s.voz.palabra.activa ? 'Te escucho cuando me llamás.' : 'Está apagado.'
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      ok: Boolean(w?.configurado),
      text: w?.configurado ? (w.ultimo && !w.ultimo.ok ? `El último no salió: ${w.ultimo.error}` : 'Te mando los recordatorios y los timers.') : 'Falta activarlo para que te lleguen los recordatorios.'
    },
    {
      id: 'agenda',
      title: 'Extensión de Chrome',
      ok: Boolean(ext.conectada),
      text: ext.conectada ? 'Conectada: leo Gmail y Classroom.' : 'Falta instalarla para Gmail, Classroom y YouTube.'
    },
    {
      id: 'estudio',
      title: 'Estudio',
      ok: true,
      text: !e || (!e.racha && !e.hoyMin && !e.semanaMin)
        ? 'Todavía no hay estudio anotado: arrancá un Pomodoro y lo voy anotando.'
        : `${e.racha ? `Racha de ${e.racha} ${e.racha === 1 ? 'día' : 'días'}` : 'Sin racha por ahora'}; ${e.hoyMin ? `hoy estudiaste ${minutesLabel(e.hoyMin)}` : 'hoy todavía no estudiaste'}.`
    },
    {
      id: 'actualizaciones',
      title: `Versión ${s.version}`,
      ok: s.actualizaciones.state !== 'ready' && s.actualizaciones.state !== 'error',
      text: s.actualizaciones.texto
    }
  ]
  const name = s.general.nombre ? `, ${s.general.nombre}` : ''
  return (
    <>
      <Header title={`Hola${name}`} text="Acá ves cómo está todo. Lo que dice «Falta» se arregla tocando «Configurar»." />
      <div className="home-grid">
        {items.map((it) => (
          <section key={it.id} className="home-card">
            <div className="home-head">
              <span className={`state-dot ${it.ok ? 'ok' : 'todo'}`} aria-hidden="true" />
              <strong>{it.title}</strong>
              <span className={`state-tag ${it.ok ? 'ok' : 'todo'}`}>{it.ok ? 'Listo' : 'Falta'}</span>
            </div>
            <p>{it.text}</p>
            <button type="button" className="button secondary" onClick={() => go(it.id)}>
              {it.ok ? 'Ver' : 'Configurar'}
            </button>
          </section>
        ))}
      </div>
      <Card title="Cosas para pedirme">
        <ul className="examples">
          {EXAMPLES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function WorkSection({ s, setS, change, say }) {
  const work = s.trabajo
  const [projectName, setProjectName] = useState('')
  const [projectFolder, setProjectFolder] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const update = (patch) => change({ trabajo: patch })
  const updateProfiles = (id, checked) => {
    const active = new Set(work.perfilesActivos)
    if (checked) active.add(id)
    else active.delete(id)
    const perfilesActivos = [...active]
    update({ perfilesActivos, habilitado: perfilesActivos.length ? true : work.habilitado })
  }
  const activeProfiles = work.perfiles.filter((profile) => profile.activo)
  const programmerActive = activeProfiles.some((profile) => profile.id === 'programador')
  const addProject = () => {
    const nombre = projectName.trim()
    const carpeta = projectFolder.trim()
    if (!nombre || !carpeta) return say('Poné el nombre y la ruta de la carpeta del proyecto.')
    update({ proyectos: [...work.proyectos, { nombre, carpeta }] })
    setProjectName('')
    setProjectFolder('')
  }
  const clear = async () => {
    const result = await api.settings.clearWork()
    setS(result)
    setConfirmClear(false)
    if (result?.mensaje) say(result.mensaje)
  }
  return (
    <>
      <Header title="Modo Trabajo" text="Elegí cómo querés que Pixie te acompañe en tu trabajo. Podés cambiarlo o apagarlo cuando quieras." />
      <Card title="Perfiles">
        <Row label="Modo Trabajo" hint="Combina las instrucciones y herramientas de los perfiles activos.">
          <Toggle label="Modo Trabajo" on={work.habilitado} onChange={(habilitado) => update({ habilitado })} />
        </Row>
        <Row label="Sugerencias de perfiles" hint="Pixie puede sugerir un perfil según el tiempo acumulado por app; nunca lo activa sin tu respuesta.">
          <Toggle label="Sugerencias de perfiles" on={!work.deteccion?.deshabilitada} onChange={(sugerenciasPerfiles) => update({ sugerenciasPerfiles })} />
        </Row>
        <div className="work-profiles">
          {work.perfiles.map((profile) => (
            <label className="work-profile" key={profile.id}>
              <input type="checkbox" checked={profile.activo} onChange={(event) => updateProfiles(profile.id, event.target.checked)} />
              <span>
                <strong>{profile.nombre}</strong>
                <span>{profile.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
        <Row label="Estoy buscando trabajo" hint="Se guarda como preferencia; todavía no activa recomendaciones de empleo.">
          <Toggle label="Estoy buscando trabajo" on={work.buscandoTrabajo} onChange={(buscandoTrabajo) => update({ buscandoTrabajo })} />
        </Row>
      </Card>
      {activeProfiles.map((profile) => (
        <Card key={profile.id} title={`Funciones: ${profile.nombre}`}>
          {profile.id === 'programador' && (
            <>
              <p>Git con una lista cerrada de operaciones y confirmación para cambios; creación de proyectos con archivos iniciales; búsqueda en documentación. Pedile estas tareas por el chat de Pixie.</p>
              <ul className="work-feature-list">
                <li>Estado, diff, historial, ramas, agregar archivos y commit, pull o push.</li>
                <li>Crear un proyecto con README, .gitignore, carpetas iniciales e inicio de Git.</li>
                <li>Buscar en README y docs; funciona sin IA con coincidencias por palabras clave.</li>
              </ul>
              <p className="hint">Ejemplos: «git status», «creá un proyecto llamado demo en la carpeta de proyectos» y «buscá en la documentación sobre instalación».</p>
            </>
          )}
          {profile.id === 'cientifico' && (
            <>
              <p>Busca publicaciones reales en Crossref y muestra título, autores, año y DOI; solo recomienda resultados que devolvió la fuente. También puede recordar temas de interés y guardar lecturas pendientes.</p>
              <p className="hint">Ejemplos: «buscá papers sobre sueño y memoria», «guardá la lectura 1» y «anotá que me interesa investigar sueño». La búsqueda requiere internet, no una clave de IA.</p>
            </>
          )}
          {profile.id === 'disenador' && (
            <>
              <p>Con IA, ayuda a armar briefs, explorar ideas, proponer paletas y combinaciones tipográficas, y separar referencias de propuestas creativas.</p>
              <p className="hint">Ejemplos: «armemos el brief de una app para…» y «proponeme una paleta accesible para…».</p>
            </>
          )}
          {profile.id === 'libre' && (
            <>
              <div className="work-description">
                <label htmlFor="work-description">¿En qué consiste tu trabajo?</label>
                <TextSetting id="work-description" value={work.descripcionLibre} placeholder="Describí tu rubro, tareas y contexto" onSave={(descripcionLibre) => update({ descripcionLibre })} />
              </div>
              <p>Podés describir cualquier profesión o actividad. Pixie adaptará la conversación sin suponer que su conocimiento es exhaustivo o está actualizado; elegí documentación de referencia si querés que la consulte.</p>
            </>
          )}
          <KnowledgeSourceEditor
            profile={profile}
            sources={work.fuentesConocimiento ?? []}
            save={(fuentesConocimiento) => update({ fuentesConocimiento })}
            say={say}
          />
        </Card>
      ))}
      {programmerActive && (
        <Card title="Proyectos de programación" note="Pixie solo consultará documentación de carpetas que agregues acá.">
          {work.proyectos.length ? (
            <ul className="work-projects">
              {work.proyectos.map((project) => (
                <li key={project.carpeta}>
                  <span><strong>{project.nombre}</strong><small>{project.carpeta}</small></span>
                  <button type="button" className="button secondary" onClick={() => update({ proyectos: work.proyectos.filter((item) => item.carpeta !== project.carpeta) })}>Quitar</button>
                </li>
              ))}
            </ul>
          ) : <p className="hint">Todavía no agregaste proyectos.</p>}
          <div className="work-project-form">
            <TextSetting id="work-project-name" value={projectName} placeholder="Nombre del proyecto" onSave={setProjectName} />
            <TextSetting id="work-project-folder" value={projectFolder} placeholder="Ruta de la carpeta" onSave={setProjectFolder} />
            <button type="button" className="button secondary" onClick={addProject}>Agregar proyecto</button>
          </div>
        </Card>
      )}
      <Card title="Datos del Modo Trabajo" note="Borra los perfiles elegidos, descripciones, proyectos, fuentes y preferencias de detección. No se puede deshacer.">
        {confirmClear ? (
          <div className="buttons">
            <button type="button" className="button danger" onClick={clear}>Sí, borrar los datos</button>
            <button type="button" className="button secondary" onClick={() => setConfirmClear(false)}>Cancelar</button>
          </div>
        ) : <button type="button" className="button secondary" onClick={() => setConfirmClear(true)}>Borrar datos del Modo Trabajo</button>}
      </Card>
    </>
  )
}

function KnowledgeSourceEditor({ profile, sources, save, say }) {
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')
  const ownSources = sources.filter((source) => source.perfilId === profile.id)
  const add = () => {
    const nombre = name.trim()
    const carpeta = folder.trim()
    if (!nombre || !carpeta) return say('Poné un nombre y la ruta de la carpeta de documentación.')
    save([...sources, { id: crypto.randomUUID(), nombre, carpeta, perfilId: profile.id }])
    setName('')
    setFolder('')
  }
  return (
    <div className="work-knowledge">
      <h3>Fuentes de referencia elegidas</h3>
      <p className="hint">Pixie solo leerá estas carpetas cuando consultes. Busca documentos de texto (por ejemplo, Markdown) en la carpeta y sus subcarpetas; no lee código.</p>
      {ownSources.length > 0 && (
        <ul className="work-projects">
          {ownSources.map((source) => (
            <li key={source.id ?? source.carpeta}>
              <span><strong>{source.nombre}</strong><small>{source.carpeta}</small></span>
              <button type="button" className="button secondary" onClick={() => save(sources.filter((item) => item !== source))}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="work-project-form">
        <TextSetting id={`work-source-name-${profile.id}`} value={name} placeholder="Nombre de la fuente" label="Nombre de la fuente" onSave={setName} />
        <TextSetting id={`work-source-folder-${profile.id}`} value={folder} placeholder="Ruta absoluta de la carpeta" label="Ruta absoluta de la carpeta" onSave={setFolder} />
        <button type="button" className="button secondary" onClick={add}>Agregar fuente</button>
      </div>
      {ownSources.length > 0 && <p className="hint">Ejemplo: «buscá en mis fuentes sobre normas de seguridad».</p>}
    </div>
  )
}

// ── WhatsApp: los recordatorios al celular ──
function WhatsAppSection({ s, setS, change, say }) {
  const w = s.whatsapp
  const [busy, setBusy] = useState(null)
  if (!w) return <Header title="WhatsApp" text="Todavía estoy arrancando." />
  const run = async (accion) => {
    setBusy(accion)
    try {
      const r = await api.settings.whatsapp({ accion })
      setS(r)
      if (r?.mensaje) say(r.mensaje)
    } finally {
      setBusy(null)
    }
  }
  const status = w.configurado
    ? `Listo: te escribo al ${w.telefono}.`
    : !w.telefono
      ? 'Falta tu número.'
      : !w.tieneClave
        ? 'Falta la clave que te manda el bot.'
        : 'Falta revisar el número.'
  return (
    <>
      <Header title="WhatsApp" text="Te mando por WhatsApp los recordatorios de tu agenda y los timers, apenas se cumplen. Solo a tu número." />
      <Card
        title={w.configurado ? 'Activado' : 'Activalo en 3 pasos'}
        note="Usa CallMeBot, un servicio gratis para mandarte mensajes a vos mismo. Tu número y la clave quedan solo en esta compu (la clave, cifrada)."
      >
        <p className={`big-status${w.configurado ? ' ok' : ''}`}>{status}</p>
        <ol className="setup-steps">
          <li>
            <div className="row-text">
              <label htmlFor="wpp-tel">Tu número</label>
              <p className="hint">Con el código de país: en Argentina, +54 9 y el número sin el 15.</p>
            </div>
            <TextSetting id="wpp-tel" value={w.telefono} placeholder="+54 9 11 1234 5678" onSave={(whatsappTelefono) => change({ whatsappTelefono })} />
          </li>
          <li>
            <div className="row-text">
              <label>Activá el bot desde ese celular</label>
              <p className="hint">
                Se abre WhatsApp con el mensaje «{w.activacion}» para el {w.bot}. Tocá Enviar: el bot te contesta con tu clave (APIKEY).
              </p>
            </div>
            <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => run('activar')}>
              Abrir WhatsApp
            </button>
          </li>
          <li>
            <div className="row-text">
              <label htmlFor="wpp-clave">Pegá la clave</label>
              <p className="hint">{w.tieneClave ? 'Ya tengo una guardada. Pegá otra si la querés cambiar.' : 'Los números que te mandó el bot, o copiá su mensaje entero y tocá «Buscar en lo copiado».'}</p>
            </div>
            <div className="inline-controls">
              <TextSetting id="wpp-clave" value="" clearOnSave placeholder={w.tieneClave ? 'Guardada' : '123456'} onSave={(whatsappClave) => change({ whatsappClave })} />
              <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => run('portapapeles')}>
                Buscar en lo copiado
              </button>
            </div>
          </li>
        </ol>
        <div className="buttons">
          <button type="button" className="button" disabled={!w.configurado || Boolean(busy)} onClick={() => run('probar')}>
            {busy === 'probar' ? 'Mandando…' : 'Mandarme un mensaje de prueba'}
          </button>
        </div>
        {w.ultimo && (
          <p className={`note ${w.ultimo.ok ? 'ok' : 'error'}`}>
            Último mensaje: {w.ultimo.ok ? `enviado ${ago(new Date(w.ultimo.at).getTime())}.` : `no salió. ${w.ultimo.error}`}
          </p>
        )}
      </Card>
      <Card title="Cuándo te escribo">
        <Row label="Avisarte al celular" hint="Los recordatorios de tu agenda y los timers.">
          <Toggle label="Avisarte al celular" on={w.avisos} onChange={(v) => change({ avisosAlCelular: v })} />
        </Row>
        <div className="choices" role="radiogroup" aria-label="Cuándo te escribo">
          {[
            ['siempre', 'Siempre', 'Te llega al celular apenas se cumple, aunque estés en la compu.'],
            ['ausente', 'Solo si no estás en la compu', 'Si estás usando la compu, te aviso solo en la pantalla.']
          ].map(([id, name, text]) => (
            <button key={id} type="button" role="radio" aria-checked={w.cuando === id} className={`choice${w.cuando === id ? ' selected' : ''}`} onClick={() => change({ whatsappCuando: id })}>
              <span className="choice-title">{name}</span>
              <span className="choice-text">{text}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Si no te llega" note="CallMeBot es gratis y a veces tarda unos segundos. Si cambia su número, aparece en su página.">
        <ul className="news-list">
          <li>Fijate que el número sea el del celular desde el que activaste el bot.</li>
          <li>Si el bot no te contestó con la clave, mandale el mensaje de nuevo o mirá su página por si cambió el número.</li>
          <li>Tocá «Mandarme un mensaje de prueba»: si algo está mal, te digo qué.</li>
        </ul>
        <div className="buttons">
          <button type="button" className="button secondary" onClick={() => run('pagina')}>
            Abrir la página de CallMeBot
          </button>
        </div>
      </Card>
    </>
  )
}

// ── Memoria y privacidad ──
function MemorySection({ s, setS, say }) {
  const m = s.memoria
  const [sure, setSure] = useState(null)
  const forget = async (que) => {
    const r = await api.settings.forgetMemory({ que })
    setS(r)
    setSure(null)
    if (r?.mensaje) say(r.mensaje)
  }
  const day = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <>
      <Header title="Memoria y privacidad" text="Me acuerdo de lo que hablamos aunque me cierre o me actualice. Todo queda solo en esta compu." />
      <Card title="Lo que me acuerdo" note="Preguntame «¿de qué hablamos ayer?», «¿qué te conté del viaje?» o «¿qué sabés de mí?».">
        <p className="big-status">
          {m.charlas === 1 ? '1 charla anotada' : `${m.charlas} charlas anotadas`}
          {m.personales > 0 && ` · ${m.personales === 1 ? '1 cosa personal' : `${m.personales} cosas personales`} que no nombro`}
        </p>
        {m.dias.length > 0 && (
          <>
            <h3 className="pomo-sub">Los últimos días</h3>
            <ul className="memory-days">
              {m.dias
                .slice()
                .reverse()
                .map((d) => (
                  <li key={d.fecha}>
                    <span className="memory-date">{day(d.fecha)}</span>
                    <span>{d.temas.length ? d.temas.join(', ') : 'charlas cortas'}</span>
                  </li>
                ))}
            </ul>
          </>
        )}
        {m.datos.length > 0 && (
          <>
            <h3 className="pomo-sub">Lo que me contaste</h3>
            <ul className="news-list">
              {m.datos.slice(0, 12).map((d) => (
                <li key={`${d.creado}-${d.texto}`}>{d.texto}</li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Card title="Lo personal">
        <p>
          Si me contás algo personal o sensible (tu salud, tu familia, tu pareja, la plata o tus creencias), me lo acuerdo pero no lo saco yo: no te pregunto por eso ni lo nombro en un resumen. Solo hablo de eso si vos lo traés.
        </p>
        <p>Las contraseñas, los números de tarjeta, el CBU, el DNI y las claves no los guardo nunca.</p>
      </Card>
      <Card title="Borrar" note="Lo que borrás no se puede recuperar.">
        <div className="buttons">
          {sure === 'charlas' ? (
            <>
              <button type="button" className="button danger" onClick={() => forget('charlas')}>
                Sí, borrar las charlas
              </button>
              <button type="button" className="button secondary" onClick={() => setSure(null)}>
                No
              </button>
            </>
          ) : sure === 'todo' ? (
            <>
              <button type="button" className="button danger" onClick={() => forget('todo')}>
                Sí, borrar todo
              </button>
              <button type="button" className="button secondary" onClick={() => setSure(null)}>
                No
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button secondary" onClick={() => setSure('charlas')} disabled={!m.charlas}>
                Borrar nuestras charlas
              </button>
              <button type="button" className="button secondary" onClick={() => setSure('todo')}>
                Borrar todo lo que sé de vos
              </button>
            </>
          )}
        </div>
      </Card>
    </>
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

// ── Pomodoro: el plan de estudio en bloques ──
const POMODORO_TIMES = [30, 60, 90, 120, 180, 240]
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const minutesLabel = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`)
const leftLabel = (ms) => {
  const min = Math.ceil(ms / 60000)
  return min <= 1 ? 'menos de un minuto' : `${min} minutos`
}
const BLOCK_NAMES = { estudio: 'Estudio', descanso: 'Descanso', largo: 'Descanso largo' }

// Los bloques en una barra (cada uno del largo de lo que dura) y la lista con los horarios
function PlanBlocks({ bloques, current = null, times = true }) {
  const total = bloques.reduce((s, b) => s + b.minutos, 0) || 1
  return (
    <div className="pomo-plan">
      <div className="pomo-bar" role="img" aria-label={`${bloques.filter((b) => b.tipo === 'estudio').length} bloques de estudio con sus descansos`}>
        {bloques.map((b, i) => (
          <span
            key={i}
            className={`pomo-seg ${b.tipo}${current === i ? ' current' : ''}${current !== null && i < current ? ' done' : ''}`}
            style={{ flexGrow: b.minutos / total }}
            title={`${BLOCK_NAMES[b.tipo]} · ${b.minutos} min`}
          />
        ))}
      </div>
      <ol className="pomo-list">
        {bloques.map((b, i) => (
          <li key={i} className={`${b.tipo}${current === i ? ' current' : ''}${current !== null && i < current ? ' done' : ''}`}>
            {times && <span className="pomo-time">{hhmm(b.desde)}</span>}
            <span>{b.tipo === 'estudio' ? `Bloque ${b.n}` : BLOCK_NAMES[b.tipo]}</span>
            <span className="pomo-min">{b.minutos} min</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function PomodoroSection({ s, setS, change, say }) {
  const p = s.pomodoro
  const ses = p.sesion
  const [busy, setBusy] = useState(null)
  const [advice, setAdvice] = useState(null) // { ia, consejos } para este plan
  const [custom, setCustom] = useState(String(p.minutos))
  const planKey = `${p.minutos}-${p.metodo}-${p.materia}`
  useEffect(() => {
    setAdvice(null)
    setCustom(String(p.minutos))
  }, [planKey, p.minutos])

  const control = async (accion) => {
    setBusy(accion)
    try {
      const r = await api.settings.pomodoro(accion)
      setS(r)
      if (r?.mensaje) say(r.mensaje)
    } finally {
      setBusy(null)
    }
  }
  const askAdvice = async () => {
    setBusy('consejos')
    try {
      setAdvice(await api.settings.pomodoroAdvice())
    } finally {
      setBusy(null)
    }
  }
  const saveCustom = () => {
    const n = Number.parseInt(custom, 10)
    if (n && n !== p.minutos) change({ pomodoroMinutos: n })
    else setCustom(String(p.minutos))
  }
  const last = p.plan.bloques.at(-1)
  const tips = advice?.consejos ?? p.plan.consejos

  return (
    <>
      <Header
        title="Pomodoro"
        text="Para estudiar en bloques. Decime «quiero estudiar química 2 horas» o armalo acá. Mientras estudiás no te molesto, te aviso si te distraés y en los últimos 2 minutos de cada bloque te ofrezco un mini test."
      />
      {ses.activo && (
        <Card title="Ahora">
          <p className="big-status">
            {ses.fase === 'estudio' ? `Bloque ${ses.bloque} de ${ses.bloques}` : 'Descanso'}
            {ses.materia ? ` de ${ses.materia}` : ''}: {ses.pausado ? 'en pausa, ' : ''}faltan {leftLabel(ses.restanteMs)}.
          </p>
          {ses.estudiadoMin > 0 && (
            <p className="pomo-progress">
              Llevás {minutesLabel(ses.estudiadoMin)} de {minutesLabel(ses.planeadoMin)} de estudio
              {ses.foco !== null && <> · foco {ses.foco}%</>}
            </p>
          )}
          <PlanBlocks bloques={ses.plan} current={ses.indice} times={false} />
          <div className="buttons">
            <button type="button" className="button" disabled={Boolean(busy)} onClick={() => control(ses.pausado ? 'seguir' : 'pausar')}>
              {ses.pausado ? 'Seguir' : 'Pausar'}
            </button>
            <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => control('saltar')}>
              {ses.fase === 'estudio' ? 'Pasar al descanso' : 'Saltar el descanso'}
            </button>
            <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => control('terminar')}>
              Terminar por hoy
            </button>
          </div>
          <p className="note">También podés tocar el temporizador en mi pantallita para pausarlo.</p>
        </Card>
      )}
      <Card title={ses.activo ? 'El próximo plan' : 'Tu plan'} note="El plan lo armo sin IA. Con IA, además te doy consejos a medida para cada bloque.">
        <div className="pomo-field">
          <div className="row-text">
            <label>Tiempo que tenés</label>
            <p className="hint">Lo que tenés libre para estudiar, con los descansos incluidos.</p>
          </div>
          <div className="pomo-times">
            <div className="segmented" role="radiogroup" aria-label="Tiempo que tenés">
              {POMODORO_TIMES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={p.minutos === m} className={p.minutos === m ? 'selected' : ''} onClick={() => change({ pomodoroMinutos: m })}>
                  {minutesLabel(m)}
                </button>
              ))}
            </div>
            <label className="pomo-custom">
              <span>Otro:</span>
              <input
                className="field"
                type="number"
                min="15"
                max="480"
                step="5"
                value={custom}
                aria-label="Minutos que tenés para estudiar"
                onChange={(e) => setCustom(e.target.value)}
                onBlur={saveCustom}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <span>min</span>
            </label>
          </div>
        </div>
        <Row label="Materia o tema" hint="Opcional: así te recomiendo cómo estudiarla." htmlFor="pomodoro-materia">
          <TextSetting id="pomodoro-materia" value={p.materia} placeholder="Química, Historia, Inglés…" onSave={(pomodoroMateria) => change({ pomodoroMateria })} />
        </Row>
        <h3 className="pomo-sub">¿Qué vas a hacer?</h3>
        <div className="choices pomo-types" role="radiogroup" aria-label="Qué vas a hacer">
          {p.tipos.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={p.tipo === t.id}
              className={`choice${p.tipo === t.id ? ' selected' : ''}`}
              onClick={() => change({ pomodoroTipo: p.tipo === t.id ? '' : t.id })}
            >
              <span className="choice-title">{t.nombre}</span>
              <span className="choice-text">{t.texto}</span>
            </button>
          ))}
        </div>
        <h3 className="pomo-sub">Método</h3>
        <div className="choices pomo-methods" role="radiogroup" aria-label="Método">
          {p.metodos.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={p.metodo === m.id} className={`choice${p.metodo === m.id ? ' selected' : ''}`} onClick={() => change({ pomodoroMetodo: m.id })}>
              <span className="choice-title">{m.nombre}</span>
              <span className="choice-text">{m.texto}</span>
            </button>
          ))}
        </div>
        {p.porque && <p className="note pomo-why">{p.porque}</p>}
        {p.plan.bloques.length ? (
          <>
            <p className="pomo-summary">
              {p.plan.bloques.filter((b) => b.tipo === 'estudio').length} bloques · {minutesLabel(p.plan.estudioMin)} de estudio · si arrancás ahora, terminás a las {hhmm(last.hasta)}
            </p>
            <PlanBlocks bloques={p.plan.bloques} />
          </>
        ) : (
          <p className="big-status">{p.plan.texto}</p>
        )}
        <h3 className="pomo-sub">{advice?.ia ? 'Consejos de la IA para cada bloque' : 'Qué hacer en cada bloque'}</h3>
        <ul className="news-list">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <div className="buttons">
          {!ses.activo && (
            <button type="button" className="button" disabled={Boolean(busy) || !p.plan.bloques.length} onClick={() => control('empezar')}>
              {busy === 'empezar' ? 'Arrancando…' : 'Arrancar ahora'}
            </button>
          )}
          {s.ia.tieneClave && s.ia.activa && (
            <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={askAdvice}>
              {busy === 'consejos' ? 'Pensando…' : 'Pedir consejos a la IA'}
            </button>
          )}
        </div>
      </Card>
      <Card title={p.materia ? `Cómo estudiar ${p.materia}` : 'Cómo estudiar mejor'}>
        <ul className="pomo-techniques">
          {p.tecnicas.map((t) => (
            <li key={t.nombre}>
              <strong>{t.nombre}</strong>
              <span>{t.como}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Mientras estudiás" note="En los bloques no te paso avisos (mails, noticias, charlas): te los cuento en el descanso. Los recordatorios de tu agenda y la batería baja, sí.">
        <Row label="Ofrecerte un Pomodoro" hint="Cuando me contás que tenés que estudiar o que tenés una prueba.">
          <Toggle on={p.ofrecer} label="Ofrecerte un Pomodoro" onChange={(pomodoroOfrecer) => change({ pomodoroOfrecer })} />
        </Row>
        <Row label="Avisarte si te distraés" hint="Si en un bloque entrás a Instagram, YouTube, una red social o un juego.">
          <Toggle on={p.distracciones} label="Avisarte si te distraés" onChange={(pomodoroDistracciones) => change({ pomodoroDistracciones })} />
        </Row>
      </Card>
    </>
  )
}

// ── Mi estudio: el seguimiento (como un habit tracker) y el temario ──
const GOALS = [30, 60, 90, 120, 180]
const MONTH_TABS = [
  ['mes', 'Este mes'],
  ['mesAnterior', 'Mes anterior']
]
const TEXT_FILE = /\.(txt|md|csv|text)$/i

// Los ciclos del día como tomatitos
function Cycles({ n }) {
  if (!n) return <span className="muted-dash">—</span>
  return (
    <span className="cycles" aria-label={`${n} ${n === 1 ? 'ciclo' : 'ciclos'}`}>
      {Array.from({ length: Math.min(n, 8) }, (_, i) => (
        <span key={i} className="cycle" />
      ))}
      {n > 8 && <span className="cycle-more">+{n - 8}</span>}
    </span>
  )
}

function MonthGrid({ month }) {
  const days = Array.from({ length: month.dias }, (_, i) => i + 1)
  const cell = (min) => (min >= 90 ? 'lots' : min >= 45 ? 'some' : min > 0 ? 'little' : '')
  if (!month.filas.length) return <p className="note">Este mes todavía no hay estudio anotado.</p>
  return (
    <div className="month-wrap">
      <table className="month">
        <thead>
          <tr>
            <th scope="col" className="month-name">Materia</th>
            {days.map((d) => (
              <th key={d} scope="col" className={month.hoy === d ? 'today' : ''}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {month.filas.map((f) => (
            <tr key={f.materia}>
              <th scope="row" className="month-name" title={`${f.materia}: ${minutesLabel(f.total)}`}>
                {f.materia}
              </th>
              {days.map((d) => (
                <td key={d} className={`${cell(f.dias[d] ?? 0)}${month.hoy === d ? ' today' : ''}`} title={f.dias[d] ? `${d}: ${minutesLabel(f.dias[d])}` : undefined}>
                  {f.dias[d] ? '✓' : ''}
                </td>
              ))}
            </tr>
          ))}
          <tr className="month-total">
            <th scope="row" className="month-name">Total</th>
            {days.map((d) => (
              <td key={d} className={`${cell(month.total[d] ?? 0)}${month.hoy === d ? ' today' : ''}`} title={month.total[d] ? `${d}: ${minutesLabel(month.total[d])}` : undefined}>
                {month.total[d] ? Math.round(month.total[d]) : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Syllabus({ temario, setS, say }) {
  const [over, setOver] = useState(false)
  const [text, setText] = useState('')
  const [materia, setMateria] = useState('')
  const [editing, setEditing] = useState(!temario)
  useEffect(() => setEditing(!temario), [Boolean(temario)])

  const save = async (texto, nombre = materia) => {
    const r = await api.settings.syllabus({ accion: 'guardar', texto, materia: nombre })
    setS(r)
    if (r?.mensaje) say(r.mensaje)
    if (r?.estudio?.temario) {
      setText('')
      setEditing(false)
    }
  }
  const act = async (req) => setS(await api.settings.syllabus(req))

  // Soltaste un archivo (o texto): se leen solo los títulos de los temas
  const onDrop = async (e) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!TEXT_FILE.test(file.name) && !file.type.startsWith('text/')) {
        say('Por ahora leo listas de texto (.txt o .md). Si tu temario está en Word o PDF, copiá los temas y pegalos acá.')
        return
      }
      if (file.size > 50000) {
        say('Ese archivo es muy grande: soltá solo la lista de temas, no los apuntes.')
        return
      }
      const nombre = materia || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\btemario\b/i, '').trim()
      return save(await file.text(), nombre)
    }
    const dropped = e.dataTransfer.getData('text/plain')
    if (dropped) setText(dropped.slice(0, 20000))
  }

  const temas = temario?.temas ?? []
  const seen = temas.filter((t) => t.visto).length
  return (
    <Card
      title={temario?.materia ? `Temario de ${temario.materia}` : 'Temario'}
      note="Solo guardo los títulos de los temas (no tus apuntes). Mientras estudiás con el Pomodoro, tacho los temas que veo en lo que tenés abierto; también los podés tachar vos."
    >
      {temas.length > 0 && (
        <>
          <div className="syllabus-progress">
            <span>
              {seen} de {temas.length} temas vistos
            </span>
            <span className="bar">
              <span style={{ width: `${Math.round((seen / temas.length) * 100)}%` }} />
            </span>
          </div>
          <ul className="syllabus">
            {temas.map((t, i) => (
              <li key={`${i}-${t.texto}`} className={t.visto ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={t.visto} onChange={(e) => act({ accion: 'marcar', indice: i, visto: e.target.checked })} />
                  <span>{t.texto}</span>
                </label>
                {t.visto && t.auto && <span className="syllabus-auto" title="Lo tachó Pixie al verte estudiarlo">visto por Pixie</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {editing ? (
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <p className="dropzone-title">Soltá acá tu temario</p>
          <p className="hint">Un archivo .txt con un tema por renglón, o pegá la lista acá abajo.</p>
          <input className="field" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Materia (opcional): Biología" aria-label="Materia del temario" />
          <textarea
            className="field syllabus-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'La célula\nFotosíntesis\nRespiración celular\nMitosis y meiosis'}
            aria-label="Temas, uno por renglón"
            rows={5}
          />
          <div className="buttons">
            <button type="button" className="button" disabled={!text.trim()} onClick={() => save(text)}>
              Guardar temario
            </button>
            {temario && (
              <button type="button" className="button secondary" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="buttons">
          <button type="button" className="button secondary" onClick={() => setEditing(true)}>
            Cambiar el temario
          </button>
          <button type="button" className="button secondary" onClick={() => act({ accion: 'borrar' })}>
            Borrar el temario
          </button>
        </div>
      )}
    </Card>
  )
}

function StudySection({ s, setS, change, say }) {
  const e = s.estudio
  const [tab, setTab] = useState('mes')
  const [confirmClear, setConfirmClear] = useState(false)
  if (!e) return <Header title="Mi estudio" text="Todavía estoy arrancando." />
  const r = e.resumen
  const month = e[tab]
  const clear = async () => {
    const res = await api.settings.clearStudy()
    setS(res)
    setConfirmClear(false)
    if (res?.mensaje) say(res.mensaje)
  }
  return (
    <>
      <Header title="Mi estudio" text="Tu seguimiento de los Pomodoros: cuánto estudiás cada día, los ciclos, la adherencia y la racha. Preguntame «¿cuánto estudié esta semana?» cuando quieras." />
      <div className="study-tiles">
        <div className="tile">
          <span className="tile-value">{r.racha}</span>
          <span className="tile-label">{r.racha === 1 ? 'día de racha' : 'días seguidos'}</span>
        </div>
        <div className="tile">
          <span className="tile-value">{minutesLabel(r.hoyMin)}</span>
          <span className="tile-label">
            hoy · {r.hoyCiclos} {r.hoyCiclos === 1 ? 'ciclo' : 'ciclos'}
          </span>
        </div>
        <div className="tile">
          <span className="tile-value">{minutesLabel(r.semanaMin)}</span>
          <span className="tile-label">esta semana</span>
        </div>
        <div className="tile">
          <span className="tile-value">{r.adherencia === null ? '—' : `${r.adherencia}%`}</span>
          <span className="tile-label">adherencia (2 semanas)</span>
        </div>
      </div>

      <Card title="Esta semana" note="Adherencia: de lo que planeaste estudiar, cuánto estudiaste sin distraerte.">
        <div className="week-wrap">
          <table className="week">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Progreso</th>
                <th scope="col">Ciclos</th>
                <th scope="col">Adherencia</th>
                <th scope="col">Estado</th>
                <th scope="col">Temas</th>
              </tr>
            </thead>
            <tbody>
              {e.semana.map((d) => (
                <tr key={d.fecha} className={`${d.hoy ? 'today' : ''}${d.futuro ? ' future' : ''}`}>
                  <th scope="row">{d.dia}</th>
                  <td>
                    <span className="progress" title={`${minutesLabel(d.minutos)} de ${minutesLabel(e.meta)}`}>
                      <span className="bar">
                        <span style={{ width: `${Math.round(d.progreso * 100)}%` }} />
                      </span>
                      <span className="pct">{d.futuro ? '' : minutesLabel(d.minutos)}</span>
                    </span>
                  </td>
                  <td>{d.futuro ? '' : <Cycles n={d.ciclos} />}</td>
                  <td>{d.adherencia === null ? <span className="muted-dash">—</span> : `${d.adherencia}%`}</td>
                  <td>{d.estado ? <span className={`status-pill ${d.estado.nivel}`}>{d.estado.texto}</span> : d.futuro ? '' : <span className="muted-dash">—</span>}</td>
                  <td className="topics">{d.temas.join(', ') || (d.materias.join(', ') || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Row label="Meta diaria" hint="Con cuánto estudio por día marco el día como «Bien hecho».">
          <div className="segmented" role="radiogroup" aria-label="Meta diaria">
            {GOALS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={e.meta === m} className={e.meta === m ? 'selected' : ''} onClick={() => change({ metaDiaria: m })}>
                {minutesLabel(m)}
              </button>
            ))}
          </div>
        </Row>
      </Card>

      {e.materias.length > 0 && (
        <Card title="Por materia">
          <div className="subjects">
            {e.materias.map((m) => (
              <div key={m.materia} className="subject">
                <strong>{m.materia}</strong>
                <span className={m.racha >= 1 || m.semanaMin ? 'subject-ok' : 'subject-off'}>{m.racha >= 1 ? `Racha: ${m.racha === 1 ? '1 día' : `${m.racha} días seguidos`}` : m.semanaMin ? 'Estudiaste esta semana' : 'No estudiaste esta semana'}</span>
                <span className="muted">{m.semanaMin ? `${minutesLabel(m.semanaMin)} esta semana` : `Última vez: ${m.ultima ? m.ultima.split('-').reverse().slice(0, 2).join('/') : '—'}`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={month.titulo.charAt(0).toUpperCase() + month.titulo.slice(1)}>
        <div className="segmented month-tabs" role="tablist" aria-label="Mes">
          {MONTH_TABS.map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>
              {name}
            </button>
          ))}
        </div>
        <p className="pomo-summary">
          {minutesLabel(month.minutos)} de estudio · {month.diasEstudiados} {month.diasEstudiados === 1 ? 'día' : 'días'} con estudio
        </p>
        <MonthGrid month={month} />
      </Card>

      <Syllabus temario={e.temario} setS={setS} say={say} />

      <Card title="Tu historial" note="Todo esto queda solo en tu compu (en estudio.json, en la carpeta de Pixie).">
        <div className="buttons">
          {confirmClear ? (
            <>
              <button type="button" className="button danger" onClick={clear}>
                Sí, borrar todo
              </button>
              <button type="button" className="button secondary" onClick={() => setConfirmClear(false)}>
                No
              </button>
            </>
          ) : (
            <button type="button" className="button secondary" onClick={() => setConfirmClear(true)} disabled={!r.sesiones}>
              Borrar mi historial de estudio
            </button>
          )}
        </div>
      </Card>
    </>
  )
}

// Tu casa: para decirte cuánto tardás en llegar a los lugares
function MapsSection({ s, change }) {
  const m = s.mapas
  return (
    <Card
      title="Mapas: tu casa"
      note="Preguntame «¿cómo llego al Obelisco?» o «¿cuánto tardo caminando a la escuela?»: te abro el recorrido en Google Maps. La dirección queda solo en esta compu; para calcular un recorrido se la paso a OpenStreetMap y Google Maps."
    >
      <Row label="Dirección de tu casa" hint="Calle y altura, y el barrio o la ciudad." htmlFor="casa">
        <TextSetting id="casa" value={m.casa} placeholder="Av. Rivadavia 5000, Caballito" onSave={(direccionCasa) => change({ direccionCasa })} />
      </Row>
    </Card>
  )
}

// Qué apps de la compu puede abrir y usar Pixie
function AppsSection({ s, setS, change, say }) {
  const a = s.apps
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  if (!a) return null
  const q = query.trim().toLowerCase()
  const list = a.lista.filter((x) => !q || x.nombre.toLowerCase().includes(q))
  const allowedOpen = a.lista.filter((x) => x.abrir).length
  const search = async () => {
    setSearching(true)
    const r = await api.settings.searchApps()
    setSearching(false)
    setS(r)
    say(r.mensaje)
  }
  return (
    <>
      <Header title="Apps" text="Elegí qué apps de tu compu puedo abrir («abrí Minecraft») y cuáles puedo usar: escribir, tocar botones, apretar atajos o cerrarlas." />
      <Card
        title="Las apps de tu compu"
        note="La lista sale del menú Inicio. Lo que no tocás queda permitido. Lo que saques, no lo abro ni lo toco aunque me lo pidas (ni con la IA)."
      >
        {a.lista.length === 0 ? (
          <p className="big-status">{a.buscando || searching ? 'Buscando las apps de tu compu…' : 'Todavía no busqué las apps de tu compu.'}</p>
        ) : (
          <p className="big-status">
            Puedo abrir {allowedOpen} de {a.lista.length} apps.
          </p>
        )}
        <div className="buttons">
          <button type="button" className="button" disabled={searching || a.buscando} onClick={search}>
            {searching || a.buscando ? 'Buscando…' : 'Buscar apps de nuevo'}
          </button>
          <button type="button" className="button secondary" onClick={() => change({ appsTodas: true })}>
            Permitir todas
          </button>
          <button type="button" className="button secondary" onClick={() => change({ appsTodas: false })}>
            Ninguna
          </button>
        </div>
        {a.lista.length > 0 && (
          <>
            <input id="apps-buscar" className="field apps-search" value={query} placeholder="Buscar una app…" aria-label="Buscar una app" onChange={(e) => setQuery(e.target.value)} />
            <div className="apps-list" role="table" aria-label="Permisos de las apps">
              <div className="apps-head" role="row">
                <span role="columnheader">App</span>
                <span role="columnheader">Abrir</span>
                <span role="columnheader">Usar</span>
              </div>
              {list.map((x) => (
                <div className="apps-row" role="row" key={x.id}>
                  <span className="apps-name" role="cell">
                    {x.nombre}
                  </span>
                  <span role="cell">
                    <Toggle label={`Abrir ${x.nombre}`} on={x.abrir} onChange={(v) => change({ appPermiso: { id: x.id, abrir: v } })} />
                  </span>
                  <span role="cell">
                    <Toggle label={`Usar ${x.nombre}`} on={x.usar} onChange={(v) => change({ appPermiso: { id: x.id, usar: v } })} />
                  </span>
                </div>
              ))}
              {list.length === 0 && <p className="note">No encontré «{query}» entre tus apps.</p>}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function General({ s, change }) {
  const g = s.general
  return (
    <>
      <Header title="Vos y Pixie" text="Lo básico: cómo te llamás, dónde estás, cómo llamarme y cómo me comporto." />
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
        <Row label="Correrme si dejás el mouse encima" hint="Así no tapo un botón que tenés que tocar. Para llamarme usá el atajo; para moverme a mano, llamame y arrastrame.">
          <Toggle label="Correrme si dejás el mouse encima" on={g.esquivarMouse} onChange={(v) => change({ esquivarMouse: v })} />
        </Row>
      </Card>
      <Card title="Mi pantallita cuando no me usás" note="Cuando te hablo, reacciono o me llamás, vuelve mi cara. El clima del resumen se actualiza cada media hora.">
        <StandbyPicker value={s.apariencia.pantallaReposo} onChange={(pantallaReposo) => change({ pantallaReposo })} />
      </Card>
    </>
  )
}

// Hace cuánto: "hace 5 minutos", "hace 2 horas"
function ago(ms) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.round(min / 60)
  return h < 24 ? `hace ${h} ${h === 1 ? 'hora' : 'horas'}` : `hace ${Math.round(h / 24)} días`
}

function ClassroomCard({ c, setS, change, say }) {
  const ext = c.extension
  const [reading, setReading] = useState(false)
  const [steps, setSteps] = useState(!ext.conectada && !c.leido)
  let state
  if (ext.vieja) state = 'La extensión está desactualizada: en chrome://extensions tocá el botón de recargar de «Pixie para Chrome».'
  else if (c.estado === 'leyendo' || reading) state = 'Leyendo tus Pendientes…'
  else if (c.leido) {
    const tareas = c.tareas === 0 ? 'no tenías tareas asignadas' : c.tareas === 1 ? 'tenías 1 tarea' : `tenías ${c.tareas} tareas`
    state = `Leí tus Pendientes ${ago(c.leido)}: ${tareas}${c.conFecha ? ` (${c.conFecha} con fecha de entrega, ya están en la agenda)` : ''}.${c.error ? ` La última vez no pude: ${c.error}` : ''}`
  } else if (!ext.conectada) state = 'Todavía no está conectada la extensión de Chrome (o Chrome está cerrado).'
  else state = c.error ? `No pude leer Classroom: ${c.error}` : 'La extensión está conectada. Tocá «Leer ahora».'
  return (
    <Card
      title="Classroom"
      note="Las materias de Classroom son calendarios del profe y Google no da su dirección secreta. Por eso las leo con mi extensión de Chrome: cada 2 horas, si Chrome está abierto, abro tus Pendientes en una pestaña de fondo, los leo y la cierro. No mando nada a internet."
    >
      <p className="big-status">{state}</p>
      <Row label="Avisarme de las entregas" hint="La noche anterior a las 20 y ese día a las 8.">
        <Toggle label="Avisarme de las entregas de Classroom" on={c.avisos} onChange={(v) => change({ classroomAvisos: v })} />
      </Row>
      <div className="buttons">
        <button
          type="button"
          className="button"
          disabled={reading}
          onClick={async () => {
            setReading(true)
            const r = await api.settings.readClassroom()
            setReading(false)
            setS(r)
            say(r.mensaje)
          }}
        >
          {reading ? 'Leyendo…' : 'Leer ahora'}
        </button>
        <button type="button" className="button secondary" onClick={() => setSteps(!steps)}>
          {steps ? 'Ocultar los pasos' : 'Cómo instalar la extensión'}
        </button>
      </div>
      {steps && (
        <div className="wizard">
          <ol className="steps">
            <li>
              <span>
                Abrí la carpeta de la extensión. Es <b>extension-chrome</b>, adentro de la carpeta de Pixie.
              </span>
              <button type="button" className="button secondary" onClick={() => api.settings.openExtensionFolder()}>
                Abrir la carpeta
              </button>
            </li>
            <li>
              <span>
                En Chrome, pegá <b>chrome://extensions</b> en la barra de direcciones y apretá Enter.
              </span>
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  await api.settings.copyExtensionsAddress()
                  say('Copiado: pegalo en la barra de Chrome con Ctrl+V.')
                }}
              >
                Copiar
              </button>
            </li>
            <li>
              <span>
                Prendé <b>«Modo de desarrollador»</b> (arriba a la derecha).
              </span>
            </li>
            <li>
              <span>
                Tocá <b>«Cargar extensión sin empaquetar»</b> y elegí la carpeta <b>extension-chrome</b> del paso 1.
              </span>
            </li>
            <li>
              <span>
                <b>Listo:</b> en menos de un minuto se conecta y leo tus Pendientes. En Chrome tenés que haber entrado a Classroom con tu cuenta.
              </span>
            </li>
          </ol>
          <p className="note">
            Si ya la tenías instalada desde la carpeta del proyecto, quitala y cargá esta: con cada versión nueva de Pixie se actualiza sola y solo tenés que tocar recargar.
          </p>
        </div>
      )}
    </Card>
  )
}

function MailCard({ m, setS, change, say }) {
  const ext = m.extension
  const [reading, setReading] = useState(false)
  let state
  if (ext.vieja) state = 'La extensión está desactualizada: en chrome://extensions tocá el botón de recargar de «Pixie para Chrome».'
  else if (m.estado === 'leyendo' || reading) state = 'Mirando tu Gmail…'
  else if (m.leido) {
    const n = m.sinLeer === 0 ? 'no tenías mails sin leer' : m.sinLeer === 1 ? 'tenías 1 mail sin leer' : `tenías ${m.sinLeer} mails sin leer`
    const where = m.cuentas.length ? ` (${m.cuentas.join(', ')})` : ''
    state = `Miré tu Gmail${where} ${ago(m.leido)}: ${n}.${m.error ? ` La última vez no pude: ${m.error}` : ''}`
  } else if (!ext.conectada) state = 'Todavía no está conectada la extensión de Chrome (o Chrome está cerrado). Los pasos para instalarla están en Classroom, acá arriba.'
  else state = m.error ? `No pude mirar tus mails: ${m.error}` : 'La extensión está conectada. Tocá «Mirar ahora».'
  return (
    <Card
      title="Mails de Gmail"
      note="Con la misma extensión de Chrome miro el aviso de mails sin leer de Gmail: quién lo manda, el asunto y las primeras palabras. No abro tus mails ni los marco como leídos, y lo que veo queda en tu compu. Solo si me pedís «leeme el mail de…» lo abro en Chrome (y, si tenés la IA, se lo paso para resumirlo)."
    >
      <p className="big-status">{state}</p>
      <Row label="Avisarme cuando llega un mail" hint="Miro cada 3 minutos, si Chrome está abierto. También podés decirme «avisame de los mails».">
        <Toggle label="Avisarme cuando llega un mail" on={m.avisos} onChange={(v) => change({ mailAvisos: v })} />
      </Row>
      {m.silenciados.length > 0 && (
        <Row label="No te aviso de" hint="Para sumar a alguien, decime «no me avises de los mails de…».">
          <div className="buttons">
            {m.silenciados.map((who) => (
              <button key={who} type="button" className="button secondary" title={`Volver a avisarte de ${who}`} onClick={() => change({ mailsDesilenciar: who })}>
                {who} ✕
              </button>
            ))}
          </div>
        </Row>
      )}
      <div className="buttons">
        <button
          type="button"
          className="button"
          disabled={reading}
          onClick={async () => {
            setReading(true)
            const r = await api.settings.readMails()
            setReading(false)
            setS(r)
            say(r.mensaje)
          }}
        >
          {reading ? 'Mirando…' : 'Mirar ahora'}
        </button>
      </div>
    </Card>
  )
}

function AgendaSection({ s, setS, change, say }) {
  const list = s.agenda.calendarios
  const hint = (c) => {
    if (c.error) return `No lo pude leer: ${c.error}`
    if (!c.proximos) return 'Nada en los próximos 7 días.'
    return `${c.proximos} ${c.proximos === 1 ? 'cosa' : 'cosas'} en los próximos 7 días.`
  }
  return (
    <>
      <Header title="Agenda" text="Sumá tu Google Calendar, tus tareas de Classroom y tus mails de Gmail: te aviso antes de cada cosa y te las cuento cuando me preguntás «¿qué tengo hoy?», «¿qué tengo que entregar?» o «¿tengo mails?»." />
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
      {s.agenda.classroom && <ClassroomCard c={s.agenda.classroom} setS={setS} change={change} say={say} />}
      {s.agenda.mails && <MailCard m={s.agenda.mails} setS={setS} change={change} say={say} />}
      <Card title={list.length ? 'Sumar otro calendario de Google' : 'Sumar tu Google Calendar'}>
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
      {u.novedades?.length > 0 && (
        <Card title={`Qué hay de nuevo en la ${String(s.version).replace(/\.0$/, '')}`} note="Cada vez que me actualizo te lo cuento. También podés preguntarme «¿qué hay de nuevo?».">
          <ul className="news-list">
            {u.novedades.map((n) => (
              <li key={n.texto}>
                <b>{n.tipo === 'nuevo' ? 'Nuevo' : 'Mejor'}:</b> {n.texto}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

const EXAMPLES = ['«Escribí: hola, ¿cómo andás?» y «mandalo»', '«Tocá el botón Enviar»', '«Guardá» · «Nueva pestaña» · «Bajá la página»', '«Poné música para estudiar»', '«Recordame la prueba del jueves»', '«¿Qué tengo que entregar?»', '«¿Qué noticias hay?»', '«¿Qué ves en mi pantalla?»', '«Cambiá el atajo a Ctrl+Alt+P»', '«Juguemos»']

function Help({ s, say }) {
  return (
    <>
      <Header title="Ayuda" text="Si algo no anda, copiá el informe y mandáselo al equipo." />
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
    </>
  )
}
