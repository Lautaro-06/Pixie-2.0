// Configuración guardada en la compu de cada persona (config.json en la carpeta de datos de la app).
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, appendFile, copyFileSync, watchFile } from 'node:fs'

const DEFAULTS = {
  ciudad: 'Buenos Aires',
  lugar: null, // { nombre, lat, lon } que se completa la primera vez que se pide el clima
  atajo: 'Control+Space',
  apps: [] // apps extra, mismo formato que APPS en catalog.js
}

let config = { ...DEFAULTS }

export function configPath() {
  return join(app.getPath('userData'), 'config.json')
}

// Lee config.json del disco: { ok, data } o { ok: false, missing, error }
function readDisk() {
  try {
    return { ok: true, data: JSON.parse(readFileSync(configPath(), 'utf8')) }
  } catch (err) {
    return { ok: false, missing: err.code === 'ENOENT', error: err }
  }
}

function reportBroken(err) {
  // Se guarda una copia por las dudas, pero el archivo no se toca: lo arreglás y Pixie lo lee solo
  try {
    copyFileSync(configPath(), brokenConfigPath())
  } catch {
    // sin copia
  }
  const msg = `config.json tiene un error (${err.message}). Arreglalo y guardalo: lo leo solo. (Hay una copia en config.roto.json.)`
  console.error(msg)
  logAction(msg)
}

export function loadConfig() {
  const disk = readDisk()
  if (disk.ok) {
    config = { ...DEFAULTS, ...disk.data }
    return config
  }
  config = { ...DEFAULTS }
  if (disk.missing) saveConfig({})
  else reportBroken(disk.error)
  return config
}

// Vuelve a leer config.json (cuando lo editás con Pixie abierto). Devuelve true si cambió algo.
export function reloadConfig() {
  const disk = readDisk()
  if (!disk.ok) {
    if (!disk.missing) reportBroken(disk.error)
    return false
  }
  const next = { ...DEFAULTS, ...disk.data }
  if (JSON.stringify(next) === JSON.stringify(config)) return false
  config = next
  return true
}

// Mira el archivo cada segundo y medio: no hace falta reiniciar Pixie después de editarlo
export function watchConfig(onChange) {
  watchFile(configPath(), { interval: 1500 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs && reloadConfig()) onChange(config)
  })
}

export function brokenConfigPath() {
  return join(app.getPath('userData'), 'config.roto.json')
}

export function getConfig() {
  return config
}

// Guarda un cambio sin pisar lo que editaste a mano: parte de lo que hay en el archivo
export function saveConfig(patch) {
  const disk = readDisk()
  if (!disk.ok && !disk.missing) {
    config = { ...config, ...patch } // el archivo está a medio editar: no se toca
    return config
  }
  const merged = { ...(disk.ok ? disk.data : config), ...patch }
  config = { ...DEFAULTS, ...merged }
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(configPath(), JSON.stringify(merged, null, 2))
  } catch (err) {
    console.error('No se pudo guardar la configuración', err)
  }
  return config
}

// Registro de lo que hizo Pixie, para poder revisarlo.
export function logAction(line) {
  const stamp = new Date().toISOString()
  appendFile(join(app.getPath('userData'), 'historial.txt'), `${stamp}  ${line}\n`, () => {})
}
