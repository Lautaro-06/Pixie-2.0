import { Tray, Menu, nativeImage, app, shell } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { getWindow } from './window.js'
import { configPath } from './config.js'

let tray = null

export function createTray({ onTalk, shortcutLabel }) {
  // En la app instalada, los íconos quedan fuera del paquete (app.asar.unpacked).
  tray = new Tray(nativeImage.createFromPath(trayIcon.replace('app.asar', 'app.asar.unpacked')))
  tray.setToolTip('Pixie')

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
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
      },
      { label: 'Abrir config.json', click: () => shell.openPath(configPath()) },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() }
    ])

  tray.setContextMenu(build())
  tray.on('click', onTalk)
  return tray
}
