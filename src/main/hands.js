// Las manos de Pixie en Windows: escribir, apretar teclas, hacer clic, usar la rueda del mouse,
// traer una ventana al frente y encontrar los botones de una ventana por su nombre (con la
// accesibilidad de Windows, UI Automation). Es un PowerShell que queda abierto y recibe pedidos en
// JSON, uno por renglón, así cada orden tarda poco. Solo hace lo que le piden las acciones de Pixie.
import { spawn } from 'node:child_process'
import { isWindows, OnlyWindowsError, FriendlyError } from './windows.js'

// C# 5 (el que compila el PowerShell de Windows): nada de $"..." ni ?.
const CSHARP = `
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class PixieHands {
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public InputUnion U; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);

  const uint KEYUP = 0x2, UNICODE = 0x4, EXTENDED = 0x1;

  // Coordenadas en píxeles reales en todas las pantallas (las mismas que da la accesibilidad)
  public static void DpiAware() {
    try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch {}
    try { SetProcessDPIAware(); } catch {}
  }

  static INPUT KeyInput(ushort vk, ushort scan, uint flags) {
    INPUT i = new INPUT();
    i.type = 1;
    i.U.ki.wVk = vk;
    i.U.ki.wScan = scan;
    i.U.ki.dwFlags = flags;
    return i;
  }

  static bool IsExtended(ushort vk) {
    return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C || vk == 0x6F || vk == 0x90;
  }

  static void Send(INPUT[] inputs) {
    SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
  }

  // Aprieta varias teclas juntas (Ctrl+S) y las suelta al revés
  public static void Combo(int[] vks) {
    for (int k = 0; k < vks.Length; k++) {
      ushort vk = (ushort)vks[k];
      Send(new INPUT[] { KeyInput(vk, 0, IsExtended(vk) ? EXTENDED : 0) });
      Thread.Sleep(25);
    }
    for (int k = vks.Length - 1; k >= 0; k--) {
      ushort vk = (ushort)vks[k];
      Send(new INPUT[] { KeyInput(vk, 0, KEYUP | (IsExtended(vk) ? EXTENDED : 0)) });
      Thread.Sleep(15);
    }
  }

  // Escribe texto tal cual (tildes, ñ, emojis), letra por letra
  public static void Type(string text) {
    foreach (char c in text) {
      if (c == '\\r') continue;
      if (c == '\\n') { Combo(new int[] { 0x0D }); continue; }
      if (c == '\\t') { Combo(new int[] { 0x09 }); continue; }
      Send(new INPUT[] { KeyInput(0, c, UNICODE), KeyInput(0, c, UNICODE | KEYUP) });
      Thread.Sleep(4);
    }
  }

  static INPUT MouseInput(uint flags, uint data) {
    INPUT i = new INPUT();
    i.type = 0;
    i.U.mi.dwFlags = flags;
    i.U.mi.mouseData = data;
    return i;
  }

  public static void Click(int x, int y, bool right, bool twice) {
    SetCursorPos(x, y);
    Thread.Sleep(60);
    uint down = right ? 0x8u : 0x2u, up = right ? 0x10u : 0x4u;
    int times = twice ? 2 : 1;
    for (int k = 0; k < times; k++) {
      Send(new INPUT[] { MouseInput(down, 0), MouseInput(up, 0) });
      Thread.Sleep(60);
    }
  }

  // Rueda del mouse: positivo sube, negativo baja (en "muescas")
  public static void Wheel(int notches) {
    Send(new INPUT[] { MouseInput(0x0800, unchecked((uint)(notches * 120))) });
  }

  public static bool Focus(IntPtr h) {
    if (!IsWindow(h)) return false;
    if (IsIconic(h)) ShowWindow(h, 9);
    IntPtr fg = GetForegroundWindow();
    uint pid;
    uint fgThread = GetWindowThreadProcessId(fg, out pid);
    uint me = GetCurrentThreadId();
    // Windows no deja que un programa de fondo cambie la ventana del frente: apretar Alt lo habilita
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    AttachThreadInput(me, fgThread, true);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    AttachThreadInput(me, fgThread, false);
    Thread.Sleep(120);
    return GetForegroundWindow() == h;
  }

  public static void State(IntPtr h, int cmd) { ShowWindow(h, cmd); }

  public static string Title(IntPtr h) {
    StringBuilder s = new StringBuilder(512);
    GetWindowText(h, s, 512);
    return s.ToString();
  }

  public static uint Pid(IntPtr h) {
    uint pid;
    GetWindowThreadProcessId(h, out pid);
    return pid;
  }
}
`

const SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
${CSHARP}
"@
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
[PixieHands]::DpiAware()
$AE = [System.Windows.Automation.AutomationElement]
$script:cache = @()

function Window-Info($h) {
  $r = New-Object PixieHands+RECT
  [void][PixieHands]::GetWindowRect($h, [ref]$r)
  $name = ''
  try { $name = (Get-Process -Id ([PixieHands]::Pid($h))).ProcessName } catch {}
  return @{ hwnd = $h.ToInt64(); titulo = [PixieHands]::Title($h); proceso = $name; x = $r.Left; y = $r.Top; ancho = $r.Right - $r.Left; alto = $r.Bottom - $r.Top }
}

# Los elementos con nombre de la ventana (botones, menús, pestañas, links, campos), recorriendo como
# mucho 4 segundos o 1500 elementos, para no trabar a Pixie con páginas enormes
function Get-Elements($h) {
  $root = $AE::FromHandle([IntPtr]$h)
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $stack = New-Object System.Collections.Stack
  $stack.Push($root)
  $script:cache = @()
  $out = New-Object System.Collections.ArrayList
  $seen = 0
  while ($stack.Count -gt 0 -and $seen -lt 1500 -and $watch.ElapsedMilliseconds -lt 4000) {
    $e = $stack.Pop()
    $seen++
    try {
      $c = $e.Current
      $r = $c.BoundingRectangle
      if ($c.Name -and -not $c.IsOffscreen -and -not $r.IsEmpty -and $r.Width -ge 2 -and $r.Height -ge 2 -and $e -ne $root) {
        $script:cache += $e
        [void]$out.Add(@{ id = $script:cache.Count - 1; nombre = $c.Name; tipo = ($c.ControlType.ProgrammaticName -replace 'ControlType\\.', ''); x = [int]($r.X + $r.Width / 2); y = [int]($r.Y + $r.Height / 2); habilitado = $c.IsEnabled })
      }
      $kids = New-Object System.Collections.ArrayList
      $k = $walker.GetFirstChild($e)
      while ($k -ne $null -and $kids.Count -lt 400) { [void]$kids.Add($k); $k = $walker.GetNextSibling($k) }
      for ($j = $kids.Count - 1; $j -ge 0; $j--) { $stack.Push($kids[$j]) }
    } catch {}
  }
  return @{ elementos = $out; completo = ($stack.Count -eq 0) }
}

# Activa un elemento de la última búsqueda: si se ve en pantalla, un clic de verdad (no se traba con
# ventanas que se abren); si no, con la accesibilidad
function Use-Element($id, $click) {
  $e = $script:cache[$id]
  if (-not $e) { throw 'Ese elemento ya no está.' }
  $r = $e.Current.BoundingRectangle
  if ($click -and -not $r.IsEmpty) { [PixieHands]::Click([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2), $false, $false); return 'clic' }
  $p = $null
  if ($e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); return 'invoke' }
  if ($e.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $p.Select(); return 'select' }
  if ($e.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle(); return 'toggle' }
  if ($e.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $p.Expand(); return 'expand' }
  $e.SetFocus()
  return 'foco'
}

