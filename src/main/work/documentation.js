import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { checkQuery } from '../safety.js'
import { redactSecrets } from '../sensitive.js'
import { BlockedError, FriendlyError } from '../windows.js'

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc', '.html', '.htm'])
const ROOT_DOC_NAMES = /^(readme|contributing|changelog|changes|architecture|design|api|license)(\.|$)/i
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'out'])
const MAX_FILES = 120
const MAX_FILE_BYTES = 512 * 1024
const MAX_TOTAL_BYTES = 5 * 1024 * 1024
const MAX_RESULTS = 4
const MAX_EXCERPT = 700
const STOPWORDS = new Set(['como', 'para', 'sobre', 'desde', 'donde', 'cuando', 'cuanto', 'cual', 'que', 'por', 'una', 'uno', 'con', 'sin', 'del', 'las', 'los', 'the', 'and', 'for', 'with', 'from', 'this', 'that'])

const fold = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const inside = (root, path) => {
  const rel = relative(root, path)
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

async function collectFiles(root, allDocumentation = false) {
  const candidates = []
  const add = async (path, entry) => {
    if (entry.isSymbolicLink() || !entry.isFile()) return
    const ext = extname(entry.name).toLowerCase()
    const rootDoc = ROOT_DOC_NAMES.test(entry.name) && (ext === '' || DOC_EXTENSIONS.has(ext))
    if (!DOC_EXTENSIONS.has(ext) && !rootDoc) return
    const absolute = resolve(path)
    if (!inside(root, absolute)) return
    const info = await stat(absolute)
    if (info.size > 0 && info.size <= MAX_FILE_BYTES) candidates.push({ absolute, size: info.size })
  }
  const walk = async (directory) => {
    if (candidates.length >= MAX_FILES) return
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (candidates.length >= MAX_FILES) break
      const path = resolve(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name.toLowerCase())) await walk(path)
      } else {
        await add(path, entry)
      }
    }
  }

  if (allDocumentation) {
    await walk(root)
    return candidates
  }
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(root, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory() && entry.name.toLowerCase() === 'docs') await walk(path)
    else if (entry.isFile()) await add(path, entry)
  }
  return candidates
}

export async function readProjectDocumentation(folder, { allDocumentation = false } = {}) {
  let root
  try {
    root = await realpath(resolve(folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new FriendlyError('No encontré la carpeta del proyecto o no puedo leerla.')
  }
  const files = await collectFiles(root, allDocumentation)
  const documents = []
  let total = 0
  for (const file of files) {
    if (total + file.size > MAX_TOTAL_BYTES) break
    try {
      const current = await realpath(file.absolute)
      if (!inside(root, current)) continue
      const info = await stat(current)
      if (!info.isFile() || info.size > MAX_FILE_BYTES) continue
      const text = redactSecrets(await readFile(current, 'utf8')).replace(/\0/g, '').trim()
      if (!text) continue
      total += file.size
      documents.push({ path: relative(root, file.absolute).split(sep).join('/'), text })
    } catch {
      // Un archivo ilegible no impide buscar en el resto de la documentación.
    }
  }
  return documents
}

function termsOf(query) {
  return fold(query).split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !STOPWORDS.has(term))
}

export function searchDocumentation(documents, query) {
  const terms = [...new Set(termsOf(query))]
  if (!terms.length) return []
  const matches = []
  for (const document of documents) {
    const blocks = document.text.split(/\n\s*\n|(?=^#{1,6}\s)/m).map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean)
    for (const block of blocks) {
      const normalized = fold(block)
      const hits = terms.filter((term) => normalized.includes(term)).length
      if (!hits) continue
      matches.push({ path: document.path, score: hits / terms.length, excerpt: block.slice(0, MAX_EXCERPT) })
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, MAX_RESULTS)
}

function projectFor(params, ctx) {
  const work = ctx.work
  const mode = work?.context?.()
  if (!mode?.habilitado || !mode.perfiles.some((profile) => profile.id === 'programador')) {
    throw new FriendlyError('Activá el perfil Programador en Ajustes → Modo Trabajo para consultar documentación.')
  }
  const projects = work.getState().proyectos
  const name = String(params.project ?? '').trim().toLocaleLowerCase()
  const project = name ? projects.find((item) => item.nombre.toLocaleLowerCase() === name) : projects[0]
  if (!project) throw new FriendlyError('Agregá un proyecto en Ajustes → Modo Trabajo antes de consultar su documentación.')
  return project
}

export const documentationAction = {
  name: 'work_docs',
  requiresAI: false,
  logLine: () => 'Modo Trabajo: consultó documentación',
  description: 'Busca palabras clave en README y documentos de la carpeta docs de un proyecto guardado. Devuelve fragmentos limitados para responder sin enviar el proyecto entero.',
  aiTool: {
    name: 'work_docs',
    description: 'Busca en README y documentación de un proyecto que el usuario guardó. Devuelve solo unos pocos fragmentos relevantes. Usa la búsqueda solo si pregunta por la documentación de ese proyecto; nunca pidas ni envíes el proyecto entero.',
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Nombre del proyecto guardado (opcional si hay uno solo)' },
        query: { type: 'string', description: 'Pregunta o palabras clave para buscar en la documentación' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  async run(params = {}, ctx) {
    const query = String(params.query ?? '').trim().slice(0, 300)
    const blocked = checkQuery(query)
    if (blocked) throw new BlockedError(blocked)
    if (!query) throw new FriendlyError('Decime qué querés buscar en la documentación.')
    const project = projectFor(params, ctx)
    const documents = await readProjectDocumentation(project.carpeta)
    if (!documents.length) return { text: `No encontré README ni archivos de documentación compatibles en ${project.nombre}.`, face: 'confused' }
    const matches = searchDocumentation(documents, query)
    if (!matches.length) return { text: `Busqué en ${documents.length} documentos de ${project.nombre} y no encontré coincidencias para «${query}».`, face: 'confused' }
    for (const match of matches) {
      const blocked = checkQuery(match.excerpt)
      if (blocked) throw new BlockedError(blocked)
    }
    const snippets = matches.map((match) => `${match.path}: ${match.excerpt}`).join('\n\n')
    return { text: `Encontré ${matches.length} fragmentos en ${project.nombre}:\n\n${snippets}`, face: 'happy' }
  }
}
