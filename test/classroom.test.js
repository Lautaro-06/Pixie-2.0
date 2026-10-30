import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDue, parseTodo, createClassroom } from '../src/main/classroom.js'
import { installExtensionFiles, olderThan } from '../src/main/extension-files.js'
import { interpretAll } from '../src/main/brain.js'
import { runAction } from '../src/main/actions/index.js'

const tmp = (name) => mkdtempSync(join(tmpdir(), `pixie-${name}-`))
const NOW = new Date(2026, 9, 30, 15, 0) // viernes 30 de octubre de 2026, 15:00
const day = (d) => (d ? [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()] : null)

test('entiende las fechas de entrega de Classroom', () => {
  assert.deepEqual(day(parseDue('Fecha de entrega: mañana, 23:59', NOW)), [2026, 10, 31, 23, 59])
  assert.deepEqual(day(parseDue('hoy', NOW)), [2026, 10, 30, 0, 0])
  assert.deepEqual(day(parseDue('ayer, 23:59', NOW)), [2026, 10, 29, 23, 59])
  assert.deepEqual(day(parseDue('Vence: jueves', NOW)), [2026, 11, 5, 0, 0])
  assert.deepEqual(day(parseDue('vie', NOW)), [2026, 10, 30, 0, 0], 'el viernes es hoy')
  assert.deepEqual(day(parseDue('5 nov.', NOW)), [2026, 11, 5, 0, 0])
  assert.deepEqual(day(parseDue('Fecha de entrega: 2 nov. 2026, 8:00', NOW)), [2026, 11, 2, 8, 0])
  assert.deepEqual(day(parseDue('5 de noviembre', NOW)), [2026, 11, 5, 0, 0])
  assert.deepEqual(day(parseDue('Due Nov 5, 11:59', NOW)), [2026, 11, 5, 11, 59])
  assert.deepEqual(day(parseDue('05/11', NOW)), [2026, 11, 5, 0, 0])
  assert.deepEqual(day(parseDue('15 feb', new Date(2026, 11, 10))), [2027, 2, 15, 0, 0], 'en diciembre, febrero es del año que viene')
  assert.equal(parseDue('Sin fecha de entrega', NOW), null)
  assert.equal(parseDue('Avance del proyecto', NOW), null)
})

const RAW = {
  items: [
    { link: 'https://classroom.google.com/u/0/c/AAA/a/BBB/details', lineas: ['Avance del Proyecto', '2026 Prácticas Profesionalizantes', 'Fecha de entrega: mañana, 23:59'], seccion: 'Esta semana' },
    { link: 'https://classroom.google.com/u/0/c/CCC/a/DDD/details', lineas: ['Tarea', 'Listening practice', 'Inglés 5°', 'jueves'], seccion: 'Esta semana' },
    { link: 'https://classroom.google.com/u/0/c/EEE/a/FFF/details', lineas: ['Leer el capítulo 3', 'Lengua y literatura'], seccion: 'Sin fecha de entrega' },
    { link: 'https://classroom.google.com/u/0/c/AAA/a/BBB/details', lineas: ['Avance del Proyecto', 'repetida'], seccion: '' },
    { link: 'https://classroom.google.com/u/0/c/GGG/a/HHH/details', lineas: [], seccion: '' }
  ]
}

test('saca título, materia y fecha de cada tarea pendiente', () => {
  const tasks = parseTodo(RAW, NOW)
  assert.equal(tasks.length, 3)
  assert.deepEqual(
    tasks.map((t) => [t.titulo, t.materia, day(t.cuando && new Date(t.cuando))]),
    [
      ['Avance del Proyecto', '2026 Prácticas Profesionalizantes', [2026, 10, 31, 23, 59]],
      ['Listening practice', 'Inglés 5°', [2026, 11, 5, 0, 0]],
      ['Leer el capítulo 3', 'Lengua y literatura', null]
    ]
  )
  assert.deepEqual(parseTodo({ items: [], vacio: true }, NOW), [])
  assert.deepEqual(parseTodo(null, NOW), [])
})

function fakeBrowser(answer) {
  const b = { on: true, calls: 0, connected: () => b.on, request: async (cmd) => (b.calls++, answer(cmd)) }
  return b
}

