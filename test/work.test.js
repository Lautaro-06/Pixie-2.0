import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBackup } from '../src/main/backup.js'
import { createMemory } from '../src/main/memory.js'
import { createWork } from '../src/main/work/index.js'

const fresh = () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pixie-work-')), 'memoria.json')
  return { file, memory: createMemory(file) }
}

const profile = (id, name, actions = []) => ({
  id,
  nombre: name,
  descripcion: `${name} de prueba.`,
  instruccionesIA: `Instrucciones de ${name}.`,
  acciones: actions,
  señales: [],
  fuentes: [],
  fuentesNoticias: []
})

test('mantiene apagado el modo de trabajo hasta activarlo', () => {
  const { memory } = fresh()
  const work = createWork({ memory })
  assert.equal(work.getState().habilitado, false)
  assert.deepEqual(work.context().perfiles, [])
  assert.deepEqual(work.listProfiles().map((item) => item.id), ['programador', 'cientifico', 'disenador', 'libre'])
  assert.deepEqual(work.context().fuentesNoticias, [])
})

test('combina perfiles activos y omite los inactivos', () => {
  const { memory } = fresh()
  const work = createWork({
    memory,
    profiles: [
      profile('uno', 'Uno', [{ name: 'accion_uno', run: () => 'uno' }]),
      profile('dos', 'Dos', [{ name: 'accion_dos', run: () => 'dos' }]),
      profile('inactivo', 'Inactivo', [{ name: 'accion_oculta', run: () => 'no' }])
    ]
  })
  assert.equal(work.setActiveProfiles(['uno', 'dos']).ok, true)
  work.setEnabled(true)
  const context = work.context()
  assert.deepEqual(context.perfiles.map((item) => item.id), ['uno', 'dos'])
  assert.deepEqual(Object.keys(context.acciones), ['accion_uno', 'accion_dos'])
  assert.equal(context.instruccionesIA, 'Instrucciones de Uno.\n\nInstrucciones de Dos.')
  assert.equal(context.instruccionesIA.includes('Inactivo'), false)
})

test('rechaza perfiles con acciones duplicadas sin pisar el estado', () => {
  const { memory } = fresh()
  const work = createWork({
    memory,
    profiles: [profile('uno', 'Uno', [{ name: 'compartida' }]), profile('dos', 'Dos', [{ name: 'compartida' }])]
  })
  const result = work.setActiveProfiles(['uno', 'dos'])
  assert.equal(result.ok, false)
  assert.deepEqual(result.colisiones, [{ accion: 'compartida', perfiles: ['uno', 'dos'] }])
  assert.deepEqual(work.getState().perfilesActivos, [])
})

test('persiste perfiles y descripción libre en memoria.json', () => {
  const { file, memory } = fresh()
  const work = createWork({ memory })
  work.setFreeDescription('Diseño de interfaces accesibles')
  work.setActiveProfiles(['libre'])
  work.setEnabled(true)

  const reloaded = createWork({ memory: createMemory(file) })
  assert.equal(reloaded.getState().habilitado, true)
  assert.deepEqual(reloaded.getState().perfilesActivos, ['libre'])
  assert.match(reloaded.context().instruccionesIA, /Diseño de interfaces accesibles/)
})

test('olvidar el modo de trabajo borra su estado', () => {
  const { memory } = fresh()
  const work = createWork({ memory })
  work.setFreeDescription('Diseño')
  work.clear()
  assert.equal(createWork({ memory }).getState().descripcionLibre, '')
})

test('respalda los datos de trabajo sin incluir claves', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pixie-work-backup-'))
  const memory = createMemory(join(dataDir, 'memoria.json'))
  const work = createWork({ memory })
  work.setFreeDescription('Diseño de interfaces')
  work.setActiveProfiles(['libre'])
  work.setEnabled(true)
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ claveIA: 'secreto-de-prueba' }))

  const backup = createBackup({ dataDir, env: {} })
  assert.equal(backup.backup().ok, true)
  const savedMemory = JSON.parse(readFileSync(join(dataDir, 'respaldos', 'memoria.json'), 'utf8'))
  const savedConfig = JSON.parse(readFileSync(join(dataDir, 'respaldos', 'config.json'), 'utf8'))
  assert.equal(savedMemory.trabajo.descripcionLibre, 'Diseño de interfaces')
  assert.equal('claveIA' in savedConfig, false)
})
