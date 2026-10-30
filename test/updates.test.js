import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createUpdater, describeUpdate } from '../src/main/updates.js'
import { createDiagnostics, redact } from '../src/main/diagnostics.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'

// Un electron-updater de mentira: emite los mismos eventos que el de verdad
function fakeUpdater({ next = null, fail = null } = {}) {
  const u = new EventEmitter()
  u.installed = 0
  u.checks = 0
  u.checkForUpdates = async () => {
    u.checks++
    u.emit('checking-for-update')
    if (fail) {
      const err = new Error(fail)
      u.emit('error', err)
      throw err
    }
    if (next) {
      u.emit('update-available', { version: next })
      u.emit('download-progress', { percent: 42.4 })
    } else u.emit('update-not-available', {})
  }
  u.finishDownload = () => u.emit('update-downloaded', { version: next })
  u.quitAndInstall = () => u.installed++
  return u
}
const noTimers = { setTimeout: () => {}, setInterval: () => {} }

test('en modo desarrollo no busca actualizaciones', async () => {
  const updater = fakeUpdater({ next: '9.9.9' })
  const up = createUpdater({ updater, packaged: false, currentVersion: '0.6.0', timers: noTimers })
  up.start()
  const s = await up.check()
  assert.equal(s.state, 'dev')
  assert.equal(updater.checks, 0)
  assert.match(up.describe(), /modo desarrollo/)
})

