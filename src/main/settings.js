// Lo que muestra y cambia la ventana de Ajustes (y la bienvenida).
// No toca Electron directamente: todo lo que necesita le llega armado, así se puede probar.
import { describeAI, pickProvider, aiErrorText } from './ai.js'
import { AIHttpError, AIConnectionError } from './ai-compatible.js'
import { maskSecret } from './secrets.js'
import { parseShortcut, shortcutText } from './shortcut.js'
import { findCalendarUrl } from './calendars.js'

export const STANDBY_MODES = ['cara', 'reloj', 'resumen']
export const NEWS_SOURCES = ['infobae', 'tn']
export const NEWS_ALERTS = ['nunca', 'aveces', 'seguido']
export const GOOGLE_CALENDAR_SETTINGS_URL = 'https://calendar.google.com/calendar/r/settings'
export const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey'
const NAMES = { gemini: 'Gemini', groq: 'Groq', claude: 'Claude', ollama: 'Ollama' }
const KEY = /(AIza[\w-]{30,}|AQ\.[\w.-]{20,}|gsk_[A-Za-z0-9]{20,}|sk-ant-[\w-]{20,})/

// Encuentra una clave de IA en un texto (por ejemplo, lo que copiaste)
export function findKey(text) {
  const m = KEY.exec(String(text ?? ''))
  return m ? m[1] : null
}

// El error de la prueba, dicho para la ventana de Ajustes (sin mandar a editar config.json)
export function keyErrorText(err) {
  if (err instanceof AIConnectionError) return 'No me pude conectar para probarla. ¿Hay internet?'
  if (err instanceof AIHttpError || err?.status) {
    if (err.status === 400 || err.status === 401 || err.status === 403) return 'Esa clave no funciona. Fijate que esté copiada entera.'
    if (err.status === 429) return 'La clave anda, pero ya se usó todo lo gratis por ahora. Probá en un rato.'
  }
  return aiErrorText(err) ?? 'No me pude conectar para probarla. ¿Hay internet?'
}

