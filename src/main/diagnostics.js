// Diagnóstico: Pixie anota sus errores y arma un informe para mandarle al equipo.
// El informe nunca lleva claves, contraseñas ni números de teléfono.
import { appendFile, renameSync, statSync } from 'node:fs'

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
  function report(info = []) {
    const lines = ['Informe de diagnóstico de Pixie', `Fecha: ${now().toISOString()}`, ...info, '']
    const last = errors.slice(-30)
    if (!last.length) lines.push('Errores: ninguno desde que arrancó.')
    else {
      lines.push(`Últimos errores (${last.length}):`)
      for (const e of last) lines.push(`- ${e.when.slice(0, 19).replace('T', ' ')} [${e.source}] ${e.message}${e.where ? `  (${e.where})` : ''}`)
    }
    return redact(lines.join('\n'))
  }

  return { record, report, list: () => [...errors] }
}
