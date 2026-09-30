import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

// Tamaños de la ventana: solo la cara, o la cara con la barra para escribir.
const SIZES = {
  compact: { width: 210, height: 164 },
  expanded: { width: 420, height: 400 }
}
const MARGIN = 16

let win = null
let mode = 'compact'

export function getWindow() {
  return win
}

export function createPixieWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const size = SIZES.compact
  win = new BrowserWindow({
    ...size,
    x: workArea.x + workArea.width - size.width - MARGIN,
    y: workArea.y + workArea.height - size.height - MARGIN,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    title: 'Pixie',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.setAlwaysOnTop(true, 'floating')
  win.once('ready-to-show', () => win.showInactive())

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

// Cambia de tamaño manteniendo fija la esquina de abajo a la derecha.
export function setMode(next) {
  if (!win || !SIZES[next] || next === mode) return
  mode = next
  const b = win.getBounds()
  const size = SIZES[next]
  const { workArea } = screen.getDisplayMatching(b)
  let x = b.x + b.width - size.width
  let y = b.y + b.height - size.height
  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - size.width)
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - size.height)
  win.setResizable(true)
  win.setBounds({ x, y, ...size })
  win.setResizable(false)
}

export function showAndFocus() {
  if (!win) return
  if (!win.isVisible()) win.show()
  win.focus()
}

export function sendEvent(event) {
  if (win && !win.isDestroyed()) win.webContents.send('pixie:event', event)
}