function Focused-Is-Password {
  try { return $AE::FocusedElement.Current.IsPassword } catch { return $false }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $req = $null
  try {
    $req = $line | ConvertFrom-Json
    $a = $req.args
    $res = $null
    switch ($req.cmd) {
      'ventana' { $res = Window-Info ([PixieHands]::GetForegroundWindow()) }
      'enfocar' { $ok = [PixieHands]::Focus([IntPtr][int64]$a.hwnd); $res = @{ ok = $ok } }
      'estado' { [PixieHands]::State([IntPtr][int64]$a.hwnd, [int]$a.modo); $res = @{ ok = $true } }
      'escribir' {
        if (Focused-Is-Password) { throw 'password' }
        [PixieHands]::Type([string]$a.texto); $res = @{ ok = $true }
      }
      'teclas' { [PixieHands]::Combo([int[]]@($a.teclas)); $res = @{ ok = $true } }
      'clic' { [PixieHands]::Click([int]$a.x, [int]$a.y, [bool]$a.derecho, [bool]$a.doble); $res = @{ ok = $true } }
      'rueda' { [PixieHands]::Wheel([int]$a.muescas); $res = @{ ok = $true } }
      'elementos' { $res = Get-Elements ([IntPtr][int64]$a.hwnd) }
      'usar' { $res = @{ como = (Use-Element ([int]$a.id) ([bool]$a.clic)) } }
      'ventanas' {
        $res = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { @{ hwnd = $_.MainWindowHandle.ToInt64(); proceso = $_.ProcessName; titulo = $_.MainWindowTitle } })
      }
      default { throw "Pedido desconocido: $($req.cmd)" }
    }
    [Console]::Out.WriteLine((@{ id = $req.id; ok = $true; result = $res } | ConvertTo-Json -Compress -Depth 6))
  } catch {
    $id = 0
    if ($req) { $id = $req.id }
    [Console]::Out.WriteLine((@{ id = $id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress))
  }
  [Console]::Out.Flush()
}
`

// Todo lo que va al PowerShell viaja en ASCII (las tildes como \\u00e1), así no importa la codificación
export function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export class PasswordFieldError extends FriendlyError {
  constructor() {
    super('Eso es un campo de contraseña: ahí no escribo. Las contraseñas ponelas vos.')
  }
}

export function createHands({ log = () => {}, spawnImpl = spawn, platformOk = isWindows } = {}) {
  let child = null
  let buffer = ''
  let nextId = 1
  const waiting = new Map()

  function start() {
    if (!platformOk) throw new OnlyWindowsError()
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    child = spawnImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      let i
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim()
        buffer = buffer.slice(i + 1)
        if (line) receive(line)
      }
    })
    child.stderr?.on('data', (d) => log(`manos: ${String(d).slice(0, 200)}`))
    child.on('error', (err) => log(`manos: ${err.message}`))
    child.on('exit', () => {
      child = null
      for (const [, w] of waiting) w.reject(new FriendlyError('Se me trabaron las manos. Probá de nuevo.'))
      waiting.clear()
    })
  }

  function receive(line) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    const w = waiting.get(msg.id)
    if (!w) return
    waiting.delete(msg.id)
    clearTimeout(w.timer)
    if (msg.ok) w.resolve(msg.result)
    else if (msg.error === 'password') w.reject(new PasswordFieldError())
    else w.reject(new FriendlyError(`No pude hacerlo: ${msg.error}`))
  }

  // La primera vez arranca el PowerShell (tarda un par de segundos en preparar todo)
  function request(cmd, args = {}, timeoutMs = 8000) {
    if (!child) start()
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id)
        reject(new FriendlyError('Windows tardó demasiado en responder. Probá de nuevo.'))
      }, timeoutMs + (nextId === 2 ? 8000 : 0))
      waiting.set(id, { resolve, reject, timer })
      child.stdin.write(`${asciiJson({ id, cmd, args })}\n`)
    })
  }

  return {
    request,
    available: () => platformOk,
    stop() {
      child?.stdin.end()
      child?.kill()
      child = null
    }
  }
}

export { SCRIPT as HANDS_SCRIPT, CSHARP as HANDS_CSHARP }
