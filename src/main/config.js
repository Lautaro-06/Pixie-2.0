// Configuración guardada en la compu de cada persona (config.json en la carpeta de datos de la app).
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, appendFile, copyFileSync } from 'node:fs'

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

export function loadConfig() {
  let text = null
  try {
    text = readFileSync(configPath(), 'utf8')
  } catch {
    // la primera vez todavía no existe
  }
  if (text !== null) {
    try {
      config = { ...DEFAULTS, ...JSON.parse(text) }
      return config
    } catch (err) {
      // Si quedó mal al editarlo a mano, se guarda una copia para no perder lo que tenía (por ejemplo la clave de IA)
      copyFileSync(configPath(), brokenConfigPath())
      const msg = `config.json tiene un error (${err.message}). Lo que tenía quedó en config.roto.json y arranco con la configuración de fábrica.`
      console.error(msg)
      logAction(msg)
    }
  }
  config = { ...DEFAULTS }
  saveConfig({})
  return config
}

export function brokenConfigPath() {
  return join(app.getPath('userData'), 'config.roto.json')
}

export function getConfig() {
  return config
}

export function saveConfig(patch) {
  config = { ...config, ...patch }
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(configPath(), JSON.stringify(config, null, 2))
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
