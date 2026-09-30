import os from 'node:os'
import { launch, lockScreen, shutdown } from '../windows.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

function cpuTimes() {
  return os.cpus().reduce(
    (acc, cpu) => {
      const t = cpu.times
      acc.idle += t.idle
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq
      return acc
    },
    { idle: 0, total: 0 }
  )
}

function uptimeText(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export const systemActions = [
  {
    name: 'bloquear_pc',
    description: 'Bloquea la compu (pide confirmación)',
    confirm: true,
    confirmText: () => '¿Bloqueo la compu?',
    run: async () => {
      await lockScreen()
      return { text: 'Compu bloqueada.', face: 'happy' }
    }
  },
  {
    name: 'apagar_pc',
    description: 'Apaga o reinicia la compu en 30 segundos (pide confirmación)',
    confirm: true,
    confirmText: ({ modo }) =>
      modo === 'reiniciar' ? '¿Reinicio la compu? Guardá lo que estés haciendo.' : '¿Apago la compu? Guardá lo que estés haciendo.',
    run: async ({ modo }) => {
      await shutdown(modo === 'reiniciar' ? 'reiniciar' : 'apagar')
      const what = modo === 'reiniciar' ? 'se reinicia' : 'se apaga'
      return { text: `La compu ${what} en 30 segundos. Si te arrepentís, decime «cancelá el apagado».`, face: 'sad' }
    }
  },
  {
    name: 'cancelar_apagado',
    description: 'Cancela un apagado o reinicio pendiente',
    run: async () => {
      try {
        await shutdown('cancelar')
      } catch {
        return { text: 'No había ningún apagado pendiente.', face: 'happy' }
      }
      return { text: '¡Listo, cancelado! La compu sigue prendida.', face: 'happy' }
    }
  },
  {
    name: 'captura',
    description: 'Abre la herramienta de recorte de Windows',
    run: async () => {
      await launch({ tipo: 'uri', valor: 'ms-screenclip:' })
      return { text: 'Elegí la parte de la pantalla. La captura queda copiada para pegarla donde quieras.', face: 'happy' }
    }
  },
  {
    name: 'estado_pc',
    description: 'Cuenta el uso de CPU y memoria',
    run: async () => {
      const a = cpuTimes()
      await sleep(500)
      const b = cpuTimes()
      const cpu = Math.round(100 * (1 - (b.idle - a.idle) / Math.max(1, b.total - a.total)))
      const totalGb = os.totalmem() / 1024 ** 3
      const usedGb = totalGb - os.freemem() / 1024 ** 3
      const ram = Math.round((100 * usedGb) / totalGb)
      const busy = cpu > 80 || ram > 85
      return {
        text:
          `La compu está usando ${cpu}% de CPU y ${ram}% de memoria (${fmt(usedGb)} de ${fmt(totalGb)} GB). ` +
          `Está prendida hace ${uptimeText(os.uptime())}.` +
          (busy ? ' Está bastante exigida: si anda lenta, cerrá lo que no uses.' : ''),
        face: busy ? 'surprised' : 'happy'
      }
    }
  }
]
