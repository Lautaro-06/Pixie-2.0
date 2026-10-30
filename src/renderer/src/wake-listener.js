// Escucha el micrófono todo el tiempo esperando «Pixie, ¿estás?». El audio se analiza acá y se tira:
// no se graba ni se manda a ningún lado. Solo cuando te reconoce, Pixie empieza a escucharte de verdad.
import { createWakeDetector } from './wake.js'
import { downsample, isHandsFree, openMicrophone } from './audio.js'

export class HandsFreeError extends Error {}

export async function startWakeListener({ templates, sensibilidad, onWake, onCandidate, onLost = () => {} }) {
  const stream = await openMicrophone()
  // Con el micrófono de unos auriculares Bluetooth, escuchar todo el tiempo deja el sonido "de llamada"
  const label = stream.getAudioTracks()[0]?.label
  if (isHandsFree(label)) {
    stream.getTracks().forEach((t) => t.stop())
    throw new HandsFreeError(label)
  }
  // Si desenchufás el micrófono, avisa para volver a abrirlo
  stream.getAudioTracks()[0]?.addEventListener('ended', () => onLost())
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  let paused = false
  const detector = createWakeDetector({
    templates,
    sensibilidad,
    onCandidate,
    onWake: (info) => {
      if (!paused) onWake(info)
    }
  })
  proc.onaudioprocess = (e) => {
    if (!paused) detector.push(downsample(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate))
  }
  source.connect(proc)
  proc.connect(ctx.destination) // la salida queda en silencio: solo hace falta para que procese
  return {
    // Mientras Pixie habla o ya te está escuchando, no busca la frase
    pause() {
      paused = true
      detector.reset()
    },
    resume() {
      paused = false
      detector.reset()
    },
    stop() {
      paused = true
      proc.disconnect()
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      ctx.close()
    }
  }
}
