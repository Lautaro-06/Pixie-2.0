// Mensajes al celular por WhatsApp, con CallMeBot (gratis, uso personal).
// Solo puede mandarle mensajes a tu propio número: no sirve para escribirle a otros.
// Se activa una vez: ver "WhatsApp al celular" en el README.
import { FriendlyError } from './windows.js'

const MIN_GAP_MS = 60 * 1000 // automáticos: como mucho uno por minuto
const MAX_AUTO_PER_DAY = 20

export function whatsappConfig(cfg) {
  const w = cfg?.whatsapp
  const telefono = String(w?.telefono ?? '').replace(/[^\d+]/g, '')
  const apikey = String(w?.apikey ?? '').trim()
  return telefono.length >= 8 && apikey ? { telefono, apikey } : null
}

export function createPhone({ getConfig, fetchImpl = (...a) => fetch(...a), log = () => {} }) {
  let lastAuto = 0
  let autoDay = ''
  let autoCount = 0

  async function send(text, { auto = false } = {}) {
    const w = whatsappConfig(getConfig())
    if (!w) throw new FriendlyError('Todavía no tengo tu WhatsApp. Se activa una vez: el README explica cómo (en 2 minutos).')
    if (auto) {
      const now = Date.now()
      const day = new Date().toDateString()
      if (day !== autoDay) {
        autoDay = day
        autoCount = 0
      }
      if (now - lastAuto < MIN_GAP_MS || autoCount >= MAX_AUTO_PER_DAY) return false
      lastAuto = now
      autoCount++
    }
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(w.telefono)}&text=${encodeURIComponent(text.slice(0, 1000))}&apikey=${encodeURIComponent(w.apikey)}`
    let res
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) })
    } catch {
      throw new FriendlyError('No pude mandar el WhatsApp: parece que no hay internet.')
    }
    const body = await res.text().catch(() => '')
    if (!res.ok || /apikey is invalid|invalid apikey|not activated|error/i.test(body)) {
      log(`whatsapp: ${res.status} ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`)
      throw new FriendlyError('WhatsApp no aceptó el mensaje. Revisá el número y la clave de CallMeBot en config.json.')
    }
    return true
  }

  return { configured: () => Boolean(whatsappConfig(getConfig())), send }
}
