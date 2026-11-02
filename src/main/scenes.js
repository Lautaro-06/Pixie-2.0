// Qué «disfraz» se pone Pixie según lo que estás haciendo en la compu:
//   cine        → anteojos 3D y pochoclos (YouTube, Netflix, Cuevana, Kick, Twitch, Instagram, TikTok…)
//   trabajando  → anteojos y la compu (Word, PowerPoint, Excel, Google Docs, Notion…)
//   programando → anteojos y la compu con </> (VS Code, Visual Studio, IntelliJ, la terminal…)
//   leyendo     → anteojos redondos y un libro (PDF, Wikipedia, Classroom, el campus…)
//   musica      → auriculares y notitas (Spotify, YouTube Music, Deezer…)
//   jugando     → un joystick (Steam, Roblox, Minecraft, Valorant, cualquier juego en pantalla completa…)
//   reunion     → auriculares con micrófono (Zoom, Meet, Teams)
//   chateando   → el celu (WhatsApp, Telegram, Discord…)
//   artista     → boina y pincel (Paint, Photoshop, Canva, Figma…)
// Solo mira el nombre del programa y el título de la ventana activa, y no guarda nada.

export const SCENES = ['cine', 'trabajando', 'programando', 'leyendo', 'musica', 'jugando', 'reunion', 'chateando', 'artista']

// Por el título de la ventana (sobre todo para lo que se usa en el navegador). Lo primero que coincide gana.
const BY_TITLE = [
  [/zoom meeting|reuni[oó]n de zoom|zoom webinar|^meet\s*[-–]\s|google meet|(reuni[oó]n|meeting|llamada|call)\b.*microsoft teams/i, 'reunion'],
  [/youtube music|spotify|deezer|soundcloud|apple music|tidal|amazon music|last\.fm|radio garden|bandcamp/i, 'musica'],
  [
    /youtube|netflix|twitch|kick\.com|\bkick\b|cuevana|pelisplus|repelis|gnula|pelis ?24|disney\+|disney plus|prime video|hbo|max\.com|star\+|paramount\+?|crunchyroll|pluto ?tv|\bflow\b|\bvix\b|mubi|apple tv|\bplex\b|tubi|dailymotion|vimeo|animeflv|jkanime|monoschinos|anime ?fenix|tioanime|zoro|9anime|rakuten|viki|directv|telefe|eltrece|tv p[uú]blica|f[uú]tbol libre|futbollibre|tele ?latino|instagram|tiktok|facebook watch|reels/i,
    'cine'
  ],
  [/whatsapp|messenger|telegram|discord/i, 'chateando'],
  [/canva|figma|photopea|pixlr|sketchup|tinkercad|piskel/i, 'artista'],
  [/github|gitlab|stack ?overflow|replit|codepen|codesandbox|w3schools|mdn web docs|vscode\.dev|leetcode|hackerrank|scratch\.mit/i, 'programando'],
  [/google docs|documentos de google|google sheets|hojas de c[aá]lculo de google|google slides|presentaciones de google|notion|overleaf|office\.com|word online|powerpoint online/i, 'trabajando'],
  [/\.pdf\b|wikipedia|classroom|moodle|campus|biblioteca|kindle|wattpad|z-library|scribd|academia\.edu|google scholar/i, 'leyendo'],
  [/poki|friv|y8\.com|chess\.com|lichess|krunker|slither\.io|agar\.io|geoguessr|wordle|minijuegos|roblox/i, 'jugando']
]

