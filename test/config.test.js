import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadConfig, configPath, brokenConfigPath, saveConfig, reloadConfig, getConfig } from '../src/main/config.js'

test('si config.json quedó mal escrito, no lo pisa y guarda una copia', () => {
  mkdirSync(dirname(configPath()), { recursive: true })
  rmSync(brokenConfigPath(), { force: true })
  const broken = '{\n  "apps": []\n  "claveIA": "sk-ant-prueba"\n}' // falta la coma
  writeFileSync(configPath(), broken)
  const cfg = loadConfig()
  assert.equal(cfg.claveIA, undefined)
  assert.equal(cfg.ciudad, 'Buenos Aires')
  assert.equal(readFileSync(brokenConfigPath(), 'utf8'), broken)
  assert.equal(readFileSync(configPath(), 'utf8'), broken) // queda para que lo arregles
  saveConfig({ lugar: 'Rosario' })
  assert.equal(readFileSync(configPath(), 'utf8'), broken) // ni guardando algo se pisa

  writeFileSync(configPath(), '{ "apps": [], "claveIA": "sk-ant-prueba" }')
  assert.equal(reloadConfig(), true) // lo arreglaste: lo lee sin reiniciar
  assert.equal(getConfig().claveIA, 'sk-ant-prueba')
  assert.equal(reloadConfig(), false)
})

test('si editás config.json con Pixie abierto, guardar no pisa tu cambio', () => {
  mkdirSync(dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), '{ "apps": [] }')
  loadConfig()
  writeFileSync(configPath(), '{ "apps": [], "claveIA": "AQ.nueva" }') // lo editás a mano
  saveConfig({ lugar: { nombre: 'Rosario' } }) // y Pixie guarda el clima
  const disk = JSON.parse(readFileSync(configPath(), 'utf8'))
  assert.equal(disk.claveIA, 'AQ.nueva')
  assert.deepEqual(disk.lugar, { nombre: 'Rosario' })
  assert.equal(getConfig().claveIA, 'AQ.nueva')
})
