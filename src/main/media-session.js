// La música y los videos que suenan en Windows (Spotify, YouTube en Chrome…), con
// los mismos controles que usan las teclas multimedia. Sirve para pausar lo que
// suena mientras Pixie habla (y seguir después) y para saber qué canción es.
import { spawn } from 'node:child_process'
import { isWindows } from './windows.js'

const SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$paused = @()
while ($true) {
  $cmd = [Console]::In.ReadLine()
  if ($cmd -eq $null) { break }
  try {
    if ($cmd -eq 'pause') {
      $paused = @()
      foreach ($s in $mgr.GetSessions()) {
        if ("$($s.GetPlaybackInfo().PlaybackStatus)" -eq 'Playing') {
          if (Await ($s.TryPauseAsync()) ([bool])) { $paused += $s.SourceAppUserModelId }
        }
      }
      [Console]::Out.WriteLine("ok $($paused.Count)")
    } elseif ($cmd -eq 'resume') {
      foreach ($s in $mgr.GetSessions()) {
        if ($paused -contains $s.SourceAppUserModelId) { Await ($s.TryPlayAsync()) ([bool]) | Out-Null }
      }
      $paused = @()
      [Console]::Out.WriteLine('ok')
    } elseif ($cmd -eq 'info') {
      $s = $mgr.GetCurrentSession()
      if ($s) {
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $o = @{ titulo = $p.Title; artista = $p.Artist; app = $s.SourceAppUserModelId; estado = "$($s.GetPlaybackInfo().PlaybackStatus)" }
        [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
      } else { [Console]::Out.WriteLine('{}') }
    } else { [Console]::Out.WriteLine('error comando') }
  } catch { [Console]::Out.WriteLine("error $($_.Exception.Message)") }
  [Console]::Out.Flush()
}
`

// "Spotify.exe" → Spotify, "Chrome" → el navegador
export function appName(id) {
  const s = String(id ?? '')
  if (/spotify/i.test(s)) return 'Spotify'
  if (/chrome|msedge|edge|firefox|opera|brave/i.test(s)) return 'el navegador'
  return s.replace(/\.exe$/i, '').split(/[\\\\!]/).pop() || 'una app'
}

export function createMediaSession({ getConfig = () => ({}), log = () => {} } = {}) {
  let ps = null
  let restarts = 0
  let buffer = ''
  const waiting = []
  let pausedByPixie = false
  let resumeTimer = null

  function start() {
    if (ps || !isWindows || restarts > 3) return Boolean(ps)
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true })
    ps.stdout.setEncoding('utf8')
    ps.stdout.on('data', (chunk) => {
      buffer += chunk
      let i
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim()
        buffer = buffer.slice(i + 1)
        waiting.shift()?.(line)
      }
    })
    ps.on('error', () => {})
    ps.on('exit', () => {
      ps = null
      restarts++
      while (waiting.length) waiting.shift()('error se cerró')
    })
    return true
  }

  function send(cmd, timeoutMs = 5000) {
    if (!start()) return Promise.resolve('error no disponible')
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('error tardó'), timeoutMs)
      waiting.push((line) => {
        clearTimeout(timer)
        resolve(line)
      })
      ps.stdin.write(`${cmd}\n`)
    })
  }

  return {
    // Qué está sonando: { titulo, artista, app, estado } o null
    async info() {
      const line = await send('info')
      if (line.startsWith('error')) return null
      try {
        const o = JSON.parse(line)
        return o.titulo ? o : null
      } catch {
        return null
      }
    },
    // Mientras Pixie habla, lo que suena se pausa; después sigue
    speaking(on) {
      if (!isWindows || getConfig().pausarMusicaAlHablar === false) return
      clearTimeout(resumeTimer)
      if (on && !pausedByPixie) {
        pausedByPixie = true
        send('pause').then((r) => r.startsWith('error') && log(`pausar música: ${r}`))
      } else if (!on && pausedByPixie) {
        resumeTimer = setTimeout(() => {
          pausedByPixie = false
          send('resume')
        }, 600)
      }
    },
    stop() {
      restarts = 99
      ps?.kill()
    }
  }
}
