import { app, ipcMain, globalShortcut, Notification, screen, desktopCapturer, clipboard, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import { release } from 'node:os'
import { autoUpdater } from 'electron-updater'
import { interpretAll, suggest, isYes, isNo, restoreAccents } from './brain.js'
import { actions, runAction } from './actions/index.js'
import { loadConfig, getConfig, saveConfig, logAction, watchConfig, setCipher } from './config.js'
import { createPixieWindow, getWindow, setMode, showAndFocus, sendEvent } from './window.js'
import { createTray } from './tray.js'
import { createMind } from './mind.js'
import { createAI, aiErrorText, describeAI } from './ai.js'
import { createBrowserBridge } from './browser.js'
import { createBackup } from './backup.js'
import { createPhone } from './phone.js'
import { FriendlyError, isWindows } from './windows.js'
import { createVoices } from './voices.js'
import { createMediaSession } from './media-session.js'
import { createUpdater } from './updates.js'
import { createDiagnostics } from './diagnostics.js'
import { shortcutText } from './shortcut.js'
import { createSettings, AI_STUDIO_URL } from './settings.js'
import { openSettingsWindow, getSettingsWindow } from './settings-window.js'
import { currentConditions } from './actions/weather.js'

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
  notify: (title, body) => {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  }
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
    `Atajo: ${shortcutLabel()}${getConfig().atajo && getConfig().atajo !== activeShortcut ? ` (pidió ${shortcutText(getConfig().atajo)}, ocupado)` : ''}`,
    `WhatsApp: ${phone?.configured() ? 'configurado' : 'sin configurar'}`,
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
async function captureScreen() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const width = Math.min(1600, Math.round(display.size.width * display.scaleFactor))
  const height = Math.round((width * display.size.height) / display.size.width)
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new FriendlyError('No pude sacarle una foto a la pantalla.')
  return source.thumbnail.toJPEG(75).toString('base64')
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

  // Con IA: charla, preguntas, frases largas y lo que las reglas no entienden.
  // Las órdenes cortas siguen por las reglas, que son instantáneas y gratis.
  const words = input.trim().split(/\s+/).length
  const social = intents?.every((i) => AI_PREFERRED.has(i.action) || i.knowledge)
  if (ai?.enabled() && (!intents || social || words > 10)) {
    try {
      return await ai.chat(input, mind.contextText())
    } catch (err) {
      const line = `IA (${ai.provider()}): ${err.status ? `${err.status} ` : ''}${err.message}`
      console.error(line)
      logAction(line)
      diagnostics.record('ia', { message: line, stack: err.stack })
      const msg = aiErrorText(err)
      if (msg) return { text: msg, face: 'confused' }
    }
  }

  // ¿Es la respuesta a algo que Pixie preguntó por su cuenta? ("Hoy tenías prueba. ¿Cómo te fue?")
  const answer = mind?.answerQuestion(input)
  if (answer) return answer

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
    for (const key of ['texto', 'nombre', 'pregunta']) if (it.params[key]) it.params[key] = restoreAccents(input, it.params[key])
    const action = actions[it.action]
    if (action?.confirm) {
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
    setCipher({
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
      decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64'))
    })
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
      try {
        return { text: await ai.transcribe(bytes) }
      } catch (err) {
        logAction(`voz: ${err.status ? `${err.status} ` : ''}${err.message}`)
        diagnostics.record('micrófono', err)
        return { error: aiErrorText(err) ?? 'No me pude conectar para entenderte. ¿Hay internet?' }
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
      pantallaReposo: getConfig().pantallaReposo ?? 'cara',
      clima: weatherNow ? { temp: weatherNow.temp, icon: weatherNow.icon } : null
    }))
    ipcMain.on('pixie:mode', (_e, mode) => setMode(mode))
    // Errores de la ventana (la cara y la barra)
    ipcMain.on('pixie:error', (_e, info) => {
      diagnostics.record('ventana', { message: String(info?.message ?? info).slice(0, 500), stack: String(info?.stack ?? '').slice(0, 2000) })
    })
    ipcMain.on('pixie:hide', () => getWindow()?.hide())
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
    browser = createBrowserBridge({ log: logAction })
    ai = createAI({ getConfig, ctx })
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
    Object.assign(ctx, {
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
      onStandby: (mode) => syncStandby(mode),
      errorCount: () => diagnostics.list().length,
      readClipboard: () => clipboard.readText(),
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
      return r
    })
    handle('ajustes:clave-portapapeles', () => settings.clipboardKey())
    handle('ajustes:borrar-clave', () => settings.forgetKey())
    handle('ajustes:abrir-ai-studio', () => shell.openExternal(AI_STUDIO_URL))
    handle('ajustes:buscar-version', async () => {
      await updates.check()
      return settings.snapshot()
    })
    handle('ajustes:instalar-version', () => updates.install())
    handle('ajustes:copiar-informe', () => ctx.copyDiagnostics())
    handle('ajustes:abrir-carpeta', () => shell.openPath(app.getPath('userData')))
    handle('ajustes:probar-voz', () => sendEvent({ type: 'prueba-voz', text: '¡Hola! Así sueno. ¿Te gusta mi voz?' }))
    handle('ajustes:bienvenida-lista', () => {
      settings.finishWelcome()
      getSettingsWindow()?.close()
      const nombre = mind.memory.getName()
      mind.say({
        kind: 'bienvenida',
        text: `¡Listo${nombre ? `, ${nombre}` : ''}! Ya estoy. Llamame con ${shortcutLabel()} o tocándome, y pedime lo que quieras.`,
        face: 'love'
      })
    })

    // La primera vez que se abre la app instalada, queda arrancando con Windows (se apaga desde el ícono)
    if (app.isPackaged && isWindows && !getConfig().arranqueConfigurado) {
      app.setLoginItemSettings({ openAtLogin: true })
      saveConfig({ arranqueConfigurado: true })
    }

    createPixieWindow({
      onProblem: (what) => {
        logAction(`ventana: ${what}`)
        diagnostics.record('ventana', what)
      }
    })
    registerShortcut()
    registerVoiceShortcut()
    followCursor()
    trayMenu = createTray({
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
      openSettings: () => openSettingsWindow('ajustes')
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
    backup?.backup()
    browser?.close()
  })
}
