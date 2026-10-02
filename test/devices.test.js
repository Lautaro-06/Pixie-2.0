import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPhone, whatsappConfig } from '../src/main/phone.js'
import { createMemory } from '../src/main/memory.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'

function fakeFetch(body = 'Message queued. You will receive it in a few seconds.', status = 200) {
  const urls = []
  return { urls, fn: async (url) => (urls.push(url), { ok: status < 300, status, text: async () => body }) }
}
const config = { whatsapp: { telefono: '+54 9 11 2345-6789', apikey: '123456' } }

test('lee el número y la clave de WhatsApp', () => {
  assert.deepEqual(whatsappConfig(config), { telefono: '+5491123456789', apikey: '123456' })
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

test('los automáticos no se repiten enseguida', async () => {
  const f = fakeFetch()
  const phone = createPhone({ getConfig: () => config, fetchImpl: f.fn })
  assert.equal(await phone.send('uno', { auto: true }), true)
  assert.equal(await phone.send('dos', { auto: true }), false)
  assert.equal(await phone.send('pedido a mano'), true) // si se lo pedís, lo manda igual
  assert.equal(f.urls.length, 2)
})

test('si la clave está mal o no está, lo explica', async () => {
  const bad = createPhone({ getConfig: () => config, fetchImpl: fakeFetch('APIKey is invalid').fn })
  await assert.rejects(bad.send('hola'), /no aceptó el mensaje/)
  const none = createPhone({ getConfig: () => ({}), fetchImpl: fakeFetch().fn })
  await assert.rejects(none.send('hola'), /Todavía no tengo tu WhatsApp/)
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
