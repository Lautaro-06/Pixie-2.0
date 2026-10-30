import { Tray, Menu, nativeImage, app, shell } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { getWindow } from './window.js'
import { configPath } from './config.js'

let tray = null

const STANDBY = [
  ['cara', 'Mi carita'],
  ['reloj', 'La hora'],
  ['resumen', 'Carita, hora y clima']
]

// El mismo menú sale del ícono al lado del reloj y de la ventanita de Pixie (botón ⋯ o clic derecho en la cara).
export function createMenus({
  onTalk,
  shortcutLabel,
  updates,
  checkUpdates,
  copyDiagnostics,
  openSettings,
  getConfig,
  setStandby,
  wake,
  hasAI,
  openHistory,
  quit
}) {
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

  const wakeItem = () => {
    const w = wake?.status()
    if (!w?.grabada) return { label: 'Llamarme con la voz («Pixie, ¿estás?»)…', click: () => openSettings?.('ajustes/voz') }
    return { label: 'Escuchar «Pixie, ¿estás?»', type: 'checkbox', checked: w.activa, click: (item) => wake.setActive(item.checked) }
  }

  const template = (where) => {
    const win = getWindow()
    const standby = getConfig?.().pantallaReposo ?? 'cara'
    return [
      where === 'tray' && { label: `Hablar con Pixie (${shortcutLabel()})`, click: onTalk },
      where === 'tray'
        ? { label: 'Mostrar u ocultar', click: () => (win?.isVisible() ? win.hide() : win?.showInactive()) }
        : { label: 'Esconderme un rato', click: () => win?.hide() },
      { label: 'Ajustes…', click: () => openSettings?.('ajustes') },
      {
        label: 'En reposo muestro',
        submenu: STANDBY.map(([id, label]) => ({ label, type: 'radio', checked: standby === id, click: () => setStandby?.(id) }))
      },
      wakeItem(),
      !hasAI?.() && { label: 'Activar la IA gratis (te explico paso a paso)…', click: () => openSettings?.('ajustes/ia') },
      { type: 'separator' },
      updateItem(),
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
      },
      {
        label: 'Ayuda',
        submenu: [
          { label: 'Copiar informe de diagnóstico', click: () => copyDiagnostics?.() },
          { label: 'Ver lo que hice (historial)', click: () => openHistory?.() },
          { label: 'Abrir la carpeta de Pixie', click: () => shell.openPath(app.getPath('userData')) },
          { label: 'Abrir config.json', click: () => shell.openPath(configPath()) }
        ]
      },
      { label: `Pixie ${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: 'Cerrar Pixie', click: () => quit?.() }
    ].filter(Boolean)
  }

  const refresh = () => tray?.setContextMenu(Menu.buildFromTemplate(template('tray')))
  refresh()
  tray.on('click', onTalk)

  return {
    tray,
    refresh,
    // Desde la ventanita: aparece donde está el mouse
    popup: () => {
      const win = getWindow()
      if (win && !win.isDestroyed()) Menu.buildFromTemplate(template('window')).popup({ window: win })
    }
  }
}
