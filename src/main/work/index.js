import { WORK_PROFILES } from './profiles/index.js'
import { knowledgeAction } from './knowledge.js'
import { isAbsolute } from 'node:path'

const DEFAULT_STATE = {
  habilitado: false,
  trabaja: null,
  perfilesActivos: [],
  descripcionLibre: '',
  proyectos: [],
  fuentesConocimiento: [],
  perfilesDescartados: [],
  buscandoTrabajo: false,
  deteccion: {}
}

const clone = (value) => structuredClone(value)

function normalizeState(value = {}) {
  return {
    ...clone(DEFAULT_STATE),
    ...(value && typeof value === 'object' ? value : {}),
    perfilesActivos: Array.isArray(value?.perfilesActivos) ? [...new Set(value.perfilesActivos)] : [],
    proyectos: Array.isArray(value?.proyectos) ? value.proyectos : [],
    fuentesConocimiento: Array.isArray(value?.fuentesConocimiento) ? value.fuentesConocimiento : [],
    perfilesDescartados: Array.isArray(value?.perfilesDescartados) ? value.perfilesDescartados : [],
    deteccion: value?.deteccion && typeof value.deteccion === 'object' ? value.deteccion : {}
  }
}

function validateProfile(profile) {
  if (!profile || typeof profile.id !== 'string' || !profile.id.trim()) throw new TypeError('Cada perfil necesita un id.')
  for (const field of ['nombre', 'descripcion']) {
    if (typeof profile[field] !== 'string') throw new TypeError(`El perfil ${profile.id} necesita ${field}.`)
  }
  if (typeof profile.instruccionesIA !== 'string' && typeof profile.instruccionesIA !== 'function') {
    throw new TypeError(`El perfil ${profile.id} necesita instruccionesIA.`)
  }
  for (const field of ['acciones', 'señales', 'fuentes', 'fuentesNoticias']) {
    if (!Array.isArray(profile[field])) throw new TypeError(`El perfil ${profile.id} necesita ${field} como lista.`)
  }
  return profile
}

