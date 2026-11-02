// Puente con la extensión "Pixie para Chrome" (carpeta extension/).
// Pixie escucha solo en la compu (127.0.0.1) y solo acepta conexiones que vienen
// de una extensión del navegador, nunca de una página web.
import { WebSocketServer } from 'ws'

export const BRIDGE_PORT = 47631

// Errores del navegador que se le pueden mostrar tal cual a la persona
export class BrowserError extends Error {}

export class NoExtensionError extends BrowserError {
  constructor() {
    super('Para eso necesito mi extensión de Chrome. En mis Ajustes → Agenda está cómo instalarla (es una sola vez).')
  }
}

// known(): ¿alguna vez se conectó la extensión? (si nunca se instaló, abrir Chrome no sirve)
// openBrowser(): abre el navegador donde está la extensión; devuelve true si ya estaba abierto
// onOpening(yaAbierto): para avisar «Abro Chrome…» mientras espera
export function createBrowserBridge({ log = () => {}, onConnect = () => {}, known = () => false, openBrowser = null, onOpening = () => {}, port = BRIDGE_PORT } = {}) {
  let socket = null
  let version = null // la versión de la extensión (para avisar si hay que recargarla)
  let nextId = 1
  const waiting = new Map()
  let connectedWaiters = [] // los que esperan a que se conecte
  let opening = null

  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port,
    verifyClient: ({ origin }) => typeof origin === 'string' && /^(chrome|moz)-extension:\/\//.test(origin)
  })

  wss.on('connection', (ws) => {
    if (socket && socket !== ws) socket.close()
    socket = ws
    log('extensión de Chrome conectada')
    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(String(data))
      } catch {
        return
      }
      if (msg.type === 'hola') {
        version = String(msg.version ?? '')
        onConnect(version, msg.navegador === 'edge' ? 'edge' : 'chrome')
        for (const w of connectedWaiters) w(true)
        connectedWaiters = []
        return
      }
      const pending = msg.id && waiting.get(msg.id)
      if (!pending) return
      clearTimeout(pending.timer)
      waiting.delete(msg.id)
      if (msg.ok) pending.resolve(msg.result)
      else pending.reject(new BrowserError(msg.error || 'El navegador no pudo hacerlo.'))
    })
    ws.on('close', () => {
      if (socket === ws) socket = null
    })
    ws.on('error', () => {})
  })
  wss.on('error', (err) => log(`puente con Chrome: ${err.message}`))

  function request(cmd, args = {}, timeoutMs = 8000) {
    if (!socket) return Promise.reject(new NoExtensionError())
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id)
        reject(new BrowserError('El navegador no respondió. ¿Está abierto Chrome?'))
      }, timeoutMs)
      waiting.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, cmd, args }))
    })
  }

  // Que la extensión esté conectada: si Chrome está cerrado lo abre y espera; si está abierto, espera a
  // que la extensión se reconecte (Chrome la duerme cuando no se usa y se despierta cada 30 segundos).
  function ensure({ timeoutMs = 35000 } = {}) {
    if (socket) return Promise.resolve(true)
    if (!openBrowser || !known()) return Promise.resolve(false)
    opening ??= (async () => {
      let giveUp = () => {}
      const wait = new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs)
        giveUp = () => {
          clearTimeout(timer)
          resolve(false)
        }
        connectedWaiters.push((ok) => {
          clearTimeout(timer)
          resolve(ok)
        })
      })
      try {
        const wasOpen = await openBrowser()
        onOpening(Boolean(wasOpen))
      } catch (err) {
        // No se pudo abrir (no está instalado): no tiene sentido esperar
        log(`abrir el navegador: ${err.message}`)
        giveUp()
      }
      const ok = await wait
      if (!ok) log('la extensión de Chrome no se conectó a tiempo')
      return Boolean(socket)
    })().finally(() => {
      opening = null
    })
    return opening
  }

  return {
    ensure,
    // Como request, pero si hace falta abre Chrome primero (para lo que pidió la persona)
    async need(cmd, args = {}, timeoutMs = 8000) {
      await ensure()
      return request(cmd, args, timeoutMs)
    },
    request,
    connected: () => Boolean(socket),
    version: () => (socket ? version : null),
    close: () => wss.close()
  }
}
