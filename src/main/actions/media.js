import { pressKey, KEYS } from '../windows.js'
import { appName } from '../media-session.js'

export const mediaActions = [
  {
    name: 'volumen',
    description: 'Sube, baja o silencia el volumen',
    run: async ({ cambio, pasos = 5, valor }) => {
      if (cambio === 'silenciar') {
        await pressKey(KEYS.mute)
        return { text: 'Listo, silencio (o sonido de nuevo, si ya estaba silenciado).', face: 'happy' }
      }
      // "volumen al 50": lo baja del todo y lo sube hasta ahí (cada tecla es 2 %)
      if (cambio === 'poner') {
        const target = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)))
        await pressKey(KEYS.volumeDown, 50)
        if (target > 0) await pressKey(KEYS.volumeUp, Math.round(target / 2))
        return { text: `Volumen al ${target}%.`, face: 'happy' }
      }
      await pressKey(cambio === 'subir' ? KEYS.volumeUp : KEYS.volumeDown, pasos)
      return { text: cambio === 'subir' ? 'Subí el volumen.' : 'Bajé el volumen.', face: 'happy' }
    }
  },
  {
    name: 'musica',
    description: 'Pausa, reanuda o cambia de canción',
    run: async ({ control }) => {
      const key = { siguiente: KEYS.next, anterior: KEYS.previous, pausa: KEYS.playPause }[control]
      await pressKey(key ?? KEYS.playPause)
      const text = { siguiente: 'Siguiente tema.', anterior: 'Tema anterior.', pausa: 'Listo: pausa o play.' }[control]
      return { text: text ?? 'Listo.', face: 'music' }
    }
  },
  {
    name: 'que_suena',
    description: 'Dice qué canción o video está sonando',
    run: async (_params, ctx) => {
      const now = ctx.media ? await ctx.media.info() : null
      if (!now) return { text: 'No escucho nada sonando ahora.', face: 'confused' }
      const who = now.artista ? ` de ${now.artista}` : ''
      const paused = now.estado === 'Paused' ? ' (está en pausa)' : ''
      return { text: `Está sonando «${now.titulo}»${who}, en ${appName(now.app)}${paused}.`, face: 'music' }
    }
  }
]
