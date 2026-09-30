import { app, ipcMain, globalShortcut, Notification } from 'electron'
import { interpret, isYes, isNo } from './brain.js'
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

  const intent = interpret(input)
  if (!intent) {
    return {
      text: 'No entendí. Probá con otra forma o pedime ayuda.',
      face: 'confused',
      suggestions: ['¿qué podés hacer?', 'abrí YouTube', 'timer de 5 minutos']
    }
  }

  const action = actions[intent.action]
  if (action?.confirm) {
    pending = intent
    return { text: action.confirmText(intent.params, ctx), face: 'idle', confirm: true }
  }
  return runAction(intent.action, intent.params, ctx)
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
