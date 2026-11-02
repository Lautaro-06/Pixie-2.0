import { app, ipcMain, globalShortcut, Notification, screen, desktopCapturer, clipboard, safeStorage, shell, powerMonitor } from 'electron'
import { join } from 'node:path'
import { release } from 'node:os'
import { autoUpdater } from 'electron-updater'
import { interpretAll, suggest, isYes, isNo, restoreAccents } from './brain.js'
import { actions, runAction, needsConfirm } from './actions/index.js'
import { loadConfig, getConfig, saveConfig, logAction, watchConfig, setCipher } from './config.js'
import { createPixieWindow, getWindow, setMode, showAndFocus, sendEvent } from './window.js'
import { createMenus } from './tray.js'
import { createMind } from './mind.js'
import { createAI, aiErrorText, voiceErrorText, describeAI } from './ai.js'
import { createBrowserBridge } from './browser.js'
import { createBackup } from './backup.js'
import { createPhone } from './phone.js'
import { FriendlyError, isWindows } from './windows.js'
import { createVoices } from './voices.js'
import { createMediaSession } from './media-session.js'
import { createUpdater } from './updates.js'
import { createDiagnostics } from './diagnostics.js'
import { shortcutText } from './shortcut.js'
import { createSettings, AI_STUDIO_URL, GOOGLE_CALENDAR_SETTINGS_URL } from './settings.js'
import { openSettingsWindow, getSettingsWindow } from './settings-window.js'
import { currentConditions } from './actions/weather.js'
import { createWakeStore } from './wake-store.js'
import { createCalendars } from './calendars.js'
import { createNews } from './news.js'
import { createClassroom } from './classroom.js'
import { createMail, announceText } from './mail.js'
import { compareVersions, updateText } from './changelog.js'
import { installExtensionFiles, olderThan } from './extension-files.js'
import { createHands } from './hands.js'
import { textToWrite } from './control.js'

const FALLBACK_SHORTCUTS = ['Control+Shift+Space', 'Alt+Shift+P']
const VOICE_SHORTCUTS = ['Control+Alt+Space', 'Alt+Shift+H']
const MAX_AUDIO_BYTES = 3 * 1024 * 1024
let activeShortcut = null
let voiceShortcut = null
let pending = null // acción esperando que la persona confirme
let settings = null
let weatherNow = null // temperatura e ícono para el resumen en reposo
let weatherTimer = null
let mind = null
let ai = null
let browser = null
let backup = null
let phone = null
let tts = null
let media = null
let updates = null
let trayMenu = null
let wake = null // «Pixie, ¿estás?»
let calendars = null // Google Calendar, Classroom
let news = null
let classroom = null // las tareas de Classroom, con la extensión de Chrome
let mail = null // los mails nuevos de Gmail, con la extensión de Chrome
let extensionFiles = null // dónde quedó la extensión para instalarla en Chrome
let hands = null // escribir, apretar teclas y tocar botones en tus apps
const OWN_APP = /^(pixie|electron)$/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BACKUP_EVERY_MS = 6 * 60 * 60 * 1000

// Errores anotados para el informe de diagnóstico (errores.log en la carpeta de Pixie)
const diagnostics = createDiagnostics({ file: join(app.getPath('userData'), 'errores.log') })
process.on('uncaughtException', (err) => {
  console.error(err)
  diagnostics.record('principal', err)
})
process.on('unhandledRejection', (err) => {
  console.error(err)
  diagnostics.record('principal', err)
})

// Lo que conviene mandarle a la IA aunque las reglas lo entiendan: charla y preguntas
const AI_PREFERRED = new Set(['saludo', 'charla', 'gracias', 'ayuda', 'consultar_memoria'])
// Usar las apps: si las reglas lo entendieron, se hace tal cual (el texto a escribir no pasa por la IA)
const DIRECT = new Set(['escribir', 'teclas', 'atajo', 'clic', 'desplazar', 'ventana', 'ir_a', 'ver_elementos'])


function shortcutLabel() {
  if (!activeShortcut) return 'el ícono de la barra de tareas'
  return shortcutText(activeShortcut)
}

// Cambia el atajo para llamar a Pixie. Si otro programa ya lo usa, deja el que había.
function changeShortcut(accel) {
  if (!accel) return { ok: false }
  if (accel === activeShortcut) return { ok: true }
  let ok = false
  try {
    ok = globalShortcut.register(accel, openBar)
  } catch {
    ok = false
  }
  if (!ok) return { ok: false }
  if (activeShortcut) globalShortcut.unregister(activeShortcut)
  activeShortcut = accel
  if (getConfig().atajo !== accel) saveConfig({ atajo: accel })
  trayMenu?.refresh()
  logAction(`atajo: ahora es ${shortcutText(accel)}`)
  return { ok: true }
}

