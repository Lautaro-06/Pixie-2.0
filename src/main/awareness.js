// Lo que Pixie "ve" de la compu: qué ventana tenés al frente, si estás en
// pantalla completa, si te fuiste, la batería e internet. Todo queda en la
// compu: no se guarda el título de las ventanas, solo el tipo de actividad.
import { spawn } from 'node:child_process'
import { powerMonitor, net } from 'electron'
import { isWindows } from './windows.js'
import { categorize } from './usage.js'

// Corre de fondo y cada 5 segundos escribe una línea JSON con la ventana activa.
const WINDOW_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class PixieWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
$i = 0
while ($true) {
  try {
    $h = [PixieWin]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 512
    [void][PixieWin]::GetWindowText($h, $sb, 512)
    [uint32]$procId = 0
    [void][PixieWin]::GetWindowThreadProcessId($h, [ref]$procId)
    $name = ''
    try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
    $r = New-Object PixieWin+RECT
    [void][PixieWin]::GetWindowRect($h, [ref]$r)
    $s = [System.Windows.Forms.Screen]::FromHandle($h).Bounds
    $full = ($r.Left -le $s.Left) -and ($r.Top -le $s.Top) -and ($r.Right -ge $s.Right) -and ($r.Bottom -ge $s.Bottom)
    $bat = $null
    if ($i % 12 -eq 0) {
      try {
        $b = Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop | Select-Object -First 1
        if ($b) { $bat = @{ nivel = [int]$b.EstimatedChargeRemaining; cargando = ($b.BatteryStatus -eq 2) } }
      } catch {}
    }
    $o = @{ titulo = $sb.ToString(); proceso = $name; pantallaCompleta = $full; bateria = $bat }
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  } catch {}
  $i++
  Start-Sleep -Seconds 5
}
`

const OWN_PROCESS = /^(pixie|electron)$/i

export function createAwareness() {
  const state = {
    actividad: null, // { categoria, app }
    desde: Date.now(), // desde cuándo está en esa actividad
    pantallaCompleta: false,
    inactivoSeg: 0,
    bloqueada: false,
    online: true,
    bateria: null // { nivel, cargando }
  }
  let watcher = null
  let restarts = 0
  let buffer = ''

  function handle(line) {
    let o
    try {
      o = JSON.parse(line)
    } catch {
      return
    }
    if (o.bateria) state.bateria = { nivel: o.bateria.nivel, cargando: Boolean(o.bateria.cargando) }
    if (OWN_PROCESS.test(o.proceso ?? '')) return // hablarle a Pixie no cambia lo que estabas haciendo
    const act = categorize({ titulo: o.titulo, proceso: o.proceso, pantallaCompleta: o.pantallaCompleta })
    state.pantallaCompleta = Boolean(act) && Boolean(o.pantallaCompleta)
    const before = state.actividad ? `${state.actividad.categoria}|${state.actividad.app}` : ''
    const now = act ? `${act.categoria}|${act.app}` : ''
    if (before !== now) {
      state.actividad = act
      state.desde = Date.now()
    }
  }

  function startWatcher() {
    if (!isWindows) return
    const encoded = Buffer.from(WINDOW_SCRIPT, 'utf16le').toString('base64')
    watcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true
    })
    watcher.stdout.setEncoding('utf8')
    watcher.stdout.on('data', (chunk) => {
      buffer += chunk
      let i
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim()
        buffer = buffer.slice(i + 1)
        if (line) handle(line)
      }
    })
    watcher.on('error', () => {})
    watcher.on('exit', () => {
      watcher = null
      if (restarts++ < 3) setTimeout(startWatcher, 30000)
    })
  }

  function poll() {
    state.inactivoSeg = powerMonitor.getSystemIdleTime()
    state.online = net.isOnline()
  }

  return {
    start() {
      startWatcher()
      poll()
      setInterval(poll, 5000)
      powerMonitor.on('lock-screen', () => { state.bloqueada = true })
      powerMonitor.on('unlock-screen', () => { state.bloqueada = false })
      powerMonitor.on('suspend', () => { state.bloqueada = true })
      powerMonitor.on('resume', () => { state.bloqueada = false })
    },
    stop() {
      restarts = 99
      watcher?.kill()
    },
    snapshot: () => ({ ...state, enActividadSeg: Math.round((Date.now() - state.desde) / 1000) })
  }
}
