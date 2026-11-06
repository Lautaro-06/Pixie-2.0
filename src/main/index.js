import { app, ipcMain, globalShortcut, Notification, screen, desktopCapturer, clipboard, safeStorage, shell, powerMonitor } from 'electron'
import { join } from 'node:path'
import { release } from 'node:os'
import { autoUpdater } from 'electron-updater'
import { interpretAll, suggest, isYes, isNo, restoreAccents } from './brain.js'
import { actions, runAction, needsConfirm, resolveAction } from './actions/index.js'
import { createPomodoro } from './pomodoro.js'
import { studyIntent, subjectFrom, subjectIn, topicFromTitle, topicsFromTitles, taskTypeFrom, minutesFrom, focusKind } from './study.js'
import { createStudyLog, endSummaryText, DEFAULT_GOAL } from './study-log.js'
import { createJournal, journalContext } from './journal.js'
import { crisisRisk, CRISIS_TEXT } from './sensitive.js'
import { noEmoji } from './speech-text.js'
import { readFileSync as readFile, writeFileSync as writeFile, rmSync as removeFile } from 'node:fs'
import { createDodger } from './dodge.js'
import { setPomodoroProbe, onTimersChange, timersState, toggleTimer, exportTimers, restoreTimers } from './actions/timers.js'
import { studyWindow } from './scenes.js'
import { loadConfig, getConfig, saveConfig, logAction, watchConfig, setCipher } from './config.js'
import { createPixieWindow, getWindow, getMode, setMode, showAndFocus, sendEvent } from './window.js'
import { createMenus } from './tray.js'
import { createMind } from './mind.js'
import { createAI, aiErrorText, voiceErrorText, describeAI } from './ai.js'
import { createBrowserBridge } from './browser.js'
import { createBackup } from './backup.js'
import { createPhone, whatsappConfig } from './phone.js'
import { FriendlyError, isWindows, launch, run, powershell } from './windows.js'
import { createVoices } from './voices.js'
import { createMediaSession } from './media-session.js'
import { createUpdater } from './updates.js'
import { createDiagnostics, usefulLogLines, tailFile } from './diagnostics.js'
import { wantsAI } from './routing.js'
import { shortcutText } from './shortcut.js'
import { createSettings, AI_STUDIO_URL, GOOGLE_CALENDAR_SETTINGS_URL } from './settings.js'
import { openSettingsWindow, getSettingsWindow, onSettingsClosed } from './settings-window.js'
import { currentConditions } from './actions/weather.js'
import { createWakeStore } from './wake-store.js'
import { createCalendars } from './calendars.js'
import { createNews } from './news.js'
import { createClassroom } from './classroom.js'
import { createMail, announceText } from './mail.js'
import { createApps, LIST_SCRIPT } from './apps.js'
import { createMaps } from './maps.js'
import { compareVersions, updateText } from './changelog.js'
import { installExtensionFiles, olderThan } from './extension-files.js'
import { createHands } from './hands.js'
import { createWork } from './work/index.js'
import { editedCommitMessage, gitAction } from './work/git.js'
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
let work = null
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
let apps = null // las apps instaladas y qué puede hacer Pixie con cada una
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
  // Un aviso más tarde (por ejemplo, cuando termina de leer Classroom)
  say: (notice) => mind?.say(notice),
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
    `Extensión de Chrome: ${browser?.connected() ? `conectada (${browser.version() ?? '?'}${extensionFiles?.version ? `, Pixie trae la ${extensionFiles.version}` : ''})` : 'no conectada'}`
  ], usefulLogLines(tailFile(join(app.getPath('userData'), 'historial.txt'))))
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

// ¿Está abierto este programa? (para no abrir Chrome dos veces)
async function isProcessRunning(exe) {
  if (process.platform !== 'win32') return false
  try {
    const out = await run('tasklist', ['/FI', `IMAGENAME eq ${exe}.exe`, '/NH'])
    return out.toLowerCase().includes(`${exe}.exe`)
  } catch {
    return false
  }
}

