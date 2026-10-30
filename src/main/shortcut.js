// Atajos de teclado: pasa lo que escribe la persona ("control alt p", "ctrl+shift+espacio")
// al formato de Electron ("Control+Alt+P") y al revés, para mostrarlo.

const MODIFIERS = {
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  mayus: 'Shift',
  mayuscula: 'Shift',
  win: 'Super',
  windows: 'Super',
  super: 'Super'
}
const KEYS = { espacio: 'Space', space: 'Space', barra: 'Space', enter: 'Enter', intro: 'Enter', tab: 'Tab' }
const IGNORED = new Set(['y', 'mas', 'con', 'tecla', 'teclas', 'el', 'la', 'a', 'en', 'por', 'de', 'sea'])
const ORDER = ['Control', 'Alt', 'Shift', 'Super']

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Devuelve el atajo en formato de Electron, o null si no se entiende o no tiene Ctrl, Alt o Windows
export function parseShortcut(text) {
  const words = fold(text).replace(/[+,.«»"']/g, ' ').split(/\s+/).filter((w) => w && !IGNORED.has(w))
  const mods = new Set()
  let key = null
  for (const w of words) {
    if (MODIFIERS[w]) mods.add(MODIFIERS[w])
    else if (KEYS[w] && !key) key = KEYS[w]
    else if (/^f([1-9]|1[0-2])$/.test(w) && !key) key = w.toUpperCase()
    else if (/^[a-z0-9]$/.test(w) && !key) key = w.toUpperCase()
    else return null
  }
  // Sin Ctrl, Alt o Windows, el atajo se dispararía mientras escribís
  if (!key || !(mods.has('Control') || mods.has('Alt') || mods.has('Super'))) return null
  return [...ORDER.filter((m) => mods.has(m)), key].join('+')
}

// "Control+Shift+Space" → "Ctrl+Shift+Espacio"
export function shortcutText(accel) {
  return String(accel ?? '')
    .replace('Control', 'Ctrl')
    .replace('Space', 'Espacio')
    .replace('Super', 'Windows')
}
