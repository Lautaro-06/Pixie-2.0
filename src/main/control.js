// Cómo Pixie usa tus apps: entiende atajos dichos con palabras, sabe los atajos comunes de cada
// programa, elige el botón que nombrás y decide qué conviene preguntar antes. No toca Windows:
// eso lo hacen las manos (hands.js).

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

// Teclas virtuales de Windows, con sus nombres en castellano y en inglés
const KEYS = {
  ctrl: 0x11, control: 0x11, contrl: 0x11, shift: 0x10, mayus: 0x10, mayuscula: 0x10, alt: 0x12, altgr: 0x12,
  win: 0x5b, windows: 0x5b, enter: 0x0d, intro: 0x0d, entrar: 0x0d, esc: 0x1b, escape: 0x1b, tab: 0x09, tabulador: 0x09,
  backspace: 0x08, borrar: 0x08, retroceso: 0x08, delete: 0x2e, suprimir: 0x2e, supr: 0x2e, del: 0x2e,
  space: 0x20, espacio: 0x20, barra: 0x20, up: 0x26, arriba: 0x26, down: 0x28, abajo: 0x28, left: 0x25, izquierda: 0x25,
  right: 0x27, derecha: 0x27, home: 0x24, inicio: 0x24, end: 0x23, fin: 0x23, pageup: 0x21, repag: 0x21, pagedown: 0x22,
  avpag: 0x22, insert: 0x2d, insertar: 0x2d, mas: 0xbb, plus: 0xbb, menos: 0xbd, minus: 0xbd
}
const MODIFIERS = new Set([0x11, 0x10, 0x12, 0x5b])
const LABELS = { 0x11: 'Ctrl', 0x10: 'Shift', 0x12: 'Alt', 0x5b: 'Windows', 0x0d: 'Enter', 0x1b: 'Esc', 0x09: 'Tab', 0x08: 'Borrar', 0x2e: 'Supr', 0x20: 'Espacio', 0x26: '↑', 0x28: '↓', 0x25: '←', 0x27: '→', 0x24: 'Inicio', 0x23: 'Fin', 0x21: 'RePág', 0x22: 'AvPág', 0x2d: 'Insert', 0xbb: '+', 0xbd: '-' }

function keyOf(word) {
  if (word in KEYS) return KEYS[word]
  if (/^[a-zñ]$/.test(word) && word !== 'ñ') return word.toUpperCase().charCodeAt(0)
  if (/^[0-9]$/.test(word)) return 0x30 + Number(word)
  const f = /^f([1-9]|1[0-2])$/.exec(word)
  if (f) return 0x6f + Number(f[1])
  return null
}

export function comboLabel(vks) {
  return vks.map((vk) => LABELS[vk] ?? (vk >= 0x70 && vk <= 0x7b ? `F${vk - 0x6f}` : String.fromCharCode(vk))).join('+')
}

