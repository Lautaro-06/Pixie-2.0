// Salud: vasos de agua, pausas para estirarse y respaldo de la memoria.
import { durationText } from '../usage.js'

const GOAL = 8 // vasos por día

export const healthActions = [
  {
    name: 'registrar_agua',
    description: 'Anota que tomaste agua',
    run: ({ vasos }, ctx) => {
      const n = Math.max(1, Math.min(10, Number(vasos) || 1))
      const { agua } = ctx.memory.addWater(new Date(), n)
      const total = `${agua} ${agua === 1 ? 'vaso' : 'vasos'}`
      if (agua >= GOAL) return { text: `¡${total} hoy! Cumpliste el objetivo del día.`, face: 'love' }
      return { text: `¡Bien! Van ${total} hoy. Te ${GOAL - agua === 1 ? 'falta uno' : `faltan ${GOAL - agua}`} para los ${GOAL}.`, face: 'happy' }
    }
  },
  {
    name: 'registrar_pausa',
    description: 'Anota que hiciste una pausa para estirarte',
    run: (_params, ctx) => {
      const { pausas } = ctx.memory.addBreak(new Date())
      return { text: `¡Bien ahí! ${pausas === 1 ? 'Primera pausa del día.' : `Ya van ${pausas} pausas hoy.`} Tu espalda te lo agradece.`, face: 'happy' }
    }
  },
  {
    name: 'ver_salud',
    description: 'Cuánta agua tomaste y cuántas pausas hiciste hoy',
    run: (_params, ctx) => {
      const now = new Date()
      const { agua, pausas } = ctx.memory.getHealth(now)
      const uso = ctx.memory.getUsage(now).total
      const parts = [`Hoy tomaste ${agua} ${agua === 1 ? 'vaso' : 'vasos'} de agua de ${GOAL} e hiciste ${pausas} ${pausas === 1 ? 'pausa' : 'pausas'}.`]
      if (uso >= 600) parts.push(`Llevás ${durationText(uso)} en la compu.`)
      if (agua < GOAL / 2 && now.getHours() >= 15) parts.push('¡Tomá un poco más de agua!')
      return { text: parts.join(' '), face: agua >= GOAL / 2 ? 'happy' : 'surprised', suggestions: ['tomé agua'] }
    }
  },
  {
    name: 'respaldar',
    description: 'Guarda una copia de la memoria de Pixie (en la nube si hay OneDrive)',
    run: (_params, ctx) => {
      const r = ctx.backup.backup()
      if (!r.ok) return { text: `No pude guardar la copia: ${r.error}.`, face: 'confused' }
      if (r.cloud) return { text: `Listo, guardé una copia de mis recuerdos en ${r.cloudName}, en la carpeta Pixie.`, face: 'happy' }
      return {
        text: 'Guardé una copia en la compu. Para que también quede en la nube, iniciá sesión en OneDrive o decime la carpeta en config.json («carpetaRespaldo»).',
        face: 'happy'
      }
    }
  }
]
