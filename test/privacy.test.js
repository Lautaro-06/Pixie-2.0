import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { interpretAll } from '../src/main/brain.js'
import { actions, runAction, needsConfirm } from '../src/main/actions/index.js'
import { createBackup, portableConfig } from '../src/main/backup.js'
import { createSettings } from '../src/main/settings.js'

const act = (text) => interpretAll(text)?.map((i) => i.action)
const quiet = { log: () => {} }

test('se cierra del todo solo si confirmás', async () => {
  for (const t of ['cerrate', 'cerrá Pixie', 'Pixie, cerrate del todo', 'apagate', 'salir de Pixie', 'cerrá la aplicación']) assert.deepEqual(act(t), ['cerrar_pixie'], t)
  assert.deepEqual(act('cerrá chrome'), ['cerrar_app'])
  assert.deepEqual(act('chau'), ['ocultar'], 'chau solo la esconde')
  assert.ok(needsConfirm(actions.cerrar_pixie, {}, {}))
  assert.match(actions.cerrar_pixie.confirmText(), /menú Inicio/)
  let closed = false
  const r = await runAction('cerrar_pixie', {}, { ...quiet, quit: () => (closed = true) })
  assert.match(r.text, /Me cierro/)
  await new Promise((res) => setTimeout(res, 1900))
  assert.equal(closed, true)
})

test('explica cómo conseguir la clave y abre la guía', async () => {
  for (const t of ['¿cómo consigo la clave?', 'ayudame con la clave de la IA', 'cómo te pongo la IA', 'no tengo clave', 'activá la inteligencia artificial']) assert.deepEqual(act(t), ['clave_ia'], t)
  let opened = null
  const r = await runAction('clave_ia', {}, { ...quiet, openSettings: (v) => (opened = v), ai: { enabled: () => false } })
  assert.equal(opened, 'ajustes/ia')
  assert.match(r.text, /paso a paso/)
  assert.match((await runAction('clave_ia', {}, { ...quiet, openSettings: () => {}, ai: { enabled: () => true } })).text, /Ya tengo IA/)
})

test('explica cómo llamarla con la voz', async () => {
  for (const t of ['¿cómo te llamo con la voz?', 'quiero enseñarte mi voz', 'palabra mágica']) assert.deepEqual(act(t), ['palabra_magica'], t)
  const status = (s) => ({ ...quiet, openSettings: () => {}, wake: { status: () => s } })
  assert.match((await runAction('palabra_magica', {}, status({ grabada: false, activa: false }))).text, /tres veces/)
  assert.match((await runAction('palabra_magica', {}, status({ grabada: true, activa: true }))).text, /Ya te escucho/)
})

test('no dice que revisa WhatsApp: no tiene acceso a los chats', async () => {
  for (const t of ['revisá mi whatsapp', 'fijate si tengo mensajes nuevos en wpp', 'leeme mis chats']) assert.deepEqual(act(t), ['chats_privados'], t)
  assert.deepEqual(act('abrí whatsapp'), ['abrir'])
  assert.deepEqual(act('mandame por whatsapp que compre pan'), ['whatsapp'])
  assert.match((await runAction('chats_privados', {}, quiet)).text, /No puedo entrar a tu WhatsApp/)
})

test('antes de mirar la pantalla con un chat abierto, pregunta', () => {
  const look = actions.ver_pantalla
  const using = (actividad) => ({ awareness: () => ({ actividad }) })
  assert.equal(needsConfirm(look, {}, using({ categoria: 'estudio', app: 'Word' })), false)
  assert.equal(needsConfirm(look, {}, using(null)), false)
  assert.equal(needsConfirm(look, {}, {}), false)
  const chat = using({ categoria: 'mensajes', app: 'WhatsApp' })
  assert.equal(needsConfirm(look, {}, chat), true)
  assert.match(look.confirmText({}, chat), /Tenés WhatsApp abierto.*¿Miro igual\?/)
  assert.equal(needsConfirm(look, { confirmado: true }, chat), false)
})

test('el respaldo no lleva claves ni lo que es de cada compu', () => {
  const cfg = { ciudad: 'Rosario', atajo: 'Control+Alt+P', claveIA: 'x', cifrado: { claveIA: 'abc' }, whatsapp: { telefono: '1' }, bienvenidaHecha: true, arranqueConfigurado: true, atajoAvisado: 'a→b' }
  assert.deepEqual(portableConfig(cfg), { ciudad: 'Rosario', atajo: 'Control+Alt+P' })

  // Una compu nueva con un respaldo viejo (de la 0.7) en OneDrive: arranca sin clave y con la bienvenida
  const base = mkdtempSync(join(tmpdir(), 'pixie-respaldo-'))
  const cloud = join(base, 'OneDrive', 'Pixie')
  mkdirSync(cloud, { recursive: true })
  writeFileSync(join(cloud, 'config.json'), JSON.stringify(cfg))
  writeFileSync(join(cloud, 'memoria.json'), JSON.stringify({ nombre: 'Lauti' }))
  const dataDir = join(base, 'datos')
  const backup = createBackup({ dataDir, env: { OneDrive: join(base, 'OneDrive') } })
  const restored = backup.restoreIfMissing()
  assert.deepEqual(restored.map((r) => r.file).sort(), ['config.json', 'memoria.json'])
  const now = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'))
  assert.deepEqual(now, { ciudad: 'Rosario', atajo: 'Control+Alt+P' })

  // Y lo que respalda ahora tampoco lleva la clave cifrada
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ ...cfg, ciudad: 'Córdoba' }))
  assert.equal(backup.backup().ok, true)
  assert.deepEqual(JSON.parse(readFileSync(join(cloud, 'config.json'), 'utf8')), { ciudad: 'Córdoba', atajo: 'Control+Alt+P' })
})

test('los ajustes muestran y cambian la palabra mágica', async () => {
  let cfg = {}
  const calls = []
  const wake = {
    status: () => ({ grabada: true, activa: cfg.palabraMagica !== false, sensibilidad: cfg.sensibilidadPalabra ?? 'normal' }),
    setActive: (on) => (cfg = { ...cfg, palabraMagica: on }),
    setSensitivity: (v) => (cfg = { ...cfg, sensibilidadPalabra: v }),
    save: (p) => {
      if (!Array.isArray(p)) throw new Error('Las grabaciones no llegaron bien.')
      calls.push('save')
    },
    forget: () => calls.push('forget')
  }
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (p) => (cfg = { ...cfg, ...p }),
    memory: { getName: () => '', setName: () => {} },
    voices: { status: () => '' },
    updates: { status: () => ({ state: 'idle' }), describe: () => '' },
    ai: {},
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Shift+Espacio',
    setCity: async () => '',
    wake
  })
  assert.deepEqual(s.snapshot().voz.palabra, { grabada: true, activa: true, sensibilidad: 'normal' })
  const r = await s.apply({ palabraMagica: false, sensibilidadPalabra: 'baja' })
  assert.deepEqual(r.voz.palabra, { grabada: true, activa: false, sensibilidad: 'baja' })
  assert.equal(s.saveWake([[]]).ok, true)
  assert.match(s.saveWake('mal').mensaje, /no llegaron bien/)
  s.forgetWake()
  assert.deepEqual(calls, ['save', 'forget'])
})
