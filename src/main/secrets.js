// Claves que nunca quedan a la vista en config.json: se guardan cifradas con la
// cuenta de Windows (en "cifrado") y Pixie las usa descifradas solo en memoria.
// Si alguien pega una clave a mano en config.json, se cifra sola la próxima vez que se lee.

export const SECRET_PATHS = [['claveIA'], ['whatsapp', 'apikey'], ['whatsapp', 'telefono'], ['transporte', 'secreto']]
const keyOf = (path) => path.join('.')

export function getIn(obj, path) {
  return path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

// Copia con el valor cambiado (undefined lo borra)
export function setIn(obj, path, value) {
  const [head, ...rest] = path
  const base = obj && typeof obj === 'object' ? obj : {}
  if (!rest.length) {
    const copy = { ...base }
    if (value === undefined) delete copy[head]
    else copy[head] = value
    return copy
  }
  return { ...base, [head]: setIn(base[head], rest, value) }
}

// Para el archivo: las claves a la vista pasan a "cifrado"
export function sealSecrets(data, cipher) {
  if (!cipher?.available()) return { data, changed: false }
  let out = { ...data }
  const sealed = { ...(data.cifrado ?? {}) }
  let changed = false
  for (const path of SECRET_PATHS) {
    const plain = getIn(out, path)
    if (typeof plain === 'string' && plain.trim()) {
      sealed[keyOf(path)] = cipher.encrypt(plain.trim())
      out = setIn(out, path, undefined)
      changed = true
    }
  }
  if (changed) out.cifrado = sealed
  return { data: out, changed }
}

// Para usar en memoria: cada clave descifrada en su lugar (sin la sección "cifrado")
export function openSecrets(data, cipher, onFail = () => {}) {
  const { cifrado, ...rest } = data ?? {}
  let out = rest
  if (!cifrado || !cipher?.available()) return out
  for (const path of SECRET_PATHS) {
    const enc = cifrado[keyOf(path)]
    if (!enc || getIn(out, path)) continue
    try {
      out = setIn(out, path, cipher.decrypt(enc))
    } catch (err) {
      onFail(keyOf(path), err) // cifrada en otra compu o con otra cuenta de Windows
    }
  }
  return out
}

// Para borrar una clave: { claveIA: null } la saca del archivo, también la cifrada
export function forgetSecrets(data, patch) {
  let out = data
  for (const path of SECRET_PATHS) {
    const value = getIn(patch, path)
    if (value === null || value === '') {
      out = setIn(out, path, undefined)
      if (out.cifrado?.[keyOf(path)]) {
        const { [keyOf(path)]: _gone, ...others } = out.cifrado
        out = Object.keys(others).length ? { ...out, cifrado: others } : setIn(out, ['cifrado'], undefined)
      }
    }
  }
  return out
}

// Muestra una clave sin revelarla: "AQ.Ab…k3Zq"
export function maskSecret(value) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (v.length <= 10) return '••••'
  return `${v.slice(0, 5)}…${v.slice(-4)}`
}

// El WhatsApp es de una persona en una compu: el número y la clave quedan marcados con esta compu y esta
// cuenta de Windows (dueno). Si config.json llegó de otro lado (una copia, otra cuenta, una compu
// compartida que ya lo tenía) o es de antes de la 0.16.2 (sin marca), se borra: nadie ve el número de otro.
export function guardWhatsapp(data, owner) {
  const enc = data?.cifrado ?? {}
  const has = data?.whatsapp || enc['whatsapp.apikey'] || enc['whatsapp.telefono']
  if (!has || (data.whatsapp?.dueno && data.whatsapp.dueno === owner)) return { data, removed: false }
  const { whatsapp: _gone, ...rest } = data
  if (data.cifrado) {
    const { 'whatsapp.apikey': _k, 'whatsapp.telefono': _t, ...others } = data.cifrado
    if (Object.keys(others).length) rest.cifrado = others
    else delete rest.cifrado
  }
  return { data: rest, removed: true }
}
