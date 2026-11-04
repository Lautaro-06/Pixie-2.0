// Mensajes al celular por WhatsApp, con CallMeBot (gratis, uso personal).
// Solo puede mandarle mensajes a tu propio número: no sirve para escribirle a otros.
// Cada uno lo activa una vez desde Ajustes → WhatsApp (pone su número y la clave que le manda el bot).
// Los recordatorios y los timers salen apenas se cumplen; si el envío falla, reintenta.
import { FriendlyError } from './windows.js'

export const CALLMEBOT_NUMBER = '+34 684 77 00 05'
export const CALLMEBOT_ACTIVATION = 'I allow callmebot to send me messages'
export const CALLMEBOT_PAGE = 'https://www.callmebot.com/blog/free-api-whatsapp-messages/'
// Abre WhatsApp con el mensaje de activación ya escrito (solo hay que tocar Enviar)
export const activationLink = () => `https://wa.me/${CALLMEBOT_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(CALLMEBOT_ACTIVATION)}`

const GAP_MS = 4000 // entre un mensaje y otro (CallMeBot no deja mandar muchos seguidos)
const MAX_AUTO_PER_DAY = 40
const RETRIES = [3000, 15000] // si falla por internet o el servicio, reintenta a los 3 y a los 15 segundos
export const WHEN = ['siempre', 'ausente'] // siempre, o solo si no estás en la compu

// «+54 9 11 1234-5678» → «+5491112345678»
export function cleanPhone(raw) {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  if (!digits.replace(/\D/g, '')) return ''
  return digits.startsWith('+') ? digits : `+${digits}`
}

export function whatsappConfig(cfg) {
  const w = cfg?.whatsapp
  const telefono = cleanPhone(w?.telefono)
  const apikey = String(w?.apikey ?? '').trim()
  const cuando = WHEN.includes(w?.cuando) ? w.cuando : 'siempre'
  return telefono.replace(/\D/g, '').length >= 8 && apikey ? { telefono, apikey, cuando } : null
}

// La clave que manda el bot («Your APIKEY is 123456»), copiada del chat
export function findWhatsappKey(text) {
  const m = /api\s*key[^0-9]{0,20}(\d{4,10})\b/i.exec(String(text ?? ''))
  return m ? m[1] : null
}

// Lo que contestó CallMeBot, dicho para una persona
export function serviceError(status, body) {
  const b = String(body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  if (/apikey is invalid|invalid apikey|wrong apikey/i.test(b)) return 'La clave no es la de ese número. Fijate que número y clave sean los del mismo celular.'
  if (/not activated|allow callmebot/i.test(b)) return 'Ese número todavía no está activado: mandale el mensaje de activación al bot desde ese celular.'
  if (/phone.*(invalid|incorrect|format)/i.test(b)) return 'El número no está bien: ponelo con el código de país, por ejemplo +54 9 11 1234 5678.'
  if (status === 429 || /too many|please wait/i.test(b)) return 'CallMeBot pide esperar un poco entre mensajes.'
  if (status >= 500) return 'El servicio de WhatsApp (CallMeBot) no está respondiendo ahora.'
  return null
}

export function createPhone({ getConfig, fetchImpl = (...a) => fetch(...a), log = () => {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now() }) {
  let autoDay = ''
  let autoCount = 0
  let last = null // { ok, at, error, texto }
  let queue = Promise.resolve()
  let lastSentAt = 0

  async function sendOnce(w, text) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(w.telefono)}&text=${encodeURIComponent(text.slice(0, 1000))}&apikey=${encodeURIComponent(w.apikey)}`
    let res
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) })
    } catch {
      return { ok: false, retry: true, error: 'No pude mandar el WhatsApp: parece que no hay internet.' }
    }
    const body = await res.text().catch(() => '')
    const failed = !res.ok || /apikey is invalid|invalid apikey|not activated|error/i.test(body)
    if (!failed) return { ok: true }
    log(`whatsapp: ${res.status} ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`)
    return {
      ok: false,
      retry: res.status === 429 || res.status >= 500,
      error: serviceError(res.status, body) ?? 'WhatsApp no aceptó el mensaje. Revisá el número y la clave en Ajustes → WhatsApp.'
    }
  }

  // Manda uno (en fila con los demás, para no pisarse) y reintenta si falló por internet o el servicio
  function send(text, { auto = false } = {}) {
    const w = whatsappConfig(getConfig())
    if (!w) return Promise.reject(new FriendlyError('Todavía no tengo tu WhatsApp. Se activa una vez en Ajustes → WhatsApp (en 2 minutos).'))
    if (auto) {
      const day = new Date(now()).toDateString()
      if (day !== autoDay) {
        autoDay = day
        autoCount = 0
      }
      if (autoCount >= MAX_AUTO_PER_DAY) return Promise.resolve(false)
      autoCount++
    }
    const job = queue.then(async () => {
      const gap = lastSentAt + GAP_MS - now()
      if (gap > 0) await wait(gap)
      let r = await sendOnce(w, text)
      for (const delay of RETRIES) {
        if (r.ok || !r.retry) break
        await wait(delay)
        r = await sendOnce(w, text)
      }
      lastSentAt = now()
      last = { ok: r.ok, at: new Date(now()).toISOString(), error: r.ok ? null : r.error, texto: text.slice(0, 80) }
      if (!r.ok) throw new FriendlyError(r.error)
      return true
    })
    queue = job.catch(() => {})
    return job
  }

  return {
    configured: () => Boolean(whatsappConfig(getConfig())),
    send,
    // Para Ajustes: si hay número (nunca el número entero: solo cómo termina), si tiene clave, cuándo
    // avisa y cómo salió el último
    status() {
      const raw = getConfig().whatsapp ?? {}
      const w = whatsappConfig(getConfig())
      const digits = cleanPhone(raw.telefono).replace(/\D/g, '')
      return {
        configurado: Boolean(w),
        tieneNumero: digits.length > 0,
        termina: digits.length >= 8 ? digits.slice(-4) : '',
        tieneClave: Boolean(String(raw.apikey ?? '').trim()),
        cuando: WHEN.includes(raw.cuando) ? raw.cuando : 'siempre',
        ultimo: last,
        bot: CALLMEBOT_NUMBER,
        activacion: CALLMEBOT_ACTIVATION
      }
    }
  }
}
