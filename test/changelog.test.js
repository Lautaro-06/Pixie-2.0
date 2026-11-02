import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANGELOG, compareVersions, entriesBetween, updateText, whatsNewText } from '../src/main/changelog.js'
import { interpretAll } from '../src/main/brain.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('cada versión publicada cuenta qué tiene de nuevo (la del package.json también)', () => {
  assert.equal(CHANGELOG[0].version, pkg.version, 'sumá las novedades de la versión nueva en src/main/changelog.js')
  for (const e of CHANGELOG) {
    assert.ok(e.nuevo.length + e.mejoras.length > 0, e.version)
    for (const x of [...e.nuevo, ...e.mejoras]) assert.ok(x.corto && x.detalle, e.version)
  }
  const sorted = [...CHANGELOG].sort((a, b) => compareVersions(b.version, a.version))
  assert.deepEqual(CHANGELOG.map((e) => e.version), sorted.map((e) => e.version), 'la más nueva primero')
})

test('compara versiones como números', () => {
  assert.ok(compareVersions('0.10.2', '0.9.1') > 0)
  assert.ok(compareVersions('0.12.0', '0.12') === 0)
  assert.ok(compareVersions('0.11.0', '0.11.1') < 0)
})

const LIST = [
  { version: '0.3.0', nuevo: [{ corto: 'juego al ajedrez', detalle: 'Juego al ajedrez.' }], mejoras: [{ corto: 'hablo más claro', detalle: 'Hablo más claro.' }] },
  { version: '0.2.1', nuevo: [], mejoras: [{ corto: 'no me cuelgo', detalle: 'Ya no me cuelgo.' }] },
  { version: '0.2.0', nuevo: [{ corto: 'canto', detalle: 'Canto.' }], mejoras: [] }
]

test('al actualizarse cuenta lo nuevo y lo que mejoró, aunque se haya salteado versiones', () => {
  assert.equal(updateText('0.2.1', '0.3.0', LIST), '¡Me actualicé a la versión 0.3! Lo nuevo: juego al ajedrez. Y mejoré: hablo más claro.')
  assert.equal(updateText('0.1.0', '0.3.0', LIST), '¡Me actualicé a la versión 0.3! Lo nuevo: juego al ajedrez y canto. Y mejoré: hablo más claro y no me cuelgo.')
  assert.equal(updateText('0.2.0', '0.2.1', LIST), '¡Me actualicé a la versión 0.2.1! Mejoré: no me cuelgo.')
  assert.equal(updateText(null, '0.3.0', LIST), '¡Me actualicé a la versión 0.3! Lo nuevo: juego al ajedrez. Y mejoré: hablo más claro.')
  assert.equal(updateText('0.3.0', '0.3.1', LIST), '¡Me actualicé a la versión 0.3.1! Arreglé algunas cositas por dentro.')
  assert.deepEqual(entriesBetween('0.2.0', '0.3.0', LIST).map((e) => e.version), ['0.3.0', '0.2.1'])
})

test('«¿qué hay de nuevo?» lo cuenta con detalle', () => {
  assert.equal(whatsNewText('0.3.0', LIST), 'En la versión 0.3: Juego al ajedrez. Además, mejoré cosas. Hablo más claro.')
  assert.equal(whatsNewText('0.2.5', LIST), 'En la versión 0.2.1: Mejoré cosas. Ya no me cuelgo.')
  assert.match(whatsNewText(pkg.version), /^En la versión /)
  for (const t of ['¿qué hay de nuevo?', 'novedades', '¿qué cambió en la última actualización?', 'qué mejoraste', '¿qué cosas nuevas sabés hacer?']) {
    assert.deepEqual(interpretAll(t), [{ action: 'novedades', params: {} }], t)
  }
})
