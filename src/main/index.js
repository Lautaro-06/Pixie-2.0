import { app, ipcMain, globalShortcut, Notification, screen } from 'electron'
import { interpretAll, suggest, isYes, isNo, restoreAccents } from './brain.js'
import { actions, runAction } from './actions/index.js'
import { loadConfig, getConfig, saveConfig, logAction } from './config.js'
import { createPixieWindow, getWindow, setMode, showAndFocus, sendEvent } from './window.js'
import { createTray } from './tray.js'
import { createMind } from './mind.js'
import { createAI, aiErrorText } from './ai.js'
import { createBrowserBridge } from './browser.js'

const FALLBACK_SHORTCUTS = ['Control+Shift+Space', 'Alt+Shift+P']
let activeShortcut = null
let pending = null // acción esperando que la persona confirme
let mind = null
let ai = null
let browser = null

// Lo que conviene mandarle a la IA aunque las reglas lo entiendan: charla y preguntas
const AI_PREFERRED = new Set(['saludo', 'charla', 'gracias', 'ayuda', 'consultar_memoria'])

function shortcutLabel() {
  if (!activeShortcut) return 'el ícono de la barra de tareas'
  return activeShortcut.replace('Control', 'Ctrl').replace('Space', 'Espacio')
}

// Lo que las acciones pueden usar de la app.
const ctx = {
  getConfig,
  saveConfig,
  shortcutLabel,
  log: logAction,
  emit: sendEvent,
  hideWindow: () => getWindow()?.hide(),
  notify: (title, body) => {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  }
}

function openBar() {
  showAndFocus()
  sendEvent({ type: 'open' })
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
    for (const key of ['texto', 'nombre']) if (it.params[key]) it.params[key] = restoreAccents(input, it.params[key])
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
    loadConfig()

    ipcMain.handle('pixie:ask', (_e, text) => ask(text))
    ipcMain.handle('pixie:confirm', (_e, yes) => confirm(Boolean(yes)))
    ipcMain.handle('pixie:info', () => ({
      shortcut: shortcutLabel(),
      version: app.getVersion(),
      feeling: mind?.feeling(),
      ai: Boolean(ai?.enabled())
    }))
    ipcMain.on('pixie:mode', (_e, mode) => setMode(mode))
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
    Object.assign(ctx, {
      ai,
      browser,
      readPage: (que) => browser.request('leer', { que }),
      setPending: (intent) => {
        pending = intent
      },
      memory: mind.memory,
      awareness: mind.snapshot,
      setQuiet: mind.setQuiet,
      feeling: mind.feeling,
      howAreYou: mind.howAreYou
    })

    createPixieWindow()
    registerShortcut()
    followCursor()
    createTray({ onTalk: openBar, shortcutLabel })
    mind.start()
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
    browser?.close()
  })
}
