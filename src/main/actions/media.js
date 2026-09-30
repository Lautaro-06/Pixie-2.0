import { pressKey, KEYS } from '../windows.js'

export const mediaActions = [
  {
    name: 'volumen',
    description: 'Sube, baja o silencia el volumen',
    run: async ({ cambio, pasos = 5 }) => {
      if (cambio === 'silenciar') {
        await pressKey(KEYS.mute)
        return { text: 'Listo, silencio (o sonido de nuevo, si ya estaba silenciado).', face: 'happy' }
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
      return { text: text ?? 'Listo.', face: 'happy' }
    }
  }
]
