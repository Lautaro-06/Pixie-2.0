// Las grabaciones de «Pixie, ¿estás?». Se guarda solo la huella de tu voz (números), nunca el audio,
// y queda en esta compu (no va al respaldo: en otra compu y con otro micrófono hay que grabarla de nuevo).
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

export const SENSITIVITIES = ['baja', 'normal', 'alta']
const COEFS = 12

// 3 a 5 grabaciones, cada una de 0,15 a 3 segundos (un vector cada 10 ms)
export function validTemplates(list) {
  return (
    Array.isArray(list) &&
    list.length >= 3 &&
    list.length <= 5 &&
    list.every(
      (t) => Array.isArray(t) && t.length >= 15 && t.length <= 300 && t.every((f) => Array.isArray(f) && f.length === COEFS && f.every(Number.isFinite))
    )
  )
}

const round = (list) => list.map((t) => t.map((f) => f.map((x) => Math.round(x * 1e4) / 1e4)))
const MAX_LEARNED = 6
const validTemplate = (t) => Array.isArray(t) && t.length >= 15 && t.length <= 320 && t.every((f) => Array.isArray(f) && f.length === COEFS && f.every(Number.isFinite))

export function createWakeStore({ file, getConfig, saveConfig, onChange = () => {} }) {
  let templates = null
  let stamp = null // cuándo se grabó: la ventanita la usa para saber si cambió la voz
  let learned = [] // las veces que la llamaste de verdad (las últimas 6)
  let learnedCount = 0
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (validTemplates(data.plantillas)) {
      templates = data.plantillas
      stamp = String(data.creada ?? 'grabada')
      learned = (data.aprendidas ?? []).filter(validTemplate).slice(-MAX_LEARNED)
    }
  } catch {
    // todavía no grabaste tu voz
  }

  const sensitivity = () => (SENSITIVITIES.includes(getConfig().sensibilidadPalabra) ? getConfig().sensibilidadPalabra : 'normal')
  const status = () => ({
    grabada: Boolean(templates),
    activa: Boolean(templates) && getConfig().palabraMagica !== false,
    sensibilidad: sensitivity()
  })

  return {
    status,
    templates: () => templates,
    // Lo que necesita la ventanita para escuchar
    forWindow: () => {
      const s = status()
      return { ...s, plantillas: s.activa ? templates : null, aprendidas: s.activa ? learned : [], huella: `${stamp}#${learnedCount}` }
    },
    // Te despertó y entendió lo que le pediste: esa forma de decirlo se suma a tus grabaciones
    learn(frames) {
      if (!templates || !validTemplate(frames)) return false
      learned = [...learned, ...round([frames])].slice(-MAX_LEARNED)
      learnedCount++
      writeFileSync(file, JSON.stringify({ version: 1, creada: stamp, plantillas: templates, aprendidas: learned }))
      onChange()
      return true
    },
    learnedCount: () => learned.length,
    save(list) {
      if (!validTemplates(list)) throw new Error('Las grabaciones no llegaron bien.')
      templates = round(list)
      learned = []
      stamp = new Date().toISOString()
      writeFileSync(file, JSON.stringify({ version: 1, creada: stamp, plantillas: templates }))
      saveConfig({ palabraMagica: true })
      onChange()
      return status()
    },
    forget() {
      templates = null
      learned = []
      stamp = null
      rmSync(file, { force: true })
      onChange()
      return status()
    },
    setActive(on) {
      saveConfig({ palabraMagica: Boolean(on) })
      onChange()
      return status()
    },
    setSensitivity(value) {
      if (SENSITIVITIES.includes(value)) {
        saveConfig({ sensibilidadPalabra: value })
        onChange()
      }
      return status()
    }
  }
}
