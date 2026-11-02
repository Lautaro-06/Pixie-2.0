import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sceneFor, musicPlaying, currentScene } from '../src/main/scenes.js'
import { renderFace, WIDTH, HEIGHT } from '../src/renderer/src/face/draw.js'
import { compose, REACTIONS, SCENE_MOTION, IDLE_BY_SCENE } from '../src/renderer/src/face/animations.js'
import { drawScene, drawNightcap, COLOR, SCENES } from '../src/renderer/src/face/props.js'

const s = (titulo, proceso, pantallaCompleta = false) => sceneFor({ titulo, proceso, pantallaCompleta })

test('se da cuenta de lo que estás haciendo: streaming, trabajo, música, juegos…', () => {
  for (const t of ['Gatos - YouTube - Google Chrome', 'Netflix', 'Cuevana 3 - Películas online', 'Kick', 'xQc - Twitch', 'Instagram', 'TikTok - Make Your Day', 'Disney+ | Inicio', 'Crunchyroll - Anime', 'Pluto TV'])
    assert.equal(s(t, 'chrome'), 'cine', t)
  assert.equal(s('Película.mkv - VLC media player', 'vlc'), 'cine')
  assert.equal(s('Stremio', 'stremio'), 'cine')
  assert.equal(s('YouTube Music', 'chrome'), 'musica', 'YouTube Music es música, no cine')
  assert.equal(s('Spotify Premium', 'Spotify'), 'musica')
  for (const [t, p] of [['TP Historia.docx - Word', 'WINWORD'], ['Presentación1 - PowerPoint', 'POWERPNT'], ['Planilla - Excel', 'EXCEL'], ['Informe - Documentos de Google - Google Chrome', 'chrome'], ['Notas', 'Notion']])
    assert.equal(s(t, p), 'trabajando', t)
  assert.equal(s('index.js - pixie - Visual Studio Code', 'Code'), 'programando')
  assert.equal(s('Pull requests · GitHub', 'chrome'), 'programando')
  assert.equal(s('apunte.pdf', 'AcroRd32'), 'leyendo')
  assert.equal(s('Fotosíntesis - Wikipedia, la enciclopedia libre', 'msedge'), 'leyendo')
  assert.equal(s('Tareas - Classroom', 'chrome'), 'leyendo')
  assert.equal(s('Minecraft 1.21', 'javaw'), 'jugando')
  assert.equal(s('Hollow Knight', 'otro_juego', true), 'jugando', 'cualquier cosa en pantalla completa es un juego')
  assert.equal(s('Reunión de Zoom', 'Zoom'), 'reunion')
  assert.equal(s('Zoom Workplace', 'Zoom'), 'chateando', 'Zoom sin una llamada')
  assert.equal(s('WhatsApp', 'WhatsApp'), 'chateando')
  assert.equal(s('Diseño sin título - Canva', 'chrome'), 'artista')
  assert.equal(s('dibujo.png - Paint', 'mspaint'), 'artista')
  // No se confunde
  assert.equal(s('Google', 'chrome'), null)
  assert.equal(s('Números complejos - Khan Academy', 'chrome'), null, '«complejos» no es Plex')
  assert.equal(s('Max Verstappen - Wikipedia', 'chrome'), 'leyendo', '«Max» no es la plataforma')
  assert.equal(s('Pixie', 'Pixie'), null)
  assert.equal(s('', 'explorer', true), null)
})

test('con música de fondo se pone los auriculares', () => {
  assert.equal(musicPlaying({ app: 'Spotify.exe', estado: 'Playing', artista: 'Duki' }), true)
  assert.equal(musicPlaying({ app: 'Spotify.exe', estado: 'Paused' }), false)
  assert.equal(musicPlaying({ app: 'chrome', estado: 'Playing', artista: 'Bizarrap' }), true)
  assert.equal(musicPlaying({ app: 'chrome', estado: 'Playing', artista: '' }), false)
  const word = { titulo: 'TP.docx - Word', proceso: 'WINWORD' }
  assert.deepEqual(currentScene(word, { app: 'Spotify.exe', estado: 'Playing' }), { escena: 'trabajando', auris: true })
  assert.deepEqual(currentScene(word, null), { escena: 'trabajando', auris: false })
  assert.deepEqual(currentScene({ titulo: 'Google', proceso: 'chrome' }, { app: 'Spotify.exe', estado: 'Playing' }), { escena: 'musica', auris: false })
  assert.deepEqual(currentScene({ titulo: 'Netflix', proceso: 'chrome' }, { app: 'Spotify.exe', estado: 'Playing' }), { escena: 'cine', auris: false }, 'mirando una peli no se pone auriculares')
})

const count = (bits, c) => bits.reduce((n, v) => n + (v === c ? 1 : 0), 0)
const draw = (name, t = 2000, extra = {}) => {
  const params = compose('idle', 0, [], t, { scene: { name, start: 0 } })
  return drawScene(renderFace(params), { name, t, props: true, ...extra }, params)
}

test('cada disfraz se dibuja, con colores, y se mueve', () => {
  for (const name of SCENES) {
    const bits = draw(name)
    assert.equal(bits.length, WIDTH * HEIGHT)
    assert.ok(bits.some((v) => v > 1), `${name} no tiene colores`)
    assert.ok(SCENE_MOTION[name], `${name} no tiene movimiento`)
    for (let t = 0; t < 8000; t += 90) draw(name, t)
  }
  const cine = draw('cine')
  assert.ok(count(cine, COLOR.rojo) > 50 && count(cine, COLOR.cian) > 50, 'anteojos 3D: una lente roja y una cian')
  assert.ok(count(cine, COLOR.amarillo) > 5, 'pochoclos')
  assert.ok(count(draw('cine', 2000, { props: false }), COLOR.amarillo) === 0, 'mientras habla o te escucha, sin el balde')
  assert.ok(count(draw('musica'), COLOR.violeta) > 30, 'auriculares')
  assert.ok(count(draw('programando'), COLOR.verde) > 5, '</>')
  assert.ok(count(draw('trabajando', 2000, { auris: true }), COLOR.violeta) > 30, 'auriculares con música de fondo')
  for (const name of Object.keys(IDLE_BY_SCENE)) for (const [, r] of IDLE_BY_SCENE[name]) assert.ok(REACTIONS[r], r)
})

test('los disfraces entran con un saltito y salen', () => {
  const start = draw('jugando', 0)
  const end = draw('jugando', 1200)
  assert.ok(count(start, COLOR.grisOscuro) < count(end, COLOR.grisOscuro), 'al principio el joystick todavía está entrando')
  const leaving = drawScene(renderFace(), { name: 'jugando', t: 270, exit: true, props: true })
  assert.ok(count(leaving, COLOR.grisOscuro) < count(end, COLOR.grisOscuro))
  assert.deepEqual(drawScene(renderFace(), null), renderFace())
  assert.ok(count(drawNightcap(renderFace(), {}), COLOR.azul) > 10, 'gorro de dormir')
})
