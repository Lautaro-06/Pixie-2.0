import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkQuery } from '../safety.js'
import { BlockedError, FriendlyError } from '../windows.js'

const exec = promisify(execFile)
const OUTPUT_LIMIT = 12000
const OPERATIONS = ['status', 'diff', 'log', 'branches', 'create_branch', 'switch_branch', 'add', 'commit', 'pull', 'push']
const CONFIRM = new Set(['create_branch', 'switch_branch', 'commit', 'pull', 'push'])
const ENUM = { type: 'string', enum: OPERATIONS, description: 'Operación Git permitida' }

async function runGit(args, cwd) {
  try {
    const { stdout, stderr } = await exec('git', args, { cwd, windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 })
    return String(stdout || stderr || '').trim()
  } catch (error) {
    if (error.code === 'ENOENT') throw new FriendlyError('No encontré Git instalado en esta compu.')
    const detail = String(error.stderr || error.stdout || error.message || '').trim().slice(0, 1000)
    throw new FriendlyError(`Git no pudo completar la operación${detail ? `: ${detail}` : '.'}`)
  }
}

function checkText(value) {
  const blocked = checkQuery(value)
  if (blocked) throw new BlockedError(blocked)
}

function safeBranch(name) {
  const branch = String(name ?? '').trim()
  if (!branch || branch.length > 200 || /[\0\r\n]/.test(branch)) throw new FriendlyError('Decime un nombre de rama válido.')
  return branch
}

function safeRelativePath(value) {
  const input = String(value ?? '').trim()
  if (!input || input.length > 1000 || /[\0\r\n]/.test(input)) throw new FriendlyError('Decime un archivo o carpeta para agregar.')
  if (input === '.') return input
  if (/^(?:[a-z]:[\\/]|[\\/])|(^|[\\/])\.\.(?:[\\/]|$)/i.test(input)) throw new FriendlyError('Solo puedo agregar archivos dentro de la carpeta del proyecto.')
  return input
}

export function editedCommitMessage(input) {
  const match = /^(?:no[,.]?\s*)?(?:edit[aá]|cambi[aá]|usa|us[aá])\s+(?:el\s+)?mensaje(?:\s+del\s+commit)?\s*(?:a|por|:)\s*(.+)$/i.exec(String(input ?? '').trim())
  const message = match?.[1]?.trim().slice(0, 200)
  return message || null
}

async function projectRoot(params, ctx) {
  const work = ctx.work
  const mode = work?.context?.()
  if (!mode?.habilitado || !mode.perfiles.some((profile) => profile.id === 'programador')) {
    throw new FriendlyError('Activá el perfil Programador en Ajustes → Modo Trabajo para usar Git.')
  }
  const projects = work.getState().proyectos
  const requested = String(params.project ?? '').trim().toLocaleLowerCase()
  const project = requested ? projects.find((item) => item.nombre.toLocaleLowerCase() === requested) : projects[0]
  if (!project) throw new FriendlyError('Agregá un proyecto en Ajustes → Modo Trabajo antes de usar Git.')
  checkText(project.nombre)
  checkText(project.carpeta)
  const folder = resolve(project.carpeta)
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new FriendlyError(`No encontré la carpeta del proyecto «${project.nombre}».`)
  const root = resolve(await runGit(['rev-parse', '--show-toplevel'], folder))
  return { root, project }
}

