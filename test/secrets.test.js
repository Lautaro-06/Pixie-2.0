import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { sealSecrets, openSecrets, forgetSecrets, maskSecret } from '../src/main/secrets.js'
import { loadConfig, configPath, saveConfig, reloadConfig, getConfig, setCipher } from '../src/main/config.js'

// Un cifrado de mentira: da vuelta el texto y le pone una marca
const fake = {
  available: () => true,
  encrypt: (s) => `x:${[...s].reverse().join('')}`,
  decrypt: (s) => {
    if (!s.startsWith('x:')) throw new Error('no es mío')
    return [...s.slice(2)].reverse().join('')
  }
}

test('cifra las claves y las devuelve descifradas solo en memoria', () => {
  const data = { ciudad: 'Rosario', claveIA: 'AQ.secreta123', whatsapp: { telefono: '+5491100000000', apikey: '1112223' } }
  const { data: sealed, changed } = sealSecrets(data, fake)
  assert.equal(changed, true)
  assert.equal(sealed.claveIA, undefined)
  assert.deepEqual(sealed.whatsapp, { telefono: '+5491100000000' })
  assert.deepEqual(sealed.cifrado, { claveIA: 'x:321aterces.QA', 'whatsapp.apikey': 'x:3222111' })
  assert.doesNotMatch(JSON.stringify(sealed), /secreta|1112223/)
  const open = openSecrets(sealed, fake)
  assert.equal(open.claveIA, 'AQ.secreta123')
  assert.equal(open.whatsapp.apikey, '1112223')
  assert.equal(open.cifrado, undefined)
})

test('sin cifrado disponible deja todo como estaba', () => {
  const data = { claveIA: 'AQ.abc' }
  assert.deepEqual(sealSecrets(data, null), { data, changed: false })
  assert.deepEqual(sealSecrets(data, { ...fake, available: () => false }), { data, changed: false })
})

test('si no puede descifrar (otra compu), la clave queda vacía y avisa una vez', () => {
  const fails = []
  const open = openSecrets({ cifrado: { claveIA: 'de-otra-compu' } }, fake, (key) => fails.push(key))
  assert.equal(open.claveIA, undefined)
  assert.deepEqual(fails, ['claveIA'])
})

test('borrar una clave la saca también de lo cifrado', () => {
  const data = { claveIA: 'AQ.x', cifrado: { claveIA: 'x:...', 'whatsapp.apikey': 'x:1' } }
  assert.deepEqual(forgetSecrets(data, { claveIA: null }), { cifrado: { 'whatsapp.apikey': 'x:1' } })
  assert.deepEqual(forgetSecrets({ cifrado: { claveIA: 'x:1' } }, { claveIA: '' }), {})
  assert.deepEqual(forgetSecrets(data, { ciudad: 'Salta' }), data)
})

test('muestra la clave sin revelarla', () => {
  assert.equal(maskSecret('AQ.Ab8RNxxxxxxxxxxxk3Zq'), 'AQ.Ab…k3Zq')
  assert.equal(maskSecret('corta'), '••••')
  assert.equal(maskSecret(''), '')
})

test('config.json: una clave pegada a mano se cifra sola y Pixie la sigue usando', () => {
  mkdirSync(dirname(configPath()), { recursive: true })
  setCipher(fake)
  try {
    writeFileSync(configPath(), JSON.stringify({ apps: [], claveIA: 'AQ.pegada-a-mano' }))
    loadConfig()
    assert.equal(getConfig().claveIA, 'AQ.pegada-a-mano')
    let disk = JSON.parse(readFileSync(configPath(), 'utf8'))
    assert.equal(disk.claveIA, undefined)
    assert.equal(disk.cifrado.claveIA, 'x:onam-a-adagep.QA')

    // La cambiás a mano con Pixie abierta: la lee, la cifra y la usa
    writeFileSync(configPath(), JSON.stringify({ ...disk, claveIA: 'AQ.nueva' }))
    assert.equal(reloadConfig(), true)
    assert.equal(getConfig().claveIA, 'AQ.nueva')
    disk = JSON.parse(readFileSync(configPath(), 'utf8'))
    assert.equal(disk.claveIA, undefined)
    assert.equal(disk.cifrado.claveIA, 'x:aveun.QA')

    // Guardar otra cosa no la pierde ni la escribe a la vista
    saveConfig({ ciudad: 'Mendoza' })
    disk = JSON.parse(readFileSync(configPath(), 'utf8'))
    assert.equal(disk.ciudad, 'Mendoza')
    assert.equal(disk.claveIA, undefined)
    assert.equal(getConfig().claveIA, 'AQ.nueva')

    // Guardar una clave desde los ajustes y después borrarla
    saveConfig({ claveIA: 'AQ.desde-ajustes' })
    assert.equal(getConfig().claveIA, 'AQ.desde-ajustes')
    assert.doesNotMatch(readFileSync(configPath(), 'utf8'), /desde-ajustes/)
    saveConfig({ claveIA: null })
    assert.equal(getConfig().claveIA, undefined)
    assert.doesNotMatch(readFileSync(configPath(), 'utf8'), /claveIA/)
  } finally {
    setCipher(null)
  }
})
