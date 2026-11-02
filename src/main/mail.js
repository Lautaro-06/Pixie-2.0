// Los mails nuevos de Gmail. La extensión de Chrome lee el aviso de mails sin leer de Gmail (el mismo
// que usan los avisadores de mails) con la sesión que ya tenés en Chrome: quién lo manda, el asunto y las
// primeras palabras. No abre tus mails ni los marca como leídos. Solo avisa si se lo pediste
// («avisame de los mails»), y en mails.json guarda solo cuáles ya te contó (para no repetirlos).
import { readFileSync, writeFileSync } from 'node:fs'
import { decodeEntities } from './news.js'
import { checkQuery } from './safety.js'

const MIN = 60 * 1000
export const EVERY_MS = 3 * MIN // cada cuánto mira si llegó algo (con los avisos prendidos y Chrome abierto)
const MIN_GAP_MS = 20 * 1000 // no más seguido que esto aunque se lo pidas
const MAX_SEEN = 600
const RECENT_MS = 15 * MIN // «leémelo» se refiere al mail que avisó hace un rato

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const clean = (s) =>
  decodeEntities(
    String(s ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()

const tag = (block, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? m[1] : null
}

// El aviso de Gmail (Atom) → { cuenta, total, mails: [{ id, de, email, asunto, resumen, cuando, link }] }
export function parseGmailFeed(xml) {
  const text = String(xml ?? '')
  if (!/<feed[\s>]/i.test(text)) return null
  const head = text.split(/<entry[\s>]/i)[0]
  const cuenta = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(clean(tag(head, 'title')))?.[0] ?? null
  const mails = []
  for (const b of text.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []) {
    const author = tag(b, 'author') ?? ''
    const email = clean(tag(author, 'email')).toLowerCase()
    const de = clean(tag(author, 'name')) || email.split('@')[0] || 'alguien'
    const link = decodeEntities(/<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? '')
    const id = clean(tag(b, 'id')) || /message_id=([\w]+)/.exec(link)?.[1] || `${email}|${clean(tag(b, 'title'))}`
    const when = clean(tag(b, 'issued') ?? tag(b, 'modified'))
    mails.push({
      id,
      de: de.slice(0, 60),
      email,
      asunto: clean(tag(b, 'title')).slice(0, 150) || '(sin asunto)',
      resumen: clean(tag(b, 'summary')).slice(0, 300),
      cuando: when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null,
      link
    })
  }
  const total = Number.parseInt(clean(tag(head, 'fullcount')), 10)
  return { cuenta, total: Number.isFinite(total) ? total : mails.length, mails }
}

// Lo que leyó la extensión ({ cuentas: [{ cuenta, xml }] } o, si el aviso no anduvo, la bandeja abierta
// { cuentas: [{ cuenta, filas: [...] }] }) → una sola lista, lo más nuevo primero
export function parseMailbox(raw) {
  const cuentas = []
  const mails = []
  let total = 0
  for (const c of raw?.cuentas ?? []) {
    if (c.xml) {
      const feed = parseGmailFeed(c.xml)
      if (!feed) continue
      cuentas.push(feed.cuenta ?? `cuenta ${c.cuenta ?? cuentas.length}`)
      total += feed.total
      mails.push(...feed.mails.map((m) => ({ ...m, cuenta: feed.cuenta })))
    } else if (Array.isArray(c.filas)) {
      cuentas.push(c.cuenta ? String(c.cuenta) : 'Gmail')
      const rows = c.filas.slice(0, 50).map((f) => ({
        id: String(f.id ?? `${f.de}|${f.asunto}`),
        de: String(f.de ?? 'alguien').slice(0, 60),
        email: String(f.email ?? '').toLowerCase(),
        asunto: String(f.asunto ?? '').slice(0, 150) || '(sin asunto)',
        resumen: String(f.resumen ?? '').replace(/^\s*-\s*/, '').slice(0, 300),
        cuando: null,
        link: String(f.link ?? ''),
        cuenta: c.cuenta ?? null
      }))
      total += Number.isFinite(c.total) ? c.total : rows.length
      mails.push(...rows)
    }
  }
  mails.sort((a, b) => (b.cuando ? Date.parse(b.cuando) : 0) - (a.cuando ? Date.parse(a.cuando) : 0))
  return { cuentas, total, mails }
}

// Un asunto que no se lee en voz alta (spam para adultos, cosas ilegales)
const safeSubject = (m) => (checkQuery(`${m.asunto} ${m.de}`) ? 'un mail que parece spam' : `«${m.asunto}»`)
const fromClassroom = (m) => /classroom\.google\.com$/.test(m.email.split('@')[1] ?? '') || /^(nueva tarea|nuevo material|new assignment)\b/i.test(m.asunto)
const senderName = (m) => (fromClassroom(m) ? 'Classroom' : m.de)

export function announceText(list) {
  if (list.length === 1) return `Te llegó un mail de ${senderName(list[0])}: ${safeSubject(list[0])}.`
  if (list.length <= 3) return `Te llegaron ${list.length} mails: ${list.map((m) => `de ${senderName(m)} (${safeSubject(m)})`).join(', ')}.`.replace(/, ([^,]*)$/, ' y $1')
  const names = [...new Set(list.map(senderName))]
  return `Te llegaron ${list.length} mails, de ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' y otros' : ''}.`
}

export function listText(box) {
  if (!box.mails.length) return 'No tenés mails sin leer. ¡Bandeja limpia!'
  const total = Math.max(box.total, box.mails.length)
  const first = box.mails.slice(0, 3).map((m) => `de ${senderName(m)}: ${safeSubject(m)}`)
  const head = total === 1 ? 'Tenés 1 mail sin leer' : `Tenés ${total} mails sin leer`
  return `${head}. ${total > 1 ? `Los últimos: ${first.join('; ')}` : first[0].replace(/^de /, 'Es de ')}.`
}

// Busca un mail por quién lo manda ("la profe de química") o por número ("el segundo")
export function findMail(mails, { de, n } = {}) {
  if (Number.isInteger(n) && n !== 0) return (n > 0 ? mails[n - 1] : mails.at(n)) ?? null
  if (!de) return mails[0] ?? null
  const words = fold(de)
    .replace(/\b(el|la|los|las|del|de|mi|profe|profesora?|senor|senora|que|mando|me)\b/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  if (!words.length) return null
  const score = (m) => {
    const hay = fold(`${m.de} ${m.email} ${m.asunto}`)
    return words.filter((w) => hay.includes(w)).length
  }
  const best = mails.map((m) => [score(m), m]).sort((a, b) => b[0] - a[0])[0]
  return best && best[0] > 0 ? best[1] : null
}

export function createMail({ browser, file, getConfig = () => ({}), saveConfig = () => {}, log = () => {}, now = () => Date.now(), onNew = () => {}, onClassroom = () => {} }) {
  let seen = new Set()
  let box = { cuentas: [], total: 0, mails: [] }
  let leido = null
  let estado = 'sin-leer'
  let error = null
  let lastTry = 0
  let reading = null
  let timer = null
  let told = { mails: [], at: 0 } // lo último que avisó o contó (para «leémelo»)

  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    seen = new Set(Array.isArray(data.vistos) ? data.vistos.slice(-MAX_SEEN) : [])
    leido = data.leido ?? null
  } catch {
    // todavía no leyó tus mails
  }

  const save = () => writeFileSync(file, JSON.stringify({ version: 1, leido, vistos: [...seen].slice(-MAX_SEEN) }))
  const muted = () => (Array.isArray(getConfig().mailsSilenciados) ? getConfig().mailsSilenciados : [])
  const isMuted = (m) => muted().some((x) => fold(`${m.de} ${m.email}`).includes(fold(x)))
  const alertsOn = () => getConfig().mailAvisos === true

  // Mira los mails sin leer. force: aunque haya mirado hace poco. silent: lo preguntaste vos (la respuesta
  // ya los cuenta, no hace falta el aviso). Devuelve el estado y los nuevos.
  async function refresh({ force = false, silent = false } = {}) {
    if (reading) return reading
    const t = now()
    if (!force && leido && t - leido < EVERY_MS - 10 * 1000) return { ...status(), nuevos: [] }
    if (t - lastTry < MIN_GAP_MS) return { ...status(), nuevos: [] }
    if (!browser?.connected()) {
      estado = 'sin-extension'
      return { ...status(), nuevos: [] }
    }
    lastTry = t
    estado = 'leyendo'
    reading = (async () => {
      let nuevos = []
      try {
        const raw = await browser.request('mails', {}, 45 * 1000)
        const first = leido === null
        box = parseMailbox(raw)
        nuevos = box.mails.filter((m) => !seen.has(m.id))
        for (const m of nuevos) seen.add(m.id)
        leido = now()
        estado = 'ok'
        error = null
        save()
        // La primera vez no avisa de todo lo que ya tenías sin leer
        if (first) nuevos = []
        if (nuevos.some(fromClassroom)) onClassroom()
        const toTell = nuevos.filter((m) => !isMuted(m))
        if (toTell.length && alertsOn() && !silent) {
          told = { mails: toTell, at: now() }
          onNew(toTell)
        }
      } catch (err) {
        estado = /desconocido/i.test(err.message) ? 'extension-vieja' : 'error'
        error = err.message
        log(`mails: ${err.message}`)
      } finally {
        reading = null
      }
      return { ...status(), nuevos }
    })()
    return reading
  }

  function status() {
    return {
      estado,
      conectada: Boolean(browser?.connected()),
      avisos: alertsOn(),
      leido,
      sinLeer: Math.max(box.total, box.mails.length),
      cuentas: box.cuentas,
      error,
      silenciados: muted()
    }
  }

  return {
    start() {
      setTimeout(() => alertsOn() && refresh(), 90 * 1000)
      timer = setInterval(() => alertsOn() && refresh(), EVERY_MS)
    },
    stop: () => clearInterval(timer),
    refresh,
    status,
    mailbox: () => box,
    // Lo que contó hace poco (para «leémelo»), o nada
    recent: () => (now() - told.at < RECENT_MS ? told.mails : []),
    remember(mails) {
      told = { mails, at: now() }
    },
    setAlerts(on) {
      saveConfig({ mailAvisos: Boolean(on), mailOfrecido: true })
      return status()
    },
    mute(who) {
      const name = String(who ?? '').trim().slice(0, 60)
      if (!name) return muted()
      const list = [...muted().filter((x) => fold(x) !== fold(name)), name].slice(-30)
      saveConfig({ mailsSilenciados: list })
      return list
    },
    unmute(who) {
      const list = muted().filter((x) => fold(x) !== fold(who))
      saveConfig({ mailsSilenciados: list })
      return list
    }
  }
}
