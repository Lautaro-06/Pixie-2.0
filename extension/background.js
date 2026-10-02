// Pixie para Chrome: se conecta con la app de Pixie (en la misma compu) y hace
// lo que Pixie le pide en YouTube, Gmail o la página abierta. Solo actúa cuando
// Pixie se lo pide; no manda nada a internet.

const PIXIE_URL = 'ws://127.0.0.1:47631'
let ws = null

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  try {
    ws = new WebSocket(PIXIE_URL)
  } catch {
    return
  }
  ws.onopen = () => ws.send(JSON.stringify({ type: 'hola', version: chrome.runtime.getManifest().version }))
  ws.onmessage = async (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    if (!msg.id) return
    try {
      const result = await handle(msg.cmd, msg.args || {})
      ws?.send(JSON.stringify({ id: msg.id, ok: true, result }))
    } catch (err) {
      ws?.send(JSON.stringify({ id: msg.id, ok: false, error: err.message }))
    }
  }
  ws.onclose = () => {
    ws = null
  }
  ws.onerror = () => {}
}

// Mantiene la conexión viva y reintenta si Pixie se abrió después que Chrome
setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
  else connect()
}, 20000)
chrome.alarms.create('pixie', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener(connect)
chrome.runtime.onStartup.addListener(connect)
chrome.runtime.onInstalled.addListener(connect)
connect()

// ───────────── Pedidos de Pixie ─────────────

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab
}

async function findTab(match, preferAudible = false) {
  const active = await activeTab()
  if (active && match(active.url || '')) return active
  const tabs = (await chrome.tabs.query({})).filter((t) => match(t.url || ''))
  return (preferAudible && tabs.find((t) => t.audible)) || tabs[0] || null
}

async function run(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args })
  return res?.result
}

const YOUTUBE = /^https:\/\/(www\.|m\.)?youtube\.com\//
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Espera a que la pestaña termine de cargar (o un máximo)
function loaded(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timer)
      resolve()
    }
    const listener = (id, info) => id === tabId && info.status === 'complete' && done()
    const timer = setTimeout(done, timeout)
    chrome.tabs.onUpdated.addListener(listener)
  })
}

// Repite una función en la página hasta que devuelva algo (YouTube carga de a poco)
async function poll(tabId, func, args = [], tries = 25, every = 400) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await run(tabId, func, args)
      if (r) return r
    } catch {
      // la página todavía está cambiando
    }
    await sleep(every)
  }
  return null
}