export const gitAction = {
  name: 'work_git',
  description: 'Usa Git en un proyecto conocido. Solo permite estado, diff, log, listar/crear/cambiar ramas, agregar archivos, commit, pull y push. Nunca borra ramas ni ejecuta comandos arbitrarios.',
  confirm: ({ operation, message }) => CONFIRM.has(operation) && (operation !== 'commit' || Boolean(String(message ?? '').trim())),
  confirmText: ({ operation, name, message }) => {
    const what = {
      create_branch: `¿Creo la rama «${name}»?`,
      switch_branch: `¿Cambio a la rama «${name}»?`,
      commit: `¿Hago el commit con el mensaje «${message}»?`,
      pull: '¿Hago git pull en el proyecto seleccionado?',
      push: '¿Hago git push en el proyecto seleccionado?'
    }
    const editHint = operation === 'commit' ? ' Si querés cambiarlo, decime «cambiá el mensaje a …».' : ''
    return `${what[operation] ?? '¿Ejecuto esta operación Git?'}${editHint} Confirmá antes de que la haga.`
  },
  aiTool: {
    name: 'work_git',
    description: 'Opera Git únicamente en un proyecto guardado en el Modo Trabajo. Usa solo las operaciones enumeradas. Para commit, revisa el diff y propone un mensaje breve; Pixie siempre solicita confirmación. Nunca intentes usar otros comandos, borrar ramas, forzar push, reset --hard ni clean -fd.',
    input_schema: {
      type: 'object',
      properties: {
        operation: ENUM,
        project: { type: 'string', description: 'Nombre del proyecto guardado (opcional si hay uno solo)' },
        name: { type: 'string', description: 'Nombre de rama para crear o cambiar' },
        path: { type: 'string', description: 'Ruta relativa de archivo/carpeta para git add; . agrega todos los cambios' },
        message: { type: 'string', description: 'Mensaje del commit propuesto' }
      },
      required: ['operation'],
      additionalProperties: false
    }
  },
  async run(params = {}, ctx) {
    const operation = String(params.operation ?? '')
    if (!OPERATIONS.includes(operation)) throw new FriendlyError('Esa operación Git no está permitida.')
    for (const value of [params.project, params.name, params.path, params.message]) if (typeof value === 'string') checkText(value)
    const { root, project } = await projectRoot(params, ctx)
    const prefix = `${project.nombre}: `
    if (operation === 'status') return { text: `${prefix}${(await runGit(['status', '--short', '--branch'], root)) || 'sin cambios.'}`, face: 'happy' }
    if (operation === 'diff') return { text: `${prefix}${(await runGit(['diff', '--'], root)).slice(0, OUTPUT_LIMIT) || 'No hay cambios sin agregar.'}`, face: 'happy' }
    if (operation === 'log') return { text: `${prefix}${(await runGit(['log', '-5', '--oneline'], root)) || 'Todavía no hay commits.'}`, face: 'happy' }
    if (operation === 'branches') return { text: `${prefix}${(await runGit(['branch', '--list'], root)) || 'No hay ramas.'}`, face: 'happy' }
    if (operation === 'create_branch' || operation === 'switch_branch') {
      const name = safeBranch(params.name)
      await runGit(['check-ref-format', '--branch', name], root)
      const result = operation === 'create_branch'
        ? await runGit(['branch', '--', name], root)
        : await runGit(['switch', '--', name], root)
      return { text: `${operation === 'create_branch' ? 'Creé' : 'Cambié a'} la rama «${name}».${result ? ` ${result}` : ''}`, face: 'happy' }
    }
    if (operation === 'add') {
      const path = safeRelativePath(params.path)
      const result = await runGit(['add', '--', path], root)
      return { text: `Agregué «${path}» al área de preparación.${result ? ` ${result}` : ''}`, face: 'happy' }
    }
    if (operation === 'commit') {
      const message = String(params.message ?? '').trim().slice(0, 200)
      if (!message) {
        const diff = (await runGit(['diff', '--cached'], root)) || (await runGit(['diff'], root))
        if (!diff) throw new FriendlyError('No hay cambios para resumir. Agregá los archivos y probá de nuevo.')
        let proposed = null
        if (ctx.ai?.enabled?.() && ctx.ai.suggestCommitMessage) {
          try {
            proposed = await ctx.ai.suggestCommitMessage(diff)
          } catch {
            proposed = null
          }
        }
        if (!proposed) throw new FriendlyError('Sin IA no puedo proponer el mensaje. Decime «git commit» seguido del mensaje y te pregunto antes de hacerlo.')
        const pending = { operation, message: proposed, ...(params.project ? { project: params.project } : {}) }
        ctx.setPending?.({ action: 'work_git', params: pending })
        return { text: `Propongo «${proposed}». ¿Hago el commit con ese mensaje?`, face: 'idle', confirm: true }
      }
      const result = await runGit(['commit', '-m', message], root)
      return { text: result.slice(0, OUTPUT_LIMIT) || 'Commit creado.', face: 'happy' }
    }
    if (operation === 'pull' || operation === 'push') {
      const result = await runGit([operation], root)
      return { text: result.slice(0, OUTPUT_LIMIT) || `Listo: git ${operation}.`, face: 'happy' }
    }
    throw new FriendlyError('Esa operación Git no está permitida.')
  }
}
