import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadConfig, configPath, brokenConfigPath } from '../src/main/config.js'

test('si config.json quedó mal escrito, guarda una copia y no pierde la clave', () => {
  mkdirSync(dirname(configPath()), { recursive: true })
  rmSync(brokenConfigPath(), { force: true })
  const broken = '{\n  "apps": []\n  "claveIA": "sk-ant-prueba"\n}' // falta la coma
  writeFileSync(configPath(), broken)
  const cfg = loadConfig()
  assert.equal(cfg.claveIA, undefined)
  assert.equal(cfg.ciudad, 'Buenos Aires')
  assert.equal(readFileSync(brokenConfigPath(), 'utf8'), broken)

  writeFileSync(configPath(), '{ "apps": [], "claveIA": "sk-ant-prueba" }')
  assert.equal(loadConfig().claveIA, 'sk-ant-prueba')
})
