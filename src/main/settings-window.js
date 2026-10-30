// La ventana de Ajustes (y la bienvenida): una ventana normal, con su marco, aparte de la cara.
import { BrowserWindow } from 'electron'
import { join } from 'node:path'

let win = null

export function getSettingsWindow() {
  return win && !win.isDestroyed() ? win : null
}

// view: 'ajustes' | 'bienvenida' (y una sección: 'ajustes/ia')
export function openSettingsWindow(view = 'ajustes') {
  const open = getSettingsWindow()
  if (open) {
    open.webContents.send('ajustes:vista', view)
    if (open.isMinimized()) open.restore()
    open.show()
    open.focus()
    return open
  }
  win = new BrowserWindow({
    width: 880,
    height: 660,
    minWidth: 720,
    minHeight: 540,
    title: view === 'bienvenida' ? '¡Hola! Soy Pixie' : 'Ajustes de Pixie',
    backgroundColor: '#0a0f17',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${view}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: view })
  return win
}
