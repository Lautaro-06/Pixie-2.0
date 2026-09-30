import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, summarizeUsage, durationText } from '../src/main/usage.js'
import { afterInteraction, currentMood, feeling, energy } from '../src/main/feelings.js'

test('reconoce qué estás haciendo según la ventana', () => {
  const c = (titulo, proceso, pantallaCompleta = false) => categorize({ titulo, proceso, pantallaCompleta })
  assert.deepEqual(c('Gatos graciosos - YouTube - Google Chrome', 'chrome'), { categoria: 'video', app: 'YouTube' })
  assert.deepEqual(c('Instagram', 'msedge'), { categoria: 'redes', app: 'Instagram' })
  assert.deepEqual(c('TP Historia.docx - Word', 'WINWORD'), { categoria: 'estudio', app: 'Word' })
  assert.deepEqual(c('Tareas - Classroom', 'chrome'), { categoria: 'estudio', app: 'Classroom' })
  assert.deepEqual(c('Spotify Premium', 'Spotify'), { categoria: 'musica', app: 'Spotify' })
  assert.deepEqual(c('Google', 'chrome'), { categoria: 'web', app: 'navegador' })
  assert.deepEqual(c('Hollow Knight', 'hollow_knight', true), { categoria: 'juego', app: 'hollow_knight' })
  assert.equal(c('', 'explorer', true), null) // el escritorio no cuenta
  assert.equal(c('Pixie', 'Pixie'), null)
  assert.deepEqual(c('Calculadora', 'ApplicationFrameHost'), { categoria: 'otros', app: 'Calculadora' })
})

test('resume el uso del día', () => {
  const day = { total: 7800, categorias: { estudio: 3600, video: 2700, redes: 1500 }, apps: { Word: 3600, YouTube: 2700, Instagram: 1500 } }
  assert.equal(summarizeUsage(day), 'Hoy usaste la compu 2 h 10 min: 1 h en estudio y trabajo, 45 min en videos, 25 min en redes sociales.')
  assert.equal(summarizeUsage(day, { buscar: 'youtube' }), 'Hoy estuviste 45 min en YouTube.')
  assert.equal(summarizeUsage(day, { buscar: 'videos' }), 'Hoy estuviste 45 min en videos.')
  assert.equal(summarizeUsage({ total: 10, categorias: {}, apps: {} }), 'Hoy casi no usaste la compu todavía.')
  assert.equal(durationText(5400), '1 h 30 min')
})

test('el ánimo sube cuando le hablás y baja si lo ignorás', () => {
  const t0 = new Date(2026, 8, 30, 15, 0).getTime()
  let mood = { valor: 65, ultimoContacto: t0 }
  mood = afterInteraction(mood, 'carino', t0)
  assert.equal(mood.valor, 77)
  assert.equal(feeling(mood, new Date(t0)), 'contento')
  const later = t0 + 12 * 3600 * 1000
  assert.equal(currentMood(mood, later), 29)
  assert.equal(afterInteraction(mood, 'insulto', t0).valor, 57)
})

test('tiene sueño de noche', () => {
  assert.ok(energy(new Date(2026, 8, 30, 3, 0)) < 40)
  assert.equal(feeling({ valor: 90 }, new Date(2026, 8, 30, 3, 0)), 'cansado')
  assert.equal(feeling({ valor: 30 }, new Date(2026, 8, 30, 15, 0)), 'aburrido')
})
