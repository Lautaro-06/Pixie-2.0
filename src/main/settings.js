// Lo que muestra y cambia la ventana de Ajustes (y la bienvenida).
// No toca Electron directamente: todo lo que necesita le llega armado, así se puede probar.
import { describeAI, pickProvider, aiErrorText } from './ai.js'
import { AIHttpError, AIConnectionError } from './ai-compatible.js'
import { entriesBetween } from './changelog.js'
import { maskSecret } from './secrets.js'
import { parseShortcut, shortcutText } from './shortcut.js'
import { findCalendarUrl } from './calendars.js'
import { buildPlan, blockTips, advicePrompt, pomodoroView, clampMinutes, METHODS, TASK_TYPES } from './study.js'
import { DEFAULT_GOAL } from './study-log.js'
import { cleanPhone, findWhatsappKey, activationLink, WHEN, CALLMEBOT_PAGE } from './phone.js'

export const STANDBY_MODES = ['cara', 'reloj', 'resumen']
export const NEWS_SOURCES = ['infobae', 'tn']
export const NEWS_ALERTS = ['nunca', 'aveces', 'seguido']
export const GOOGLE_CALENDAR_SETTINGS_URL = 'https://calendar.google.com/calendar/r/settings'
export const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey'
export const POMODORO_ACTIONS = ['empezar', 'pausar', 'seguir', 'saltar', 'terminar']
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
  mail = null,
  apps = null,
  pomodoro = null, // la sesión (pomodoro.js)
  studyLog = null, // el seguimiento de estudio y el temario (study-log.js)
  phone = null, // WhatsApp (phone.js)
  journal = null, // el diario de charlas (journal.js)
  openExternal = () => {},
  runPomodoro = null, // async (accion) → lo que dice Pixie (arrancar, pausar, seguir, saltar, terminar)
  extension = () => ({ carpeta: null, version: null, conectada: false, vieja: false }),
  version = '0.0.0'
}) {
  let candidate = null // la clave que se encontró copiada, sin mostrarla
  let calendarCandidate = null // la dirección de un calendario que se encontró copiada
  let calendarTried = null // la última que se probó (para no probarla de nuevo a cada rato)

  // Ajustes → Pomodoro: lo elegido, el plan que sale con eso y cómo va la sesión
  function pomodoroSnapshot() {
    const cfg = getConfig()
    return pomodoroView(
      { minutos: cfg.pomodoroMinutos, metodo: cfg.pomodoroMetodo, materia: cfg.pomodoroMateria, tipo: cfg.pomodoroTipo, ofrecer: cfg.pomodoroOfrecer, distracciones: cfg.pomodoroDistracciones },
      pomodoro?.status()
    )
  }

  // Ajustes → Mi estudio: el seguimiento (como un habit tracker) y el temario
  const goalOf = (cfg) => Math.min(600, Math.max(15, Math.round(Number(cfg.metaDiaria) || DEFAULT_GOAL)))
  function studySnapshot() {
    const goal = goalOf(getConfig())
    return studyLog ? studyLog.view(goal) : null
  }

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
        avisosAlCelular: cfg.avisosAlCelular !== false,
        esquivarMouse: cfg.esquivarMouse !== false
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
        classroom: classroom ? { ...classroom.status(), extension: extension() } : null,
        mails: mail ? { ...mail.status(), extension: extension() } : null
      },
      apps: apps ? { lista: apps.list(), actualizado: apps.updated(), buscando: apps.searching() } : null,
      pomodoro: pomodoroSnapshot(),
      whatsapp: phone ? { ...phone.status(), avisos: cfg.avisosAlCelular !== false } : null,
      memoria: memorySnapshot(),
      estudio: studySnapshot(),
      mapas: { casa: cfg.direccionCasa ?? '' },
      noticias: {
        fuentes: Array.isArray(cfg.noticiasFuentes) ? cfg.noticiasFuentes.filter((f) => NEWS_SOURCES.includes(f)) : NEWS_SOURCES,
        avisos: NEWS_ALERTS.includes(cfg.noticiasAvisos) ? cfg.noticiasAvisos : 'aveces'
      },
      actualizaciones: {
        ...updates.status(),
        texto: updates.describe(),
        novedades: entriesBetween(null, version).flatMap((e) => [...e.nuevo.map((x) => ({ tipo: 'nuevo', texto: x.detalle })), ...e.mejoras.map((x) => ({ tipo: 'mejora', texto: x.detalle }))])
      },
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
    if ('esquivarMouse' in patch) saveConfig({ esquivarMouse: Boolean(patch.esquivarMouse) })
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
    if ('mailAvisos' in patch) {
      mail?.setAlerts(Boolean(patch.mailAvisos))
      if (patch.mailAvisos) mail?.refresh({ force: true, silent: true }).catch(() => {})
    }
    if (typeof patch.mailsDesilenciar === 'string') mail?.unmute(patch.mailsDesilenciar)
    // Ajustes → WhatsApp: tu número, la clave del bot y cuándo te escribe
    if (typeof patch.whatsappTelefono === 'string' || typeof patch.whatsappClave === 'string' || typeof patch.whatsappCuando === 'string') {
      const cur = getConfig().whatsapp ?? {}
      const next = { ...cur }
      // Vacío lo borra (también el cifrado)
      if (typeof patch.whatsappTelefono === 'string') next.telefono = cleanPhone(patch.whatsappTelefono) || null
      if (typeof patch.whatsappClave === 'string' && patch.whatsappClave.trim()) next.apikey = (findWhatsappKey(patch.whatsappClave) ?? patch.whatsappClave).trim()
      if (WHEN.includes(patch.whatsappCuando)) next.cuando = patch.whatsappCuando
      saveConfig({ whatsapp: next })
      if (phone?.configured() && (typeof patch.whatsappClave === 'string' || typeof patch.whatsappTelefono === 'string')) mensajes.push('Listo. Tocá «Mandarme un mensaje de prueba» para ver que llegue.')
    }
    // Ajustes → Apps y mapas: tu casa
    if (typeof patch.direccionCasa === 'string') saveConfig({ direccionCasa: patch.direccionCasa.trim().slice(0, 120) || undefined })
    // Ajustes → Pomodoro
    if ('pomodoroMinutos' in patch) saveConfig({ pomodoroMinutos: clampMinutes(patch.pomodoroMinutos) })
    if (typeof patch.pomodoroMetodo === 'string' && (METHODS[patch.pomodoroMetodo] || patch.pomodoroMetodo === 'auto')) saveConfig({ pomodoroMetodo: patch.pomodoroMetodo })
    if (typeof patch.pomodoroTipo === 'string') saveConfig({ pomodoroTipo: TASK_TYPES[patch.pomodoroTipo] ? patch.pomodoroTipo : undefined })
    if ('metaDiaria' in patch) saveConfig({ metaDiaria: goalOf({ metaDiaria: patch.metaDiaria }) })
    if (typeof patch.pomodoroMateria === 'string') saveConfig({ pomodoroMateria: patch.pomodoroMateria.trim().slice(0, 40) || undefined })
    if ('pomodoroOfrecer' in patch) saveConfig({ pomodoroOfrecer: Boolean(patch.pomodoroOfrecer) })
    if ('pomodoroDistracciones' in patch) saveConfig({ pomodoroDistracciones: Boolean(patch.pomodoroDistracciones) })
    // Ajustes → Apps: qué apps puede abrir y usar
    if (patch.appPermiso && typeof patch.appPermiso.id === 'string') apps?.set(patch.appPermiso.id, patch.appPermiso)
    if (typeof patch.appsTodas === 'boolean') apps?.setAll(patch.appsTodas)
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

  // Apps: vuelve a buscar las instaladas
  async function searchApps() {
    const list = await apps.refresh()
    const mensaje = list.length ? `Encontré ${list.length} apps en tu compu.` : 'No encontré apps: esto anda en Windows.'
    return { ...snapshot(), mensaje }
  }

  // Mails: mira ahora cuántos hay sin leer (con la extensión de Chrome)
  async function readMails() {
    const st = await mail.refresh({ force: true, silent: true })
    const n = st.sinLeer
    const mensaje =
      st.estado === 'ok'
        ? n === 0
          ? 'Miré tu Gmail: no tenés mails sin leer.'
          : `Miré tu Gmail: tenés ${n === 1 ? '1 mail sin leer' : `${n} mails sin leer`}.`
        : st.estado === 'sin-extension'
          ? 'Primero instalá la extensión de Chrome (los pasos están en Classroom, acá arriba) y dejá Chrome abierto.'
          : st.estado === 'extension-vieja'
            ? 'La extensión está desactualizada: en chrome://extensions tocá recargar en «Pixie para Chrome».'
            : `No pude mirar tus mails: ${st.error ?? 'probá de nuevo en un rato'}`
    return { ...snapshot(), mensaje }
  }

  // Los botones del Pomodoro (arrancar, pausar, seguir, saltar, terminar): lo hace y lo dice Pixie
  async function pomodoroControl(accion) {
    if (!POMODORO_ACTIONS.includes(accion) || !runPomodoro) return { ...snapshot(), mensaje: null }
    const mensaje = await runPomodoro(accion)
    return { ...snapshot(), mensaje }
  }

  // Consejos para cada bloque: con IA, a medida; sin IA (o si falla), los de siempre
  async function pomodoroAdvice() {
    const p = pomodoroSnapshot()
    const plan = buildPlan({ minutos: p.minutos, metodo: p.metodo, materia: p.materia || null, tipo: p.tipo || null })
    if (ai?.enabled?.() && ai.advise) {
      try {
        const text = await ai.advise(advicePrompt(plan))
        if (text) return { ia: true, consejos: text.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 10) }
      } catch {
        // sin internet o sin cupo: los de siempre
      }
    }
    return { ia: false, consejos: blockTips(plan) }
  }

  // El temario: guardarlo (del texto que soltaste), tachar o destachar un tema, o borrarlo
  function syllabus({ accion, materia, texto, indice, visto } = {}) {
    if (!studyLog) return { ...snapshot(), mensaje: null }
    if (accion === 'guardar') {
      const t = studyLog.setTemario(materia, String(texto ?? '').slice(0, 20000))
      return {
        ...snapshot(),
        mensaje: t ? `Anoté ${t.temas.length === 1 ? '1 tema' : `${t.temas.length} temas`}. Mientras estudiás voy tachando los que veo.` : 'No encontré temas: poné uno por renglón (solo los títulos, no el contenido).'
      }
    }
    if (accion === 'marcar') studyLog.markTopic(Number(indice), Boolean(visto))
    if (accion === 'borrar') studyLog.clearTemario()
    return { ...snapshot(), mensaje: null }
  }

  function clearStudy() {
    studyLog?.clear()
    return { ...snapshot(), mensaje: 'Borré tu historial de estudio.' }
  }

  // WhatsApp: abrir el chat del bot con el mensaje de activación, buscar la clave copiada o mandar una prueba
  async function whatsapp({ accion } = {}) {
    // Borra tu número y la clave de esta compu
    if (accion === 'borrar') {
      saveConfig({ whatsapp: { telefono: null, apikey: null } })
      return { ...snapshot(), mensaje: 'Listo, borré tu número y la clave de WhatsApp de esta compu.' }
    }
    if (accion === 'activar') {
      openExternal(activationLink())
      return { ...snapshot(), mensaje: 'Te abrí WhatsApp con el mensaje ya escrito: tocá Enviar. El bot te contesta con tu clave (APIKEY).' }
    }
    if (accion === 'pagina') {
      openExternal(CALLMEBOT_PAGE)
      return { ...snapshot(), mensaje: null }
    }
    if (accion === 'portapapeles') {
      const key = findWhatsappKey(readClipboard())
      if (!key) return { ...snapshot(), mensaje: 'No encontré la clave en lo que copiaste. Copiá el mensaje del bot (el que dice «APIKEY») y tocá de nuevo.' }
      const cur = getConfig().whatsapp ?? {}
      saveConfig({ whatsapp: { ...cur, apikey: key } })
      return { ...snapshot(), mensaje: 'Encontré tu clave y la guardé (cifrada).' }
    }
    if (accion === 'probar') {
      if (!phone?.configured()) return { ...snapshot(), mensaje: 'Primero poné tu número y la clave que te mandó el bot.' }
      try {
        await phone.send('Pixie: ¡Hola! Así te van a llegar mis recordatorios y los timers.')
        return { ...snapshot(), mensaje: '¡Te lo mandé! Fijate en tu WhatsApp.' }
      } catch (err) {
        return { ...snapshot(), mensaje: err.message }
      }
    }
    return { ...snapshot(), mensaje: null }
  }

  // Ajustes → Memoria: cuánto se acuerda, lo personal que no nombra, y borrar
  function memorySnapshot() {
    const facts = memory?.listFacts?.() ?? []
    const open = memory?.publicFacts?.() ?? facts
    return {
      charlas: journal?.count() ?? 0,
      datos: open.map((f) => ({ texto: f.texto, creado: f.creado })).slice(-30).reverse(),
      personales: facts.length - open.length,
      dias: journal?.summaries(7).map((d) => ({ fecha: d.fecha, temas: d.temas, charlas: d.charlas })) ?? []
    }
  }

  function forget({ que } = {}) {
    if (que === 'charlas') journal?.forgetAll()
    if (que === 'todo') {
      journal?.forgetAll()
      memory?.forgetAll?.()
    }
    return { ...snapshot(), mensaje: que === 'todo' ? 'Listo, me olvidé de todo.' : que === 'charlas' ? 'Listo, me olvidé de nuestras charlas.' : null }
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
    readMails,
    searchApps,
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
    readClassroom,
    pomodoroControl,
    pomodoroAdvice,
    syllabus,
    clearStudy,
    whatsapp,
    forget
  }
}
