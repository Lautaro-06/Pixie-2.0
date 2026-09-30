import { app, ipcMain, globalShortcut, Notification, screen } from 'electron'
import { interpretAll, suggest, isYes, isNo } from './brain.js'
import { actions, runAction } from './actions/index.js'
import { loadConfig, getConfig, saveConfig, logAction } from './config.js'
import { createPixieWindow, getWindow, setMode, showAndFocus, sendEvent } from './window.js'
import { createTray } from './tray.js'

const FALLBACK_SHORTCUTS = ['Control+Shift+Space', 'Alt+Shift+P']
let activeShortcut = null
let pending = null // acción esperando que la persona confirme

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

function mergeResults(results) {
  if (results.length === 1) return results[0]
  const last = results[results.length - 1]
  const face = [...results].reverse().find((r) => r.face && r.face !== 'idle')?.face ?? 'idle'
  return {
    text: results.map((r) => r.text).join(' '),
    face,
    confirm: last.confirm,
    suggestions: last.suggestions,
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
    ipcMain.handle('pixie:info', () => ({ shortcut: shortcutLabel(), version: app.getVersion() }))
    ipcMain.on('pixie:mode', (_e, mode) => setMode(mode))
    ipcMain.on('pixie:hide', () => getWindow()?.hide())

    createPixieWindow()
    registerShortcut()
    followCursor()
    createTray({ onTalk: openBar, shortcutLabel })
  })

  // Pixie no navega a otras páginas ni abre ventanas nuevas.
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => event.preventDefault())
  })

  // Vive en la barra de tareas: cerrar la ventana no cierra la app.
  app.on('window-all-closed', () => {})
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
