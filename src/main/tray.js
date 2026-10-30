import { Tray, Menu, nativeImage, app, shell } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { getWindow } from './window.js'
import { configPath } from './config.js'

let tray = null

export function createTray({ onTalk, shortcutLabel, updates, checkUpdates, copyDiagnostics }) {
  // En la app instalada, los íconos quedan fuera del paquete (app.asar.unpacked).
  tray = new Tray(nativeImage.createFromPath(trayIcon.replace('app.asar', 'app.asar.unpacked')))
  tray.setToolTip('Pixie')

  // Lo que dice el renglón de las actualizaciones según cómo vayan
  const updateItem = () => {
    const s = updates?.status()
    if (s?.state === 'ready') return { label: `Actualizar a la versión ${s.available} y reiniciar`, click: () => updates.install() }
    if (s?.state === 'downloading') return { label: `Bajando la versión ${s.available} (${s.progress} %)…`, enabled: false }
    if (s?.state === 'dev') return { label: 'Actualizaciones: solo en la app instalada', enabled: false }
    return { label: 'Buscar actualizaciones', click: () => checkUpdates?.() }
  }

  const build = () =>
    Menu.buildFromTemplate([
      { label: `Hablar con Pixie (${shortcutLabel()})`, click: onTalk },
      {
        label: 'Mostrar u ocultar',
        click: () => {
          const win = getWindow()
          if (win?.isVisible()) win.hide()
          else win?.showInactive()
        }
      },
      { type: 'separator' },
      updateItem(),
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
      },
      { label: 'Abrir config.json', click: () => shell.openPath(configPath()) },
      { type: 'separator' },
      { label: 'Copiar informe de diagnóstico', click: () => copyDiagnostics?.() },
      { label: 'Abrir la carpeta de Pixie', click: () => shell.openPath(app.getPath('userData')) },
      { label: `Pixie ${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() }
    ])

  tray.setContextMenu(build())
  tray.on('click', onTalk)
  return { tray, refresh: () => tray?.setContextMenu(build()) }
}