// Por el nombre del programa (en minúsculas, sin .exe)
const BY_PROCESS = {
  // cine
  vlc: 'cine', mpc: 'cine', 'mpc-hc': 'cine', 'mpc-hc64': 'cine', mpv: 'cine', potplayermini64: 'cine', potplayer: 'cine',
  stremio: 'cine', kodi: 'cine', plex: 'cine', netflix: 'cine', 'popcorn-time': 'cine', 'popcorntime': 'cine',
  'video.ui': 'cine', 'microsoft.media.player': 'cine', disneyplus: 'cine', primevideo: 'cine',
  // música
  spotify: 'musica', deezer: 'musica', tidal: 'musica', 'amazon music': 'musica', itunes: 'musica', applemusic: 'musica',
  winamp: 'musica', foobar2000: 'musica', aimp: 'musica', musicbee: 'musica', 'music.ui': 'musica', audacity: 'musica',
  'fl64': 'musica', fl: 'musica', 'ableton live': 'musica',
  // trabajando
  winword: 'trabajando', excel: 'trabajando', powerpnt: 'trabajando', onenote: 'trabajando', notepad: 'trabajando',
  'notepad++': 'trabajando', wordpad: 'trabajando', soffice: 'trabajando', 'soffice.bin': 'trabajando', swriter: 'trabajando',
  scalc: 'trabajando', simpress: 'trabajando', notion: 'trabajando', obsidian: 'trabajando', evernote: 'trabajando', outlook: 'trabajando',
  olk: 'trabajando', wps: 'trabajando', et: 'trabajando', wpp: 'trabajando',
  // programando
  code: 'programando', cursor: 'programando', devenv: 'programando', idea64: 'programando', pycharm64: 'programando',
  webstorm64: 'programando', studio64: 'programando', sublime_text: 'programando', eclipse: 'programando', netbeans64: 'programando',
  'arduino ide': 'programando', arduino: 'programando', windowsterminal: 'programando', cmd: 'programando', powershell: 'programando',
  pwsh: 'programando', 'github desktop': 'programando', githubdesktop: 'programando', postman: 'programando', unity: 'programando',
  godot: 'programando',
  // leyendo
  acrord32: 'leyendo', acrobat: 'leyendo', sumatrapdf: 'leyendo', foxitpdfreader: 'leyendo', foxitreader: 'leyendo',
  kindle: 'leyendo', calibre: 'leyendo', 'ebook-viewer': 'leyendo',
  // jugando
  steam: 'jugando', robloxplayerbeta: 'jugando', minecraft: 'jugando', javaw: 'jugando', 'minecraft.windows': 'jugando',
  valorant: 'jugando', 'valorant-win64-shipping': 'jugando', 'league of legends': 'jugando', fortniteclient: 'jugando',
  'fortniteclient-win64-shipping': 'jugando', epicgameslauncher: 'jugando', 'battle.net': 'jugando', cs2: 'jugando', csgo: 'jugando',
  gta5: 'jugando', rocketleague: 'jugando', fc25: 'jugando', fc24: 'jugando', eafc: 'jugando', brawlhalla: 'jugando',
  'among us': 'jugando', genshinimpact: 'jugando', overwatch: 'jugando', dota2: 'jugando', terraria: 'jugando', stardew: 'jugando',
  'stardew valley': 'jugando', geometrydash: 'jugando', osu: 'jugando', 'osu!': 'jugando', freefire: 'jugando', hollow_knight: 'jugando',
  // reunión
  zoom: 'reunion', 'ms-teams': 'reunion', teams: 'reunion', webex: 'reunion', skype: 'reunion',
  // chateando
  whatsapp: 'chateando', telegram: 'chateando', discord: 'chateando', signal: 'chateando', messenger: 'chateando',
  // artista
  mspaint: 'artista', photoshop: 'artista', illustrator: 'artista', 'gimp-2.10': 'artista', gimp: 'artista', krita: 'artista',
  clipstudiopaint: 'artista', paintdotnet: 'artista', figma: 'artista', aseprite: 'artista', blender: 'artista', inkscape: 'artista',
  canva: 'artista', 'adobe premiere pro': 'artista', afterfx: 'artista', resolve: 'artista', capcut: 'artista', filmora: 'artista',
  vegas: 'artista', 'vegas pro': 'artista', 'paint3d': 'artista', medibangpaintpro: 'artista', firealpaca: 'artista'
}

const IGNORED = new Set(['pixie', 'electron', 'explorer', 'searchhost', 'shellexperiencehost', 'lockapp', 'startmenuexperiencehost', ''])

// ventana: { titulo, proceso, pantallaCompleta } → una de SCENES o null (navegar, el escritorio, otras cosas)
export function sceneFor(ventana) {
  if (!ventana) return null
  const proceso = String(ventana.proceso ?? '').toLowerCase().replace(/\.exe$/, '')
  const titulo = String(ventana.titulo ?? '')
  if (IGNORED.has(proceso)) return null
  // En Teams o Zoom solo es reunión si hay una llamada (el título lo dice); si no, es chatear
  for (const [re, scene] of BY_TITLE) if (re.test(titulo)) return scene
  if (proceso === 'ms-teams' || proceso === 'teams' || proceso === 'zoom') return 'chateando'
  if (BY_PROCESS[proceso]) return BY_PROCESS[proceso]
  if (ventana.pantallaCompleta && proceso !== 'applicationframehost') return 'jugando'
  return null
}

// ¿Lo que suena es música? (para ponerse los auriculares mientras hacés otra cosa)
// media: { app, estado, artista } de lo que suena en Windows
export function musicPlaying(media) {
  if (!media || media.estado !== 'Playing') return false
  const app = String(media.app ?? '')
  if (/spotify|music|deezer|tidal|soundcloud|winamp|foobar|aimp|musicbee|itunes/i.test(app)) return true
  // En el navegador, si tiene artista (YouTube Music, un tema en YouTube)
  return /chrome|msedge|firefox|opera|brave/i.test(app) && Boolean(String(media.artista ?? '').trim())
}

// La escena que se ve: la de lo que tenés adelante; si no hay, y suena música, la de música.
// Con música de fondo mientras trabajás, además se pone los auriculares.
export function currentScene(ventana, media) {
  return combineScene(sceneFor(ventana), media)
}

export function combineScene(scene, media) {
  const music = musicPlaying(media)
  if (!scene) return { escena: music ? 'musica' : null, auris: false }
  return { escena: scene, auris: music && !['cine', 'musica', 'reunion'].includes(scene) }
}