// Lo que las acciones pueden usar de la app.
const ctx = {
  getConfig,
  saveConfig,
  shortcutLabel,
  changeShortcut,
  log: logAction,
  emit: sendEvent,
  reportError: (source, err) => diagnostics.record(source, err),
  // Copia el informe de diagnóstico y devuelve cuántos errores tiene
  copyDiagnostics: () => {
    clipboard.writeText(diagnosticsReport())
    return Math.min(diagnostics.list().length, 30)
  },
  hideWindow: () => getWindow()?.hide(),
  openSettings: (view) => openSettingsWindow(view),
  quit: () => quitPixie(),
  notify: (title, body) => {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  }
}

// ───────────── Usar tus apps ─────────────

// La app donde hacer lo que pediste: la que tenés adelante, o si adelante está Pixie (le escribiste),
// la que estabas usando antes, que vuelve al frente.
async function targetWindow() {
  const fg = await hands.request('ventana')
  if (fg?.proceso && !OWN_APP.test(fg.proceso)) return fg
  const last = mind?.lastWindow()
  if (!last?.hwnd) throw new FriendlyError('No sé en qué app hacerlo. Tocá la app que querés y pedímelo de nuevo.')
  hidePixieFocus()
  const r = await hands.request('enfocar', { hwnd: last.hwnd })
  if (!r?.ok) throw new FriendlyError(`No pude volver a ${last.proceso}. Tocala vos y pedímelo de nuevo.`)
  return { ...last, ...(await hands.request('ventana')) }
}

// Pixie suelta el teclado (si lo tenía) para que vuelva a la app de abajo
function hidePixieFocus() {
  const win = getWindow()
  if (win && !win.isDestroyed() && win.isFocused()) win.blur()
}

// Si el clic cae arriba de la carita de Pixie, la esconde un momento
async function withPixieHidden(point, fn) {
  const win = getWindow()
  let hid = false
  if (win && !win.isDestroyed() && win.isVisible() && point) {
    const b = isWindows ? screen.dipToScreenRect(win, win.getBounds()) : win.getBounds()
    if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) {
      win.hide()
      hid = true
      await sleep(150)
    }
  }
  try {
    return await fn()
  } finally {
    if (hid) setTimeout(() => !win.isDestroyed() && win.showInactive(), 300)
  }
}

// Busca algo en la pantalla con la IA (un botón sin nombre): el punto en píxeles reales, o null
async function locateOnScreen(what) {
  if (!ai?.enabled()) return null
  const shot = await captureScreen({ withDisplay: true })
  const p = await ai.locate(shot.image, what)
  if (!p) return null
  const d = shot.display.bounds
  const dip = { x: Math.round(d.x + (p.x / 1000) * d.width), y: Math.round(d.y + (p.y / 1000) * d.height) }
  return isWindows ? screen.dipToScreenPoint(dip) : dip
}

// Cerrar del todo (no solo esconderla). Avisa cómo volver a abrirla.
function quitPixie() {
  ctx.notify('Pixie', 'Me cierro. Para volver a abrirme, buscá «Pixie» en el menú Inicio.')
  logAction('cerrar: me cerraste')
  setTimeout(() => app.quit(), 400)
}

// Palabras que ayudan a entenderte por voz: tu nombre y tus apps
function voiceHints() {
  const name = mind?.memory.getName()
  const apps = ['WhatsApp', 'YouTube', 'Spotify', 'Chrome', 'Classroom', 'Discord', 'Instagram', 'TikTok', 'Word', 'Excel', 'Netflix', 'Gmail']
  const extra = (getConfig().apps ?? []).map((a) => a?.nombre).filter(Boolean)
  return [name, ...apps, ...extra].filter(Boolean).slice(0, 30).join(', ')
}

function openHistory() {
  shell.openPath(join(app.getPath('userData'), 'historial.txt'))
}

function diagnosticsReport() {
  let login = 'no'
  try {
    login = app.getLoginItemSettings().openAtLogin ? 'sí' : 'no'
  } catch {
    login = 'no se sabe'
  }
  return diagnostics.report([
    `Versión: ${app.getVersion()} (${app.isPackaged ? 'instalada' : 'desarrollo'})`,
    `Sistema: ${process.platform} ${release()} · ${process.arch}`,
    `Electron ${process.versions.electron} · Chrome ${process.versions.chrome} · Node ${process.versions.node}`,
    `IA: ${describeAI(getConfig()).text}`,
    `Voz: ${({ piper: 'natural (Piper)', gemini: 'Gemini' })[tts?.engine()] ?? 'la de Windows'}`,
    `Actualizaciones: ${updates?.describe() ?? 'sin arrancar'}`,
    `Arranca con Windows: ${login}`,
    `Palabra mágica: ${wake?.status().activa ? `activa (sensibilidad ${wake.status().sensibilidad})` : wake?.status().grabada ? 'apagada' : 'sin grabar'}`,
    `Atajo: ${shortcutLabel()}${getConfig().atajo && getConfig().atajo !== activeShortcut ? ` (pidió ${shortcutText(getConfig().atajo)}, ocupado)` : ''}`,
    `WhatsApp: ${phone?.configured() ? 'configurado' : 'sin configurar'}`,
    `Classroom: ${classroom ? `${classroom.status().estado}, ${classroom.status().tareas} tareas` : 'sin arrancar'}`,
    `Mails: ${mail ? `${mail.status().estado}, avisos ${mail.status().avisos ? 'sí' : 'no'}` : 'sin arrancar'}`,
    `Calendarios: ${calendars?.status().map((c) => `${c.nombre}${c.error ? ' (no anda)' : ''}`).join(', ') || 'ninguno'}`,
    `Noticias por su cuenta: ${getConfig().noticiasAvisos ?? 'aveces'}`,
    `Extensión de Chrome: ${browser?.connected() ? 'conectada' : 'no conectada'}`
  ])
}

