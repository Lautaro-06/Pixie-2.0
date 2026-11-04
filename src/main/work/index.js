import freeProfile from './profiles/libre.js'

const DEFAULT_STATE = {
  habilitado: false,
  trabaja: null,
  perfilesActivos: [],
  descripcionLibre: '',
  proyectos: [],
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

export function createWork({ memory, profiles = [freeProfile] } = {}) {
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
    for (const profile of active) {
      for (const action of profile.acciones) {
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
    }
    const instructions = active
      .map((profile) => (typeof profile.instruccionesIA === 'function' ? profile.instruccionesIA(state) : profile.instruccionesIA))
      .filter((text) => typeof text === 'string' && text.trim())
    return {
      habilitado: Boolean(enabled),
      perfiles: active.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
      instruccionesIA: instructions.join('\n\n'),
      acciones: Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'perfil'))])),
      fuentes: active.flatMap((profile) => profile.fuentes),
      fuentesNoticias: active.flatMap((profile) => profile.fuentesNoticias),
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
    }
  }
}
