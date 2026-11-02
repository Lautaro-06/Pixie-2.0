// Las apps instaladas en la compu y qué puede hacer Pixie con cada una:
//   abrir → «abrí Minecraft» (aunque no esté en su lista de siempre)
//   usar  → escribir, tocar botones, apretar atajos o cerrarla
// La lista sale del menú Inicio (lo mismo que ves en «Todas las apps»). Los permisos se eligen en
// Ajustes → Apps; lo que no tocaste está permitido.
import { readFileSync, writeFileSync } from 'node:fs'

// Lista el menú Inicio: el nombre y el AppID de cada app (Get-StartApps), y a qué programa apunta cada
// acceso directo (para saber qué ventana es de qué app)
export const LIST_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = @()
$sh = New-Object -ComObject WScript.Shell
$links = @{}
foreach ($dir in @("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs")) {
  Get-ChildItem $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try { $t = $sh.CreateShortcut($_.FullName).TargetPath; if ($t) { $links[$_.BaseName] = $t } } catch {}
  }
}
foreach ($a in (Get-StartApps)) {
  $out += @{ nombre = $a.Name; id = $a.AppID; destino = $links[$a.Name] }
}
$out | ConvertTo-Json -Compress
`

const SKIP = /\b(uninstall|desinstalar|desinstalaci[oó]n|readme|l[eé]ame|help|ayuda|manual|documentation|documentaci[oó]n|license|licencia|release notes|website|sitio web|reparar|repair|feedback hub|support)\b/i
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const exeOf = (path) => (/([^\\/]+)\.exe$/i.exec(String(path ?? ''))?.[1] ?? '').toLowerCase()

// "Adobe Photoshop 2024" → ["adobe photoshop 2024", "adobe photoshop", "photoshop"]
export function aliasesFor(nombre) {
  const full = fold(nombre)
  const out = new Set([full])
  const noVersion = full.replace(/\b(v?\d+([.,]\d+)*|\(x64\)|\(x86\)|x64|x86|64-bit|32-bit)\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (noVersion) out.add(noVersion)
  const noVendor = noVersion.replace(/^(microsoft|adobe|google|mozilla|apple|autodesk|jetbrains|epic games|ea|ubisoft)\s+/, '')
  if (noVendor && noVendor.length > 2) out.add(noVendor)
  return [...out]
}

// Lo que devuelve el script → [{ id, nombre, proceso }] sin desinstaladores ni repetidos, por nombre
export function parseInstalled(raw) {
  let list
  try {
    list = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return []
  }
  if (!Array.isArray(list)) list = list ? [list] : []
  const seen = new Set()
  const apps = []
  for (const a of list) {
    const nombre = String(a?.nombre ?? '').trim()
    const id = String(a?.id ?? '').trim()
    if (!nombre || !id || SKIP.test(nombre) || /^https?:/i.test(id)) continue
    const key = fold(nombre)
    if (seen.has(key)) continue
    seen.add(key)
    // AppID de un programa común: la ruta del .exe (o una carpeta conocida + la ruta)
    const proceso = exeOf(a.destino) || exeOf(id) || null
    apps.push({ id, nombre: nombre.slice(0, 80), proceso })
  }
  return apps.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
}

export function createApps({ file, getConfig, saveConfig, listImpl = null, log = () => {}, now = () => Date.now() }) {
  let apps = []
  let updated = null
  let searching = null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    apps = Array.isArray(data.apps) ? data.apps : []
    updated = data.actualizado ?? null
  } catch {
    // todavía no buscó las apps
  }

  const perms = () => getConfig().appsPermisos ?? {}
  const permission = (app, kind) => perms()[app.id]?.[kind] !== false

  // Busca las apps instaladas (en Windows); tarda unos segundos
  function refresh() {
    if (!listImpl) return Promise.resolve(apps)
    searching ??= (async () => {
      try {
        const found = parseInstalled(await listImpl())
        if (found.length) {
          apps = found
          updated = now()
          writeFileSync(file, JSON.stringify({ version: 1, actualizado: updated, apps }))
          log(`apps: encontré ${apps.length} apps instaladas`)
        }
      } catch (err) {
        log(`apps: no pude listarlas (${err.message})`)
      } finally {
        searching = null
      }
      return apps
    })()
    return searching
  }

  // Qué app instalada es esta ventana (por el programa o por el nombre)
  function appForWindow(win) {
    const proceso = String(win?.proceso ?? '').toLowerCase().replace(/\.exe$/, '')
    if (proceso) {
      const byExe = apps.find((a) => a.proceso && a.proceso === proceso)
      if (byExe) return byExe
    }
    const titulo = fold(win?.titulo)
    const name = fold(win?.nombre)
    return (
      apps.find((a) => name && aliasesFor(a.nombre).includes(name)) ??
      apps.find((a) => proceso.length > 3 && aliasesFor(a.nombre).some((al) => al.replace(/\s+/g, '') === proceso)) ??
      apps.find((a) => titulo && aliasesFor(a.nombre).some((al) => al.length > 4 && titulo.endsWith(al))) ??
      null
    )
  }

  return {
    refresh,
    searching: () => Boolean(searching),
    list: () => apps.map((a) => ({ ...a, abrir: permission(a, 'abrir'), usar: permission(a, 'usar') })),
    updated: () => updated,
    // Para «abrí …»: las apps instaladas como las del catálogo (se abren por su AppID)
    catalog: () =>
      apps.map((a) => ({
        nombre: a.nombre,
        alias: aliasesFor(a.nombre),
        abrir: { tipo: 'start', valor: `shell:AppsFolder\\${a.id}` },
        proceso: a.proceso ? `${a.proceso}.exe` : undefined,
        instalada: a.id
      })),
    // ¿Puede abrirla / usarla? win: { proceso, titulo, nombre }. Si no la conoce, sí.
    can(kind, win) {
      const a = appForWindow(win)
      return a ? permission(a, kind) : true
    },
    appForWindow,
    set(id, patch) {
      const cur = perms()
      const next = { ...cur[id] }
      if ('abrir' in patch) next.abrir = Boolean(patch.abrir)
      if ('usar' in patch) next.usar = Boolean(patch.usar)
      saveConfig({ appsPermisos: { ...cur, [id]: next } })
    },
    setAll(on) {
      saveConfig({ appsPermisos: on ? {} : Object.fromEntries(apps.map((a) => [a.id, { abrir: false, usar: false }])) })
    }
  }
}
