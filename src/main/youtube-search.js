// Busca un video en YouTube sin la extensión: lee la página de resultados (la
// misma que ve cualquiera) y saca el primer video. Si YouTube cambia su página
// y esto deja de andar, Pixie abre la búsqueda como antes.

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'accept-language': 'es-AR,es;q=0.9'
}

// Recorre los datos de la página y junta los videos en orden (sin en vivo ni Shorts)
export function videosFromData(data, max = 10) {
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object' || out.length >= max) return
    if (Array.isArray(node)) return node.forEach(walk)
    const v = node.videoRenderer
    if (v?.videoId && v.lengthText) {
      out.push({
        videoId: v.videoId,
        title: v.title?.runs?.map((r) => r.text).join('') ?? v.title?.simpleText ?? '',
        channel: v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text ?? ''
      })
      return
    }
    for (const value of Object.values(node)) walk(value)
  }
  walk(data)
  return out
}

export function parseResults(html) {
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s) ?? html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s)
  if (m) {
    try {
      const videos = videosFromData(JSON.parse(m[1]))
      if (videos.length) return videos
    } catch {
      // seguimos con el plan B
    }
  }
  const id = html.match(/"videoId":"([\w-]{11})"/)?.[1]
  return id ? [{ videoId: id, title: '', channel: '' }] : []
}

export async function findVideo(query, fetchImpl = (...a) => fetch(...a)) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`
  const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
  if (!res.ok) return null
  return parseResults(await res.text())[0] ?? null
}
