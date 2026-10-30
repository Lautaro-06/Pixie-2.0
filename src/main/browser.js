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

export function createBrowserBridge({ log = () => {}, onConnect = () => {} } = {}) {
  let socket = null
  let version = null // la versión de la extensión (para avisar si hay que recargarla)
  let nextId = 1
  const waiting = new Map()

  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: BRIDGE_PORT,
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
        onConnect(version)
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

  return {
    request,
    connected: () => Boolean(socket),
    version: () => (socket ? version : null),
    close: () => wss.close()
  }
}
