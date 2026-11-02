import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApps, parseInstalled, aliasesFor } from '../src/main/apps.js'
import { runAction } from '../src/main/actions/index.js'

// Lo que devuelve el menú Inicio de una compu de ejemplo
const START_MENU = [
  { nombre: 'Minecraft Launcher', id: 'Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft', destino: null },
  { nombre: 'Adobe Photoshop 2024', id: '{6D809377-6AF0-444B-8957-A3773F02200E}\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe', destino: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe' },
  { nombre: 'Notepad++', id: '{6D809377-6AF0-444B-8957-A3773F02200E}\\Notepad++\\notepad++.exe', destino: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
  { nombre: 'Desinstalar Notepad++', id: 'x\\uninstall.exe', destino: null },
  { nombre: 'Steam', id: 'C:\\Program Files (x86)\\Steam\\steam.exe', destino: 'C:\\Program Files (x86)\\Steam\\steam.exe' },
  { nombre: 'Steam', id: 'repetida', destino: null },
  { nombre: 'Sitio web de Zoom', id: 'https://zoom.us', destino: null },
  { nombre: 'WhatsApp', id: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App', destino: null }
]

function setup(perms = {}) {
  let cfg = { appsPermisos: perms }
  const apps = createApps({
    file: join(mkdtempSync(join(tmpdir(), 'pixie-apps-')), 'apps-instaladas.json'),
    getConfig: () => cfg,
    saveConfig: (p) => (cfg = { ...cfg, ...p }),
    listImpl: async () => JSON.stringify(START_MENU)
  })
  return { apps, cfg: () => cfg }
}

test('arma la lista de apps del menú Inicio, sin desinstaladores, sitios ni repetidas', () => {
  const list = parseInstalled(JSON.stringify(START_MENU))
  assert.deepEqual(list.map((a) => a.nombre), ['Adobe Photoshop 2024', 'Minecraft Launcher', 'Notepad++', 'Steam', 'WhatsApp'])
  assert.equal(list.find((a) => a.nombre === 'Notepad++').proceso, 'notepad++')
  assert.equal(list.find((a) => a.nombre === 'WhatsApp').proceso, null)
  assert.deepEqual(aliasesFor('Adobe Photoshop 2024'), ['adobe photoshop 2024', 'adobe photoshop', 'photoshop'])
  assert.deepEqual(parseInstalled('esto no es json'), [])
})

test('«abrí …» encuentra cualquier app instalada, salvo las que le sacaste', async () => {
  const { apps, cfg } = setup()
  await apps.refresh()
  const ctx = { apps, getConfig: cfg, log: () => {} }
  const target = apps.catalog().find((a) => a.nombre === 'Minecraft Launcher')
  assert.deepEqual(target.abrir, { tipo: 'start', valor: 'shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft' })
  assert.ok(target.alias.includes('minecraft launcher'))
  apps.set('C:\\Program Files (x86)\\Steam\\steam.exe', { abrir: false })
  const r = await runAction('abrir', { objetivo: 'steam' }, ctx)
  assert.equal(r.text, 'No tengo permiso para abrir Steam. Lo podés cambiar en mis Ajustes → Apps.')
  assert.equal(apps.list().find((a) => a.nombre === 'Steam').abrir, false)
  assert.equal(apps.list().find((a) => a.nombre === 'Steam').usar, true, 'lo que no tocaste sigue permitido')
})

test('no usa las apps que le sacaste (por el programa o el nombre de la ventana)', async () => {
  const { apps } = setup()
  await apps.refresh()
  apps.set('{6D809377-6AF0-444B-8957-A3773F02200E}\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe', { usar: false })
  assert.equal(apps.can('usar', { proceso: 'Photoshop', titulo: 'dibujo.psd @ 100%' }), false)
  assert.equal(apps.can('abrir', { proceso: 'Photoshop' }), true)
  assert.equal(apps.can('usar', { proceso: 'notepad++' }), true)
  assert.equal(apps.can('usar', { proceso: 'algo_desconocido' }), true, 'lo que no conoce lo deja')
  apps.set('5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App', { usar: false })
  assert.equal(apps.can('usar', { proceso: 'WhatsApp', titulo: 'WhatsApp' }), false, 'una app de la tienda, por el nombre')
  // Las acciones de usar apps lo respetan
  const ctx = {
    apps,
    log: () => {},
    hands: { available: () => true, request: async () => ({ ok: true }) },
    targetWindow: async () => ({ hwnd: 1, proceso: 'Photoshop', titulo: 'dibujo.psd' })
  }
  const r = await runAction('teclas', { teclas: 'ctrl+s' }, ctx)
  assert.equal(r.text, 'No tengo permiso para usar Adobe Photoshop 2024. Lo podés cambiar en mis Ajustes → Apps.')
  apps.setAll(false)
  assert.ok(apps.list().every((a) => !a.abrir && !a.usar))
  apps.setAll(true)
  assert.ok(apps.list().every((a) => a.abrir && a.usar))
})
