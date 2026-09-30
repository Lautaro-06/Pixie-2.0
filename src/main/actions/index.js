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
import { OnlyWindowsError } from '../windows.js'

const ALL = [...infoActions, ...openActions, ...mediaActions, ...systemActions, ...timerActions, ...weatherActions]

export const actions = Object.fromEntries(ALL.map((a) => [a.name, a]))

export async function runAction(name, params, ctx) {
  const action = actions[name]
  if (!action) return { text: 'Eso todavía no lo sé hacer.', face: 'confused' }
  try {
    const result = await action.run(params ?? {}, ctx)
    ctx.log(`${name} ${JSON.stringify(params ?? {})} → ${result.text}`)
    return result
  } catch (err) {
    ctx.log(`${name} ${JSON.stringify(params ?? {})} → error: ${err.message}`)
    if (err instanceof OnlyWindowsError) return { text: err.message, face: 'confused' }
    console.error(err)
    return { text: 'Algo salió mal al hacerlo. Probá de nuevo.', face: 'confused' }
  }
}
