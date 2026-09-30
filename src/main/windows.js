// Ayudantes para hablar con Windows. Nunca reciben texto de la persona:
// solo valores que vienen del catálogo, de la configuración o números validados.
import { execFile } from 'node:child_process'
import { shell } from 'electron'

export const isWindows = process.platform === 'win32'

export class OnlyWindowsError extends Error {
  constructor() {
    super('Esta acción por ahora solo funciona en Windows.')
  }
}

export function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 15000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

export function powershell(script) {
  if (!isWindows) throw new OnlyWindowsError()
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script])
}

// Teclas virtuales de Windows para volumen y multimedia.
export const KEYS = {
  volumeUp: 175,
  volumeDown: 174,
  mute: 173,
  next: 176,
  previous: 177,
  playPause: 179
}

export function pressKey(code, times = 1) {
  if (!Object.values(KEYS).includes(code)) throw new Error('Tecla no permitida')
  const n = Math.max(1, Math.min(50, Math.round(times)))
  return powershell(
    `$w = New-Object -ComObject WScript.Shell; for ($i = 0; $i -lt ${n}; $i++) { $w.SendKeys([char]${code}) }`
  )
}

// Abre una app, un sitio o una carpeta.
//   start: nombre que Windows sabe abrir (notepad.exe, chrome, winword)
//   uri:   protocolo de una app (spotify:, ms-settings:) o una dirección web
//   ruta:  archivo o carpeta en el disco
export async function launch(target) {
  if (target.tipo === 'start') {
    if (!isWindows) throw new OnlyWindowsError()
    await run('cmd.exe', ['/d', '/c', 'start', '', target.valor])
  } else if (target.tipo === 'uri') {
    await shell.openExternal(target.valor)
  } else if (target.tipo === 'ruta') {
    const error = await shell.openPath(target.valor)
    if (error) throw new Error(error)
  } else {
    throw new Error(`Tipo desconocido: ${target.tipo}`)
  }
}

export function closeProcess(processName) {
  if (!isWindows) throw new OnlyWindowsError()
  return run('taskkill.exe', ['/IM', processName])
}

export function lockScreen() {
  if (!isWindows) throw new OnlyWindowsError()
  return run('rundll32.exe', ['user32.dll,LockWorkStation'])
}

// Apagar o reiniciar con 30 segundos de margen, o cancelar lo pendiente.
export function shutdown(mode) {
  if (!isWindows) throw new OnlyWindowsError()
  const args = { apagar: ['/s', '/t', '30'], reiniciar: ['/r', '/t', '30'], cancelar: ['/a'] }[mode]
  if (!args) throw new Error('Modo no permitido')
  return run('shutdown.exe', args)
}
