// Sonidos de Pixie: bips sintetizados (no hay archivos de audio), como un robotito.
// Cada sonido es una lista de notas: [frecuencia, duración en ms, frecuencia final (opcional)].

const SOUNDS = {
  boot: { wave: 'square', notes: [[523, 70], [659, 70], [784, 70], [1047, 160]] },
  happy: { wave: 'square', notes: [[784, 70], [1047, 110]] },
  love: { wave: 'sine', notes: [[659, 120], [880, 200]] },
  laugh: { wave: 'square', notes: [[880, 55], [740, 55], [880, 55], [740, 55], [988, 90]] },
  surprised: { wave: 'sine', notes: [[400, 180, 1200]] },
  sad: { wave: 'triangle', notes: [[523, 180, 392], [440, 260, 311]] },
  confused: { wave: 'triangle', notes: [[600, 140, 750], [750, 160, 520]] },
  angry: { wave: 'sawtooth', notes: [[180, 90], [150, 140]] },
  wink: { wave: 'sine', notes: [[1175, 60], [1568, 80]] },
  music: { wave: 'triangle', notes: [[659, 90], [784, 90], [988, 140]] },
  notice: { wave: 'sine', notes: [[988, 90], [1319, 160]] },
  wake: { wave: 'sine', notes: [[440, 120, 880]] }
}

let ctx = null
const VOLUME = 0.07

export function hasSound(name) {
  return name in SOUNDS
}

export function playSound(name) {
  const sound = SOUNDS[name]
  if (!sound) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    let at = ctx.currentTime + 0.01
    for (const [freq, ms, to] of sound.notes) {
      const end = at + ms / 1000
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = sound.wave
      osc.frequency.setValueAtTime(freq, at)
      if (to) osc.frequency.exponentialRampToValueAtTime(to, end)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(VOLUME, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(end + 0.02)
      at = end
    }
  } catch {
    // sin audio: no pasa nada
  }
}
