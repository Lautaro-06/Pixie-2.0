import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemory } from '../src/main/memory.js'
import { createBackup, cloudFolder } from '../src/main/backup.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'
import { categorize } from '../src/main/usage.js'

const tmp = (name) => mkdtempSync(join(tmpdir(), `pixie-${name}-`))
const ctxWith = (memory, extra = {}) => ({ memory, log: () => {}, ...extra })

test('anota el agua y las pausas del día', async () => {
  const memory = createMemory(join(tmp('salud'), 'memoria.json'))
  const ctx = ctxWith(memory)
  assert.equal((await runAction('registrar_agua', {}, ctx)).text, '¡Bien! Van 1 vaso hoy. Te faltan 7 para los 8.')
  assert.equal((await runAction('registrar_agua', { vasos: 7 }, ctx)).text, '¡8 vasos hoy! Cumpliste el objetivo del día.')
  assert.match((await runAction('registrar_pausa', {}, ctx)).text, /Primera pausa del día/)
  assert.match((await runAction('ver_salud', {}, ctx)).text, /^Hoy tomaste 8 vasos de agua de 8 e hiciste 1 pausa\./)
  assert.ok(memory.lastWater())
})

test('entiende las frases de salud y respaldo', () => {
  const act = (q) => interpretAll(q)?.map((i) => [i.action, i.params])
  assert.deepEqual(act('tomé agua'), [['registrar_agua', { vasos: 1 }]])
  assert.deepEqual(act('ya me tomé dos vasos de agua'), [['registrar_agua', { vasos: 2 }]])
  assert.deepEqual(act('ya me estiré'), [['registrar_pausa', {}]])
  assert.deepEqual(act('¿cuánta agua tomé hoy?'), [['ver_salud', {}]])
  assert.deepEqual(act('hacé un respaldo'), [['respaldar', {}]])
  assert.notEqual(act('recordame tomar agua en 20 minutos')?.[0]?.[0], 'registrar_agua')
})

test('reconoce reuniones y llamadas', () => {
  assert.deepEqual(categorize({ titulo: 'Reunión de Zoom', proceso: 'Zoom' }), { categoria: 'reunion', app: 'Zoom' })
  assert.deepEqual(categorize({ titulo: 'Meet - abc-defg-hij - Google Chrome', proceso: 'chrome' }), { categoria: 'reunion', app: 'Google Meet' })
  assert.deepEqual(categorize({ titulo: 'Reunión en "General" | Microsoft Teams', proceso: 'ms-teams' }), { categoria: 'reunion', app: 'Teams' })
  assert.notEqual(categorize({ titulo: 'Chat | Microsoft Teams', proceso: 'ms-teams' })?.categoria, 'reunion')
})

test('respalda en la compu y en OneDrive, sin las claves', () => {
  const data = tmp('datos')
  const one = tmp('onedrive')
  writeFileSync(join(data, 'memoria.json'), JSON.stringify({ nombre: 'Lauti' }))
  writeFileSync(join(data, 'config.json'), JSON.stringify({ ciudad: 'Rosario', claveIA: 'AQ.secreta', whatsapp: { apikey: 'x' } }))
  const b = createBackup({ dataDir: data, env: { OneDrive: one }, now: () => new Date(2026, 9, 2) })
  const r = b.backup()
  assert.deepEqual(r, { ok: true, cloud: true, cloudName: 'OneDrive' })
  assert.equal(JSON.parse(readFileSync(join(one, 'Pixie', 'memoria.json'), 'utf8')).nombre, 'Lauti')
  assert.ok(existsSync(join(one, 'Pixie', 'memoria-2026-10-02.json')))
  assert.ok(existsSync(join(data, 'respaldos', 'memoria.json')))
  const cfg = JSON.parse(readFileSync(join(one, 'Pixie', 'config.json'), 'utf8'))
  assert.deepEqual(cfg, { ciudad: 'Rosario' })
})

test('guarda solo los últimos 7 días', () => {
  const data = tmp('datos')
  writeFileSync(join(data, 'memoria.json'), '{}')
  for (let d = 1; d <= 10; d++) createBackup({ dataDir: data, env: {}, now: () => new Date(2026, 9, d) }).backup()
  const daily = readdirSync(join(data, 'respaldos')).filter((f) => f.startsWith('memoria-'))
  assert.equal(daily.length, 7)
  assert.ok(daily.includes('memoria-2026-10-10.json') && !daily.includes('memoria-2026-10-03.json'))
})

test('en una compu nueva recupera los recuerdos de la nube', () => {
  const one = tmp('onedrive')
  const old = tmp('vieja')
  writeFileSync(join(old, 'memoria.json'), JSON.stringify({ nombre: 'Lauti' }))
  createBackup({ dataDir: old, env: { OneDrive: one } }).backup()

  const fresh = tmp('nueva')
  const restored = createBackup({ dataDir: fresh, env: { OneDrive: one } }).restoreIfMissing()
  assert.deepEqual(restored, [{ file: 'memoria.json', from: 'OneDrive' }])
  assert.equal(JSON.parse(readFileSync(join(fresh, 'memoria.json'), 'utf8')).nombre, 'Lauti')
  // si ya tiene memoria, no la pisa
  assert.deepEqual(createBackup({ dataDir: fresh, env: { OneDrive: one } }).restoreIfMissing(), [])
})

test('sin memoria sana no respalda, y la carpeta de config.json manda', () => {
  const data = tmp('datos')
  writeFileSync(join(data, 'memoria.json'), '{ roto')
  assert.equal(createBackup({ dataDir: data, env: {} }).backup().ok, false)
  assert.deepEqual(cloudFolder({ carpetaRespaldo: 'G:\\Mi unidad\\Pixie' }, { OneDrive: 'C:\\OneDrive' }).dir, 'G:\\Mi unidad\\Pixie')
})