export function createSettings({
  getConfig,
  saveConfig,
  memory,
  voices,
  updates,
  ai,
  loginItem,
  changeShortcut,
  shortcutLabel,
  setCity,
  onStandby = () => {},
  errorCount = () => 0,
  readClipboard = () => '',
  wake = null,
  calendars = null,
  news = null,
  classroom = null,
  extension = () => ({ carpeta: null, version: null, conectada: false, vieja: false }),
  version = '0.0.0'
}) {
  let candidate = null // la clave que se encontró copiada, sin mostrarla
  let calendarCandidate = null // la dirección de un calendario que se encontró copiada
  let calendarTried = null // la última que se probó (para no probarla de nuevo a cada rato)

  function snapshot() {
    const cfg = getConfig()
    const p = pickProvider(cfg)
    return {
      version,
      bienvenidaHecha: cfg.bienvenidaHecha === true,
      general: {
        nombre: memory?.getName() ?? '',
        ciudad: cfg.ciudad ?? '',
        atajo: shortcutLabel(),
        arrancarConWindows: Boolean(loginItem.get()),
        recordatoriosSalud: cfg.recordatoriosSalud !== false,
        avisosAlCelular: cfg.avisosAlCelular !== false
      },
      apariencia: { pantallaReposo: STANDBY_MODES.includes(cfg.pantallaReposo) ? cfg.pantallaReposo : 'cara' },
      ia: {
        activa: cfg.ia !== false,
        estado: describeAI(cfg).text,
        proveedor: p ? (NAMES[p.name] ?? p.name) : null,
        modelo: p?.model ?? null,
        clave: maskSecret(cfg.claveIA),
        tieneClave: Boolean(cfg.claveIA)
      },
      voz: {
        modo: cfg.vozNatural === false ? 'windows' : cfg.vozNatural === 'gemini' ? 'gemini' : 'natural',
        estado: voices?.status() ?? '',
        palabra: wake?.status() ?? { grabada: false, activa: false, sensibilidad: 'normal' }
      },
      agenda: {
        calendarios: calendars?.status() ?? [],
        classroom: classroom ? { ...classroom.status(), extension: extension() } : null
      },
      noticias: {
        fuentes: Array.isArray(cfg.noticiasFuentes) ? cfg.noticiasFuentes.filter((f) => NEWS_SOURCES.includes(f)) : NEWS_SOURCES,
        avisos: NEWS_ALERTS.includes(cfg.noticiasAvisos) ? cfg.noticiasAvisos : 'aveces'
      },
      actualizaciones: { ...updates.status(), texto: updates.describe() },
      ayuda: { errores: errorCount() }
    }
  }

  async function apply(patch = {}) {
    const mensajes = []
    if (typeof patch.nombre === 'string' && patch.nombre.trim()) memory?.setName(patch.nombre.trim().slice(0, 40))
    if (typeof patch.ciudad === 'string' && patch.ciudad.trim() && patch.ciudad.trim() !== getConfig().ciudad) {
      mensajes.push(await setCity(patch.ciudad.trim()))
    }
    if ('arrancarConWindows' in patch) loginItem.set(Boolean(patch.arrancarConWindows))
    if ('recordatoriosSalud' in patch) saveConfig({ recordatoriosSalud: Boolean(patch.recordatoriosSalud) })
    if ('avisosAlCelular' in patch) saveConfig({ avisosAlCelular: Boolean(patch.avisosAlCelular) })
    if (STANDBY_MODES.includes(patch.pantallaReposo)) {
      saveConfig({ pantallaReposo: patch.pantallaReposo })
      onStandby(patch.pantallaReposo)
    }
    if ('iaActiva' in patch) saveConfig({ ia: patch.iaActiva ? undefined : false })
    if (patch.vozModo === 'windows') voices.use(false)
    else if (patch.vozModo === 'gemini') voices.use('gemini')
    else if (patch.vozModo === 'natural') {
      voices.use(true)
      voices.install()
    }
    if (Array.isArray(patch.noticiasFuentes)) saveConfig({ noticiasFuentes: patch.noticiasFuentes.filter((f) => NEWS_SOURCES.includes(f)) })
    if (NEWS_ALERTS.includes(patch.noticiasAvisos)) saveConfig({ noticiasAvisos: patch.noticiasAvisos })
    if ('classroomAvisos' in patch) saveConfig({ classroomAvisos: Boolean(patch.classroomAvisos) })
    if ('palabraMagica' in patch) wake?.setActive(Boolean(patch.palabraMagica))
    if (typeof patch.sensibilidadPalabra === 'string') wake?.setSensitivity(patch.sensibilidadPalabra)
    if (typeof patch.atajo === 'string') {
      const accel = parseShortcut(patch.atajo)
      if (!accel) mensajes.push('Ese atajo no sirve: tiene que llevar Ctrl o Alt y una tecla.')
      else {
        const r = changeShortcut(accel)
        mensajes.push(r.ok ? `Ahora me llamás con ${shortcutText(accel)}.` : `${shortcutText(accel)} lo está usando otro programa. Probá con otro.`)
      }
    }
    return { ...snapshot(), mensajes }
  }

  async function testKey(key) {
    const k = typeof key === 'string' && key.trim() ? findKey(key) ?? key.trim() : candidate
    if (!k) return { ok: false, mensaje: 'Copiá o pegá la clave primero.' }
    try {
      const r = await ai.ping(k)
      return { ok: true, clave: k, mensaje: `¡Funciona! Uso ${NAMES[r.provider] ?? r.provider}.` }
    } catch (err) {
      return { ok: false, mensaje: keyErrorText(err) }
    }
  }

  // Prueba la clave (la escrita o la que encontró copiada) y, si anda, la guarda cifrada
  async function saveKey(key) {
    const r = await testKey(key)
    if (!r.ok) return r
    saveConfig({ claveIA: r.clave, proveedorIA: undefined, ia: undefined })
    candidate = null
    return { ok: true, mensaje: r.mensaje, guardada: true }
  }

  function forgetKey() {
    saveConfig({ claveIA: null })
    return snapshot()
  }

  // Mira si lo último que copiaste es una clave de IA (no guarda nada más de lo copiado)
  function clipboardKey() {
    const k = findKey(readClipboard())
    if (!k || k === getConfig().claveIA) return { encontrada: false }
    candidate = k
    return { encontrada: true, clave: maskSecret(k) }
  }

  function finishWelcome() {
    saveConfig({ bienvenidaHecha: true })
  }

  // «Pixie, ¿estás?»: guarda o borra la huella de tu voz
  function saveWake(plantillas) {
    try {
      wake.save(plantillas)
      return { ok: true, mensaje: '¡Listo! Ahora llamame diciendo «Pixie, ¿estás?».', ...snapshot() }
    } catch (err) {
      return { ok: false, mensaje: err.message, ...snapshot() }
    }
  }

  function forgetWake() {
    wake.forget()
    return snapshot()
  }

  // Calendarios: la dirección secreta se prueba antes de guardarla (cifrada)
  async function addCalendar(url) {
    const typed = typeof url === 'string' && url.trim() ? url : null
    if (!typed) calendarTried = calendarCandidate
    const r = await calendars.add(typed ?? calendarCandidate ?? '')
    calendarCandidate = null
    return { ...r, ...snapshot() }
  }

  // ¿Lo último que copiaste es la dirección de un calendario? (no se muestra: es secreta)
  function clipboardCalendar() {
    const url = findCalendarUrl(readClipboard())
    if (!url || url === calendarTried || calendars.has(url)) return { encontrada: false }
    calendarCandidate = url
    return { encontrada: true }
  }

  function removeCalendar(id) {
    calendars.remove(String(id))
    return snapshot()
  }

  function calendarAlerts(id, on) {
    calendars.setAlerts(String(id), Boolean(on))
    return snapshot()
  }

  // Classroom: la lee ahora (con la extensión de Chrome)
  async function readClassroom() {
    const st = await classroom.refresh({ force: true })
    const mensaje =
      st.estado === 'ok'
        ? `Leí tus Pendientes: ${st.tareas === 0 ? 'no tenés tareas asignadas' : st.tareas === 1 ? 'tenés 1 tarea' : `tenés ${st.tareas} tareas`}.`
        : st.estado === 'sin-extension'
          ? 'Primero instalá la extensión de Chrome (los pasos están acá abajo) y dejá Chrome abierto.'
          : st.estado === 'extension-vieja'
            ? 'La extensión está desactualizada: en chrome://extensions tocá recargar en «Pixie para Chrome».'
            : `No pude leer Classroom: ${st.error ?? 'probá de nuevo en un rato'}`
    return { ...snapshot(), mensaje }
  }

  // Los últimos titulares, para ver cómo quedan
  async function previewNews() {
    try {
      const items = await news.latest({ fuentes: snapshot().noticias.fuentes })
      return { ok: true, titulares: items.slice(0, 5).map((it) => ({ titulo: it.titulo, fuente: it.fuente })) }
    } catch (err) {
      return { ok: false, mensaje: err.message }
    }
  }

  return {
    snapshot,
    apply,
    testKey,
    saveKey,
    forgetKey,
    clipboardKey,
    finishWelcome,
    saveWake,
    forgetWake,
    addCalendar,
    clipboardCalendar,
    removeCalendar,
    calendarAlerts,
    previewNews,
    readClassroom
  }
}