export function createWork({ memory, profiles = WORK_PROFILES } = {}) {
  const registry = new Map()
  for (const rawProfile of profiles) {
    const profile = validateProfile(rawProfile)
    if (registry.has(profile.id)) throw new Error(`El perfil «${profile.id}» está registrado más de una vez.`)
    registry.set(profile.id, profile)
  }

  let state = normalizeState(memory?.getWork?.())
  const persist = () => {
    state = normalizeState(memory?.setWork?.(state) ?? state)
    return clone(state)
  }

  function selected(ids = state.perfilesActivos) {
    return ids.map((id) => registry.get(id)).filter(Boolean)
  }

  function compose(ids = state.perfilesActivos, enabled = state.habilitado) {
    const active = enabled ? selected(ids) : []
    const actions = {}
    const collisions = []
    const conflicted = new Set()
    const registeredActions = active.flatMap((profile) => profile.acciones.map((action) => ({ profile, action })))
    if (active.length) registeredActions.push({ profile: { id: 'compartido' }, action: knowledgeAction })
    for (const { profile, action } of registeredActions) {
      const name = action?.name
      if (typeof name !== 'string' || !name) continue
      if (name in actions) {
        collisions.push({ accion: name, perfiles: [actions[name].perfil, profile.id] })
        delete actions[name]
        conflicted.add(name)
      } else if (!conflicted.has(name)) {
        actions[name] = { ...action, perfil: profile.id }
      }
    }
    const instructions = active
      .map((profile) => (typeof profile.instruccionesIA === 'function' ? profile.instruccionesIA(state) : profile.instruccionesIA))
      .filter((text) => typeof text === 'string' && text.trim())
    return {
      habilitado: Boolean(enabled),
      perfiles: active.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
      instruccionesIA: instructions.join('\n\n'),
      acciones: Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'perfil'))])),
      herramientas: Object.values(actions).map((action) => action.aiTool).filter(Boolean),
      fuentes: active.flatMap((profile) => profile.fuentes),
      fuentesNoticias: active.flatMap((profile) => profile.fuentesNoticias),
      fuentesConocimiento: state.fuentesConocimiento
        .filter((source) => active.some((profile) => profile.id === source.perfilId))
        .map(({ id, nombre, perfilId }) => ({ id, nombre, perfilId })),
      colisiones: collisions
    }
  }

  return {
    listProfiles: () => [...registry.values()].map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
    getState: () => clone(state),
    context: () => compose(),
    setEnabled(enabled) {
      state.habilitado = Boolean(enabled)
      persist()
      return compose()
    },
    setActiveProfiles(ids) {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !registry.has(id))) {
        return { ok: false, error: 'Hay un perfil desconocido.' }
      }
      const unique = [...new Set(ids)]
      const combined = compose(unique, true)
      if (combined.colisiones.length) return { ok: false, error: 'Hay acciones repetidas entre perfiles.', colisiones: combined.colisiones }
      state.perfilesActivos = unique
      persist()
      return { ok: true, ...compose() }
    },
    setFreeDescription(description) {
      state.descripcionLibre = String(description ?? '').trim().slice(0, 1000)
      persist()
      return compose()
    },
    setProjects(projects) {
      if (!Array.isArray(projects)) return { ok: false, error: 'La lista de proyectos no es válida.' }
      const byPath = new Map()
      for (const project of projects) {
        const nombre = String(project?.nombre ?? '').trim().slice(0, 80)
        const carpeta = String(project?.carpeta ?? '').trim().slice(0, 1024)
        if (!nombre || !carpeta) return { ok: false, error: 'Cada proyecto necesita un nombre y una carpeta.' }
        const key = carpeta.toLocaleLowerCase()
        if (!byPath.has(key)) byPath.set(key, { nombre, carpeta })
      }
      state.proyectos = [...byPath.values()]
      persist()
      return { ok: true, proyectos: clone(state.proyectos) }
    },
    setKnowledgeSources(sources) {
      if (!Array.isArray(sources) || sources.length > 10) return { ok: false, error: 'Podés agregar hasta 10 fuentes de referencia.' }
      const bySource = new Map()
      for (const source of sources) {
        const nombre = String(source?.nombre ?? '').trim().slice(0, 80)
        const carpeta = String(source?.carpeta ?? '').trim().slice(0, 1024)
        const perfilId = String(source?.perfilId ?? '')
        if (!nombre || !carpeta || !isAbsolute(carpeta) || !registry.has(perfilId)) return { ok: false, error: 'Cada fuente necesita un nombre, una ruta absoluta y un perfil válido.' }
        const key = `${perfilId}|${carpeta.toLocaleLowerCase()}`
        if (!bySource.has(key)) bySource.set(key, { id: key, nombre, carpeta, perfilId })
      }
      state.fuentesConocimiento = [...bySource.values()]
      persist()
      return { ok: true, fuentesConocimiento: clone(state.fuentesConocimiento) }
    },
    suggestionForUsage(usage, now = new Date()) {
      const day = now.toISOString().slice(0, 10)
      if (state.trabaja === false || state.deteccion.deshabilitada || state.deteccion.sugerenciaDia === day) return null
      const active = new Set(state.perfilesActivos)
      const dismissed = new Set(state.perfilesDescartados)
      for (const profile of registry.values()) {
        if (active.has(profile.id) || dismissed.has(profile.id)) continue
        const signals = profile.señales
        const apps = usage?.apps ?? {}
        const matchedApps = []
        const seconds = signals.reduce((sum, signal) => {
          const names = typeof signal === 'string' ? [signal] : Array.isArray(signal?.apps) ? signal.apps : []
          return sum + Object.entries(apps).reduce((appSum, [app, duration]) => {
            if (!names.some((name) => app.toLocaleLowerCase().includes(String(name).toLocaleLowerCase()))) return appSum
            matchedApps.push(app)
            return appSum + Number(duration || 0)
          }, 0)
        }, 0)
        if (seconds >= 60 * 60) return { id: profile.id, nombre: profile.nombre, apps: [...new Set(matchedApps)] }
      }
      return null
    },
    recordSuggestion(profileId, now = new Date()) {
      if (!registry.has(profileId)) return false
      state.deteccion.sugerenciaDia = now.toISOString().slice(0, 10)
      state.deteccion.ultimaSugerencia = profileId
      persist()
      return true
    },
    answerSuggestion(profileId, answer) {
      if (!registry.has(profileId)) return { ok: false, error: 'El perfil sugerido no existe.' }
      if (answer === 'never') {
        state.deteccion.deshabilitada = true
        persist()
        return { ok: true, message: 'No volveré a sugerir perfiles.' }
      }
      if (answer === 'no') {
        if (!state.perfilesDescartados.includes(profileId)) state.perfilesDescartados.push(profileId)
        persist()
        return { ok: true, message: 'Entendido, no volveré a sugerir ese perfil.' }
      }
      if (answer !== 'yes') return { ok: false, error: 'La respuesta a la sugerencia no es válida.' }
      const next = [...new Set([...state.perfilesActivos, profileId])]
      const combined = compose(next, true)
      if (combined.colisiones.length) return { ok: false, error: 'Hay acciones repetidas entre perfiles.', colisiones: combined.colisiones }
      state.perfilesActivos = next
      state.habilitado = true
      persist()
      return { ok: true, message: `Activé el perfil ${registry.get(profileId).nombre}.` }
    },
    updatePreferences(patch = {}) {
      if (typeof patch.trabaja === 'boolean' || patch.trabaja === null) state.trabaja = patch.trabaja
      if (typeof patch.buscandoTrabajo === 'boolean') state.buscandoTrabajo = patch.buscandoTrabajo
      if (typeof patch.sugerenciasPerfiles === 'boolean') state.deteccion.deshabilitada = !patch.sugerenciasPerfiles
      persist()
      return compose()
    },
    clear() {
      state = normalizeState()
      persist()
      return compose()
    }
  }
}