// Lo que la IA sabe en cada mensaje (de los mails, solo cuántos hay sin leer, y si pediste los avisos)
// query: lo que dijo ahora (para traer lo que hablaron antes sobre eso)
function contextForAI(query = '') {
  const st = mail?.status()
  const mails = st?.avisos && st.leido ? `\nMails sin leer en Gmail: ${st.sinLeer}.` : ''
  const talks = journalContext(journal, query)
  return `${mind.contextText(query)}${mails}${talks ? `\n${talks}` : ''}`
}

// ───────────── Lo que estaba haciendo (para seguir después de actualizarse o reiniciarse) ─────────────
let journal = null // el diario de charlas (charlas.jsonl)
const stateFile = () => join(app.getPath('userData'), 'estado.json')

function saveState(reason = 'auto') {
  try {
    const state = {
      version: app.getVersion(),
      savedAt: Date.now(),
      reason,
      pomodoro: pomodoro?.snapshot() ?? null,
      timers: exportTimers(),
      ai: ai?.saveState() ?? null
    }
    writeFile(stateFile(), JSON.stringify(state))
  } catch (err) {
    logAction(`no pude guardar lo que estaba haciendo: ${err.message}`)
  }
}

// Al arrancar: sigue con el Pomodoro, los timers y la charla de antes de cerrarse
function restoreState() {
  let state = null
  try {
    state = JSON.parse(readFile(stateFile(), 'utf8'))
    removeFile(stateFile(), { force: true })
  } catch {
    return
  }
  if (!state?.savedAt || Date.now() - state.savedAt > 12 * 60 * 60 * 1000) return
  const parts = []
  if (state.pomodoro) {
    const r = pomodoro.restore(state.pomodoro, { savedAt: state.savedAt })
    if (r?.sigue) {
      const st = r.sigue
      const fase = st.fase === 'estudio' ? `el bloque ${st.bloque} de ${st.bloques}` : 'el descanso'
      parts.push(`Seguimos con tu Pomodoro: ${fase}, ${st.pausado ? 'en pausa' : `faltan ${Math.max(1, Math.ceil(st.restanteMs / 60000))} minutos`}.`)
    } else if (r?.terminado) parts.push('Tu Pomodoro quedó anotado hasta donde lo dejaste.')
  }
  const t = restoreTimers(state.timers, ctx)
  if (t.siguen.length) parts.push(t.siguen.length === 1 ? `Tu timer${t.siguen[0].etiqueta ? ` de «${t.siguen[0].etiqueta}»` : ''} sigue andando.` : `Tus ${t.siguen.length} timers siguen andando.`)
  // La charla: si fue hace poco, la IA sigue donde estaba
  if (state.ai && Date.now() - state.savedAt < 6 * 60 * 60 * 1000) ai?.loadState(state.ai)
  const last = state.reason === 'actualizacion' ? journal?.lastTalk() : null
  if (last) {
    parts.push(`Estábamos hablando de «${last.yo.slice(0, 80)}»: seguimos cuando quieras.`)
  }
  logAction(`volví: ${state.reason} (${parts.length ? parts.join(' ') : 'nada pendiente'})`)
  if (!parts.length) return
  const intro = state.reason === 'actualizacion' ? 'Ya volví de actualizarme.' : 'Ya volví.'
  setTimeout(() => mind?.say({ kind: 'volvio', text: `${intro} ${parts.join(' ')}`, face: 'happy' }), state.reason === 'actualizacion' ? 16000 : 4000)
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

// ───────────── Modo Pomodoro ─────────────
let pomodoro = null
let studyLog = null // estudio.json: las sesiones terminadas y el temario
// Qué estás estudiando (los títulos de lo que tenés abierto en cada bloque): en memoria mientras dura
// el Pomodoro; al terminar quedan solo los temas (limpios) en estudio.json
const studySpy = new Map()
let lastStudyOffer = 0
const FOCUS_SPY_MS = 5000
const CHAT_GRACE_MS = 3 * 60 * 1000 // un chat distrae si te quedás más de 3 minutos
let focusNow = null // { tipo, app, distraido } de lo que tenés adelante en el bloque
let chatSince = null
let studyQuestion = null // «¿qué vas a estudiar?»: esperando la respuesta
let lastSummary = null // el resumen de la última sesión que terminaste a mano

// Mira qué tenés adelante en un bloque de estudio: si te distrae, lo descuenta del foco; si es lo que
// estudiás, anota el título (para el mini test, los temas vistos y el temario)
function watchFocus() {
  if (!pomodoro?.enFoco()) {
    focusNow = null
    chatSince = null
    return
  }
  const w = mind?.lastWindow()
  const f = focusKind(w, { materia: pomodoro.status().materia })
  if (f?.tipo === 'chat') chatSince ??= Date.now()
  else chatSince = null
  const distraido = f?.tipo === 'distraccion' || (f?.tipo === 'chat' && Date.now() - chatSince >= CHAT_GRACE_MS)
  focusNow = f ? { ...f, distraido } : null
  if (distraido) {
    pomodoro.noteDistraction(FOCUS_SPY_MS)
    return
  }
  if (f?.tipo !== 'estudio' || !studyWindow(w)) return
  const before = studySpy.get(w.titulo) ?? 0
  studySpy.set(w.titulo, before + FOCUS_SPY_MS)
  // Lo estudiaste un minuto: si está en el temario, lo tacha
  if (before < 60000 && before + FOCUS_SPY_MS >= 60000) {
    const seen = studyLog?.markSeen([w.titulo, topicFromTitle(w.titulo)]) ?? []
    if (seen.length) logAction(`temario: visto ${seen.join(', ')}`)
  }
}

// Los botones de Ajustes → Pomodoro y del menú: Pixie lo hace y lo dice en voz alta
async function runPomodoroButton(accion) {
  const cfg = getConfig()
  const r = await runAction('pomodoro', { accion, minutos: cfg.pomodoroMinutos, materia: cfg.pomodoroMateria, metodo: cfg.pomodoroMetodo, tipo: cfg.pomodoroTipo, directo: true }, ctx)
  sendEvent({ type: 'notice', text: r.text, face: r.face, suggestions: r.suggestions })
  trayMenu?.refresh()
  return r.text
}

// «¿Qué vas a estudiar?»: la respuesta («química», «memorizar fechas», «armalo igual») arma el plan
async function answerStudyQuestion(input) {
  const q = studyQuestion
  studyQuestion = null
  const t = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const params = { accion: 'plan', minutos: q.minutos ?? minutesFrom(input) ?? undefined, metodo: q.metodo, directo: true }
  if (/^(armalo igual|da igual|cualquiera|no se|nose|no importa|lo que sea|igual|dale)\b/.test(t)) return runAction('pomodoro', params, ctx)
  const tipo = taskTypeFrom(input)
  let materia = subjectIn(input) ?? subjectFrom(input)
  if (!tipo && !materia) {
    // Una respuesta corta que no es otro pedido («Construcción de la ciudadanía») es la materia
    const other = interpretAll(input)?.[0]
    if ((other && !['charla', 'buscar'].includes(other.action)) || t.split(/\s+/).length > 5) return null
    materia = input.trim().replace(/[.!?]+$/, '').slice(0, 40)
  }
  return runAction('pomodoro', { ...params, materia, tipo }, ctx)
}

function studyTopic() {
  const top = [...studySpy.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? topicFromTitle(top[0]) || null : null
}

// Lo que necesita la ventanita para dibujar el temporizador
function pomodoroForWindow() {
  const st = pomodoro?.status()
  if (!st?.activo) return { activo: false }
  const { activo, fase, bloque, bloques, finAt, restanteMs, totalMs, pausado, materia, indice } = st
  // El plan entero, para dibujar los bloques en fila
  const plan = st.plan.bloques.map((b) => ({ tipo: b.tipo, minutos: b.minutos }))
  return { activo, fase, bloque, bloques, finAt, restanteMs, totalMs, pausado, materia, indice, plan }
}

function onPomodoro(event, st) {
  if (event === 'cambio') {
    sendEvent({ type: 'pomodoro', ...pomodoroForWindow() })
    trayMenu?.refresh()
    return
  }
  if (event === 'bloque') {
    logAction(`pomodoro: bloque ${st.bloque} de ${st.bloques}`)
    // El primero lo cuenta la respuesta a «arrancá»; los demás, Pixie por su cuenta
    if (st.bloque > 1) {
      mind?.say({
        kind: 'pomodoro',
        text: `Arranca el bloque ${st.bloque} de ${st.bloques}: ${Math.round(st.totalMs / 60000)} minutos sin distracciones. Vuelvo en el descanso. No te voy a molestar, pero sigo acá si necesitás ayuda con lo que estudiás.`,
        face: 'happy',
        suggestions: ['terminar por hoy']
      })
    }
  } else if (event === 'ultimos2') {
    const tema = studyTopic() ?? st.materia
    mind?.say({
      kind: 'pomodoro',
      text: `Quedan 2 minutos del bloque. ¿Hacemos un mini test de repaso${tema ? ` de «${tema}»` : ''}?`,
      face: 'happy',
      suggestions: ['dale, tomame', 'no, sigo']
    })
  } else if (event === 'descanso') {
    const held = mind?.releaseHeld() ?? ''
    const min = Math.round(st.totalMs / 60000)
    mind?.say({
      kind: 'pomodoro',
      text: `¡Bloque ${st.bloque} terminado! ${min} minutos de descanso: estirate, tomá agua y mirá lejos de la pantalla.${held ? ` ${held}` : ''}`,
      face: 'proud',
      suggestions: ['saltá el descanso', 'terminar por hoy']
    })
    logAction(`pomodoro: descanso de ${min} minutos`)
  } else if (event === 'fin') {
    const held = mind?.releaseHeld() ?? ''
    // Los temas que estuviste viendo (limpios) quedan en la sesión; los títulos se borran
    const temas = topicsFromTitles([...studySpy.entries()])
    studyLog?.markSeen([...studySpy.keys()])
    studySpy.clear()
    focusNow = null
    const sesion = { ...st, temas }
    studyLog?.record(sesion)
    const text = endSummaryText({ sesion, hoy: studyLog?.today() ?? { minutos: st.estudiadoMin, ciclos: st.ciclos }, racha: studyLog?.streak() ?? 0, temario: studyLog?.temario() })
    sendEvent({ type: 'pomodoro-fin', completo: st.completo })
    // Si terminó solo, lo cuenta Pixie; si lo terminaste vos, lo contesta lo que le pediste
    lastSummary = st.completo ? null : `${text}${held ? ` ${held}` : ''}`
    if (st.completo) mind?.say({ kind: 'pomodoro', text: `${text}${held ? ` ${held}` : ''}`, face: 'proud', suggestions: ['mostrame mi seguimiento'] })
    mind?.memory.markDone?.('pomodoro', new Date())
    logAction(`pomodoro: terminado (${st.estudiadoMin} minutos de estudio, ${st.ciclos} ciclos, adherencia ${st.adherencia}%)`)
  }
}

// Si hablás de estudiar y no hay un Pomodoro andando, te lo ofrece (como mucho cada 20 minutos)
function offerPomodoro(input, result) {
  if (!result || result.confirm || result.noOffer || getConfig().pomodoroOfrecer === false) return result
  if (pomodoro?.activo() || !studyIntent(input) || /\bpomodoro\b/i.test(input)) return result
  if (Date.now() - lastStudyOffer < 20 * 60 * 1000) return result
  lastStudyOffer = Date.now()
  const materia = subjectFrom(input)
  const chip = materia ? `armá un pomodoro de ${materia}` : 'armá un pomodoro'
  return {
    ...result,
    text: `${result.text ?? ''} ¿Querés que armemos un Pomodoro para estudiar? Te muestro los bloques y no te molesto mientras estudiás.`.trim(),
    suggestions: [chip, ...(result.suggestions ?? [])].slice(0, 4)
  }
}

async function ask(text) {
  const input = String(text ?? '').slice(0, 500)
  const started = Date.now()
  const result = await respond(input, text)
  // Si tardó, queda anotado (para el informe de diagnóstico): cuánto y si fue con la IA
  const ms = Date.now() - started
  if (ms > 2000) logAction(`tardé ${(ms / 1000).toFixed(1)} s en contestar «${input.slice(0, 40)}» (${route})`)
  // Todo lo que hablan queda en el diario (en la compu), para acordarse aunque se cierre.
  // Las órdenes que entienden las reglas («abrí Spotify») quedan marcadas como pedidos.
  if (result?.text) journal?.record(input, result.text, { pedido: Boolean(interpretAll(input, { customApps: getConfig().apps ?? [] })?.length) })
  return result
}

async function respond(input, text) {
  // Si dice que se quiere hacer daño: primero eso, con cuidado y con a quién llamar
  if (crisisRisk(input)) {
    logAction('charla: respondí con ayuda (dijo que se quería hacer daño)')
    return { text: CRISIS_TEXT, face: 'sad' }
  }
  // Le preguntó «¿qué vas a estudiar?» hace poco: esto es la respuesta (si no es otro pedido)
  if (studyQuestion && Date.now() - studyQuestion.at < 5 * 60 * 1000) {
    const r = await answerStudyQuestion(input)
    if (r) return r
  }
  studyQuestion = null
  return offerPomodoro(input, await askInner(text))
}

// Por dónde salió la última respuesta (para anotar en el historial si tardó)
let route = 'reglas'

async function askInner(text) {
  const input = String(text ?? '').slice(0, 500)
  route = 'reglas'

  if (pending) {
    const waiting = pending
    pending = null
    if (waiting.action === 'work_git' && waiting.params?.operation === 'commit') {
      const message = editedCommitMessage(input)
      if (message) {
        waiting.params.message = message
        pending = waiting
        return { text: gitAction.confirmText(waiting.params), face: 'idle', confirm: true }
      }
    }
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
  // Las órdenes que las reglas entienden van por las reglas, que son instantáneas y gratis.
  if (ai?.enabled() && wantsAI(input, intents)) {
    route = 'IA'
    try {
      return await ai.chat(input, contextForAI(input))
    } catch (err) {
      route = 'IA falló, reglas'
      const line = `IA (${ai.provider()}): ${err.status ? `${err.status} ` : ''}${err.message}`
      console.error(line)
      logAction(line)
      diagnostics.record('ia', { message: line, stack: err.stack })
      // Si la IA falla (saturada, sin internet, tarda), lo que entendieron las reglas se hace igual
      if (intents) logAction('IA: falló, lo hago con las reglas')
      else {
        const msg = aiErrorText(err)
        if (msg) return { text: msg, face: 'confused', suggestions: suggest(input, options) }
      }
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
    for (const key of ['texto', 'nombre', 'pregunta', 'tema', 'de', 'destino', 'direccion', 'materia', 'temas']) if (it.params[key]) it.params[key] = restoreAccents(input, it.params[key])
    if (it.action === 'escribir') it.params.texto = textToWrite(input, intents.length > 1) ?? it.params.texto
    // Los temas del temario, como los escribiste (con comas y tildes)
    if (it.action === 'temario' && it.params.temas) it.params.temas = /\bson\b[:\s]*(.+)$/i.exec(input)?.[1] ?? it.params.temas
    const action = resolveAction(it.action, ctx)
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
// Y si dejás el mouse encima de Pixie, se corre (para no tapar lo que ibas a tocar).
function followCursor() {
  let last = ''
  const dodger = createDodger({
    getWindow,
    getMode,
    workArea: (b) => screen.getDisplayMatching(b).workArea,
    enabled: () => getConfig().esquivarMouse !== false,
    log: logAction
  })
  setInterval(() => {
    const win = getWindow()
    if (!win || win.isDestroyed() || !win.isVisible()) return
    const { x, y } = screen.getCursorScreenPoint()
    dodger.check({ x, y })
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

    // Las respuestas salen sin emojis (aunque la IA los ponga)
    const clean = (r) => (r && typeof r === 'object' ? { ...r, text: noEmoji(r.text), suggestions: r.suggestions?.map(noEmoji) } : r)
    ipcMain.handle('pixie:ask', async (_e, text) => clean(await ask(text)))
    ipcMain.handle('pixie:confirm', async (_e, yes) => clean(await confirm(Boolean(yes))))
    // Lo que dijiste por el micrófono → texto
    ipcMain.handle('pixie:transcribe', async (_e, audio) => {
      const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio ?? [])
      if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return { error: 'El audio quedó vacío o muy largo.' }
      tts?.prepare?.() // mientras te entiende, la voz ya se va cargando para contestarte
      const started = Date.now()
      try {
        const text = await ai.transcribe(bytes, voiceHints())
        const ms = Date.now() - started
        if (ms > 2500) logAction(`voz: tardé ${(ms / 1000).toFixed(1)} s en pasar tu voz a texto`)
        return { text }
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
      escena: mind?.scene() ?? null,
      pomodoro: pomodoroForWindow(),
      timers: timersState(),
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

    journal = createJournal(join(app.getPath('userData'), 'charlas.jsonl'))
    ctx.journal = journal
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
    work = createWork({ memory: mind.memory })
    ctx.work = work
    browser = createBrowserBridge({
      log: logAction,
      // Si una función necesita Chrome y está cerrado, lo abre (si la extensión ya se conectó alguna vez)
      known: () => Boolean(getConfig().extensionNavegador),
      openBrowser: async () => {
        const exe = getConfig().extensionNavegador === 'edge' ? 'msedge' : 'chrome'
        if (await isProcessRunning(exe)) return true
        await launch({ tipo: 'start', valor: exe })
        return false
      },
      onOpening: (wasOpen) =>
        sendEvent({ type: 'notice', text: wasOpen ? 'Un segundo, me conecto con Chrome…' : 'Abro Chrome y enseguida lo hago…', face: 'happy', voice: false }),
      // Apenas se conecta la extensión (abriste Chrome), se fija en tus Pendientes de Classroom
      onConnect: (version, navegador) => {
        if (getConfig().extensionNavegador !== navegador) saveConfig({ extensionNavegador: navegador })
        logAction(`extensión de Chrome ${version}`)
        // Si es más vieja que la que trae Pixie, se recarga sola (desde la 0.16.1 sabe hacerlo; las de antes, a mano)
        if (extensionFiles?.version && olderThan(version, extensionFiles.version)) {
          browser
            ?.request('recargar', {}, 5000)
            .then(() => logAction(`extensión de Chrome: se recargó a la ${extensionFiles.version}`))
            .catch(() => logAction(`extensión de Chrome: hay que recargarla a mano (tiene la ${version}, hay la ${extensionFiles.version})`))
        }
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
    // Las apps instaladas (del menú Inicio): «abrí …» las encuentra y en Ajustes → Apps elegís cuáles usa
    apps = createApps({
      file: join(app.getPath('userData'), 'apps-instaladas.json'),
      getConfig,
      saveConfig,
      listImpl: isWindows ? () => powershell(LIST_SCRIPT, 90000) : null,
      log: logAction
    })
    if (!apps.updated() || Date.now() - apps.updated() > 12 * 60 * 60 * 1000) setTimeout(() => apps.refresh(), 25000)
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
    // El Pomodoro y los timers en la pantallita (tocarla los pausa)
    pomodoro = createPomodoro({ on: onPomodoro })
    setPomodoroProbe(() => pomodoro.enFoco())
    onTimersChange((list) => sendEvent({ type: 'timers', timers: list }))
    studyLog = createStudyLog(join(app.getPath('userData'), 'estudio.json'))
    setInterval(watchFocus, FOCUS_SPY_MS)
    ipcMain.handle('pixie:timer-toggle', (e) => {
      if (!fromPixie(e)) return null
      if (pomodoro.activo()) return pomodoro.toggle()
      return toggleTimer()
    })
    Object.assign(ctx, {
      hands,
      pomodoro,
      studyTopic,
      studyLog,
      missedNotices: () => mind?.missedNotices() ?? [],
      askStudy: ({ minutos, metodo } = {}) => (studyQuestion = { at: Date.now(), minutos, metodo }),
      lastStudySummary: () => {
        const t = lastSummary
        lastSummary = null
        return t
      },
      // Para los avisos de distracciones en un bloque: lo que tenés adelante y si te distrae
      pomodoroFocus: () => focusNow,
      contextText: () => contextForAI(),
      targetWindow,
      withPixieHidden,
      hidePixieFocus,
      locateOnScreen,
      news,
      calendars,
      classroom,
      // ¿La extensión de Chrome conectada es más vieja que la que trae Pixie? (hay que recargarla)
      extensionOld: () => Boolean(browser?.connected() && extensionFiles?.version && olderThan(browser.version(), extensionFiles.version)),
      mail,
      apps,
      // Mapas (OpenStreetMap; los recorridos en colectivo, en Google Maps)
      maps: createMaps({ getConfig, log: logAction }),
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
      // Recordatorios y timers al WhatsApp: siempre, o solo si no estás en la compu (Ajustes → WhatsApp)
      phoneNotify: (text) => {
        const w = whatsappConfig(getConfig())
        if (!w || getConfig().avisosAlCelular === false) return
        if (w.cuando === 'ausente') {
          const snap = mind.snapshot()
          if (!(snap && (snap.bloqueada || snap.inactivoSeg >= 300))) return
        }
        phone
          .send(`Pixie: ${text}`, { auto: true })
          .then((sent) => sent && logAction(`whatsapp: te mandé «${text.slice(0, 60)}»`))
          .catch((err) => logAction(`whatsapp automático: ${err.message}`))
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
      beforeInstall: () => saveState('actualizacion'),
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
      apps,
      pomodoro,
      studyLog,
      work,
      phone,
      journal,
      openExternal: (url) => shell.openExternal(url),
      runPomodoro: runPomodoroButton,
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
    handle('ajustes:apps-buscar', () => settings.searchApps())
    handle('ajustes:pomodoro', (accion) => settings.pomodoroControl(String(accion ?? '')))
    handle('ajustes:pomodoro-consejos', () => settings.pomodoroAdvice())
    handle('ajustes:temario', (req) => settings.syllabus(req && typeof req === 'object' ? req : {}))
    handle('ajustes:estudio-borrar', () => settings.clearStudy())
    handle('ajustes:whatsapp', (req) => settings.whatsapp(req && typeof req === 'object' ? req : {}))
    handle('ajustes:memoria-borrar', (req) => settings.forget(req && typeof req === 'object' ? req : {}))
    handle('ajustes:trabajo-borrar', () => settings.clearWork())
    handle('ajustes:abrir-carpeta-extension', () => extensionFiles?.carpeta && shell.openPath(extensionFiles.carpeta))
    // Chrome no deja abrir chrome://extensions desde otro programa: se copia para pegarlo en la barra
    handle('ajustes:copiar-direccion-extensiones', () => clipboard.writeText('chrome://extensions'))
    // Pixie lee en voz alta un paso de la guía (para quien prefiere escuchar)
    handle('ajustes:decir', (text) => sendEvent({ type: 'prueba-voz', text: String(text ?? '').slice(0, 400) }))
    // Mientras probás la frase en Ajustes, la ventanita no se despierta
    handle('ajustes:palabra-probando', (on) => sendEvent({ type: 'palabra', ...wake.forWindow(), pausada: Boolean(on) }))
    // Si cerrás Ajustes a mitad de «Probar ahora», la ventanita vuelve a escuchar «Pixie, ¿estás?»
    onSettingsClosed(() => wake && sendEvent({ type: 'palabra', ...wake.forWindow(), pausada: false }))
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
      pomodoro: { status: () => pomodoro?.status(), run: (accion) => runPomodoroButton(accion) },
      quit: quitPixie
    })
    mind.start()
    // Si se cerró o se actualizó en el medio de algo, sigue donde estaba (y lo va guardando)
    restoreState()
    setInterval(() => saveState('auto'), 20000).unref?.()
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
    saveState(updates?.status().state === 'ready' ? 'actualizacion' : 'cerrar')
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
