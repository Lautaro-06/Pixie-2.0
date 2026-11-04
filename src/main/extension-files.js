// La extensión de Chrome viaja adentro de Pixie. Al arrancar, Pixie la copia a su carpeta de datos
// (siempre en el mismo lugar), así en Chrome se instala una sola vez y con cada versión nueva de
// Pixie alcanza con tocar «recargar» en chrome://extensions.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const versionOf = (dir) => {
  try {
    return JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')).version ?? null
  } catch {
    return null
  }
}

export function installExtensionFiles({ from, to }) {
  const bundled = versionOf(from)
  if (!bundled) return { ok: false, carpeta: to }
  const installed = versionOf(to)
  if (installed !== bundled) {
    // Se pisan los archivos en el lugar, sin borrar la carpeta: Chrome la tiene abierta y, en Windows,
    // borrarla y volver a crearla falla (EPERM) hasta que Chrome la suelta
    mkdirSync(to, { recursive: true })
    copyInto(from, to)
    removeStale(from, to)
  }
  return { ok: true, carpeta: to, version: bundled, actualizada: installed !== bundled && installed !== null }
}

function copyInto(from, to) {
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, e.name)
    const dst = join(to, e.name)
    if (e.isDirectory()) {
      mkdirSync(dst, { recursive: true })
      copyInto(src, dst)
    } else copyFileSync(src, dst)
  }
}

// Lo que quedó de una versión vieja y ya no viene (si no se puede borrar, no pasa nada)
function removeStale(from, to) {
  for (const e of readdirSync(to, { withFileTypes: true })) {
    const src = join(from, e.name)
    const dst = join(to, e.name)
    try {
      if (!existsSync(src)) rmSync(dst, { recursive: true, force: true })
      else if (e.isDirectory()) removeStale(src, dst)
    } catch {
      // en uso: queda
    }
  }
}

// "0.9.1" < "0.10.0"
export function olderThan(a, b) {
  const pa = String(a ?? '0').split('.').map(Number)
  const pb = String(b ?? '0').split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0)
  return false
}
