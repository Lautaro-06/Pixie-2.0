import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { parseCombo, shortcutFor, risky, bestElement, elementNames, findWindow, textToWrite, comboLabel } from '../src/main/control.js'
import { createHands, asciiJson, PasswordFieldError, HANDS_SCRIPT, HANDS_CSHARP } from '../src/main/hands.js'
import { actions, runAction, needsConfirm } from '../src/main/actions/index.js'
import { createVoiceGate } from '../src/renderer/src/audio.js'
import { transcriptionPrompt, parseLocation } from '../src/main/ai.js'

test('entiende los atajos dichos con palabras', () => {
  assert.deepEqual(parseCombo('control s'), { teclas: [0x11, 0x53], nombre: 'Ctrl+S' })
  assert.deepEqual(parseCombo('Ctrl+Shift+T').teclas, [0x11, 0x10, 0x54])
  assert.equal(parseCombo('alt f4').nombre, 'Alt+F4')
  assert.equal(parseCombo('la tecla enter').nombre, 'Enter')
  assert.equal(parseCombo('flecha abajo').nombre, '↓')
  assert.equal(parseCombo('control y').nombre, 'Ctrl+Y', 'la Y al final es la tecla')
  assert.equal(parseCombo('control y shift y t').nombre, 'Ctrl+Shift+T')
  assert.equal(parseCombo('av pag').nombre, 'AvPág')
  assert.equal(parseCombo('windows').nombre, 'Windows')
  assert.equal(parseCombo('control'), null, 'solo Ctrl no hace nada')
  assert.equal(parseCombo('el botón aceptar'), null)
  assert.equal(parseCombo(''), null)
  assert.equal(comboLabel([0x11, 0x74]), 'Ctrl+F5')
})

test('en Word en castellano toca el botón en vez de usar el atajo en inglés', () => {
  assert.deepEqual(shortcutFor('guardar', 'chrome'), { teclas: [0x11, 0x53], nombre: 'Ctrl+S', dicho: 'Guardado' })
  const word = shortcutFor('guardar', 'WINWORD')
  assert.deepEqual(word.botones, ['Guardar', 'Save'])
  assert.deepEqual(shortcutFor('negrita', 'winword').botones, ['Negrita', 'Bold'])
  assert.equal(shortcutFor('nueva pestaña', 'chrome').nombre, 'Ctrl+T')
  assert.equal(shortcutFor('volar', 'chrome'), null)
  assert.equal(risky([0x12, 0x73]), 'cerrar la ventana')
  assert.equal(risky([0x10, 0x2e]), 'borrar sin pasar por la papelera')
  assert.equal(risky([0x11, 0x53]), null)
})

const ELEMENTS = [
  { id: 0, nombre: 'Archivo', tipo: 'MenuItem', x: 10, y: 10, habilitado: true },
  { id: 1, nombre: 'Enviar', tipo: 'Button', x: 900, y: 700, habilitado: true },
  { id: 2, nombre: 'Enviar más tarde', tipo: 'Button', x: 950, y: 700, habilitado: true },
  { id: 3, nombre: 'Enviar', tipo: 'Text', x: 100, y: 300, habilitado: true },
  { id: 4, nombre: 'Nuevo documento en blanco', tipo: 'ListItem', x: 200, y: 200, habilitado: true },
  { id: 5, nombre: 'Insertar', tipo: 'TabItem', x: 120, y: 10, habilitado: false },
  { id: 6, nombre: 'Insertar tabla', tipo: 'Button', x: 130, y: 60, habilitado: true }
]

test('elige el botón que nombraste', () => {
  assert.equal(bestElement(ELEMENTS, 'enviar').id, 1, 'el botón, no el texto ni «más tarde»')
  assert.equal(bestElement(ELEMENTS, 'el botón Enviar').id, 1)
  assert.equal(bestElement(ELEMENTS, 'nuevo documento').id, 4)
  assert.equal(bestElement(ELEMENTS, 'archivo').id, 0)
  assert.equal(bestElement(ELEMENTS, 'tabla').id, 6)
  assert.equal(bestElement(ELEMENTS, 'guardar'), null)
  assert.equal(bestElement([], 'algo'), null)
  assert.deepEqual(elementNames(ELEMENTS, 4), ['Archivo', 'Enviar', 'Enviar más tarde', 'Nuevo documento en blanco'])
  const windows = [
    { hwnd: 1, proceso: 'chrome', titulo: 'YouTube - Google Chrome' },
    { hwnd: 2, proceso: 'WINWORD', titulo: 'Informe.docx - Word' }
  ]
  assert.equal(findWindow(windows, 'word', 'winword.exe').hwnd, 2)
  assert.equal(findWindow(windows, 'youtube').hwnd, 1)
  assert.equal(findWindow(windows, 'spotify'), null)
})