// "control s", "Ctrl+Shift+T", "alt f4", "flecha abajo", "la tecla enter" → { teclas, nombre } o null
export function parseCombo(text) {
  const t = fold(text)
    .replace(/\b(av|avance) ?pag(ina)?\b/g, 'avpag')
    .replace(/\b(re|retroceso) ?pag(ina)?\b/g, 'repag')
    .replace(/\b(la |las |una )?(tecla|teclas|flecha|flechita|boton de|el|la|juntas?|a la vez|al mismo tiempo)\b/g, ' ')
    .replace(/\by\b(?= \S)/g, ' ') // "control y shift": la y es un «y»; al final ("control y") es la tecla Y
    .replace(/[+,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  const words = t.split(' ')
  if (words.length > 5) return null
  const keys = []
  for (const w of words) {
    const vk = keyOf(w)
    if (vk === null) return null
    if (!keys.includes(vk)) keys.push(vk)
  }
  const mods = keys.filter((k) => MODIFIERS.has(k))
  const rest = keys.filter((k) => !MODIFIERS.has(k))
  if (!rest.length && !(mods.length === 1 && mods[0] === 0x5b)) return null // solo Ctrl o Shift no hacen nada
  if (rest.length > 2) return null
  const teclas = [...mods, ...rest]
  return { teclas, nombre: comboLabel(teclas) }
}

// Lo de todos los días, dicho con palabras. office: en Word/Excel/PowerPoint en castellano los atajos
// cambian (Ctrl+G guarda, Ctrl+N es negrita), así que ahí se toca el botón por su nombre.
const NAMED = {
  guardar: { teclas: ['ctrl', 's'], office: ['Guardar', 'Save'], dicho: 'Guardado' },
  copiar: { teclas: ['ctrl', 'c'], dicho: 'Copiado' },
  pegar: { teclas: ['ctrl', 'v'], dicho: 'Pegado' },
  cortar: { teclas: ['ctrl', 'x'], dicho: 'Cortado' },
  deshacer: { teclas: ['ctrl', 'z'], dicho: 'Deshecho' },
  rehacer: { teclas: ['ctrl', 'y'], dicho: 'Rehecho' },
  'seleccionar todo': { teclas: ['ctrl', 'a'], dicho: 'Seleccioné todo' },
  imprimir: { teclas: ['ctrl', 'p'], dicho: 'Abrí imprimir' },
  'buscar en la pagina': { teclas: ['ctrl', 'f'], office: ['Buscar', 'Find'], dicho: 'Abrí el buscador' },
  'nueva pestaña': { teclas: ['ctrl', 't'], dicho: 'Pestaña nueva' },
  'cerrar pestaña': { teclas: ['ctrl', 'w'], dicho: 'Cerré la pestaña' },
  'reabrir pestaña': { teclas: ['ctrl', 'shift', 't'], dicho: 'Volví a abrir la pestaña' },
  'siguiente pestaña': { teclas: ['ctrl', 'tab'], dicho: 'Listo' },
  'pestaña anterior': { teclas: ['ctrl', 'shift', 'tab'], dicho: 'Listo' },
  'nueva ventana': { teclas: ['ctrl', 'n'], dicho: 'Ventana nueva' },
  recargar: { teclas: ['f5'], dicho: 'Recargué' },
  atras: { teclas: ['alt', 'left'], dicho: 'Volví atrás' },
  adelante: { teclas: ['alt', 'right'], dicho: 'Fui para adelante' },
  'pantalla completa': { teclas: ['f11'], dicho: 'Listo' },
  acercar: { teclas: ['ctrl', 'mas'], dicho: 'Acerqué' },
  alejar: { teclas: ['ctrl', 'menos'], dicho: 'Alejé' },
  negrita: { teclas: ['ctrl', 'b'], office: ['Negrita', 'Bold'], dicho: 'Negrita' },
  cursiva: { teclas: ['ctrl', 'i'], office: ['Cursiva', 'Italic'], dicho: 'Cursiva' },
  subrayado: { teclas: ['ctrl', 'u'], office: ['Subrayado', 'Underline'], dicho: 'Subrayado' },
  'cambiar de ventana': { teclas: ['alt', 'tab'], dicho: 'Listo' },
  'mostrar escritorio': { teclas: ['win', 'd'], dicho: 'Listo' },
  'recortar pantalla': { teclas: ['win', 'shift', 's'], dicho: 'Elegí qué parte recortar' },
  enter: { teclas: ['enter'], dicho: 'Listo' }
}
export const SHORTCUT_NAMES = Object.keys(NAMED)
const NAMED_FOLDED = Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [fold(k), v]))
const OFFICE = /^(winword|excel|powerpnt|onenote|outlook)$/i

// Qué hacer para «guardá» en esta app: { teclas, nombre, dicho } o { botones, teclas, dicho }
export function shortcutFor(name, proceso = '') {
  const n = NAMED_FOLDED[fold(name)]
  if (!n) return null
  const teclas = n.teclas.map(keyOf)
  if (n.office && OFFICE.test(proceso)) return { botones: n.office, teclas, nombre: comboLabel(teclas), dicho: n.dicho }
  return { teclas, nombre: comboLabel(teclas), dicho: n.dicho }
}

// Atajos que pueden hacer perder algo: se pregunta antes
export function risky(teclas) {
  const set = new Set(teclas)
  if (set.has(0x12) && set.has(0x73)) return 'cerrar la ventana' // Alt+F4
  if (set.has(0x10) && set.has(0x2e)) return 'borrar sin pasar por la papelera' // Shift+Supr
  return null
}

