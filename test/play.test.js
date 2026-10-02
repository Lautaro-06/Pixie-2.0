import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opened } from 'electron'
import { parseResults, findVideo } from '../src/main/youtube-search.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'

// Página de resultados de YouTube (recortada): primero un en vivo, después videos
const data = {
  contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [
    { videoRenderer: { videoId: 'VIVOxxxxxxx', title: { runs: [{ text: 'Radio en vivo' }] } } },
    { videoRenderer: { videoId: 'aaaaaaaaaaa', title: { runs: [{ text: 'DUKI - Goteo' }] }, ownerText: { runs: [{ text: 'Duki' }] }, lengthText: { simpleText: '3:05' } } },
    { videoRenderer: { videoId: 'bbbbbbbbbbb', title: { runs: [{ text: 'Goteo (letra)' }] }, ownerText: { runs: [{ text: 'Letras' }] }, lengthText: { simpleText: '3:05' } } }
  ] } }] } } } }
}
const html = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`

test('saca el primer video de la página de resultados (sin los en vivo)', () => {
  const videos = parseResults(html)
  assert.deepEqual(videos[0], { videoId: 'aaaaaaaaaaa', title: 'DUKI - Goteo', channel: 'Duki' })
  assert.equal(videos.length, 2)
  assert.deepEqual(parseResults('... "videoId":"ccccccccccc" ...'), [{ videoId: 'ccccccccccc', title: '', channel: '' }])
  assert.deepEqual(parseResults('<html></html>'), [])
})

test('busca el video con filtro de "solo videos"', async () => {
  const urls = []
  const v = await findVideo('goteo duki', async (url) => (urls.push(url), { ok: true, text: async () => html }))
  assert.equal(v.videoId, 'aaaaaaaaaaa')
  assert.match(urls[0], /search_query=goteo%20duki&sp=EgIQAQ%253D%253D$/)
})

const base = { log: () => {}, getConfig: () => ({}) }

test('con la extensión: lo pone en YouTube y dice qué suena', async () => {
  const calls = []
  const browser = { connected: () => true, request: async (cmd, args) => (calls.push([cmd, args]), { ok: true, title: 'DUKI - Goteo', channel: 'Duki', playing: true }) }
  const r = await runAction('reproducir', { consulta: 'goteo de duki' }, { ...base, browser })
  assert.equal(r.text, 'Poniendo «DUKI - Goteo» de Duki.')
  assert.equal(r.face, 'music')
  assert.deepEqual(calls, [['reproducir', { consulta: 'goteo de duki' }]])
})

test('si Chrome no lo dejó arrancar solo, avisa que toques play', async () => {
  const browser = { connected: () => true, request: async () => ({ ok: true, title: 'La Bamba', channel: '', playing: false }) }
  const r = await runAction('reproducir', { consulta: 'la bamba' }, { ...base, browser })
  assert.equal(r.text, 'Te dejé «La Bamba». Si no arranca solo, tocá play.')
})

test('sin la extensión: busca el video y lo abre directo', async () => {
  opened.length = 0
  const fetch = async () => ({ ok: true, text: async () => html })
  const r = await runAction('reproducir', { consulta: 'goteo de duki' }, { ...base, browser: { connected: () => false }, fetch })
  assert.equal(r.text, 'Poniendo «DUKI - Goteo» de Duki.')
  assert.deepEqual(opened, ['https://www.youtube.com/watch?v=aaaaaaaaaaa'])
})

test('si no puede buscar, abre la búsqueda como antes', async () => {
  opened.length = 0
  const fetch = async () => ({ ok: false, status: 500 })
  const r = await runAction('reproducir', { consulta: 'la bamba' }, { ...base, fetch })
  assert.match(r.text, /Te abrí la búsqueda/)
  assert.deepEqual(opened, ['https://www.youtube.com/results?search_query=la%20bamba'])
})

test('el filtro de contenido vale también para los temas y los títulos', async () => {
  opened.length = 0
  const asked = await runAction('reproducir', { consulta: 'videos porno' }, base)
  assert.equal(asked.blocked, 'adultos')
  const calls = []
  const browser = { connected: () => true, request: async (cmd, args) => (calls.push([cmd, args]), cmd === 'reproducir' ? { title: 'xxx videos', playing: true } : {}) }
  const sneaky = await runAction('reproducir', { consulta: 'algo inocente' }, { ...base, browser })
  assert.equal(sneaky.blocked, 'adultos')
  assert.deepEqual(calls[1], ['youtube', { accion: 'pausa' }]) // lo frena
  assert.deepEqual(opened, [])
})

test('pone el video número N de la lista', async () => {
  const calls = []
  const browser = { connected: () => true, request: async (cmd, args) => (calls.push([cmd, args]), { title: 'Goteo (letra)', channel: 'Letras', playing: true }) }
  const r = await runAction('youtube_click', { n: 2 }, { ...base, browser })
  assert.equal(r.text, 'Poniendo «Goteo (letra)» de Letras.')
  assert.deepEqual(calls, [['youtube_click', { n: 2 }]])
})

test('entiende cuándo poner un tema y cuándo es otra cosa', () => {
  const act = (q) => interpretAll(q)?.map((i) => [i.action, i.params])
  assert.deepEqual(act('poné goteo de duki'), [['reproducir', { consulta: 'goteo de duki' }]])
  assert.deepEqual(act('quiero escuchar a los redondos'), [['reproducir', { consulta: 'los redondos' }]])
  assert.deepEqual(act('tocá la bamba'), [['reproducir', { consulta: 'la bamba' }]])
  assert.deepEqual(act('poné musica de duki'), [['reproducir', { consulta: 'música de duki' }]])
  assert.deepEqual(act('poné videos de gatos'), [['reproducir', { consulta: 'gatos' }]])
  assert.deepEqual(act('poné el segundo'), [['youtube_click', { n: 2 }]])
  assert.deepEqual(act('abrí el primer video'), [['youtube_click', { n: 1 }]])
  assert.deepEqual(act('poné música'), [['musica', { control: 'pausa' }]])
  assert.deepEqual(act('poné spotify'), [['abrir', { objetivo: 'spotify' }]])
  assert.deepEqual(act('poné el volumen al 50'), [['volumen', { cambio: 'poner', valor: 50 }]])
  assert.deepEqual(act('buscá recetas en youtube'), [['buscar', { sitio: 'youtube', consulta: 'recetas' }]])
})
