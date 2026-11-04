import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createBackup } from '../src/main/backup.js'
import { needsConfirm, resolveAction, runAction } from '../src/main/actions/index.js'
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

test('valida y deduplica proyectos por ruta sin leer la carpeta', () => {
  const work = createWork()
  const result = work.setProjects([
    { nombre: 'Pixie', carpeta: 'C:\\Proyectos\\Pixie' },
    { nombre: 'Otra etiqueta', carpeta: 'c:\\proyectos\\pixie' }
  ])
  assert.equal(result.ok, true)
  assert.deepEqual(result.proyectos, [{ nombre: 'Pixie', carpeta: 'C:\\Proyectos\\Pixie' }])
  assert.equal(work.setProjects([{ nombre: 'Incompleto', carpeta: '' }]).ok, false)
})

test('Git trabaja solo en proyectos conocidos y confirma operaciones riesgosas', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pixie-git-'))
  execFileSync('git', ['init'], { cwd: folder, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Pixie Test'], { cwd: folder })
  execFileSync('git', ['config', 'user.email', 'pixie@example.invalid'], { cwd: folder })
  writeFileSync(join(folder, 'README.md'), 'Proyecto de prueba\n')
  execFileSync('git', ['add', '--', 'README.md'], { cwd: folder })
  execFileSync('git', ['commit', '-m', 'inicio'], { cwd: folder, stdio: 'ignore' })

  const work = createWork()
  const ctx = { work, log: () => {}, reportError: () => {} }
  assert.equal(resolveAction('work_git', ctx), null)
  work.setActiveProfiles(['programador'])
  work.setProjects([{ nombre: 'Temporal', carpeta: folder }])
  work.setEnabled(true)
  const action = resolveAction('work_git', ctx)
  assert.ok(action)

  writeFileSync(join(folder, 'README.md'), 'Proyecto de prueba\ncambio visible\n')
  const status = await runAction('work_git', { operation: 'status' }, ctx)
  assert.match(status.text, /README\.md/)
  const diff = await runAction('work_git', { operation: 'diff' }, ctx)
  assert.match(diff.text, /cambio visible/)
  await runAction('work_git', { operation: 'add', path: 'README.md' }, ctx)

  const commit = { operation: 'commit', message: 'agrega nota' }
  assert.equal(needsConfirm(action, commit, ctx), true)
  const committed = await runAction('work_git', { ...commit, confirmado: true }, ctx)
  assert.match(committed.text, /agrega nota/)

  writeFileSync(join(folder, 'README.md'), 'Proyecto de prueba\notro cambio\n')
  await runAction('work_git', { operation: 'add', path: 'README.md' }, ctx)
  const pending = []
  ctx.setPending = (item) => pending.push(item)
  ctx.ai = { enabled: () => true, suggestCommitMessage: async (contents) => (contents.includes('otro cambio') ? 'actualiza la documentación' : '') }
  const proposal = await runAction('work_git', { operation: 'commit' }, ctx)
  assert.equal(proposal.confirm, true)
  assert.match(proposal.text, /actualiza la documentación/)
  assert.equal(pending.length, 1)
  assert.equal(needsConfirm(action, pending[0].params, ctx), true)
  const proposedCommit = await runAction('work_git', { ...pending[0].params, confirmado: true }, ctx)
  assert.match(proposedCommit.text, /actualiza la documentación/)

  const create = { operation: 'create_branch', name: 'feature/demo' }
  assert.equal(needsConfirm(action, create, ctx), true)
  const branch = await runAction('work_git', { ...create, confirmado: true }, ctx)
  assert.match(branch.text, /feature\/demo/)
  for (const operation of ['switch_branch', 'pull', 'push']) assert.equal(needsConfirm(action, { operation, name: 'main' }, ctx), true)

  const unsafePath = await runAction('work_git', { operation: 'add', path: '..\\outside.txt' }, ctx)
  assert.match(unsafePath.text, /Solo puedo agregar archivos dentro/)
  const arbitrary = await runAction('work_git', { operation: 'reset --hard' }, ctx)
  assert.match(arbitrary.text, /no está permitida/)
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
