// Voz natural que corre en la compu, sin internet y sin límite: Piper con la voz
// "Daniela" (español de Argentina). Se baja una sola vez (unos 135 MB) cuando la
// pedís y queda en %APPDATA%\Pixie\voz. Si algo falla, Pixie usa la voz de Windows.
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn as nodeSpawn } from 'node:child_process'
import { run, powershell } from './windows.js'

export const PIPER_ZIP = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
export const VOICE_NAME = 'es_AR-daniela-high'
export const VOICE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx'
const SIZES = { zip: 22e6, model: 114.2e6 } // para calcular el porcentaje

// Más rápido o más lento según la emoción (sin tocar el tono, que distorsiona)
const SPEED = { happy: 0.95, laugh: 0.92, surprised: 0.95, alarm: 0.9, sad: 1.08, love: 1.02 }

// Descomprime con el tar que trae Windows 10/11; si no, con PowerShell
async function extractZip(zip, dest) {
  try {
    await run('tar.exe', ['-xf', zip, '-C', dest])
  } catch {
    const q = (p) => `'${p.replace(/'/g, "''")}'`
    await powershell(`Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(dest)} -Force`)
  }
}

export function piperLine(text) {
  return String(text ?? '').replace(/[«»*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600)
}

export function createPiper({ dir, fetchImpl = (...a) => fetch(...a), spawnImpl = nodeSpawn, extract = extractZip, log = () => {} }) {
  // El zip trae una carpeta "piper"; por las dudas también se busca suelto
  const exes = [join(dir, 'piper', 'piper.exe'), join(dir, 'piper.exe')]
  const findExe = () => exes.find((p) => existsSync(p)) ?? null
  const model = join(dir, `${VOICE_NAME}.onnx`)
  const modelConfig = `${model}.json`
  const running = new Map()
  let installing = null
  let progress = 0

  const installed = () => Boolean(findExe()) && existsSync(model) && existsSync(modelConfig)

  function sampleRate() {
    try {
      return JSON.parse(readFileSync(modelConfig, 'utf8')).audio?.sample_rate ?? 22050
    } catch {
      return 22050
    }
  }

  async function download(url, dest, onBytes = () => {}) {
    const res = await fetchImpl(url, { redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`no se pudo bajar ${url.split('/').pop()} (${res.status})`)
    const body = typeof res.body.getReader === 'function' ? Readable.fromWeb(res.body) : Readable.from(res.body)
    let got = 0
    body.on('data', (c) => onBytes((got += c.length)))
    const part = `${dest}.part`
    await pipeline(body, createWriteStream(part))
    renameSync(part, dest)
  }

  // Baja Piper y la voz. onProgress(porcentaje) cada 5 %.
  function install(onProgress = () => {}) {
    if (installed()) return Promise.resolve(true)
    installing ??= (async () => {
      mkdirSync(dir, { recursive: true })
      progress = 0
      const total = SIZES.zip + SIZES.model
      let base = 0
      const report = (got) => {
        const pct = Math.min(95, Math.floor(((base + got) / total) * 20) * 5) // de a 5 %
        if (pct > progress) {
          progress = pct
          onProgress(pct)
        }
      }
      if (!findExe()) {
        const zip = join(dir, 'piper.zip')
        await download(PIPER_ZIP, zip, report)
        await extract(zip, dir)
        rmSync(zip, { force: true })
        if (!findExe()) throw new Error('el programa de la voz no se descomprimió bien')
      }
      base = SIZES.zip
      if (!existsSync(modelConfig)) await download(`${VOICE_URL}.json`, modelConfig)
      if (!existsSync(model)) await download(VOICE_URL, model, report)
      progress = 100
      return true
    })().finally(() => {
      installing = null
    })
    return installing
  }

  // Habla: el audio (PCM de 16 bits, mono) llega en pedacitos a onChunk(chunk, rate)
  function speak(id, text, face, onChunk) {
    const line = piperLine(text)
    if (!installed() || !line) return Promise.resolve({ ok: false })
    const rate = sampleRate()
    const exe = findExe()
    return new Promise((resolve) => {
      let received = 0
      let finished = false
      const child = spawnImpl(exe, ['--model', model, '--output-raw', '--length_scale', String(SPEED[face] ?? 1), '--sentence_silence', '0.15'], {
        windowsHide: true,
        cwd: dirname(exe)
      })
      const done = () => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        running.delete(id)
        resolve({ ok: received > 0 })
      }
      const timer = setTimeout(() => child.kill(), 30000)
      running.set(id, child)
      child.stdout.on('data', (c) => {
        received += c.length
        onChunk(new Uint8Array(c), rate)
      })
      child.stderr?.on('data', () => {}) // Piper cuenta lo que hace por acá
      child.on('error', (err) => {
        log(`voz natural: ${err.message}`)
        done()
      })
      child.on('close', done)
      child.stdin.on('error', () => {})
      child.stdin.end(`${line}\n`)
    })
  }

  return {
    installed,
    installing: () => Boolean(installing),
    progress: () => progress,
    install,
    speak,
    stop: (id) => running.get(id)?.kill()
  }
}
