import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createBackup } from '../src/main/backup.js'
import { needsConfirm, resolveAction, runAction } from '../src/main/actions/index.js'
import { createMemory } from '../src/main/memory.js'
import { createWork } from '../src/main/work/index.js'
import { documentationAction, readProjectDocumentation, searchDocumentation } from '../src/main/work/documentation.js'
import { createProjectAction } from '../src/main/work/create-project.js'
import { editedCommitMessage } from '../src/main/work/git.js'

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

test('lee README y docs, pero omite código fuente y archivos no documentales', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pixie-docs-'))
  mkdirSync(join(folder, 'docs'))
  mkdirSync(join(folder, 'src'))
  writeFileSync(join(folder, 'README.md'), '# Inicio\n\nLa instalación usa npm test.')
  writeFileSync(join(folder, 'docs', 'setup.md'), '# Instalación\n\nnpm test ejecuta todas las pruebas.')
  writeFileSync(join(folder, 'docs', 'ignored.js'), 'const secret = "not documentation"')
  writeFileSync(join(folder, 'src', 'private.js'), 'const internal = "not documentation"')
  writeFileSync(join(folder, 'notes.js'), 'Este archivo raíz no es documentación.')

  const documents = await readProjectDocumentation(folder)
  assert.deepEqual(new Set(documents.map((doc) => doc.path)), new Set(['README.md', 'docs/setup.md']))
  const matches = searchDocumentation(documents, 'cómo ejecutar pruebas')
  assert.ok(matches.length)
  assert.match(matches[0].excerpt, /npm test/)
  assert.equal(documents.some((doc) => doc.text.includes('not documentation')), false)
})

test('crea un proyecto nuevo con plantillas fijas, Git y registro en memoria', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'pixie-projects-'))
  const work = createWork()
  work.setActiveProfiles(['programador'])
  work.setEnabled(true)
  const ctx = { work, log: () => {}, reportError: () => {} }
  const params = { name: 'Demo', parent, description: 'Proyecto de prueba', folders: ['src', 'docs'] }
  assert.equal(needsConfirm(createProjectAction, params, ctx), true)
  const result = await runAction(createProjectAction.name, { ...params, confirmado: true }, ctx)
  const folder = join(parent, 'Demo')
  assert.match(result.text, /inicié Git/)
  assert.equal(existsSync(join(folder, 'README.md')), true)
  assert.equal(existsSync(join(folder, '.gitignore')), true)
  assert.equal(existsSync(join(folder, 'src')), true)
  assert.equal(existsSync(join(folder, 'docs')), true)
  assert.equal(work.getState().proyectos[0].nombre, 'Demo')
  assert.equal(existsSync(work.getState().proyectos[0].carpeta), true)
  assert.match(work.getState().proyectos[0].carpeta, /[\\/]Demo$/)

  const original = readFileSync(join(folder, 'README.md'), 'utf8')
  const duplicate = await runAction(createProjectAction.name, { ...params, confirmado: true }, ctx)
  assert.match(duplicate.text, /Ya existe una carpeta/)
  assert.equal(readFileSync(join(folder, 'README.md'), 'utf8'), original)
})

test('consulta documentación sin IA y no registra la búsqueda ni los fragmentos', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pixie-doc-action-'))
  writeFileSync(join(folder, 'README.md'), '# Compilación\n\nEjecutá npm test para probar el proyecto.')
  const work = createWork()
  work.setActiveProfiles(['programador'])
  work.setProjects([{ nombre: 'Demo', carpeta: folder }])
  work.setEnabled(true)
  const logs = []
  const ctx = { work, log: (line) => logs.push(line), reportError: () => {} }
  const result = await runAction(documentationAction.name, { project: 'Demo', query: 'como probar' }, ctx)
  assert.match(result.text, /npm test/)
  assert.deepEqual(logs, ['Modo Trabajo: consultó documentación'])
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

test('permite editar el mensaje propuesto para un commit antes de confirmarlo', () => {
  assert.equal(editedCommitMessage('cambiá el mensaje a arregla el formulario'), 'arregla el formulario')
  assert.equal(editedCommitMessage('no, usá el mensaje del commit por agrega validación'), 'agrega validación')
  assert.equal(editedCommitMessage('sí'), null)
  assert.equal(editedCommitMessage('cambiá el mensaje a   '), null)
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
