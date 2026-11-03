import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPhone, whatsappConfig, cleanPhone, findWhatsappKey, serviceError, activationLink } from '../src/main/phone.js'
import { createMemory } from '../src/main/memory.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'

function fakeFetch(body = 'Message queued. You will receive it in a few seconds.', status = 200) {
  const urls = []
  return { urls, fn: async (url) => (urls.push(url), { ok: status < 300, status, text: async () => body }) }
}
const config = { whatsapp: { telefono: '+54 9 11 2345-6789', apikey: '123456' } }

test('lee el número y la clave de WhatsApp', () => {
  assert.deepEqual(whatsappConfig(config), { telefono: '+5491123456789', apikey: '123456', cuando: 'siempre' })
  assert.equal(whatsappConfig({ whatsapp: { ...config.whatsapp, cuando: 'ausente' } }).cuando, 'ausente')
  assert.equal(cleanPhone('54 9 11 2345-6789'), '+5491123456789')
  assert.equal(cleanPhone(''), '')
  assert.equal(findWhatsappKey('Your APIKEY is 7654321, use it to send messages'), '7654321')
  assert.equal(findWhatsappKey('hola'), null)
  assert.match(activationLink(), /^https:\/\/wa\.me\/\d+\?text=I%20allow%20callmebot%20to%20send%20me%20messages$/)
  assert.equal(whatsappConfig({ whatsapp: { telefono: '+54911' } }), null)
  assert.equal(whatsappConfig({}), null)
})

test('manda el WhatsApp por CallMeBot', async () => {
  const f = fakeFetch()
  const phone = createPhone({ getConfig: () => config, fetchImpl: f.fn })
  assert.equal(await phone.send('Pixie: comprá pan'), true)
  const url = new URL(f.urls[0])
  assert.equal(url.origin + url.pathname, 'https://api.callmebot.com/whatsapp.php')
  assert.equal(url.searchParams.get('phone'), '+5491123456789')
  assert.equal(url.searchParams.get('text'), 'Pixie: comprá pan')
  assert.equal(url.searchParams.get('apikey'), '123456')
})

test('los mensajes salen en fila (con un ratito entre uno y otro) y no se pierde ninguno', async () => {
  const f = fakeFetch()
  const waits = []
  const phone = createPhone({ getConfig: () => config, fetchImpl: f.fn, wait: async (ms) => waits.push(ms) })
  const all = await Promise.all([phone.send('uno', { auto: true }), phone.send('dos', { auto: true }), phone.send('pedido a mano')])
  assert.deepEqual(all, [true, true, true])
  assert.deepEqual(f.urls.map((u) => new URL(u).searchParams.get('text')), ['uno', 'dos', 'pedido a mano'])
  assert.equal(waits.length, 2, 'espera entre uno y otro')
  assert.equal(phone.status().ultimo.ok, true)
})

test('si el servicio falla, reintenta; si la clave está mal, no insiste', async () => {
  let calls = 0
  const flaky = async () => (++calls < 3 ? { ok: false, status: 503, text: async () => 'Service unavailable' } : { ok: true, status: 200, text: async () => 'Message queued' })
  const phone = createPhone({ getConfig: () => config, fetchImpl: flaky, wait: async () => {} })
  assert.equal(await phone.send('hola'), true)
  assert.equal(calls, 3)
  let bad = 0
  const invalid = createPhone({ getConfig: () => config, fetchImpl: async () => (bad++, { ok: true, status: 200, text: async () => 'APIKey is invalid' }), wait: async () => {} })
  await assert.rejects(invalid.send('hola'), /La clave no es la de ese número/)
  assert.equal(bad, 1)
  assert.match(invalid.status().ultimo.error, /La clave no es la de ese número/)
  assert.match(serviceError(200, 'Phone not activated'), /todavía no está activado/)
})

test('si la clave está mal o no está, lo explica', async () => {
  const bad = createPhone({ getConfig: () => config, fetchImpl: fakeFetch('APIKey is invalid').fn })
  await assert.rejects(bad.send('hola'), /La clave no es la de ese número/)
  const none = createPhone({ getConfig: () => ({}), fetchImpl: fakeFetch().fn })
  await assert.rejects(none.send('hola'), /Ajustes → WhatsApp/)
})

test('te manda tus pendientes por WhatsApp', async () => {
  const f = fakeFetch()
  const memory = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-wpp-')), 'memoria.json'))
  memory.addTodo('comprar cartuchos')
  const ctx = { memory, log: () => {}, phone: createPhone({ getConfig: () => config, fetchImpl: f.fn }) }
  const r = await runAction('whatsapp', { texto: 'mis pendientes' }, ctx)
  assert.equal(r.text, 'Listo, te lo mandé por WhatsApp.')
  assert.equal(new URL(f.urls[0]).searchParams.get('text'), 'Pixie: Tus pendientes:\n1. comprar cartuchos')
})

test('entiende brillo, Bluetooth y WhatsApp', () => {
  const act = (q) => interpretAll(q)?.map((i) => [i.action, i.params])
  assert.deepEqual(act('subí el brillo'), [['brillo', { cambio: 'subir' }]])
  assert.deepEqual(act('brillo al 40'), [['brillo', { cambio: 'poner', valor: 40 }]])
  assert.deepEqual(act('la pantalla está muy oscura'), [['brillo', { cambio: 'subir' }]])
  assert.deepEqual(act('subile el volumen'), [['volumen', { cambio: 'subir', pasos: 5 }]])
  assert.deepEqual(act('prendé el bluetooth'), [['bluetooth', { estado: 'prender' }]])
  assert.deepEqual(act('apagá el blutu'), [['bluetooth', { estado: 'apagar' }]])
  assert.deepEqual(act('mandame por whatsapp que compre pan'), [['whatsapp', { texto: 'compre pan' }]])
  assert.deepEqual(act('mandame un wpp con mis pendientes'), [['whatsapp', { texto: 'mis pendientes' }]])
  assert.deepEqual(act('abrí whatsapp'), [['abrir', { objetivo: 'whatsapp' }]])
})

test('solo escribe por WhatsApp a tu número, y no confunde "acá" con mirar la pantalla', async () => {
  const f = fakeFetch()
  const memory = createMemory(join(mkdtempSync(join(tmpdir(), 'pixie-wpp-')), 'memoria.json'))
  const ctx = { memory, log: () => {}, phone: createPhone({ getConfig: () => config, fetchImpl: f.fn }) }
  assert.match((await runAction('whatsapp', { texto: 'a mamá que llego tarde' }, ctx)).text, /solo te puedo mandar WhatsApp a vos/)
  assert.equal(f.urls.length, 0)
  assert.notEqual(interpretAll('fijate el clima acá')?.[0]?.action, 'ver_pantalla')
  assert.equal(interpretAll('fijate esto')?.[0]?.action, 'ver_pantalla')
})
