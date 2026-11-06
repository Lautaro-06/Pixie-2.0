import { checkQuery } from '../safety.js'
import { BlockedError, FriendlyError } from '../windows.js'
import { readProjectDocumentation, searchDocumentation } from './documentation.js'

export const knowledgeAction = {
  name: 'work_knowledge',
  requiresAI: false,
  logLine: () => 'Modo Trabajo: consultó fuentes elegidas',
  description: 'Busca en documentación de carpetas que la persona eligió explícitamente en Ajustes → Trabajo.',
  aiTool: {
    name: 'work_knowledge',
    description: 'Busca por palabras clave solo en carpetas de documentación que la persona agregó en Ajustes → Trabajo. Devuelve unos pocos fragmentos relevantes, nunca lee carpetas no elegidas ni el proyecto entero.',
    input_schema: {
      type: 'object',
      properties: {
        fuente: { type: 'string', description: 'Nombre de una fuente elegida (opcional si hay una sola)' },
        query: { type: 'string', description: 'Pregunta o palabras clave para buscar en la documentación' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  async run(params = {}, ctx) {
    const query = String(params.query ?? '').trim().slice(0, 300)
    if (!query) throw new FriendlyError('Decime qué querés buscar en tus fuentes de trabajo.')
    const blocked = checkQuery(query)
    if (blocked) throw new BlockedError(blocked)

    const mode = ctx.work?.context?.()
    if (!mode?.habilitado || !mode.perfiles.length) throw new FriendlyError('Activá un perfil en Ajustes → Trabajo para consultar tus fuentes.')
    const selected = new Set(mode.perfiles.map(({ id }) => id))
    const allSources = ctx.work.getState().fuentesConocimiento ?? []
    const sources = allSources.filter((source) => selected.has(source.perfilId))
    const requested = String(params.fuente ?? '').trim().toLocaleLowerCase()
    const matching = requested ? sources.filter((source) => source.nombre.toLocaleLowerCase() === requested) : sources
    if (!matching.length) {
      throw new FriendlyError(sources.length
        ? `No encontré una fuente elegida con el nombre «${params.fuente}».`
        : 'Agregá una carpeta de documentación en el panel de tu perfil, dentro de Ajustes → Trabajo.')
    }

    const matches = []
    for (const source of matching) {
      const documents = await readProjectDocumentation(source.carpeta, { allDocumentation: true })
      for (const result of searchDocumentation(documents, query)) {
        const blockedExcerpt = checkQuery(result.excerpt)
        if (blockedExcerpt) throw new BlockedError(blockedExcerpt)
        matches.push({ ...result, fuente: source.nombre })
      }
    }
    const top = matches.sort((a, b) => b.score - a.score || a.fuente.localeCompare(b.fuente)).slice(0, 4)
    if (!top.length) return { text: 'No encontré coincidencias en las fuentes que elegiste.', face: 'confused' }
    return {
      text: `Encontré ${top.length} fragmentos:\n\n${top.map((item) => `${item.fuente} · ${item.path}: ${item.excerpt}`).join('\n\n')}`,
      face: 'happy'
    }
  }
}