test('escribe el texto exacto que pediste', () => {
  assert.equal(textToWrite('escribí hola, ¿cómo estás?'), 'hola, ¿cómo estás?')
  assert.equal(textToWrite('Pixie, escribí: Hola Mundo'), 'Hola Mundo')
  assert.equal(textToWrite('escribí «Querida profe»'), 'Querida profe')
  assert.equal(textToWrite('escribí que diga Feliz cumple Ñañá'), 'Feliz cumple Ñañá')
  assert.equal(textToWrite('escribí buen día a todos y después apretá enter', true), 'buen día a todos')
  assert.equal(textToWrite('escribí hola y mandalo', true), 'hola')
  assert.equal(textToWrite('escribí pan y leche', false), 'pan y leche')
  assert.equal(textToWrite('abrí word'), null)
})

// Unas manos de mentira que anotan lo que les piden
function fakeHands(answers = {}) {
  const calls = []
  return {
    calls,
    available: () => true,
    request: async (cmd, args) => {
      calls.push([cmd, args])
      const a = answers[cmd]
      if (a instanceof Error) throw a
      return typeof a === 'function' ? a(args) : (a ?? { ok: true })
    }
  }
}
const ctxWith = (hands, extra = {}) => ({
  log: () => {},
  getConfig: () => ({ apps: [] }),
  hands,
  targetWindow: async () => ({ hwnd: 7, proceso: 'WINWORD', titulo: 'Informe.docx - Word' }),
  withPixieHidden: async (_point, fn) => fn(),
  ...extra
})

test('escribe, aprieta atajos y toca botones en la app de adelante', async () => {
  const h = fakeHands({ elementos: { elementos: ELEMENTS } })
  const ctx = ctxWith(h)
  assert.match((await runAction('escribir', { texto: 'Hola, ¿cómo andás?' }, ctx)).text, /^Escribí «Hola, ¿cómo andás\?» en WINWORD\.$/)
  assert.deepEqual(h.calls.at(-1), ['escribir', { texto: 'Hola, ¿cómo andás?' }])
  assert.equal((await runAction('teclas', { teclas: 'control s', veces: 2 }, ctx)).text, 'Apreté Ctrl+S 2 veces.')
  assert.equal(h.calls.filter(([c]) => c === 'teclas').length, 2)
  assert.match((await runAction('teclas', { teclas: 'banana' }, ctx)).text, /No entendí la tecla/)
  assert.equal((await runAction('clic', { objetivo: 'enviar' }, ctx)).text, 'Toqué «Enviar».')
  assert.deepEqual(h.calls.at(-1), ['usar', { id: 1, clic: true }])
  // En Word, «guardá» toca el botón Guardar (si no está, aprieta el atajo)
  const word = fakeHands({ elementos: { elementos: [{ id: 3, nombre: 'Guardar', tipo: 'Button', x: 20, y: 5 }] } })
  assert.equal((await runAction('atajo', { accion: 'guardar' }, ctxWith(word))).text, 'Guardado.')
  assert.deepEqual(word.calls.at(-1), ['usar', { id: 3, clic: true }])
  const chrome = fakeHands()
  await runAction('atajo', { accion: 'nueva pestaña' }, ctxWith(chrome, { targetWindow: async () => ({ hwnd: 1, proceso: 'chrome' }) }))
  assert.deepEqual(chrome.calls.at(-1), ['teclas', { teclas: [0x11, 0x54] }])
  // Bajar la página y manejar la ventana
  await runAction('desplazar', { direccion: 'abajo' }, ctx)
  assert.deepEqual(h.calls.at(-1), ['rueda', { muescas: -5 }])
  await runAction('ventana', { accion: 'maximizar' }, ctx)
  assert.deepEqual(h.calls.at(-1), ['estado', { hwnd: 7, modo: 3 }])
})

test('si no encuentra el botón, lo busca en la pantalla; y si no, dice qué ve', async () => {
  const h = fakeHands({ elementos: { elementos: ELEMENTS } })
  const r = await runAction('clic', { objetivo: 'la lupita' }, ctxWith(h, { locateOnScreen: async () => ({ x: 640, y: 360 }) }))
  assert.equal(r.text, 'Toqué «la lupita».')
  assert.deepEqual(h.calls.at(-1), ['clic', { x: 640, y: 360 }])
  const none = await runAction('clic', { objetivo: 'la lupita' }, ctxWith(fakeHands({ elementos: { elementos: ELEMENTS } }), { locateOnScreen: async () => null }))
  assert.match(none.text, /^No encontré «la lupita» en WINWORD\. Veo, por ejemplo: Archivo, Enviar, /)
})

