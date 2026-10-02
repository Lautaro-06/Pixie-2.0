// Ayudantes para hablar con Windows. Nunca reciben texto de la persona:
// solo valores que vienen del catálogo, de la configuración o números validados.
import { execFile } from 'node:child_process'
import { shell } from 'electron'
import { checkUrl, blockedMessage } from './safety.js'

export const isWindows = process.platform === 'win32'

// Errores con un mensaje pensado para mostrarle a la persona
export class FriendlyError extends Error {}

// Un sitio bloqueado por el filtro de contenido
export class BlockedError extends FriendlyError {
  constructor(categoria) {
    super(blockedMessage(categoria))
    this.categoria = categoria
  }
}

export class OnlyWindowsError extends FriendlyError {
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
    // Última barrera: ninguna página bloqueada se abre, venga de donde venga
    const blocked = /^https?:/i.test(target.valor) ? checkUrl(target.valor) : null
    if (blocked) throw new BlockedError(blocked)
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

// Brillo de la pantalla (0 a 100). Anda en notebooks; los monitores externos casi nunca lo permiten.
export async function getBrightness() {
  let out
  try {
    out = await powershell('(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1).CurrentBrightness')
  } catch (err) {
    if (err instanceof OnlyWindowsError) throw err
    throw new FriendlyError('Tu pantalla no deja cambiar el brillo desde Windows (pasa con los monitores externos).')
  }
  const level = parseInt(out, 10)
  if (Number.isNaN(level)) throw new FriendlyError('Tu pantalla no deja cambiar el brillo desde Windows (pasa con los monitores externos).')
  return level
}

export async function setBrightness(level) {
  const n = Math.max(0, Math.min(100, Math.round(Number(level))))
  if (Number.isNaN(n)) throw new Error('Brillo inválido')
  try {
    await powershell(
      `Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]0; Brightness = [byte]${n} } | Out-Null`
    )
  } catch (err) {
    if (err instanceof OnlyWindowsError) throw err
    throw new FriendlyError('Tu pantalla no deja cambiar el brillo desde Windows (pasa con los monitores externos).')
  }
  return n
}

// Prende o apaga el Bluetooth con la misma API que usa el panel rápido de Windows.
const BLUETOOTH_SCRIPT = (state) => `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Radios.RadioAccessStatus, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null
$radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' } | Select-Object -First 1
if (-not $bt) { 'sin-bluetooth'; exit }
[Windows.Devices.Radios.RadioState, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
$r = Await ($bt.SetStateAsync('${state}')) ([Windows.Devices.Radios.RadioAccessStatus])
"$r"
`

export async function setBluetooth(on) {
  const out = String(await powershell(BLUETOOTH_SCRIPT(on ? 'On' : 'Off'))).trim()
  if (out.includes('sin-bluetooth')) throw new FriendlyError('Esta compu no tiene Bluetooth (o está desactivado en el administrador de dispositivos).')
  if (!/Allowed/i.test(out)) throw new Error(`Bluetooth: ${out}`)
}

// Apagar o reiniciar con 30 segundos de margen, o cancelar lo pendiente.
export function shutdown(mode) {
  if (!isWindows) throw new OnlyWindowsError()
  const args = { apagar: ['/s', '/t', '30'], reiniciar: ['/r', '/t', '30'], cancelar: ['/a'] }[mode]
  if (!args) throw new Error('Modo no permitido')
  return run('shutdown.exe', args)
}
