// Tu número de WhatsApp es tuyo: no se muestra entero, se guarda cifrado y no aparece en otra compu ni en
// otra cuenta de Windows (aunque alguien copie config.json o use una compu donde ya estaba)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadConfig, configPath, saveConfig, getConfig, setCipher, machineOwner } from '../src/main/config.js'
import { guardWhatsapp } from '../src/main/secrets.js'
import { createPhone } from '../src/main/phone.js'
import { createSettings } from '../src/main/settings.js'
import { portableConfig } from '../src/main/backup.js'

const NUMBER = '+5491155550123'
// Un cifrado de mentira (como el de Windows: solo se descifra en la misma cuenta)
setCipher({
  available: () => true,
  encrypt: (t) => Buffer.from(`pixie:${t}`).toString('base64'),
  decrypt: (b) => {
    const s = Buffer.from(b, 'base64').toString()
    if (!s.startsWith('pixie:')) throw new Error('otra cuenta')
    return s.slice(6)
  }
})
const writeDisk = (data) => {
  mkdirSync(dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(data))
}
const disk = () => readFileSync(configPath(), 'utf8')

test('un config.json de antes de la 0.16.2 (o de otra compu) no muestra el número: se borra', () => {
  writeDisk({ ciudad: 'Rosario', whatsapp: { telefono: NUMBER, apikey: '7654321', cuando: 'siempre' } })
  const cfg = loadConfig()
  assert.equal(cfg.whatsapp, undefined)
  assert.equal(cfg.ciudad, 'Rosario', 'lo demás queda')
  assert.doesNotMatch(disk(), /5491155550123|7654321/)

  // Copiado de otra compu o de otra cuenta de Windows (otro dueño)
  writeDisk({ whatsapp: { dueno: 'otra-compu', cuando: 'siempre' }, cifrado: { 'whatsapp.telefono': 'xx', 'whatsapp.apikey': 'yy', claveIA: 'zz' } })
  assert.equal(loadConfig().whatsapp, undefined)
  assert.deepEqual(JSON.parse(disk()).cifrado, { claveIA: 'zz' }, 'la clave de la IA no se toca')
})

test('el que ponés en esta compu queda cifrado, marcado como tuyo, y se puede borrar', () => {
  writeDisk({})
  loadConfig()
  saveConfig({ whatsapp: { telefono: NUMBER, apikey: '7654321', cuando: 'ausente' } })
  assert.doesNotMatch(disk(), /5491155550123|7654321/, 'en el archivo no queda a la vista')
  assert.equal(JSON.parse(disk()).whatsapp.dueno, machineOwner())
  assert.equal(loadConfig().whatsapp.telefono, NUMBER, 'en esta compu y esta cuenta sigue andando')
  assert.equal(getConfig().whatsapp.cuando, 'ausente')
  saveConfig({ whatsapp: { ...getConfig().whatsapp, telefono: null, apikey: null } })
  assert.equal(loadConfig().whatsapp?.telefono, undefined)
  assert.doesNotMatch(disk(), /whatsapp\.telefono|whatsapp\.apikey/, 'tampoco queda cifrado')
})

test('la regla: solo se queda el WhatsApp marcado con esta compu y esta cuenta', () => {
  assert.deepEqual(guardWhatsapp({ ciudad: 'X' }, 'yo'), { data: { ciudad: 'X' }, removed: false })
  assert.equal(guardWhatsapp({ whatsapp: { dueno: 'yo', telefono: 'a' } }, 'yo').removed, false)
  assert.equal(guardWhatsapp({ whatsapp: { telefono: 'a' } }, 'yo').removed, true)
  assert.equal(guardWhatsapp({ cifrado: { 'whatsapp.telefono': 'a' } }, 'yo').removed, true)
  assert.equal(guardWhatsapp({ whatsapp: { dueno: 'otro' } }, 'yo').removed, true)
})

test('Ajustes nunca recibe el número entero: solo cómo termina', async () => {
  let cfg = { whatsapp: { telefono: NUMBER, apikey: '7654321' } }
  const phone = createPhone({ getConfig: () => cfg, fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'queued' }), wait: async () => {} })
  const st = phone.status()
  assert.equal(st.termina, '0123')
  assert.equal(st.tieneNumero, true)
  assert.doesNotMatch(JSON.stringify(st), /5491155550123|55550123|7654321/)
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (patch) => (cfg = { ...cfg, ...patch }),
    memory: { getName: () => '', setName: () => {} },
    voices: { status: () => '' },
    updates: { status: () => ({ state: 'idle', current: '0.16.2' }), describe: () => '' },
    ai: { ping: async () => ({}) },
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Shift+Espacio',
    setCity: async () => '',
    phone
  })
  assert.doesNotMatch(JSON.stringify(s.snapshot()), /5491155550123|55550123|7654321/)
  const r = await s.whatsapp({ accion: 'borrar' })
  assert.match(r.mensaje, /borré tu número/)
  assert.deepEqual(cfg.whatsapp, { telefono: null, apikey: null })
  assert.equal(r.whatsapp.tieneNumero, false)
  // Un campo vacío al guardar lo borra (no deja el viejo)
  cfg = { whatsapp: { telefono: NUMBER, apikey: '7654321' } }
  await s.apply({ whatsappTelefono: '' })
  assert.equal(cfg.whatsapp.telefono, null)
})

test('el respaldo en la nube nunca lleva el WhatsApp', () => {
  const out = portableConfig({ ciudad: 'X', whatsapp: { telefono: NUMBER, dueno: 'yo' }, cifrado: { 'whatsapp.telefono': 'a' } })
  assert.deepEqual(out, { ciudad: 'X' })
})