// El resumen en reposo muestra el clima: se actualiza cada 30 minutos mientras esté elegido
async function refreshWeather() {
  try {
    weatherNow = await currentConditions(ctx)
    sendEvent({ type: 'clima', temp: weatherNow.temp, icon: weatherNow.icon })
  } catch (err) {
    logAction(`clima del resumen: ${err.message}`)
  }
}

function syncStandby(mode = getConfig().pantallaReposo ?? 'cara') {
  sendEvent({ type: 'ajustes', pantallaReposo: mode })
  clearInterval(weatherTimer)
  weatherTimer = null
  if (mode === 'resumen') {
    refreshWeather()
    weatherTimer = setInterval(refreshWeather, 30 * 60 * 1000)
  }
}

function openBar() {
  showAndFocus()
  sendEvent({ type: 'open' })
}

// Atajo para hablarle por voz: abre la barra y empieza a escuchar
function listen() {
  showAndFocus()
  sendEvent({ type: 'listen' })
}

function registerVoiceShortcut() {
  for (const accel of [getConfig().atajoVoz, ...VOICE_SHORTCUTS]) {
    try {
      if (accel && accel !== activeShortcut && globalShortcut.register(accel, listen)) {
        voiceShortcut = accel
        return
      }
    } catch {
      // atajo inválido: probamos el siguiente
    }
  }
}

// Captura de la pantalla donde está el mouse (como mucho 1600 px de ancho, en JPG)
async function captureScreen({ withDisplay = false } = {}) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const width = Math.min(1600, Math.round(display.size.width * display.scaleFactor))
  const height = Math.round((width * display.size.height) / display.size.width)
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new FriendlyError('No pude sacarle una foto a la pantalla.')
  const image = source.thumbnail.toJPEG(75).toString('base64')
  return withDisplay ? { image, display } : image
}

function registerShortcut() {
  for (const accel of [getConfig().atajo, ...FALLBACK_SHORTCUTS]) {
    try {
      if (accel && globalShortcut.register(accel, openBar)) {
        activeShortcut = accel
        return
      }
    } catch {
      // atajo inválido en config.json: probamos el siguiente
    }
  }
}

// Lo que la IA sabe en cada mensaje (de los mails, solo cuántos hay sin leer, y si pediste los avisos)
function contextForAI() {
  const st = mail?.status()
  const mails = st?.avisos && st.leido ? `\nMails sin leer en Gmail: ${st.sinLeer}.` : ''
  return `${mind.contextText()}${mails}`
}

// La primera vez que arranca con una versión nueva, cuenta qué hay de nuevo y qué mejoró
function announceUpdate() {
  const cfg = getConfig()
  const current = app.getVersion()
  const seen = cfg.versionVista
  if (seen === current) return
  saveConfig({ versionVista: current })
  // Instalación nueva: la bienvenida ya presenta todo
  if (!seen && cfg.bienvenidaHecha !== true) return
  if (seen && compareVersions(current, seen) <= 0) return
  logAction(`actualizada: ${seen ?? 'una versión anterior'} → ${current}`)
  setTimeout(() => mind?.say({ kind: 'novedades', text: updateText(seen, current), face: 'love', suggestions: ['¿qué hay de nuevo?'] }), 10000)
}

// Una vez, cuando ya está la extensión: ¿querés que te avise de los mails?
function offerMailAlerts() {
  const cfg = getConfig()
  if (cfg.mailAvisos !== undefined || cfg.mailOfrecido) return
  saveConfig({ mailOfrecido: true })
  mind?.say({
    kind: 'mail',
    text: 'Ahora que tengo mi extensión de Chrome, puedo avisarte cuando te llegue un mail: solo miro quién lo manda y el asunto, no los abro. ¿Querés?',
    face: 'happy',
    suggestions: ['sí, avisame de los mails', 'no, gracias']
  })
}

