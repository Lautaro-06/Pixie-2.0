import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opened } from 'electron'
import { checkUrl, checkQuery } from '../src/main/safety.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'

test('bloquea sitios para adultos, gore y del mercado negro', () => {
  assert.equal(checkUrl('https://www.pornhub.com/view?x=1'), 'adultos')
  assert.equal(checkUrl('es.xvideos.com'), 'adultos')
  assert.equal(checkUrl('https://cualquiercosaporno.net'), 'adultos')
  assert.equal(checkUrl('https://sitio.xxx'), 'adultos')
  assert.equal(checkUrl('https://bestgore.fun'), 'violento')
  assert.equal(checkUrl('http://algo.onion'), 'ilegal')
  assert.equal(checkUrl('https://misitio.com', ['misitio.com']), 'adultos') // los que sume config.json
})

test('no bloquea sitios normales', () => {
  for (const url of ['https://www.youtube.com', 'https://es.wikipedia.org/wiki/Sexualidad', 'https://www.gorenje.com', 'https://www.essex.ac.uk', 'https://classroom.google.com', 'https://www.argentina.gob.ar/educacion/esi']) {
    assert.equal(checkUrl(url), null, url)
  }
})

test('bloquea búsquedas de contenido sensible', () => {
  const blocked = {
    adultos: ['videos porno', 'pornografía', 'xxx', 'chicas desnudas', 'onlyfans de famosas', 'sexo gratis', 'videos de sexo', 'hentai', 'pornhub.com'],
    violento: ['gore', 'videos de muertes reales', 'gente muriendo', 'decapitaciones', 'fotos de cadáveres'],
    ilegal: ['dónde compro droga', 'comprar cocaína', 'conseguir armas', 'dni falso comprar', 'vender tarjetas clonadas', 'deep web', 'cómo entrar a la dark web', 'mercado negro', 'hackear instagram']
  }
  for (const [categoria, list] of Object.entries(blocked)) {
    for (const q of list) assert.equal(checkQuery(q), categoria, q)
  }
})

test('deja pasar tareas del colegio y cosas normales', () => {
  for (const q of [
    'educación sexual integral', 'reproducción de las plantas', 'efectos de la cocaína en el cuerpo', 'armas de la segunda guerra mundial',
    'Al Gore cambio climático', 'el emperador desnudo cuento', 'historia del contrabando en el Río de la Plata', 'recetas de pizza',
    'videos de gatos', 'qué es la fotosíntesis', 'partes del cuerpo humano', 'labial nude', 'coger el colectivo'
  ]) {
    assert.equal(checkQuery(q), null, q)
  }
})

test('no abre ni busca lo bloqueado, y Google va con búsqueda segura', async () => {
  const ctx = { log: () => {}, getConfig: () => ({}) }
  opened.length = 0
  const r1 = await runAction('abrir', { objetivo: 'pornhub.com' }, ctx)
  assert.equal(r1.blocked, 'adultos')
  assert.equal(r1.face, 'angry')
  assert.match(r1.text, /no muestro contenido para adultos/)
  const r2 = await runAction('abrir', { objetivo: 'pornhub' }, ctx)
  assert.equal(r2.blocked, 'adultos')
  const r3 = await runAction('buscar', { sitio: 'youtube', consulta: 'videos de muertes reales' }, ctx)
  assert.equal(r3.blocked, 'violento')
  const r4 = await runAction('buscar', { sitio: 'google', consulta: 'dónde comprar droga' }, ctx)
  assert.equal(r4.blocked, 'ilegal')
  assert.deepEqual(opened, [])

  await runAction('buscar', { sitio: 'google', consulta: 'recetas de pizza' }, ctx)
  assert.deepEqual(opened, ['https://www.google.com/search?q=recetas%20de%20pizza&safe=active'])
  await runAction('abrir', { objetivo: 'youtube' }, ctx)
  assert.match(opened[1], /youtube\.com/)
})

test('lo mismo si el pedido viene en una frase', async () => {
  const ctx = { log: () => {}, getConfig: () => ({}) }
  opened.length = 0
  for (const q of ['abrí pornhub.com', 'buscá videos porno', 'poné videos gore en youtube']) {
    const [it] = interpretAll(q)
    const r = await runAction(it.action, it.params, ctx)
    assert.ok(r.blocked, q)
  }
  assert.deepEqual(opened, [])
})