test('lee Classroom con la extensión, lo guarda y lo suma a la agenda con avisos', async () => {
  const file = join(tmp('classroom'), 'classroom.json')
  let now = NOW
  const browser = fakeBrowser(() => RAW)
  browser.on = false
  const cr = createClassroom({ browser, file, now: () => now })
  assert.equal((await cr.refresh({ force: true })).estado, 'sin-extension')
  browser.on = true
  now = new Date(NOW.getTime() + 6 * 60000)
  const st = await cr.refresh({ force: true })
  assert.equal(st.estado, 'ok')
  assert.equal(st.tareas, 3)
  assert.equal(st.conFecha, 2)
  // No vuelve a leer enseguida
  await cr.refresh({ force: true })
  assert.equal(browser.calls, 1)
  // En la agenda: entregas de todo el día, con la materia
  const evs = cr.eventsBetween(new Date(2026, 9, 30), new Date(2026, 10, 10))
  assert.deepEqual(evs.map((e) => [e.texto, e.conHora, e.calendario]), [
    ['Avance del Proyecto (2026 Prácticas Profesionalizantes)', false, 'Classroom'],
    ['Listening practice (Inglés 5°)', false, 'Classroom']
  ])
  // Avisa la noche anterior a las 20 y ese día a las 8, una vez
  now = new Date(2026, 9, 30, 20, 1)
  assert.deepEqual(cr.dueAlerts(now).map((a) => [a.evento.texto, a.clave]), [['Avance del Proyecto (2026 Prácticas Profesionalizantes)', 'noche']])
  assert.deepEqual(cr.dueAlerts(now), [])
  // Lo último que leyó queda guardado (con lo que vio, para ajustar si Classroom cambia)
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(saved.tareas.length, 3)
  assert.ok(saved.crudo.length > 0)
  const again = createClassroom({ browser: fakeBrowser(() => RAW), file, now: () => now })
  assert.equal(again.status().tareas, 3)
  assert.equal(again.tasks()[0].titulo, 'Avance del Proyecto')
})

test('si la extensión es vieja o falla, lo dice', async () => {
  const old = createClassroom({ browser: fakeBrowser(() => Promise.reject(new Error('Pedido desconocido: classroom'))), file: join(tmp('cr2'), 'c.json'), now: () => NOW })
  assert.equal((await old.refresh({ force: true })).estado, 'extension-vieja')
  const off = createClassroom({ browser: fakeBrowser(() => Promise.reject(new Error('Entrá a Classroom en Chrome con tu cuenta y probá de nuevo.'))), file: join(tmp('cr3'), 'c.json'), now: () => NOW })
  const st = await off.refresh({ force: true })
  assert.equal(st.estado, 'error')
  assert.match(st.error, /Entrá a Classroom/)
})

test('le preguntás por Classroom y te cuenta lo próximo', async () => {
  for (const t of ['¿qué tengo en classroom?', 'revisá Classroom', 'sumá Classroom', 'tareas de classroom']) assert.deepEqual(interpretAll(t)?.map((i) => i.action), ['classroom'], t)
  assert.deepEqual(interpretAll('abrí classroom')?.map((i) => i.action), ['abrir'])
  const soon = (d) => {
    const x = new Date()
    x.setDate(x.getDate() + d)
    return x.toISOString()
  }
  const tasks = [
    { titulo: 'TP 2', materia: 'Física', cuando: soon(1) },
    { titulo: 'Leer', materia: 'Lengua', cuando: null }
  ]
  const ctx = { log: () => {}, classroom: { refresh: async () => ({ estado: 'ok', leido: Date.now() }), tasks: () => tasks } }
  const r = await runAction('classroom', {}, ctx)
  assert.match(r.text, /^En Classroom tenés 2 tareas pendientes\. Lo próximo: TP 2 \(Física\) mañana\. Una no tiene fecha de entrega\.$/)
  let opened = null
  const none = await runAction('classroom', {}, { log: () => {}, openSettings: (v) => (opened = v), classroom: { refresh: async () => ({ estado: 'sin-extension', leido: null }), tasks: () => [] } })
  assert.match(none.text, /extensión de Chrome/)
  assert.equal(opened, 'ajustes/agenda')
})

test('la extensión viaja con Pixie y se copia cuando cambia de versión', () => {
  const base = tmp('ext')
  const from = join(base, 'resources', 'extension')
  const to = join(base, 'datos', 'extension-chrome')
  mkdirSync(from, { recursive: true })
  writeFileSync(join(from, 'manifest.json'), JSON.stringify({ version: '0.9.1' }))
  writeFileSync(join(from, 'background.js'), '// v1')
  assert.deepEqual(installExtensionFiles({ from, to }), { ok: true, carpeta: to, version: '0.9.1', actualizada: false })
  assert.equal(readFileSync(join(to, 'background.js'), 'utf8'), '// v1')
  writeFileSync(join(from, 'background.js'), '// v2')
  installExtensionFiles({ from, to })
  assert.equal(readFileSync(join(to, 'background.js'), 'utf8'), '// v1', 'misma versión: no la toca')
  writeFileSync(join(from, 'manifest.json'), JSON.stringify({ version: '0.10.0' }))
  assert.equal(installExtensionFiles({ from, to }).actualizada, true)
  assert.equal(readFileSync(join(to, 'background.js'), 'utf8'), '// v2')
  assert.equal(installExtensionFiles({ from: join(base, 'no-existe'), to }).ok, false)
  assert.ok(existsSync(to))
  assert.equal(olderThan('0.6.0', '0.9.1'), true)
  assert.equal(olderThan('0.10.0', '0.9.1'), false)
  assert.equal(olderThan('0.9.1', '0.9.1'), false)
})

test('la extensión que viene con Pixie es una versión nueva', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  assert.ok(!olderThan(manifest.version, '0.9.1'))
})
