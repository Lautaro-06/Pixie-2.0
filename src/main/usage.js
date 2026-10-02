// Qué tipo de cosa estás haciendo según la ventana activa, y resúmenes de uso.

export const CATEGORY_NAMES = {
  estudio: 'estudio y trabajo',
  video: 'videos',
  redes: 'redes sociales',
  musica: 'música',
  mensajes: 'mensajes',
  juego: 'juegos',
  reunion: 'reuniones y llamadas',
  web: 'navegar',
  otros: 'otras cosas'
}

const BY_TITLE = [
  [/zoom meeting|reuni[oó]n de zoom|zoom webinar/i, 'reunion', 'Zoom'],
  [/^meet\s*[-–]\s|google meet/i, 'reunion', 'Google Meet'],
  [/(reuni[oó]n|meeting|llamada|call)\b.*microsoft teams/i, 'reunion', 'Teams'],
  [/youtube/i, 'video', 'YouTube'],
  [/netflix/i, 'video', 'Netflix'],
  [/twitch/i, 'video', 'Twitch'],
  [/disney\+|prime video|star\+|max\b/i, 'video', 'streaming'],
  [/instagram/i, 'redes', 'Instagram'],
  [/tiktok/i, 'redes', 'TikTok'],
  [/twitter| \/ x\b|^x\b/i, 'redes', 'X'],
  [/facebook/i, 'redes', 'Facebook'],
  [/reddit/i, 'redes', 'Reddit'],
  [/whatsapp/i, 'mensajes', 'WhatsApp'],
  [/classroom/i, 'estudio', 'Classroom'],
  [/google docs|documentos de google|google sheets|hojas de c[aá]lculo de google|google slides/i, 'estudio', 'Google Docs'],
  [/wikipedia/i, 'estudio', 'Wikipedia'],
  [/moodle|campus/i, 'estudio', 'Campus'],
  [/github|stack ?overflow|mdn/i, 'estudio', 'programación'],
  [/chatgpt|claude/i, 'estudio', 'IA']
]

const BY_PROCESS = {
  winword: ['estudio', 'Word'],
  excel: ['estudio', 'Excel'],
  powerpnt: ['estudio', 'PowerPoint'],
  onenote: ['estudio', 'OneNote'],
  code: ['estudio', 'VS Code'],
  devenv: ['estudio', 'Visual Studio'],
  idea64: ['estudio', 'IntelliJ'],
  acrord32: ['estudio', 'PDF'],
  acrobat: ['estudio', 'PDF'],
  notepad: ['estudio', 'Bloc de notas'],
  spotify: ['musica', 'Spotify'],
  discord: ['mensajes', 'Discord'],
  whatsapp: ['mensajes', 'WhatsApp'],
  telegram: ['mensajes', 'Telegram'],
  steam: ['juego', 'Steam'],
  robloxplayerbeta: ['juego', 'Roblox'],
  'league of legends': ['juego', 'League of Legends'],
  valorant: ['juego', 'Valorant'],
  fortniteclient: ['juego', 'Fortnite'],
  minecraft: ['juego', 'Minecraft'],
  javaw: ['juego', 'Minecraft']
}

const BROWSERS = new Set(['chrome', 'msedge', 'firefox', 'opera', 'brave', 'vivaldi'])
const IGNORED = new Set(['pixie', 'electron', 'explorer', 'searchhost', 'shellexperiencehost', 'lockapp', ''])

// ventana: { titulo, proceso, pantallaCompleta } → { categoria, app } o null si no cuenta
export function categorize(ventana) {
  if (!ventana) return null
  const proceso = String(ventana.proceso ?? '').toLowerCase()
  const titulo = String(ventana.titulo ?? '')
  if (IGNORED.has(proceso)) return null
  for (const [re, categoria, app] of BY_TITLE) if (re.test(titulo)) return { categoria, app }
  if (BY_PROCESS[proceso]) {
    const [categoria, app] = BY_PROCESS[proceso]
    return { categoria, app }
  }
  if (BROWSERS.has(proceso)) return { categoria: 'web', app: 'navegador' }
  // Las apps nuevas de Windows (Calculadora, Configuración) comparten proceso: se usa el título
  if (proceso === 'applicationframehost') return { categoria: 'otros', app: titulo || 'una app de Windows' }
  if (ventana.pantallaCompleta) return { categoria: 'juego', app: ventana.proceso }
  return { categoria: 'otros', app: ventana.proceso || 'otra app' }
}

export function durationText(seconds) {
  const total = Math.round(seconds / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h} h ${m} min`
  if (h) return `${h} h`
  return `${m} min`
}

// "Hoy usaste la compu 2 h 10 min: 1 h en estudio y trabajo, 45 min en videos…"
export function summarizeUsage(day, { buscar } = {}) {
  if (!day || day.total < 60) return 'Hoy casi no usaste la compu todavía.'
  if (buscar) {
    const q = buscar.toLowerCase()
    const app = Object.keys(day.apps).find((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))
    const cat = Object.keys(CATEGORY_NAMES).find((c) => CATEGORY_NAMES[c].includes(q) || q.includes(c))
    if (app) return `Hoy estuviste ${durationText(day.apps[app])} en ${app}.`
    if (cat && day.categorias[cat]) return `Hoy estuviste ${durationText(day.categorias[cat])} en ${CATEGORY_NAMES[cat]}.`
    return `Hoy no te vi en ${buscar}.`
  }
  const parts = Object.entries(day.categorias)
    .filter(([, s]) => s >= 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c, s]) => `${durationText(s)} en ${CATEGORY_NAMES[c] ?? c}`)
  return `Hoy usaste la compu ${durationText(day.total)}: ${parts.join(', ')}.`
}
