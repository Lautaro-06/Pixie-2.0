// Ajustes → WhatsApp y Ajustes → Memoria y privacidad
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSettings } from '../src/main/settings.js'
import { createPhone } from '../src/main/phone.js'
import { createJournal } from '../src/main/journal.js'
import { createMemory } from '../src/main/memory.js'

function setup({ config = {}, reply = { ok: true, status: 200, text: async () => 'Message queued' } } = {}) {
  let cfg = { ciudad: 'Buenos Aires', ...config }
  let clip = ''
  const opened = []
  const sent = []
  const dir = mkdtempSync(join(tmpdir(), 'pixie-'))
  const getConfig = () => cfg
  const phone = createPhone({ getConfig, fetchImpl: async (url) => (sent.push(url), typeof reply === 'function' ? reply() : reply), wait: async () => {} })
  const memory = createMemory(join(dir, 'memoria.json'))
  const journal = createJournal(join(dir, 'charlas.jsonl'))
  const s = createSettings({
    getConfig,
    saveConfig: (patch) => (cfg = { ...cfg, ...patch }),
    memory,
    voices: { status: () => '' },
    updates: { status: () => ({ state: 'idle', current: '0.16.0' }), describe: () => '' },
    ai: { ping: async () => ({}) },
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Shift+Espacio',
    setCity: async () => '',
    readClipboard: () => clip,
    phone,
    journal,
    openExternal: (url) => opened.push(url),
    version: '0.16.0'
  })
  return { s, cfg: () => cfg, setClip: (t) => (clip = t), opened, sent, memory, journal }
}

test('WhatsApp se activa desde Ajustes: número, clave y prueba', async () => {
  const t = setup()
  let snap = t.s.snapshot()
  assert.equal(snap.whatsapp.configurado, false)
  assert.equal(snap.whatsapp.cuando, 'siempre', 'por defecto te escribe siempre')
  assert.equal(snap.whatsapp.avisos, true)
  assert.equal((await t.s.whatsapp({ accion: 'probar' })).mensaje, 'Primero poné tu número y la clave que te mandó el bot.')

  await t.s.apply({ whatsappTelefono: '+54 9 11 2345-6789' })
  assert.equal(t.cfg().whatsapp.telefono, '+5491123456789')
  // Abre WhatsApp con el mensaje de activación ya escrito
  const r = await t.s.whatsapp({ accion: 'activar' })
  assert.match(t.opened[0], /^https:\/\/wa\.me\/\d+\?text=I%20allow%20callmebot/)
  assert.match(r.mensaje, /tocá Enviar/)

  // La clave, copiada del mensaje del bot
  t.setClip('API Activated for your phone number. Your APIKEY is 7654321')
  assert.match((await t.s.whatsapp({ accion: 'portapapeles' })).mensaje, /Encontré tu clave/)
  assert.equal(t.cfg().whatsapp.apikey, '7654321')
  snap = t.s.snapshot()
  assert.equal(snap.whatsapp.configurado, true)
  assert.doesNotMatch(JSON.stringify(snap), /7654321/, 'la clave no se muestra')

  const probe = await t.s.whatsapp({ accion: 'probar' })
  assert.equal(probe.mensaje, '¡Te lo mandé! Fijate en tu WhatsApp.')
  assert.match(t.sent[0], /phone=%2B5491123456789&text=Pixie/)
  assert.equal(probe.whatsapp.ultimo.ok, true)
})

test('la clave también se puede pegar a mano, y se elige cuándo escribirte', async () => {
  const t = setup({ config: { whatsapp: { telefono: '+5491123456789' } } })
  let r = await t.s.apply({ whatsappClave: 'Your APIKEY is 112233' })
  assert.equal(t.cfg().whatsapp.apikey, '112233', 'saca los números del mensaje del bot')
  assert.match(r.mensajes.join(' '), /mensaje de prueba/)
  r = await t.s.apply({ whatsappCuando: 'ausente' })
  assert.equal(r.whatsapp.cuando, 'ausente')
  r = await t.s.apply({ whatsappCuando: 'cualquiera' })
  assert.equal(r.whatsapp.cuando, 'ausente', 'ignora opciones que no existen')
  assert.equal(t.cfg().whatsapp.telefono, '+5491123456789', 'no se pierde el número')
  t.setClip('nada que ver')
  assert.match((await t.s.whatsapp({ accion: 'portapapeles' })).mensaje, /No encontré la clave/)
})

test('si la prueba falla, dice por qué', async () => {
  const t = setup({ config: { whatsapp: { telefono: '+5491123456789', apikey: '999' } }, reply: { ok: false, status: 203, text: async () => 'APIKey is invalid' } })
  const r = await t.s.whatsapp({ accion: 'probar' })
  assert.match(r.mensaje, /clave/i)
  assert.equal(r.whatsapp.ultimo.ok, false)
})

test('Ajustes → Memoria muestra lo que se acuerda, sin lo personal, y lo puede borrar', () => {
  const t = setup()
  t.memory.addFact('juego al fútbol los sábados')
  t.memory.addFact('voy al psicólogo por la ansiedad')
  t.journal.record('¿me ayudás con química?', 'Dale.')
  let m = t.s.snapshot().memoria
  assert.equal(m.charlas, 1)
  assert.deepEqual(
    m.datos.map((d) => d.texto),
    ['juego al fútbol los sábados']
  )
  assert.equal(m.personales, 1, 'cuenta lo personal sin mostrarlo')
  assert.doesNotMatch(JSON.stringify(m), /psicólogo/)

  let r = t.s.forget({ que: 'charlas' })
  assert.equal(r.memoria.charlas, 0)
  assert.equal(r.memoria.datos.length, 1, 'borrar las charlas no borra lo que le contaste')
  assert.match(r.mensaje, /charlas/)
  r = t.s.forget({ que: 'todo' })
  assert.equal(r.memoria.datos.length, 0)
  assert.equal(r.memoria.personales, 0)
  assert.equal(t.s.forget({}).mensaje, null)
})

test('Ajustes ya no tiene lo de los colectivos en vivo', () => {
  const snap = setup({ config: { direccionCasa: 'Av. Corrientes 1234', transporte: { cliente: 'x', secreto: 'y' } } }).s.snapshot()
  assert.deepEqual(snap.mapas, { casa: 'Av. Corrientes 1234' })
  assert.doesNotMatch(JSON.stringify(snap), /transporte|secreto/)
})
