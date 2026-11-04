import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { checkQuery } from '../safety.js'
import { redactSecrets } from '../sensitive.js'
import { BlockedError, FriendlyError } from '../windows.js'

const exec = promisify(execFile)
const DEFAULT_FOLDERS = ['src', 'docs', 'tests']
const GITIGNORE = `node_modules/\n.venv/\n__pycache__/\ndist/\nbuild/\ncoverage/\n.env\n*.log\n`

function checkText(text) {
  const blocked = checkQuery(text)
  if (blocked) throw new BlockedError(blocked)
}

function safeName(value) {
  const name = String(value ?? '').trim()
  if (!name || name === '.' || name === '..' || name.length > 80 || !/^[\p{L}\p{N}._ -]+$/u.test(name)) {
    throw new FriendlyError('Usá un nombre de proyecto corto, sin barras ni caracteres especiales.')
  }
  return name
}

function safeFolders(value) {
  const input = value === undefined ? DEFAULT_FOLDERS : value
  if (!Array.isArray(input) || input.length > 20) throw new FriendlyError('La lista de carpetas no es válida.')
  const folders = new Set()
  for (const raw of input) {
    const path = String(raw ?? '').trim().replace(/\\/g, '/')
    const parts = path.split('/')
    if (!path || path.length > 180 || isAbsolute(path) || parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) {
      throw new FriendlyError('Cada carpeta debe ser una ruta relativa sencilla, sin segmentos ocultos ni «..».')
    }
    checkText(path)
    folders.add(parts.join(sep))
  }
  return [...folders]
}

const inside = (root, path) => {
  const rel = relative(root, path)
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}

export const createProjectAction = {
  name: 'work_create_project',
  requiresAI: false,
  logLine: () => 'Modo Trabajo: creó un proyecto inicial',
  description: 'Crea un proyecto nuevo con README, .gitignore y carpetas iniciales, e intenta iniciar Git. Nunca sobrescribe una carpeta existente.',
  confirm: true,
  confirmText: ({ name, parent }) => `¿Creo el proyecto «${name}» dentro de «${parent}» con archivos iniciales e inicio Git?`,
  aiTool: {
    name: 'work_create_project',
    description: 'Crea un proyecto nuevo en la carpeta indicada. Pide confirmación al usuario. Solo crea README.md, .gitignore y carpetas vacías; no sobrescribe destinos existentes ni ejecuta comandos arbitrarios.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del proyecto, sin rutas' },
        parent: { type: 'string', description: 'Carpeta existente dentro de la cual crear el proyecto' },
        description: { type: 'string', description: 'Descripción breve para el README' },
        folders: { type: 'array', items: { type: 'string' }, description: 'Carpetas relativas iniciales; por defecto src, docs y tests' }
      },
      required: ['name', 'parent'],
      additionalProperties: false
    }
  },
  async run(params = {}, ctx) {
    const mode = ctx.work?.context?.()
    if (!mode?.habilitado || !mode.perfiles.some((profile) => profile.id === 'programador')) {
      throw new FriendlyError('Activá el perfil Programador en Ajustes → Modo Trabajo para crear proyectos.')
    }
    const name = safeName(params.name)
    checkText(name)
    const description = redactSecrets(String(params.description ?? '').trim().slice(0, 2000))
    if (description) checkText(description)
    const folders = safeFolders(params.folders)
    const parentValue = String(params.parent ?? '').trim()
    if (!parentValue || parentValue.length > 1024) throw new FriendlyError('Elegí una carpeta existente para guardar el proyecto.')

    let parent
    try {
      parent = await realpath(resolve(parentValue))
      if (!(await stat(parent)).isDirectory()) throw new Error('not a folder')
    } catch {
      throw new FriendlyError('No encontré la carpeta donde querés crear el proyecto.')
    }
    const target = resolve(parent, name)
    if (!inside(parent, target)) throw new FriendlyError('La carpeta del proyecto tiene que quedar dentro de la ubicación elegida.')

    try {
      await mkdir(target)
    } catch (error) {
      if (error.code === 'EEXIST') throw new FriendlyError('Ya existe una carpeta con ese nombre. No voy a sobrescribirla.')
      throw new FriendlyError('No pude crear la carpeta del proyecto.')
    }

    for (const folder of folders) await mkdir(resolve(target, folder), { recursive: true })
    const heading = `# ${name}`
    const readme = `${heading}\n\n${description || 'Descripción del proyecto.'}\n\n## Estructura inicial\n\n${folders.map((folder) => `- ${folder.split(sep).join('/')}`).join('\n')}\n`
    await writeFile(resolve(target, 'README.md'), readme, { encoding: 'utf8', flag: 'wx' })
    await writeFile(resolve(target, '.gitignore'), GITIGNORE, { encoding: 'utf8', flag: 'wx' })

    let initialized = false
    try {
      await exec('git', ['init'], { cwd: target, windowsHide: true, timeout: 15000 })
      initialized = true
    } catch {
      // El proyecto sigue siendo usable; Git puede inicializarse después.
    }

    const projects = ctx.work.getState().proyectos.filter((project) => project.carpeta.toLocaleLowerCase() !== target.toLocaleLowerCase())
    const saved = ctx.work.setProjects([...projects, { nombre: name, carpeta: target }])
    if (!saved.ok) throw new FriendlyError(saved.error)

    return {
      text: `Creé «${name}» con README.md, .gitignore y ${folders.length} carpetas iniciales${initialized ? ', e inicié Git' : '. No encontré Git instalado, así que no lo inicié'}.`,
      face: 'happy'
    }
  }
}