// ───────────── Elegir el botón que nombraste ─────────────

const CLICKABLE = new Set(['Button', 'MenuItem', 'Hyperlink', 'TabItem', 'ListItem', 'CheckBox', 'RadioButton', 'SplitButton', 'TreeItem', 'ComboBox', 'MenuBar'])
const FILLER = /\b(el|la|los|las|un|una|del|de la|boton|botoncito|opcion|pestana|link|enlace|menu|icono|item|que dice|donde dice|llamad[oa]|que se llama)\b/g

// elements: [{ id, nombre, tipo, x, y, habilitado }] → el mejor para lo que pediste (o null)
export function bestElement(elements, query) {
  const q = fold(query).replace(FILLER, ' ').replace(/[«»"'¿?¡!.:]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!q) return null
  const qWords = q.split(' ')
  let best = null
  for (const el of elements ?? []) {
    const n = fold(el.nombre).replace(/[«»"'¿?¡!.:]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!n) continue
    let score = 0
    if (n === q) score = 100
    else if (n.startsWith(`${q} `) || n.startsWith(q)) score = 80
    else if (` ${n} `.includes(` ${q} `)) score = 70
    else if (n.includes(q)) score = 60
    else if (qWords.every((w) => n.includes(w))) score = 50
    else if (n.length >= 3 && q.includes(n)) score = 40
    else {
      const hits = qWords.filter((w) => w.length > 2 && n.includes(w)).length
      score = hits ? (hits / qWords.length) * 35 : 0
    }
    if (!score) continue
    if (CLICKABLE.has(el.tipo)) score += 10
    else if (/^(Text|Image|Pane|Group|Custom|Document|Window)$/.test(el.tipo)) score -= 8
    if (el.habilitado === false) score -= 30
    score -= Math.min(10, Math.max(0, n.length - q.length) / 10) // entre parecidos, el nombre más corto
    if (!best || score > best.score) best = { ...el, score }
  }
  return best && best.score >= 40 ? best : null
}

// Para contarle a la IA (o a vos) qué se puede tocar: los nombres sin repetir, primero los botones
export function elementNames(elements, max = 60) {
  const seen = new Set()
  const sorted = [...(elements ?? [])].sort((a, b) => Number(CLICKABLE.has(b.tipo)) - Number(CLICKABLE.has(a.tipo)))
  const out = []
  for (const el of sorted) {
    const name = String(el.nombre).trim().slice(0, 60)
    const key = fold(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

// La ventana de esa app entre las abiertas: por nombre del programa o por título
export function findWindow(windows, query, proceso = null) {
  const q = fold(query)
  const p = proceso ? fold(proceso).replace(/\.exe$/, '') : null
  return (
    (windows ?? []).find((w) => p && fold(w.proceso) === p) ??
    (windows ?? []).find((w) => fold(w.proceso) === q) ??
    (windows ?? []).find((w) => q.length >= 3 && fold(w.titulo).includes(q)) ??
    null
  )
}

// El texto exacto que pediste escribir, con mayúsculas, tildes y signos ("escribí: Hola, ¿cómo andás?")
export function textToWrite(input, cutFollowUp = false) {
  const m = /^\s*(?:pixie[\s,]*)?(?:escrib[ií]|escribe|escribir|escribime|tipe[aá]|tipear|tipeame|pon[eé] que diga|escrib[ií] que dice)\s*:?\s+(?:esto:?\s+|lo siguiente:?\s+|que diga:?\s+|ac[aá]:?\s+)?([\s\S]+)$/i.exec(String(input ?? ''))
  if (!m) return null
  let text = m[1]
  if (cutFollowUp) {
    text = text.replace(/\s*(?:,\s*|\s+y\s+)(?:despu[eé]s\s+|luego\s+)?(?:apret[aá]|presion[aá]|puls[aá]|dale\s+(?:a\s+)?enter|guard[aá](?:lo|la)?|mand[aá](?:lo|la)|envi[aá](?:lo|la)|enter)(?=[\s,.!?]|$)[\s\S]*$/i, '')
  }
  return text.trim().replace(/^[«"“]\s*/, '').replace(/\s*[»"”]$/, '') || null
}
