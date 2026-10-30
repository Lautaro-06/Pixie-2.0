// Claves que nunca quedan a la vista en config.json: se guardan cifradas con la
// cuenta de Windows (en "cifrado") y Pixie las usa descifradas solo en memoria.
// Si alguien pega una clave a mano en config.json, se cifra sola la próxima vez que se lee.

export const SECRET_PATHS = [['claveIA'], ['whatsapp', 'apikey']]
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
