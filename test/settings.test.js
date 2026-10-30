import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSettings, findKey, keyErrorText } from '../src/main/settings.js'
import { AIHttpError, AIConnectionError } from '../src/main/ai-compatible.js'
import { renderStandby } from '../src/renderer/src/face/standby.js'
import { renderFace, WIDTH, HEIGHT } from '../src/renderer/src/face/draw.js'
import { interpretAll } from '../src/main/brain.js'
import { runAction } from '../src/main/actions/index.js'

function setup({ config = {}, ping } = {}) {
  let cfg = { ciudad: 'Buenos Aires', ...config }
  const calls = []
  let login = false
  let name = ''
  let clip = ''
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (patch) => {
      calls.push(patch)
      cfg = { ...cfg, ...patch }
      for (const [k, v] of Object.entries(patch)) if (v === undefined || v === null) delete cfg[k]
      return cfg
    },
    memory: { getName: () => name, setName: (n) => (name = n) },
    voices: { status: () => 'Uso la voz de Windows.', use: (m) => calls.push({ voz: m }), install: () => calls.push({ instalar: true }) },
    updates: { status: () => ({ state: 'idle', current: '0.7.0' }), describe: () => 'Tengo la versión 0.7.0.' },
    ai: { ping: ping ?? (async (key) => ({ provider: 'gemini', model: 'gemini-flash-lite-latest', key })) },
    loginItem: { get: () => login, set: (on) => (login = on) },
    changeShortcut: (accel) => (accel === 'Control+Space' ? { ok: false } : { ok: true }),
    shortcutLabel: () => 'Ctrl+Shift+Espacio',
    setCity: async (c) => `Listo, para el clima uso ${c}.`,
    errorCount: () => 2,
    readClipboard: () => clip,
    version: '0.7.0'
  })
  return { s, calls, cfg: () => cfg, setClip: (t) => (clip = t), login: () => login, name: () => name }
}

test('muestra los ajustes sin revelar la clave', () => {
  const { s } = setup({ config: { claveIA: 'AQ.Ab8RNxxxxxxxxxxxxxxxxk3Zq', pantallaReposo: 'reloj' } })
  const snap = s.snapshot()
  assert.equal(snap.ia.clave, 'AQ.Ab…k3Zq')
  assert.equal(snap.ia.proveedor, 'Gemini')
  assert.equal(snap.apariencia.pantallaReposo, 'reloj')
  assert.equal(snap.general.atajo, 'Ctrl+Shift+Espacio')
  assert.equal(snap.ayuda.errores, 2)
  assert.doesNotMatch(JSON.stringify(snap), /xxxxxxxx/)
})

test('cambia cada ajuste', async () => {
  const t = setup()
  let r = await t.s.apply({ nombre: '  Lauti  ', arrancarConWindows: true, recordatoriosSalud: false, pantallaReposo: 'resumen' })
  assert.equal(t.name(), 'Lauti')
  assert.equal(t.login(), true)
  assert.equal(t.cfg().recordatoriosSalud, false)
  assert.equal(r.apariencia.pantallaReposo, 'resumen')
  r = await t.s.apply({ pantallaReposo: 'cualquiera' })
  assert.equal(r.apariencia.pantallaReposo, 'resumen', 'ignora modos que no existen')
  r = await t.s.apply({ ciudad: 'Rosario' })
  assert.deepEqual(r.mensajes, ['Listo, para el clima uso Rosario.'])
  r = await t.s.apply({ atajo: 'Control+Alt+P' })
  assert.deepEqual(r.mensajes, ['Ahora me llamás con Ctrl+Alt+P.'])
  r = await t.s.apply({ atajo: 'Control+Space' })
  assert.match(r.mensajes[0], /Ctrl\+Espacio lo está usando otro programa/)
  r = await t.s.apply({ atajo: 'Shift+P' })
  assert.match(r.mensajes[0], /tiene que llevar Ctrl o Alt/)
  await t.s.apply({ vozModo: 'natural' })
  assert.deepEqual(t.calls.slice(-2), [{ voz: true }, { instalar: true }])
  await t.s.apply({ iaActiva: false })
  assert.equal(t.cfg().ia, false)
  await t.s.apply({ iaActiva: true })
  assert.equal(t.cfg().ia, undefined)
})

