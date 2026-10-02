// La lista cerrada de acciones de Pixie. Solo se puede ejecutar lo que está acá.
// Cada acción tiene: name, description, run(params, ctx) y, si es riesgosa,
// confirm: true y confirmText(params, ctx).
// Más adelante esta misma lista se le puede dar a una IA como herramientas.
import { infoActions } from './info.js'
import { openActions } from './open.js'
import { mediaActions } from './media.js'
import { systemActions } from './system.js'
import { timerActions } from './timers.js'
import { weatherActions } from './weather.js'
import { memoryActions, contextActions } from './memory.js'
import { browserActions } from './browser.js'
import { healthActions } from './health.js'
import { deviceActions } from './devices.js'
import { FriendlyError, BlockedError } from '../windows.js'
import { BrowserError } from '../browser.js'

const ALL = [
  ...infoActions,
  ...openActions,
  ...mediaActions,
  ...systemActions,
  ...timerActions,
  ...weatherActions,
  ...memoryActions,
  ...contextActions,
  ...browserActions,
  ...healthActions,
  ...deviceActions
]

export const actions = Object.fromEntries(ALL.map((a) => [a.name, a]))

// Si recién tocaste la música, Pixie no la pausa para hablar
const MEDIA_ACTIONS = new Set(['musica', 'youtube', 'volumen', 'que_suena'])

export async function runAction(name, params, ctx) {
  const action = actions[name]
  if (!action) return { text: 'Eso todavía no lo sé hacer.', face: 'confused' }
  if (MEDIA_ACTIONS.has(name) || (name === 'buscar' && params?.sitio === 'youtube')) ctx.mediaTouchedAt = Date.now()
  try {
    const result = await action.run(params ?? {}, ctx)
    ctx.log(`${name} ${JSON.stringify(params ?? {})} → ${result.text}`)
    return result
  } catch (err) {
    if (err instanceof BlockedError) {
      ctx.log(`BLOQUEADO (${err.categoria}): ${name} ${JSON.stringify(params ?? {})}`)
      return { text: err.message, face: 'angry', blocked: err.categoria }
    }
    ctx.log(`${name} ${JSON.stringify(params ?? {})} → error: ${err.message}`)
    if (err instanceof FriendlyError || err instanceof BrowserError) return { text: err.message, face: 'confused' }
    console.error(err)
    return { text: 'Algo salió mal al hacerlo. Probá de nuevo.', face: 'confused' }
  }
}
