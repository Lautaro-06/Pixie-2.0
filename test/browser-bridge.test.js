import { test } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { createBrowserBridge, NoExtensionError } from '../src/main/browser.js'

let port = 47700
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Una extensión de mentira: se conecta como lo hace Chrome y contesta los pedidos
function fakeExtension(p, { navegador = 'chrome' } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${p}`, { origin: 'chrome-extension://abcdef' })
  ws.on('open', () => ws.send(JSON.stringify({ type: 'hola', version: '0.13.0', navegador })))
  ws.on('message', (data) => {
    const msg = JSON.parse(String(data))
    if (msg.id) ws.send(JSON.stringify({ id: msg.id, ok: true, result: { cmd: msg.cmd } }))
  })
  return ws
}

test('si la extensión nunca se instaló, no abre Chrome al pedo', async () => {
  let opened = 0
  const b = createBrowserBridge({ port: port++, known: () => false, openBrowser: async () => opened++ })
  assert.equal(await b.ensure(), false)
  assert.equal(opened, 0)
  await assert.rejects(b.need('mails'), NoExtensionError)
  b.close()
})

test('si Chrome está cerrado, lo abre, espera a la extensión y recién ahí hace lo pedido', async () => {
  const p = port++
  const calls = { opened: 0, opening: [], connect: [] }
  let ext = null
  const b = createBrowserBridge({
    port: p,
    known: () => true,
    openBrowser: async () => {
      calls.opened++
      setTimeout(() => (ext = fakeExtension(p, { navegador: 'edge' })), 150) // Chrome tarda un poco en abrir
      return false
    },
    onOpening: (wasOpen) => calls.opening.push(wasOpen),
    onConnect: (version, navegador) => calls.connect.push([version, navegador])
  })
  const [r1, r2] = await Promise.all([b.need('mails', {}, 2000), b.need('classroom', {}, 2000)])
  assert.deepEqual([r1.cmd, r2.cmd], ['mails', 'classroom'])
  assert.equal(calls.opened, 1, 'dos pedidos a la vez abren Chrome una sola vez')
  assert.deepEqual(calls.opening, [false])
  assert.deepEqual(calls.connect, [['0.13.0', 'edge']])
  assert.equal(await b.ensure(), true)
  assert.equal(calls.opened, 1, 'ya conectada no abre nada')
  ext.close()
  b.close()
})

test('si no se conecta a tiempo, avisa que no pudo', async () => {
  const b = createBrowserBridge({ port: port++, known: () => true, openBrowser: async () => true })
  const t0 = Date.now()
  assert.equal(await b.ensure({ timeoutMs: 200 }), false)
  assert.ok(Date.now() - t0 < 1500)
  b.close()
  await sleep(10)
})

test('si no puede abrir Chrome, no se queda esperando', async () => {
  const b = createBrowserBridge({ port: port++, known: () => true, openBrowser: async () => { throw new Error('no está instalado') } })
  const t0 = Date.now()
  assert.equal(await b.ensure({ timeoutMs: 5000 }), false)
  assert.ok(Date.now() - t0 < 1000)
  b.close()
})