test('lo que puede hacer perder algo pregunta antes, y no escribe lo que no corresponde', async () => {
  assert.equal(needsConfirm(actions.teclas, { teclas: 'alt f4' }, {}), true)
  assert.match(actions.teclas.confirmText({ teclas: 'alt f4' }), /cerrar la ventana/)
  assert.equal(needsConfirm(actions.teclas, { teclas: 'control s' }, {}), false)
  assert.equal(needsConfirm(actions.ventana, { accion: 'cerrar' }, {}), true)
  assert.equal(needsConfirm(actions.ventana, { accion: 'maximizar' }, {}), false)
  const blocked = await runAction('escribir', { texto: 'videos de muertes reales' }, ctxWith(fakeHands()))
  assert.equal(blocked.face, 'angry')
  const pw = await runAction('escribir', { texto: 'hola' }, ctxWith(fakeHands({ escribir: new PasswordFieldError() })))
  assert.match(pw.text, /contraseña/)
  const noWin = await runAction('escribir', { texto: 'hola' }, { log: () => {}, getConfig: () => ({}), hands: { available: () => false } })
  assert.match(noWin.text, /solo funciona en Windows/)
})

test('trae al frente una app abierta, y si no está, la abre', async () => {
  const windows = [{ hwnd: 9, proceso: 'WINWORD', titulo: 'Informe.docx - Word' }]
  const h = fakeHands({ ventanas: windows, enfocar: { ok: true } })
  const r = await runAction('ir_a', { app: 'word' }, ctxWith(h))
  assert.match(r.text, /^Listo, Word al frente\.$/)
  assert.deepEqual(h.calls.at(-1), ['enfocar', { hwnd: 9 }])
  const r2 = await runAction('abrir', { objetivo: 'word' }, ctxWith(h))
  assert.equal(r2.text, 'Te traje Word.')
})

test('las manos de Windows: pedidos en ASCII y respuestas en orden', async () => {
  const written = []
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stdout.setEncoding = () => {}
  child.stderr = new EventEmitter()
  child.stdin = {
    write: (line) => {
      written.push(line)
      const req = JSON.parse(line)
      const reply = req.cmd === 'escribir' && req.args.texto === 'secreto' ? { id: req.id, ok: false, error: 'password' } : { id: req.id, ok: true, result: { eco: req.args } }
      setImmediate(() => child.stdout.emit('data', `${JSON.stringify(reply)}\n`))
    },
    end: () => {}
  }
  child.kill = () => {}
  const hands = createHands({ spawnImpl: () => child, platformOk: true })
  assert.deepEqual(await hands.request('escribir', { texto: 'ñandú' }), { eco: { texto: 'ñandú' } })
  assert.match(written[0], /\\u00f1and\\u00fa/)
  assert.ok(!/[^\x00-\x7f]/.test(written[0]), 'solo ASCII')
  await assert.rejects(hands.request('escribir', { texto: 'secreto' }), PasswordFieldError)
  const pending = hands.request('teclas', { teclas: [13] })
  child.emit('exit')
  await assert.rejects(pending, /trabaron/)
  assert.throws(() => createHands({ platformOk: false }).request('ventana'), /solo funciona en Windows/)
  assert.equal(asciiJson({ a: '😀' }), '{"a":"\\ud83d\\ude00"}')
})

test('el script de las manos es C# 5 y PowerShell sin sorpresas', () => {
  // El PowerShell de Windows compila C# 5: nada de interpolación ni ?.
  assert.doesNotMatch(HANDS_CSHARP, /\$"|\?\.|=>/)
  assert.match(HANDS_CSHARP, /KEYEVENTF|UNICODE/)
  for (const cmd of ['ventana', 'enfocar', 'estado', 'escribir', 'teclas', 'clic', 'rueda', 'elementos', 'usar', 'ventanas']) assert.match(HANDS_SCRIPT, new RegExp(`'${cmd}'`))
  assert.match(HANDS_SCRIPT, /Focused-Is-Password/)
})

test('escucha según el ruido de tu habitación y no corta en las pausas', () => {
  const gate = createVoiceGate()
  let t = 0
  const push = (l) => gate.push(l, (t += 85))
  for (let i = 0; i < 4; i++) push(0.002) // la habitación, en silencio
  assert.equal(push(0.003).heard, false)
  assert.deepEqual(push(0.012), { heard: true, speaking: true }, 'un micrófono bajito también cuenta')
  assert.equal(push(0.005).speaking, true, 'una sílaba suave sigue siendo voz')
  assert.equal(push(0.002).speaking, false)
  // En una habitación con ruido, el ruido no cuenta como voz
  const noisy = createVoiceGate()
  t = 0
  for (let i = 0; i < 4; i++) noisy.push(0.02, (t += 85))
  assert.equal(noisy.push(0.03, (t += 85)).heard, false)
  assert.equal(noisy.push(0.08, (t += 85)).heard, true)
})

test('la IA transcribe sabiendo dónde está y señala en la pantalla', () => {
  assert.match(transcriptionPrompt('Lauti, WhatsApp, Classroom'), /rioplatense.*por ejemplo: Lauti, WhatsApp, Classroom/s)
  assert.doesNotMatch(transcriptionPrompt(), /por ejemplo/)
  assert.deepEqual(parseLocation('Acá: {"x": 512, "y": 300}'), { x: 512, y: 300 })
  assert.equal(parseLocation('{"x": null}'), null)
  assert.equal(parseLocation('{"x": 2000, "y": 5}'), null)
  assert.equal(parseLocation('no sé'), null)
})