test('encuentra la clave copiada, la prueba y la guarda', async () => {
  const t = setup()
  t.setClip('hola, esto no es una clave')
  assert.deepEqual(t.s.clipboardKey(), { encontrada: false })
  t.setClip('Tu clave: AQ.Ab8RNpruebaprueba123456789 (no la compartas)')
  assert.deepEqual(t.s.clipboardKey(), { encontrada: true, clave: 'AQ.Ab…6789' })
  const r = await t.s.saveKey(null)
  assert.equal(r.ok, true)
  assert.equal(r.guardada, true)
  assert.equal(t.cfg().claveIA, 'AQ.Ab8RNpruebaprueba123456789')
  // La misma clave ya guardada no se vuelve a ofrecer
  assert.deepEqual(t.s.clipboardKey(), { encontrada: false })
})

test('si la clave no anda, no la guarda y explica por qué', async () => {
  const bad = setup({ ping: async () => { throw new AIHttpError(400, 'API key not valid', 'gemini-flash-lite-latest') } })
  let r = await bad.s.saveKey('AIzaSyEstaClaveNoAnda1234567890123456')
  assert.equal(r.ok, false)
  assert.match(r.mensaje, /no funciona/)
  assert.equal(bad.cfg().claveIA, undefined)

  const offline = setup({ ping: async () => { throw new AIConnectionError('sin internet') } })
  r = await offline.s.testKey('AQ.algo1234567890123456789')
  assert.match(r.mensaje, /¿Hay internet\?/)
  assert.match((await offline.s.testKey('')).mensaje, /Copiá o pegá la clave/)
})

test('reconoce claves de IA en un texto', () => {
  assert.equal(findKey('AIzaSyA1234567890abcdefghijklmnopqrstu'), 'AIzaSyA1234567890abcdefghijklmnopqrstu')
  assert.equal(findKey('gsk_abcdefghijklmnopqrstuvwx'), 'gsk_abcdefghijklmnopqrstuvwx')
  assert.equal(findKey('mi contraseña es 1234'), null)
  assert.match(keyErrorText(new AIHttpError(429, 'quota', 'x')), /se usó todo lo gratis/)
})

test('la bienvenida queda hecha y la clave se puede borrar', () => {
  const t = setup({ config: { claveIA: 'AQ.Ab8RNpruebaprueba123456789' } })
  t.s.finishWelcome()
  assert.equal(t.cfg().bienvenidaHecha, true)
  const snap = t.s.forgetKey()
  assert.equal(snap.ia.tieneClave, false)
})

test('en reposo dibuja el reloj y el resumen con píxeles', () => {
  const face = renderFace({})
  const date = new Date(2026, 9, 30, 14, 5, 2) // viernes 30 de octubre, 14:05:02
  const clock = renderStandby('reloj', face, date)
  const summary = renderStandby('resumen', face, date, { temp: 23, icon: 'sol' })
  const lit = (bits) => bits.reduce((n, b) => n + b, 0)
  assert.equal(clock.length, WIDTH * HEIGHT)
  assert.ok(lit(clock) > 150, 'la hora grande se ve')
  assert.notDeepEqual(clock, face)
  // En el resumen, la carita chiquita está a la izquierda y la hora y el clima a la derecha
  const leftHalf = (bits) => [...bits].filter((_, i) => i % WIDTH < 32).reduce((n, b) => n + b, 0)
  assert.ok(leftHalf(summary) > 50 && lit(summary) - leftHalf(summary) > 60)
  // El dos puntos titila cada segundo
  assert.notDeepEqual(renderStandby('reloj', face, date), renderStandby('reloj', face, new Date(2026, 9, 30, 14, 5, 3)))
  // Sin clima muestra el día
  assert.ok(lit(renderStandby('resumen', face, date, null)) > 0)
})

test('entiende cuando le pedís los ajustes', async () => {
  const action = (text) => interpretAll(text)?.map((i) => i.action)
  for (const t of ['abrí tus ajustes', 'ajustes', 'configuración de Pixie', 'quiero personalizarte']) assert.deepEqual(action(t), ['ajustes'], t)
  assert.deepEqual(action('abrí los ajustes de windows'), ['abrir'])
  let opened = null
  const r = await runAction('ajustes', {}, { log: () => {}, openSettings: (v) => (opened = v) })
  assert.equal(opened, 'ajustes')
  assert.match(r.text, /Te abrí mis ajustes/)
})