// Usa la pestaña de YouTube que ya tenés (si hay) en vez de abrir otra
async function youtubeTab(url) {
  const tab = await findTab((u) => YOUTUBE.test(u), true)
  if (!tab) return chrome.tabs.create({ url, active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
  return chrome.tabs.update(tab.id, { url, active: true })
}

// Abre el video y se asegura de que suene
async function play(tabId, videoId) {
  await chrome.tabs.update(tabId, { url: `https://www.youtube.com/watch?v=${videoId}` })
  await loaded(tabId)
  return poll(tabId, ensurePlaying, [], 15, 500)
}

async function handle(cmd, args) {
  // "poné goteo de duki": busca, elige el primer video y lo reproduce
  if (cmd === 'reproducir') {
    const q = String(args.consulta ?? '').slice(0, 200)
    const tab = await youtubeTab(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`)
    await loaded(tab.id)
    const videos = await poll(tab.id, listVideos)
    if (!videos?.length) throw new Error(`No encontré videos de «${q}».`)
    const first = videos[0]
    const playing = await play(tab.id, first.videoId)
    return { ok: true, title: first.title, channel: first.channel, playing: Boolean(playing) }
  }
  // "poné el segundo": el video número N de la lista que estás viendo
  if (cmd === 'youtube_click') {
    const tab = await findTab((u) => YOUTUBE.test(u), true)
    if (!tab) throw new Error('No tenés YouTube abierto en Chrome.')
    const videos = await poll(tab.id, listVideos, [], 5)
    const n = Math.max(1, Math.round(Number(args.n) || 1))
    const video = videos?.[n - 1]
    if (!video) throw new Error(videos?.length ? `En la lista hay ${videos.length} videos.` : 'No veo videos en la página de YouTube.')
    const playing = await play(tab.id, video.videoId)
    return { ok: true, title: video.title, channel: video.channel, playing: Boolean(playing) }
  }
  if (cmd === 'youtube') {
    const tab = await findTab((url) => /^https:\/\/(www\.|m\.)?youtube\.com\/(watch|shorts)/.test(url), true)
    if (!tab) throw new Error('No encontré un video de YouTube abierto en Chrome.')
    return run(tab.id, youtubeAction, [args.accion, args.valor ?? null])
  }
  if (cmd === 'leer') {
    if (args.que === 'mail') {
      const tab = await findTab((url) => url.startsWith('https://mail.google.com/'))
      if (!tab) throw new Error('No encontré Gmail abierto en Chrome.')
      const r = await run(tab.id, readGmail)
      if (!r?.ok) throw new Error(r?.text || 'No pude leer el mail.')
      return r
    }
    const tab = await activeTab()
    if (!tab || !/^https?:/.test(tab.url || '')) throw new Error('No hay una página web abierta que pueda leer.')
    const r = await run(tab.id, readPage)
    if (!r?.ok) throw new Error(r?.text || 'No pude leer la página.')
    return r
  }
  throw new Error(`Pedido desconocido: ${cmd}`)
}

// ───────────── Funciones que corren dentro de la página ─────────────
// (Chrome las copia a la pestaña: no pueden usar nada de afuera.)

function youtubeAction(accion, valor) {
  const video = document.querySelector('video.html5-main-video') || document.querySelector('video')
  const title =
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title')?.textContent?.trim() ||
    document.title.replace(/ - YouTube$/, '')
  const channel = document.querySelector('#owner #channel-name a, ytd-channel-name a')?.textContent?.trim() || ''
  const visible = (el) => el && el.offsetParent !== null
  const buttons = () => [...document.querySelectorAll('button')].filter(visible)
  const byLabel = (re) => buttons().find((b) => re.test(b.getAttribute('aria-label') || ''))
  const pressed = (b) => b?.getAttribute('aria-pressed') === 'true'
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  switch (accion) {
    case 'like': {
      const b = document.querySelector('like-button-view-model button, #segmented-like-button button') || byLabel(/(gusta este video|like this video)/i)
      if (!visible(b)) return { ok: false, text: 'No encontré el botón de Me gusta. ¿Iniciaste sesión en YouTube?' }
      if (pressed(b)) return { ok: true, text: `Ya le habías dado like a «${title}».` }
      b.click()
      return { ok: true, text: `¡Listo! Le di like a «${title}».` }
    }
    case 'dislike': {
      const b = document.querySelector('dislike-button-view-model button, #segmented-dislike-button button') || byLabel(/(no me gusta|dislike)/i)
      if (!visible(b)) return { ok: false, text: 'No encontré el botón de No me gusta.' }
      if (!pressed(b)) b.click()
      return { ok: true, text: 'Listo, no me gusta.' }
    }
    case 'suscribir': {
      const b = document.querySelector('#subscribe-button button, ytd-subscribe-button-renderer button')
      if (!visible(b)) return { ok: false, text: 'No encontré el botón para suscribirse.' }
      const label = `${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`
      if (/suscripto|suscrito|subscribed/i.test(label)) return { ok: true, text: `Ya estás suscripto a ${channel || 'ese canal'}.` }
      b.click()
      return { ok: true, text: `¡Te suscribí a ${channel || 'ese canal'}!` }
    }
    case 'saltar_anuncio': {
      const skip = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern')
      if (visible(skip)) {
        skip.click()
        return { ok: true, text: 'Anuncio salteado.' }
      }
      const ad = document.querySelector('#movie_player.ad-showing')
      return { ok: false, text: ad ? 'Todavía no se puede saltar el anuncio. Esperá unos segundos.' : 'No hay ningún anuncio ahora.' }
    }
    case 'subtitulos': {
      const b = document.querySelector('.ytp-subtitles-button')
      if (!visible(b)) return { ok: false, text: 'Este video no tiene subtítulos.' }
      const wasOn = pressed(b)
      b.click()
      return { ok: true, text: wasOn ? 'Subtítulos desactivados.' : 'Subtítulos activados.' }
    }
    case 'velocidad':
    case 'mas_rapido':
    case 'mas_lento': {
      if (!video) return { ok: false, text: 'No encontré el video.' }
      let rate = accion === 'mas_rapido' ? video.playbackRate + 0.25 : accion === 'mas_lento' ? video.playbackRate - 0.25 : Number(valor) || 1
      rate = Math.min(3, Math.max(0.25, Math.round(rate * 100) / 100))
      video.playbackRate = rate
      return { ok: true, text: rate === 1 ? 'Velocidad normal.' : `Velocidad ${String(rate).replace('.', ',')}x.` }
    }
    case 'adelantar':
    case 'atrasar': {
      if (!video) return { ok: false, text: 'No encontré el video.' }
      const secs = Math.abs(Number(valor) || 10)
      video.currentTime = Math.max(0, video.currentTime + (accion === 'adelantar' ? secs : -secs))
      return { ok: true, text: `${accion === 'adelantar' ? 'Adelanté' : 'Atrasé'} ${secs} segundos.` }
    }
    case 'siguiente': {
      const b = document.querySelector('.ytp-next-button')
      if (!visible(b)) return { ok: false, text: 'No hay un video siguiente.' }
      b.click()
      return { ok: true, text: 'Pasando al siguiente video.' }
    }
    case 'pausa': {
      if (!video) return { ok: false, text: 'No encontré el video.' }
      const wasPaused = video.paused
      if (wasPaused) video.play()
      else video.pause()
      return { ok: true, text: wasPaused ? 'Sigue el video.' : 'Pausado.' }
    }
    case 'que_veo': {
      if (!video) return { ok: true, text: `Estás en «${title}».` }
      return { ok: true, text: `Estás viendo «${title}»${channel ? ` de ${channel}` : ''}, vas por el minuto ${fmt(video.currentTime)} de ${fmt(video.duration || 0)}.` }
    }
    default:
      return { ok: false, text: 'Eso todavía no lo sé hacer en YouTube.' }
  }
}

// Los videos de la página de YouTube abierta (búsqueda, inicio o sugeridos), sin Shorts ni anuncios
function listVideos() {
  const cards = document.querySelectorAll(
    'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model'
  )
  const out = []
  const seen = new Set()
  for (const card of cards) {
    if (card.offsetParent === null) continue
    if (card.closest('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-ad-slot-renderer')) continue
    const link = [...card.querySelectorAll('a[href*="watch?v="]')][0]
    const id = link?.getAttribute('href')?.match(/[?&]v=([\w-]{11})/)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const title =
      card.querySelector('#video-title')?.textContent?.trim() ||
      card.querySelector('h3, [title]')?.getAttribute('title') ||
      card.querySelector('h3')?.textContent?.trim() ||
      ''
    const channel = card.querySelector('ytd-channel-name a, #channel-name a, ytd-channel-name #text')?.textContent?.trim() || ''
    out.push({ videoId: id, title, channel })
    if (out.length >= 10) break
  }
  return out.length ? out : null
}

// Si el video quedó en pausa (Chrome a veces no deja que arranque solo), le da play
function ensurePlaying() {
  const video = document.querySelector('video.html5-main-video') || document.querySelector('video')
  if (!video) return null
  if (document.querySelector('#movie_player.ad-showing')) return 'anuncio'
  if (video.paused) {
    video.muted = false
    video.play().catch(() => document.querySelector('.ytp-play-button')?.click())
    return null
  }
  return 'sonando'
}

function readGmail() {
  const visible = (el) => el && el.offsetParent !== null
  const subject = document.querySelector('h2.hP')?.innerText?.trim()
  const bodies = [...document.querySelectorAll('div.a3s')].filter(visible)
  if (!subject || !bodies.length) return { ok: false, text: 'Abrí un mail en Gmail y pedímelo de nuevo.' }
  const senders = [...document.querySelectorAll('span.gD')].map((s) => s.getAttribute('name') || s.innerText)
  const MAX = 30000
  let text = bodies[bodies.length - 1].innerText.trim()
  const truncated = text.length > MAX
  if (truncated) text = text.slice(0, MAX)
  return { ok: true, kind: 'mail', subject, sender: senders[senders.length - 1] || '', text, truncated }
}

function readPage() {
  const root = document.querySelector('article, main, [role=main]') || document.body
  const MAX = 30000
  let text = (root.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
  const truncated = text.length > MAX
  if (truncated) text = text.slice(0, MAX)
  if (!text) return { ok: false, text: 'Esta página no tiene texto para leer.' }
  return { ok: true, kind: 'pagina', title: document.title, url: location.href, text, truncated }
}
