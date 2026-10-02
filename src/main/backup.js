// Respaldo de la memoria: una copia en la compu y otra en la nube (la carpeta de
// OneDrive, que Windows sincroniza solo). Si se rompe la compu, en la nueva Pixie
// recupera sus recuerdos al arrancar. Las claves nunca se copian.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { dayKey } from './dates.js'

const KEEP_DAYS = 7
const SECRETS = ['claveIA', 'whatsapp']

// Dónde está la nube: la carpeta que diga config.json o la de OneDrive
export function cloudFolder(cfg = {}, env = process.env) {
  if (cfg.carpetaRespaldo) return { dir: cfg.carpetaRespaldo, name: basename(cfg.carpetaRespaldo) || 'la nube' }
  const one = env.OneDrive || env.OneDriveConsumer || env.OneDriveCommercial
  return one ? { dir: join(one, 'Pixie'), name: 'OneDrive' } : null
}

export function createBackup({ dataDir, getConfig = () => ({}), env = process.env, now = () => new Date() }) {
  const localDir = join(dataDir, 'respaldos')
  const targets = () => {
    const cloud = cloudFolder(getConfig(), env)
    return { cloud, dirs: [localDir, ...(cloud ? [cloud.dir] : [])] }
  }

  function backup() {
    const memoryFile = join(dataDir, 'memoria.json')
    let memory
    try {
      memory = readFileSync(memoryFile, 'utf8')
      JSON.parse(memory) // solo se respalda si está sana
    } catch (err) {
      return { ok: false, error: existsSync(memoryFile) ? 'la memoria está dañada' : 'todavía no tengo recuerdos' }
    }
    const { cloud, dirs } = targets()
    let config = null
    try {
      const cfg = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'))
      for (const k of SECRETS) delete cfg[k]
      config = JSON.stringify(cfg, null, 2)
    } catch {
      // sin config: se respalda solo la memoria
    }
    let cloudOk = false
    for (const dir of dirs) {
      try {
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'memoria.json'), memory)
        writeFileSync(join(dir, `memoria-${dayKey(now())}.json`), memory)
        if (config) writeFileSync(join(dir, 'config.json'), config)
        prune(dir)
        if (dir !== localDir) cloudOk = true
      } catch (err) {
        if (dir === localDir) return { ok: false, error: err.message }
      }
    }
    return { ok: true, cloud: cloudOk, cloudName: cloud?.name }
  }

  function prune(dir) {
    const daily = readdirSync(dir).filter((f) => /^memoria-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    for (const f of daily.slice(0, Math.max(0, daily.length - KEEP_DAYS))) rmSync(join(dir, f), { force: true })
  }

  // En una compu nueva (o si se borró la memoria): trae la copia más reciente
  function restoreIfMissing() {
    const restored = []
    const { cloud, dirs } = targets()
    const sources = [...dirs].reverse() // primero la nube
    for (const file of ['memoria.json', 'config.json']) {
      const dest = join(dataDir, file)
      if (existsSync(dest)) continue
      const from = sources.find((dir) => existsSync(join(dir, file)))
      if (!from) continue
      try {
        mkdirSync(dataDir, { recursive: true })
        copyFileSync(join(from, file), dest)
        restored.push({ file, from: from === localDir ? 'la compu' : cloud?.name ?? 'la nube' })
      } catch {
        // si no se puede, Pixie arranca de cero
      }
    }
    return restored
  }

  return { backup, restoreIfMissing, cloud: () => targets().cloud }
}
