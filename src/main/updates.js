// Actualizaciones: Pixie busca versiones nuevas en las Releases de GitHub,
// las baja sola y, cuando están listas, ofrece el botón «Actualizar».
// Solo anda en la app instalada; con npm run dev queda en modo desarrollo.

const FIRST_CHECK_MS = 20 * 1000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const OFFLINE = /ENOTFOUND|ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|net::ERR_/

export function createUpdater({
  updater,
  packaged,
  currentVersion,
  log = () => {},
  reportError = () => {},
  onChange = () => {},
  onReady = () => {},
  timers = { setTimeout, setInterval }
}) {
  let state = packaged ? 'idle' : 'dev' // idle | checking | downloading | ready | error | offline | dev
  let available = null
  let progress = 0
  let lastError = null
  let announced = null
  let upToDate = false // ya se fijó y no hay nada nuevo
  let lastShown = ''

  // Avisa los cambios que se notan (el progreso, de a 10 %), no cada pedacito que baja
  const set = (next) => {
    if (next.state) state = next.state
    if ('available' in next) available = next.available
    if ('progress' in next) progress = next.progress
    if ('error' in next) lastError = next.error
    const shown = `${state}|${available}|${Math.floor(progress / 10)}`
    if (shown === lastShown) return
    lastShown = shown
    onChange(status())
  }

  function failed(err) {
    const message = String(err?.message ?? err)
    if (OFFLINE.test(message)) {
      set({ state: 'offline', error: null })
      return
    }
    set({ state: 'error', error: message.split('\n')[0].slice(0, 200) })
    log(`actualizaciones: ${message.split('\n')[0]}`)
    reportError('actualizaciones', err)
  }

  if (packaged) {
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.on('checking-for-update', () => set({ state: 'checking' }))
    updater.on('update-available', (info) => {
      log(`actualizaciones: hay una versión nueva (${info.version}), la bajo`)
      set({ state: 'downloading', available: info.version, progress: 0 })
    })
    updater.on('update-not-available', () => {
      upToDate = true
      set({ state: 'idle', available: null, error: null })
    })
    updater.on('download-progress', (p) => set({ progress: Math.round(p.percent ?? 0) }))
    updater.on('update-downloaded', (info) => {
      set({ state: 'ready', available: info.version, progress: 100, error: null })
      if (announced !== info.version) {
        announced = info.version
        log(`actualizaciones: la versión ${info.version} está lista para instalar`)
        onReady(info.version)
      }
    })
    updater.on('error', failed)
  }

  async function check() {
    if (!packaged || state === 'ready' || state === 'downloading') return status()
    try {
      await updater.checkForUpdates()
    } catch (err) {
      failed(err)
    }
    return status()
  }

  function start() {
    if (!packaged) return
    timers.setTimeout(check, FIRST_CHECK_MS)
    timers.setInterval(check, CHECK_EVERY_MS)
  }

  // Cierra Pixie, instala la versión nueva sin preguntas y la vuelve a abrir
  function install() {
    if (state !== 'ready') return false
    log(`actualizaciones: instalando la versión ${available}`)
    updater.quitAndInstall(true, true)
    return true
  }

  function status() {
    return { state, current: currentVersion, available, progress, error: lastError, upToDate }
  }

  return { start, check, install, status, describe: () => describeUpdate(status()) }
}

// El estado de las actualizaciones, en una frase
export function describeUpdate({ state, current, available, progress, upToDate }) {
  switch (state) {
    case 'dev':
      return `Soy la versión ${current} en modo desarrollo: las actualizaciones andan en la app instalada.`
    case 'checking':
      return `Tengo la versión ${current} y me estoy fijando si hay una nueva.`
    case 'downloading':
      return `Tengo la versión ${current} y estoy bajando la ${available} (${progress} %).`
    case 'ready':
      return `La versión ${available} ya está lista para instalar (ahora tengo la ${current}).`
    case 'offline':
      return `Tengo la versión ${current}. No pude fijarme si hay una nueva porque no hay internet.`
    case 'error':
      return `Tengo la versión ${current}. No pude fijarme si hay una nueva.`
    default:
      return upToDate ? `Tengo la versión ${current}, la última.` : `Tengo la versión ${current}.`
  }
}