test('baja la versión nueva, avisa una sola vez y la instala', async () => {
  const updater = fakeUpdater({ next: '0.6.1' })
  const ready = []
  const up = createUpdater({ updater, packaged: true, currentVersion: '0.6.0', timers: noTimers, onReady: (v) => ready.push(v) })
  assert.equal(updater.autoDownload, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
  assert.equal(up.install(), false, 'no instala nada si no está lista')

  let s = await up.check()
  assert.equal(s.state, 'downloading')
  assert.equal(s.available, '0.6.1')
  assert.equal(s.progress, 42)
  assert.match(up.describe(), /bajando la 0\.6\.1 \(42 %\)/)

  updater.finishDownload()
  updater.finishDownload()
  assert.deepEqual(ready, ['0.6.1'])
  s = up.status()
  assert.equal(s.state, 'ready')
  assert.equal(up.install(), true)
  assert.equal(updater.installed, 1)
})

test('sin novedades dice que es la última, sin internet no lo anota como error', async () => {
  const up = createUpdater({ updater: fakeUpdater(), packaged: true, currentVersion: '0.6.0', timers: noTimers })
  assert.equal(up.describe(), 'Tengo la versión 0.6.0.')
  await up.check()
  assert.equal(up.describe(), 'Tengo la versión 0.6.0, la última.')

  const errors = []
  const offline = createUpdater({
    updater: fakeUpdater({ fail: 'net::ERR_INTERNET_DISCONNECTED' }),
    packaged: true,
    currentVersion: '0.6.0',
    timers: noTimers,
    reportError: (src, err) => errors.push([src, err.message])
  })
  assert.equal((await offline.check()).state, 'offline')
  assert.equal(errors.length, 0)

  const broken = createUpdater({
    updater: fakeUpdater({ fail: 'Cannot find latest.yml in the latest release artifacts' }),
    packaged: true,
    currentVersion: '0.6.0',
    timers: noTimers,
    reportError: (src, err) => errors.push([src, err.message])
  })
  assert.equal((await broken.check()).state, 'error')
  assert.equal(errors[0][0], 'actualizaciones')
})

test('se fija al arrancar y después cada 6 horas', () => {
  const calls = []
  const up = createUpdater({
    updater: fakeUpdater(),
    packaged: true,
    currentVersion: '0.6.0',
    timers: { setTimeout: (_f, ms) => calls.push(['una vez', ms]), setInterval: (_f, ms) => calls.push(['cada', ms]) }
  })
  up.start()
  assert.deepEqual(calls, [['una vez', 20000], ['cada', 6 * 60 * 60 * 1000]])
})

test('describe cada estado en una frase', () => {
  assert.match(describeUpdate({ state: 'ready', current: '0.6.0', available: '0.7.0' }), /0\.7\.0 ya está lista/)
  assert.match(describeUpdate({ state: 'offline', current: '0.6.0' }), /no hay internet/)
})

test('entiende los pedidos sobre Pixie misma', () => {
  const action = (text) => interpretAll(text)?.map((i) => i.action)
  for (const t of ['actualizate', 'Actualizá', 'actualizar', '¿hay una versión nueva?', 'buscá actualizaciones', 'fijate si hay actualizaciones', 'pixie, actualizate']) {
    assert.deepEqual(action(t), ['actualizar'], t)
  }
  for (const t of ['¿qué versión tenés?', 'en qué versión estás']) assert.deepEqual(action(t), ['version'], t)
  for (const t of ['copiame el informe', 'informe de diagnóstico', 'pasame el diagnóstico']) assert.deepEqual(action(t), ['diagnostico'], t)
  // Lo de siempre sigue igual
  assert.deepEqual(action('buscá gatos en youtube'), ['buscar'])
})

test('la acción actualizar sigue el estado de las actualizaciones', async () => {
  const updater = fakeUpdater({ next: '0.6.1' })
  const updates = createUpdater({ updater, packaged: true, currentVersion: '0.6.0', timers: noTimers })
  const ctx = { updates, log: () => {} }
  let r = await runAction('actualizar', {}, ctx)
  assert.match(r.text, /versión nueva, la 0\.6\.1/)
  r = await runAction('actualizar', {}, ctx)
  assert.match(r.text, /Estoy bajando la versión 0\.6\.1/)
  updater.finishDownload()
  r = await runAction('actualizar', {}, ctx)
  assert.match(r.text, /Me actualizo a la versión 0\.6\.1/)
  assert.equal(r.speak, false)

  const latest = { updates: createUpdater({ updater: fakeUpdater(), packaged: true, currentVersion: '0.6.0', timers: noTimers }), log: () => {} }
  assert.match((await runAction('actualizar', {}, latest)).text, /Ya tengo la última versión \(0\.6\.0\)/)
  const dev = { updates: createUpdater({ updater: fakeUpdater(), packaged: false, currentVersion: '0.6.0', timers: noTimers }), log: () => {} }
  assert.match((await runAction('actualizar', {}, dev)).text, /modo desarrollo/)
})

test('el informe de diagnóstico no lleva claves ni teléfonos', () => {
  const lines = []
  const d = createDiagnostics({ file: '/tmp/no-se-usa.log', write: (_f, line, cb) => (lines.push(line), cb()), now: () => new Date('2026-10-30T12:00:00Z') })
  d.record('ia', new Error('400 API key not valid: AIzaSyA1234567890abcdefghijklmnop'))
  d.record('whatsapp', { message: 'falló el envío a 5491100000000 con apikey=1112223' })
  const report = d.report(['Versión: 0.6.0 (instalada)'])
  assert.match(report, /Versión: 0\.6\.0/)
  assert.match(report, /Últimos errores \(2\)/)
  assert.match(report, /\[ia\]/)
  assert.doesNotMatch(report, /AIzaSy|5491100000000|1112223/)
  assert.equal(lines.length, 2)
  assert.doesNotMatch(lines.join(''), /AIzaSy|1112223/)
  assert.equal(redact('2026-10-30 versión 10.0.22631'), '2026-10-30 versión 10.0.22631')
})

test('recuerda solo los últimos 60 errores', () => {
  const d = createDiagnostics()
  for (let i = 0; i < 70; i++) d.record('prueba', new Error(`error ${i}`))
  assert.equal(d.list().length, 60)
  assert.equal(d.list()[0].message, 'error 10')
  assert.match(d.report(), /Últimos errores \(30\)/)
})

test('la acción diagnóstico copia el informe', async () => {
  let copied = 0
  const ctx = { log: () => {}, copyDiagnostics: () => (copied++, 3) }
  const r = await runAction('diagnostico', {}, ctx)
  assert.equal(copied, 1)
  assert.match(r.text, /Te copié el informe de diagnóstico/)
  assert.match(r.text, /últimos 3 errores/)
  const none = await runAction('diagnostico', {}, { log: () => {}, copyDiagnostics: () => 0 })
  assert.match(none.text, /No anoté ningún error/)
})

test('entiende atajos escritos de muchas formas', async () => {
  const { parseShortcut, shortcutText } = await import('../src/main/shortcut.js')
  assert.equal(parseShortcut('Ctrl+Alt+P'), 'Control+Alt+P')
  assert.equal(parseShortcut('control alt p'), 'Control+Alt+P')
  assert.equal(parseShortcut('alt y ctrl y p'), 'Control+Alt+P')
  assert.equal(parseShortcut('ctrl + shift + espacio'), 'Control+Shift+Space')
  assert.equal(parseShortcut('Alt+F9'), 'Alt+F9')
  assert.equal(parseShortcut('windows mas j'), 'Super+J')
  assert.equal(parseShortcut('shift+p'), null, 'sin Ctrl ni Alt se dispararía al escribir')
  assert.equal(parseShortcut('ctrl alt'), null, 'falta la tecla')
  assert.equal(parseShortcut('ctrl+alt+pp'), null)
  assert.equal(shortcutText('Control+Shift+Space'), 'Ctrl+Shift+Espacio')
})

test('cambia el atajo si está libre y avisa si otro programa lo usa', async () => {
  const action = (text) => interpretAll(text)?.map((i) => [i.action, i.params])
  assert.deepEqual(action('cambiá el atajo a Ctrl+Alt+P'), [['cambiar_atajo', { atajo: 'ctrl+alt+p' }]])
  assert.deepEqual(action('poné el atajo en control y alt y p'), [['cambiar_atajo', { atajo: 'control y alt y p' }]])
  assert.deepEqual(action('¿cuál es tu atajo?'), [['cambiar_atajo', {}]])

  const taken = new Set(['Control+Space'])
  let current = 'Control+Shift+Space'
  const ctx = {
    log: () => {},
    shortcutLabel: () => current.replace('Control', 'Ctrl').replace('Space', 'Espacio'),
    changeShortcut: (accel) => (taken.has(accel) ? { ok: false } : ((current = accel), { ok: true }))
  }
  assert.match((await runAction('cambiar_atajo', {}, ctx)).text, /Me llamás con Ctrl\+Shift\+Espacio/)
  assert.match((await runAction('cambiar_atajo', { atajo: 'ctrl espacio' }, ctx)).text, /Ctrl\+Espacio lo está usando otro programa/)
  assert.match((await runAction('cambiar_atajo', { atajo: 'ctrl alt p' }, ctx)).text, /Ahora me llamás con Ctrl\+Alt\+P/)
  assert.equal(current, 'Control+Alt+P')
  assert.match((await runAction('cambiar_atajo', { atajo: 'p' }, ctx)).text, /No entendí ese atajo/)
})