async function ask(text) {
  const input = String(text ?? '').slice(0, 500)

  if (pending) {
    const waiting = pending
    pending = null
    if (isYes(input)) return runAction(waiting.action, waiting.params, ctx)
    if (isNo(input)) return { text: 'Listo, no hago nada.', face: 'happy' }
  }

  const options = { customApps: getConfig().apps ?? [] }
  const intents = interpretAll(input, options)
  mind?.interacted(moodKind(intents))

  // ¿Es la respuesta a algo que Pixie preguntó por su cuenta? ("¿Cómo te fue?", "¿Sigue pendiente?")
  const answer = mind?.answerQuestion(input)
  if (answer) return answer

  // Con IA: charla, preguntas, frases largas y lo que las reglas no entienden.
  // Las órdenes cortas siguen por las reglas, que son instantáneas y gratis.
  const words = input.trim().split(/\s+/).length
  const social = intents?.every((i) => AI_PREFERRED.has(i.action) || i.knowledge)
  const direct = intents?.some((i) => DIRECT.has(i.action))
  if (ai?.enabled() && !direct && (!intents || social || words > 10)) {
    try {
      return await ai.chat(input, contextForAI())
    } catch (err) {
      const line = `IA (${ai.provider()}): ${err.status ? `${err.status} ` : ''}${err.message}`
      console.error(line)
      logAction(line)
      diagnostics.record('ia', { message: line, stack: err.stack })
      const msg = aiErrorText(err)
      if (msg) return { text: msg, face: 'confused' }
    }
  }

  if (!intents) {
    return {
      text: 'No te entendí del todo. ¿Era alguna de estas?',
      face: 'confused',
      suggestions: suggest(input, options)
    }
  }

  // Puede haber varios pedidos juntos: se hacen en orden y lo riesgoso frena para preguntar.
  const results = []
  for (const it of intents) {
    // Los textos que se guardan conservan las tildes: "reunion" → "reunión"
    for (const key of ['texto', 'nombre', 'pregunta', 'tema', 'de']) if (it.params[key]) it.params[key] = restoreAccents(input, it.params[key])
    if (it.action === 'escribir') it.params.texto = textToWrite(input, intents.length > 1) ?? it.params.texto
    const action = actions[it.action]
    if (needsConfirm(action, it.params, ctx)) {
      pending = it
      results.push({ text: action.confirmText(it.params, ctx), face: 'idle', confirm: true })
      break
    }
    results.push(await runAction(it.action, it.params, ctx))
  }
  return mergeResults(results)
}

// Cómo le cae a Pixie lo que le dijiste
function moodKind(intents) {
  const temas = (intents ?? []).map((i) => (i.action === 'charla' ? i.params.tema : i.action))
  if (temas.includes('insulto')) return 'insulto'
  if (temas.includes('carino')) return 'carino'
  if (temas.includes('gracias') || temas.includes('guardar_nombre')) return 'gracias'
  if (temas.includes('chiste')) return 'chiste'
  return 'mensaje'
}

function mergeResults(results) {
  if (results.length === 1) return results[0]
  const last = results[results.length - 1]
  const face = [...results].reverse().find((r) => r.face && r.face !== 'idle')?.face ?? 'idle'
  return {
    text: results.map((r) => r.text).join(' '),
    face,
    confirm: last.confirm,
    suggestions: last.suggestions,
    game: results.find((r) => r.game)?.game,
    speak: results.every((r) => r.speak !== false)
  }
}

// Le pasa a la cara dónde está el mouse, para que lo siga con la mirada.
function followCursor() {
  let last = ''
  setInterval(() => {
    const win = getWindow()
    if (!win || win.isDestroyed() || !win.isVisible()) return
    const { x, y } = screen.getCursorScreenPoint()
    const key = `${x},${y}`
    if (key === last) return
    last = key
    sendEvent({ type: 'cursor', x, y })
  }, 120)
}

