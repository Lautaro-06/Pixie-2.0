// La extensión de Chrome viaja adentro de Pixie. Al arrancar, Pixie la copia a su carpeta de datos
// (siempre en el mismo lugar), así en Chrome se instala una sola vez y con cada versión nueva de
// Pixie alcanza con tocar «recargar» en chrome://extensions.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'

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
    if (existsSync(to)) rmSync(to, { recursive: true, force: true })
    mkdirSync(to, { recursive: true })
    cpSync(from, to, { recursive: true })
  }
  return { ok: true, carpeta: to, version: bundled, actualizada: installed !== bundled && installed !== null }
}

// "0.9.1" < "0.10.0"
export function olderThan(a, b) {
  const pa = String(a ?? '0').split('.').map(Number)
  const pb = String(b ?? '0').split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0)
  return false
}
