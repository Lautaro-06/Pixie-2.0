// Lo que Pixie sabe abrir. Para sumar algo, agregalo acá o en config.json
// (en la sección "apps", con el mismo formato).

export const APPS = [
  { nombre: 'Bloc de notas', alias: ['bloc de notas', 'notepad', 'notas'], abrir: { tipo: 'start', valor: 'notepad.exe' }, proceso: 'notepad.exe' },
  { nombre: 'Calculadora', alias: ['calculadora', 'calc'], abrir: { tipo: 'uri', valor: 'ms-calculator:' }, proceso: 'CalculatorApp.exe' },
  { nombre: 'Paint', alias: ['paint'], abrir: { tipo: 'start', valor: 'mspaint.exe' }, proceso: 'mspaint.exe' },
  { nombre: 'Explorador de archivos', alias: ['explorador', 'explorador de archivos', 'archivos'], abrir: { tipo: 'start', valor: 'explorer.exe' } },
  { nombre: 'Configuración de Windows', alias: ['configuracion', 'configuracion de windows', 'ajustes de windows'], abrir: { tipo: 'uri', valor: 'ms-settings:' } },
  { nombre: 'Administrador de tareas', alias: ['administrador de tareas', 'task manager'], abrir: { tipo: 'start', valor: 'taskmgr.exe' } },
  { nombre: 'Cámara', alias: ['camara'], abrir: { tipo: 'uri', valor: 'microsoft.windows.camera:' }, proceso: 'WindowsCamera.exe' },
  { nombre: 'Chrome', alias: ['chrome', 'google chrome'], abrir: { tipo: 'start', valor: 'chrome' }, proceso: 'chrome.exe' },
  { nombre: 'Edge', alias: ['edge', 'microsoft edge'], abrir: { tipo: 'start', valor: 'msedge' }, proceso: 'msedge.exe' },
  { nombre: 'Firefox', alias: ['firefox'], abrir: { tipo: 'start', valor: 'firefox' }, proceso: 'firefox.exe' },
  { nombre: 'Spotify', alias: ['spotify'], abrir: { tipo: 'uri', valor: 'spotify:' }, proceso: 'Spotify.exe' },
  { nombre: 'Discord', alias: ['discord'], abrir: { tipo: 'uri', valor: 'discord://' }, proceso: 'Discord.exe' },
  { nombre: 'Steam', alias: ['steam'], abrir: { tipo: 'uri', valor: 'steam://open/main' }, proceso: 'steam.exe' },
  { nombre: 'WhatsApp', alias: ['whatsapp', 'wpp'], abrir: { tipo: 'uri', valor: 'whatsapp:' }, proceso: 'WhatsApp.exe' },
  { nombre: 'Visual Studio Code', alias: ['visual studio code', 'vscode', 'vs code', 'code'], abrir: { tipo: 'uri', valor: 'vscode:' }, proceso: 'Code.exe' },
  { nombre: 'Word', alias: ['word'], abrir: { tipo: 'start', valor: 'winword' }, proceso: 'WINWORD.EXE' },
  { nombre: 'Excel', alias: ['excel'], abrir: { tipo: 'start', valor: 'excel' }, proceso: 'EXCEL.EXE' },
  { nombre: 'PowerPoint', alias: ['powerpoint', 'power point'], abrir: { tipo: 'start', valor: 'powerpnt' }, proceso: 'POWERPNT.EXE' }
]

export const SITES = [
  { nombre: 'YouTube', alias: ['youtube', 'yt'], url: 'https://www.youtube.com' },
  { nombre: 'Google', alias: ['google'], url: 'https://www.google.com' },
  { nombre: 'Gmail', alias: ['gmail', 'mail', 'correo', 'mi correo'], url: 'https://mail.google.com' },
  { nombre: 'Google Drive', alias: ['drive', 'google drive'], url: 'https://drive.google.com' },
  { nombre: 'Classroom', alias: ['classroom', 'google classroom'], url: 'https://classroom.google.com' },
  { nombre: 'WhatsApp Web', alias: ['whatsapp web'], url: 'https://web.whatsapp.com' },
  { nombre: 'GitHub', alias: ['github'], url: 'https://github.com' },
  { nombre: 'Netflix', alias: ['netflix'], url: 'https://www.netflix.com' },
  { nombre: 'Instagram', alias: ['instagram', 'insta'], url: 'https://www.instagram.com' },
  { nombre: 'Twitch', alias: ['twitch'], url: 'https://www.twitch.tv' },
  { nombre: 'Wikipedia', alias: ['wikipedia'], url: 'https://es.wikipedia.org' },
  { nombre: 'Mercado Libre', alias: ['mercado libre', 'mercadolibre'], url: 'https://www.mercadolibre.com.ar' }
]

// Carpetas del usuario (nombres de app.getPath de Electron).
export const FOLDERS = [
  { nombre: 'Descargas', alias: ['descargas', 'carpeta de descargas'], clave: 'downloads' },
  { nombre: 'Documentos', alias: ['documentos', 'carpeta de documentos'], clave: 'documents' },
  { nombre: 'Escritorio', alias: ['escritorio'], clave: 'desktop' },
  { nombre: 'Imágenes', alias: ['imagenes', 'fotos', 'carpeta de imagenes'], clave: 'pictures' },
  { nombre: 'Música', alias: ['musica', 'carpeta de musica'], clave: 'music' },
  { nombre: 'Videos', alias: ['videos', 'carpeta de videos'], clave: 'videos' }
]

const PREFIXES = /^(la |el |los |las |mi |mis |app |aplicacion |programa |pagina de |pagina |sitio de |web de |carpeta de |carpeta )+/

const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function findByAlias(list, name) {
  return list.find((item) => (item.alias ?? []).some((a) => fold(a) === name)) ?? null
}

// Busca qué quiso abrir la persona. Devuelve { tipo, item } o null.
export function resolveTarget(rawName, customApps = []) {
  const name = fold(rawName).replace(PREFIXES, '').trim()
  const folder = findByAlias(FOLDERS, name)
  if (folder) return { tipo: 'carpeta', item: folder }
  const site = findByAlias(SITES, name)
  if (site) return { tipo: 'sitio', item: site }
  const app = findByAlias([...customApps, ...APPS], name)
  if (app) return { tipo: 'app', item: app }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(name)) {
    return { tipo: 'sitio', item: { nombre: name, url: `https://${name}` } }
  }
  return null
}