async function confirm(yes) {
  const waiting = pending
  pending = null
  if (!waiting) return { text: 'No había nada para confirmar.', face: 'idle' }
  ai?.note(`El usuario ${yes ? 'confirmó' : 'canceló'} «${waiting.action}».`)
  if (!yes) return { text: 'Listo, no hago nada.', face: 'happy' }
  return runAction(waiting.action, waiting.params, ctx)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', openBar)

  app.whenReady().then(() => {
    app.setAppUserModelId(app.isPackaged ? 'com.pixie.asistente' : process.execPath)
    // Las claves de config.json se guardan cifradas con la cuenta de Windows
    const cipher = {
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
      decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64'))
    }
    setCipher(cipher)
    // En una compu nueva, recupera la memoria del respaldo antes de arrancar
    backup = createBackup({ dataDir: app.getPath('userData'), getConfig })
    const restored = backup.restoreIfMissing()
    loadConfig()

    ipcMain.handle('pixie:ask', (_e, text) => ask(text))
    ipcMain.handle('pixie:confirm', (_e, yes) => confirm(Boolean(yes)))
    // Lo que dijiste por el micrófono → texto
    ipcMain.handle('pixie:transcribe', async (_e, audio) => {
      const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio ?? [])
      if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return { error: 'El audio quedó vacío o muy largo.' }
      tts?.prepare?.() // mientras te entiende, la voz ya se va cargando para contestarte
      try {
        return { text: await ai.transcribe(bytes, voiceHints()) }
      } catch (err) {
        logAction(`voz: ${err.status ? `${err.status} ` : ''}${err.message}`)
        diagnostics.record('micrófono', err)
        return { error: voiceErrorText(err) }
      }
    })
    // Voz natural: el audio va llegando en pedacitos a la interfaz
    ipcMain.handle('pixie:voice', (e, { id, text, face } = {}) =>
      tts.stream(id, String(text ?? ''), face, (chunk, rate) => {
        if (!e.sender.isDestroyed()) e.sender.send('pixie:event', { type: 'voz', id, chunk, rate })
      })
    )
    ipcMain.on('pixie:voice-stop', (_e, id) => tts?.stop(id))
    // Mientras Pixie habla, pausa la música (salvo que se la acabes de pedir)
    ipcMain.on('pixie:speaking', (_e, on) => {
      if (on && Date.now() - (ctx.mediaTouchedAt ?? 0) < 10000) return
      media?.speaking(Boolean(on))
    })
    ipcMain.handle('pixie:info', () => ({
      naturalVoice: Boolean(tts?.available()),
      voiceShortcut: voiceShortcut?.replace('Control', 'Ctrl').replace('Space', 'Espacio') ?? null,
      shortcut: shortcutLabel(),
      version: app.getVersion(),
      feeling: mind?.feeling(),
      ai: Boolean(ai?.enabled()),
      palabra: wake?.forWindow() ?? null,
      pantallaReposo: getConfig().pantallaReposo ?? 'cara',
      clima: weatherNow ? { temp: weatherNow.temp, icon: weatherNow.icon } : null
    }))
    ipcMain.on('pixie:mode', (_e, mode) => setMode(mode))
    // Errores de la ventana (la cara y la barra)
    ipcMain.on('pixie:error', (_e, info) => {
      diagnostics.record('ventana', { message: String(info?.message ?? info).slice(0, 500), stack: String(info?.stack ?? '').slice(0, 2000) })
    })
    ipcMain.on('pixie:hide', () => getWindow()?.hide())
    // Solo la ventanita de Pixie: su menú, aparecer si estaba escondida (cuando la llamás con la voz)
    const fromPixie = (e) => e.sender === getWindow()?.webContents
    ipcMain.on('pixie:menu', (e) => fromPixie(e) && trayMenu?.popup())
    ipcMain.on('pixie:show', (e) => {
      const win = getWindow()
      if (fromPixie(e) && win && !win.isVisible()) win.showInactive()
    })
    ipcMain.on('pixie:wake-log', (e, line) => fromPixie(e) && logAction(`palabra mágica: ${String(line).slice(0, 200)}`))
    ipcMain.on('pixie:wake-learn', (e, frames) => {
      if (fromPixie(e) && wake?.learn(frames)) logAction(`palabra mágica: aprendí cómo me llamaste (van ${wake.learnedCount()})`)
    })
    ipcMain.on('pixie:game-result', (_e, result) => {
      const ganador = result?.ganador === 'user' ? 'vos' : 'Pixie'
      logAction(`partido de pong: ganó ${ganador}`)
      mind?.interacted(result?.ganador === 'user' ? 'gracias' : 'chiste')
    })

    mind = createMind({
      ctx,
      sendEvent,
      notify: ctx.notify,
      log: logAction,
      showWindow: () => {
        const win = getWindow()
        if (win && !win.isVisible()) win.showInactive()
      }
    })
    browser = createBrowserBridge({
      log: logAction,
      // Apenas se conecta la extensión (abriste Chrome), se fija en tus Pendientes de Classroom
      onConnect: (version) => {
        logAction(`extensión de Chrome ${version}`)
        setTimeout(() => classroom?.refresh(), 5000)
        setTimeout(() => (getConfig().mailAvisos ? mail?.refresh() : offerMailAlerts()), 15000)
      }
    })
    ai = createAI({ getConfig, ctx, log: logAction })
    phone = createPhone({ getConfig, log: logAction })
    tts = createVoices({
      getConfig,
      saveConfig,
      dataDir: app.getPath('userData'),
      log: (line) => {
        console.log(line)
        logAction(line)
      },
      announce: (text, face) => mind.say({ kind: 'voz', text, face })
    })
    media = createMediaSession({ getConfig, log: logAction })
    // Noticias de Infobae y TN, y los calendarios de Google y Classroom (se suman a la agenda)
    news = createNews({ log: logAction })
    calendars = createCalendars({
      file: join(app.getPath('userData'), 'calendarios.json'),
      cipher,
      log: logAction,
      onChange: () => trayMenu?.refresh()
    })
    classroom = createClassroom({
      browser,
      file: join(app.getPath('userData'), 'classroom.json'),
      getConfig,
      log: logAction,
      onChange: () => trayMenu?.refresh()
    })
    mind.memory.setExternal({
      eventsBetween: (from, to) => [...calendars.eventsBetween(from, to), ...classroom.eventsBetween(from, to)],
      dueAlerts: (now) => [...calendars.dueAlerts(now), ...classroom.dueAlerts(now)]
    })
    // Los mails nuevos: solo avisa si se lo pediste («avisame de los mails»)
    mail = createMail({
      browser,
      file: join(app.getPath('userData'), 'mails.json'),
      getConfig,
      saveConfig,
      log: logAction,
      onNew: (list) => mind.say({ kind: 'mail', text: announceText(list), face: 'surprised', suggestions: ['leémelo', 'abrí Gmail'] }),
      // Un mail de Classroom (una tarea nueva): vuelve a leer los Pendientes
      onClassroom: () => setTimeout(() => classroom?.refresh({ force: true }), 3000)
    })
    calendars.start()
    classroom.start()
    mail.start()
    // La extensión viaja adentro de Pixie: queda copiada en su carpeta de datos para instalarla en Chrome
    try {
      extensionFiles = installExtensionFiles({
        from: app.isPackaged ? join(process.resourcesPath, 'extension') : join(app.getAppPath(), 'extension'),
        to: join(app.getPath('userData'), 'extension-chrome')
      })
    } catch (err) {
      logAction(`extensión de Chrome: no la pude copiar (${err.message})`)
    }
    hands = createHands({ log: logAction })
    Object.assign(ctx, {
      hands,
      targetWindow,
      withPixieHidden,
      hidePixieFocus,
      locateOnScreen,
      news,
      calendars,
      classroom,
      mail,
      phone,
      media,
      voice: tts,
      // "¿Qué ves en mi pantalla?": una foto de la pantalla para la IA (no se guarda)
      lookAtScreen: async (pregunta) => {
        if (!ai.enabled()) throw new FriendlyError(`Para mirar tu pantalla necesito la IA. ${ai.status()}`)
        const image = await captureScreen()
        try {
          return await ai.look(image, pregunta)
        } catch (err) {
          logAction(`pantalla: ${err.status ? `${err.status} ` : ''}${err.message}`)
          diagnostics.record('pantalla', err)
          throw new FriendlyError(aiErrorText(err) ?? 'No me pude conectar con la IA para mirar la pantalla.')
        }
      },
      // Si no estás frente a la compu, los avisos importantes te llegan al celular
      phoneIfAway: (text) => {
        const snap = mind.snapshot()
        const away = snap && (snap.bloqueada || snap.inactivoSeg >= 300)
        if (!away || getConfig().avisosAlCelular === false || !phone.configured()) return
        phone.send(`Pixie: ${text}`, { auto: true }).catch((err) => logAction(`whatsapp automático: ${err.message}`))
      },
      ai,
      browser,
      readPage: (que) => browser.request('leer', { que }),
      setPending: (intent) => {
        pending = intent
      },
      memory: mind.memory,
      backup,
      awareness: mind.snapshot,
      setQuiet: mind.setQuiet,
      feeling: mind.feeling,
      howAreYou: mind.howAreYou
    })

    // Versiones nuevas desde las Releases de GitHub
    updates = createUpdater({
      updater: autoUpdater,
      packaged: app.isPackaged,
      currentVersion: app.getVersion(),
      log: logAction,
      reportError: ctx.reportError,
      onChange: () => trayMenu?.refresh(),
      onReady: (version) =>
        mind.say({
          kind: 'actualizacion',
          text: `¡Hay una versión nueva de Pixie, la ${version}! ¿Me actualizo ahora? Si no, se instala sola la próxima vez que me cierres.`,
          face: 'happy',
          suggestions: ['actualizar']
        })
    })
    ctx.updates = updates

    // «Pixie, ¿estás?»: la huella de tu voz, en esta compu
    wake = createWakeStore({
      file: join(app.getPath('userData'), 'palabra-magica.json'),
      getConfig,
      saveConfig,
      onChange: () => {
        sendEvent({ type: 'palabra', ...wake.forWindow() })
        trayMenu?.refresh()
      }
    })
    ctx.wake = wake

    // Ajustes y bienvenida: solo la ventana de Ajustes puede usar estos pedidos
    settings = createSettings({
      getConfig,
      saveConfig,
      memory: mind.memory,
      voices: tts,
      updates,
      ai,
      loginItem: {
        get: () => {
          try {
            return app.getLoginItemSettings().openAtLogin
          } catch {
            return false
          }
        },
        set: (on) => app.setLoginItemSettings({ openAtLogin: on })
      },
      changeShortcut,
      shortcutLabel,
      setCity: async (ciudad) => (await runAction('configurar_ciudad', { ciudad }, ctx)).text,
      onStandby: (mode) => {
        syncStandby(mode)
        trayMenu?.refresh()
      },
      errorCount: () => diagnostics.list().length,
      readClipboard: () => clipboard.readText(),
      wake,
      calendars,
      news,
      classroom,
      mail,
      extension: () => ({
        carpeta: extensionFiles?.carpeta ?? null,
        version: extensionFiles?.version ?? null,
        conectada: Boolean(browser?.connected()),
        vieja: Boolean(browser?.connected() && extensionFiles?.version && olderThan(browser.version(), extensionFiles.version))
      }),
      version: app.getVersion()
    })
    const fromSettings = (e) => e.sender === getSettingsWindow()?.webContents
    const handle = (channel, fn) =>
      ipcMain.handle(channel, (e, ...args) => {
        if (!fromSettings(e)) throw new Error('Solo desde la ventana de Ajustes')
        return fn(...args)
      })
    handle('ajustes:leer', () => settings.snapshot())
    handle('ajustes:cambiar', (patch) => settings.apply(patch && typeof patch === 'object' ? patch : {}))
    handle('ajustes:probar-clave', (key) => settings.testKey(key))
    handle('ajustes:guardar-clave', async (key) => {
      const r = await settings.saveKey(key)
      if (r.guardada) logAction('ajustes: clave de IA nueva guardada (cifrada)')
      trayMenu?.refresh()
      return r
    })
    handle('ajustes:clave-portapapeles', () => settings.clipboardKey())
    handle('ajustes:borrar-clave', () => {
      const r = settings.forgetKey()
      trayMenu?.refresh()
      return r
    })
    handle('ajustes:abrir-ai-studio', () => shell.openExternal(AI_STUDIO_URL))
    handle('ajustes:buscar-version', async () => {
      await updates.check()
      return settings.snapshot()
    })
    handle('ajustes:instalar-version', () => updates.install())
    handle('ajustes:copiar-informe', () => ctx.copyDiagnostics())
    handle('ajustes:abrir-carpeta', () => shell.openPath(app.getPath('userData')))
    handle('ajustes:probar-voz', () => sendEvent({ type: 'prueba-voz', text: '¡Hola! Así sueno. ¿Te gusta mi voz?' }))
    handle('ajustes:palabra-guardar', (plantillas) => {
      const r = settings.saveWake(plantillas)
      if (r.ok) logAction('palabra mágica: grabaste tu voz')
      return r
    })
    handle('ajustes:palabra-borrar', () => settings.forgetWake())
    handle('ajustes:palabra-plantillas', () => wake.templates())
    handle('ajustes:calendario-agregar', async (url) => {
      const r = await settings.addCalendar(url)
      if (r.ok) logAction(`agenda: sumé un calendario (${r.mensaje})`)
      return r
    })
    handle('ajustes:calendario-portapapeles', () => settings.clipboardCalendar())
    handle('ajustes:calendario-quitar', (id) => settings.removeCalendar(id))
    handle('ajustes:calendario-avisos', (id, on) => settings.calendarAlerts(id, on))
    handle('ajustes:abrir-google-calendar', () => shell.openExternal(GOOGLE_CALENDAR_SETTINGS_URL))
    handle('ajustes:noticias-probar', () => settings.previewNews())
    handle('ajustes:classroom-leer', () => settings.readClassroom())
    handle('ajustes:mails-leer', () => settings.readMails())
    handle('ajustes:abrir-carpeta-extension', () => extensionFiles?.carpeta && shell.openPath(extensionFiles.carpeta))
    // Chrome no deja abrir chrome://extensions desde otro programa: se copia para pegarlo en la barra
    handle('ajustes:copiar-direccion-extensiones', () => clipboard.writeText('chrome://extensions'))
    // Pixie lee en voz alta un paso de la guía (para quien prefiere escuchar)
    handle('ajustes:decir', (text) => sendEvent({ type: 'prueba-voz', text: String(text ?? '').slice(0, 400) }))
    // Mientras probás la frase en Ajustes, la ventanita no se despierta
    handle('ajustes:palabra-probando', (on) => sendEvent({ type: 'palabra', ...wake.forWindow(), pausada: Boolean(on) }))
    handle('ajustes:bienvenida-lista', () => {
      settings.finishWelcome()
      getSettingsWindow()?.close()
      const nombre = mind.memory.getName()
      mind.say({
        kind: 'bienvenida',
        text: `¡Listo${nombre ? `, ${nombre}` : ''}! Ya estoy. Llamame ${wake.status().activa ? 'diciendo «Pixie, ¿estás?», ' : ''}con ${shortcutLabel()} o tocándome, y pedime lo que quieras.`,
        face: 'love'
      })
    })

    // La primera vez que se abre la app instalada, queda arrancando con Windows (se apaga desde el ícono)
    if (app.isPackaged && isWindows && !getConfig().arranqueConfigurado) {
      app.setLoginItemSettings({ openAtLogin: true })
      saveConfig({ arranqueConfigurado: true })
    }

    // Al volver de suspender o desbloquear la compu, la ventanita reabre el micrófono de «Pixie, ¿estás?»
    announceUpdate()
    powerMonitor.on('resume', () => setTimeout(() => sendEvent({ type: 'microfono', motivo: 'la compu volvió de suspenderse' }), 3000))
    powerMonitor.on('unlock-screen', () => setTimeout(() => sendEvent({ type: 'microfono', motivo: 'desbloqueaste la compu' }), 2000))
    createPixieWindow({
      onProblem: (what) => {
        logAction(`ventana: ${what}`)
        diagnostics.record('ventana', what)
      }
    })
    registerShortcut()
    registerVoiceShortcut()
    followCursor()
    trayMenu = createMenus({
      onTalk: openBar,
      shortcutLabel,
      updates,
      checkUpdates: async () => {
        const s = await updates.check()
        if (s.state !== 'ready') ctx.notify('Pixie', updates.describe())
      },
      copyDiagnostics: () => {
        ctx.copyDiagnostics()
        ctx.notify('Pixie', 'Copié el informe de diagnóstico. Pegalo con Ctrl+V donde lo quieras mandar.')
      },
      openSettings: (view = 'ajustes') => openSettingsWindow(view),
      getConfig,
      setStandby: (mode) => settings.apply({ pantallaReposo: mode }),
      wake,
      hasAI: () => Boolean(ai?.enabled()),
      openHistory,
      quit: quitPixie
    })
    mind.start()
    updates.start()
    syncStandby()
    console.log(`Pixie ${app.getVersion()} · ${ai.status()}`)

    // La primera vez: si todavía no tiene IA, abre la bienvenida para dejarla lista en un minuto
    if (!getConfig().bienvenidaHecha) {
      if (describeAI(getConfig()).on) settings.finishWelcome()
      else setTimeout(() => openSettingsWindow('bienvenida'), 2500)
    }

    // Si otro programa (por ejemplo Claude) ya usa el atajo, Pixie avisa cuál le quedó (una vez por caso)
    const wanted = getConfig().atajo
    const busy = wanted && activeShortcut !== wanted ? `${wanted}→${activeShortcut}` : null
    if (busy && getConfig().atajoAvisado !== busy) {
      setTimeout(() => {
        const now = activeShortcut ? `para llamarme usá ${shortcutLabel()}` : 'para llamarme tocá mi ícono al lado del reloj'
        mind.say({
          kind: 'atajo',
          text: `${shortcutText(wanted)} lo está usando otro programa, así que ${now}. Si preferís otro, decime «cambiá el atajo a Ctrl+Alt+P».`,
          face: 'confused'
        })
        saveConfig({ atajoAvisado: busy })
      }, 6000)
    }

    // Si editás config.json con Pixie abierto, lo lee solo (también un atajo nuevo)
    let lastShortcut = getConfig().atajo
    let lastStandby = getConfig().pantallaReposo
    watchConfig((cfg) => {
      const msg = `config.json cambió · ${describeAI(cfg).text}`
      console.log(msg)
      logAction(msg)
      if (cfg.pantallaReposo !== lastStandby) {
        lastStandby = cfg.pantallaReposo
        syncStandby()
      }
      if (cfg.atajo === lastShortcut) return
      lastShortcut = cfg.atajo
      if (cfg.atajo && cfg.atajo !== activeShortcut && !changeShortcut(cfg.atajo).ok) {
        logAction(`atajo: ${shortcutText(cfg.atajo)} lo usa otro programa, sigo con ${shortcutLabel()}`)
      }
    })

    if (restored.some((r) => r.file === 'memoria.json')) {
      const from = restored.find((r) => r.file === 'memoria.json').from
      setTimeout(() => mind.say({ kind: 'respaldo', text: `¡Recuperé mis recuerdos del respaldo en ${from}!`, face: 'love' }), 5000)
    }
    setTimeout(() => backup.backup(), 60 * 1000)
    setInterval(() => backup.backup(), BACKUP_EVERY_MS)
  })

  // Pixie no navega a otras páginas ni abre ventanas nuevas.
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => event.preventDefault())
  })

  // Vive en la barra de tareas: cerrar la ventana no cierra la app.
  app.on('window-all-closed', () => {})
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    mind?.stop()
    media?.stop()
    calendars?.stop()
    classroom?.stop()
    mail?.stop()
    hands?.stop()
    backup?.backup()
    browser?.close()
  })
}
