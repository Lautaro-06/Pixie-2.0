// Diagnóstico: Pixie anota sus errores y arma un informe para mandarle al equipo.
// El informe nunca lleva claves, contraseñas ni números de teléfono.
import { appendFile, renameSync, statSync, openSync, readSync, closeSync } from 'node:fs'

const KEEP = 60 // errores que recuerda
const MAX_FILE_BYTES = 256 * 1024

// Tapa todo lo que parezca una clave o un dato personal
export function redact(text) {
  return String(text)
    .replace(/sk-ant-[\w-]{8,}/g, '[clave]')
    .replace(/AIza[\w-]{20,}/g, '[clave]')
    .replace(/\bAQ\.[\w-]{12,}/g, '[clave]')
    .replace(/gsk_[\w-]{12,}/g, '[clave]')
    .replace(/\b(apikey|api_key|key|token|password|contrase[nñ]a|clave\w*)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, '$1$2[oculto]')
    .replace(/\+\d[\d\s-]{8,}\d|\b\d{10,15}\b/g, '[número]')
}

// Lo último del historial que sirve para entender un problema: «Pixie, ¿estás?» (si te escuchó, a qué
// distancia, si se cerró el micrófono), lo que tardó en contestar, la IA, Classroom y la extensión.
// No lleva lo que le pediste guardar ni los WhatsApp.
const USEFUL = /palabra m[aá]gica|tard[eé]|\bIA\b|IA \(|classroom|extensi[oó]n de chrome|\bvoz:|micr[oó]fono/i
export function usefulLogLines(text, max = 40) {
  return String(text ?? '')
    .split('\n')
    .filter((l) => l.trim() && USEFUL.test(l))
    .slice(-max)
    .map((l) => l.replace(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d)\.\d+Z\s+/, '$1 $2  '))
}

// Los últimos bytes de un archivo (el historial puede ser grande)
export function tailFile(path, bytes = 96 * 1024) {
  let fd
  try {
    fd = openSync(path, 'r')
    const size = statSync(path).size
    const len = Math.min(bytes, size)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    const text = buf.toString('utf8')
    return len < size ? text.slice(text.indexOf('\n') + 1) : text
  } catch {
    return ''
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

function firstLines(stack) {
  if (!stack) return ''
  return String(stack)
    .split('\n')
    .slice(1, 4)
    .map((s) => s.trim())
    .join(' | ')
}

export function createDiagnostics({ file = null, now = () => new Date(), write = appendFile } = {}) {
  const errors = []

  function rotate() {
    try {
      if (statSync(file).size > MAX_FILE_BYTES) renameSync(file, `${file}.viejo`)
    } catch {
      // todavía no existe
    }
  }

  function record(source, err) {
    const message = redact(err?.message ?? String(err)).slice(0, 400)
    const entry = { when: now().toISOString(), source, message, where: redact(firstLines(err?.stack)) }
    errors.push(entry)
    if (errors.length > KEEP) errors.shift()
    if (file) {
      rotate()
      write(file, `${entry.when}  [${source}] ${message}${entry.where ? `  (${entry.where})` : ''}\n`, () => {})
    }
    return entry
  }

  // info: lo que sabe la app en este momento (versión, IA, voz…), en líneas de texto
  function report(info = [], log = []) {
    const lines = ['Informe de diagnóstico de Pixie', `Fecha: ${now().toISOString()}`, ...info, '']
    const last = errors.slice(-30)
    if (!last.length) lines.push('Errores: ninguno desde que arrancó.')
    else {
      lines.push(`Últimos errores (${last.length}):`)
      for (const e of last) lines.push(`- ${e.when.slice(0, 19).replace('T', ' ')} [${e.source}] ${e.message}${e.where ? `  (${e.where})` : ''}`)
    }
    if (log.length) lines.push('', `Lo último del historial (${log.length} renglones):`, ...log)
    return redact(lines.join('\n'))
  }

  return { record, report, list: () => [...errors] }
}
