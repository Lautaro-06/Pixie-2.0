import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpret, normalize, isYes, isNo } from '../src/main/brain.js'

// [frase, acción esperada, parámetros esperados (opcional)]
const CASES = [
  ['¿Qué hora es?', 'decir_hora', {}],
  ['decime la hora por favor', 'decir_hora', {}],
  ['¿Qué día es hoy?', 'decir_hora', { fecha: true }],
  ['¿Cómo está el clima?', 'clima', {}],
  ['¿va a llover?', 'clima', {}],
  ['mi ciudad es Córdoba', 'configurar_ciudad', { ciudad: 'cordoba' }],
  ['Abrí YouTube', 'abrir', { objetivo: 'youtube' }],
  ['¿podés abrir la calculadora?', 'abrir', { objetivo: 'calculadora' }],
  ['hola pixie, abrí spotify', 'abrir', { objetivo: 'spotify' }],
  ['abrime mis descargas', 'abrir', { objetivo: 'descargas' }],
  ['entrá a github.com', 'abrir', { objetivo: 'github.com' }],
  ['cerrá el bloc de notas', 'cerrar_app', { objetivo: 'bloc de notas' }],
  ['buscá recetas de pizza', 'buscar', { sitio: 'google', consulta: 'recetas de pizza' }],
  ['poné lofi para estudiar en youtube', 'buscar', { sitio: 'youtube', consulta: 'lofi para estudiar' }],
  ['subí el volumen', 'volumen', { cambio: 'subir', pasos: 5 }],
  ['bajá el volumen 20', 'volumen', { cambio: 'bajar', pasos: 10 }],
  ['silenciá la compu', 'volumen', { cambio: 'silenciar' }],
  ['pausá la música', 'musica', { control: 'pausa' }],
  ['siguiente canción', 'musica', { control: 'siguiente' }],
  ['poné el tema anterior', 'musica', { control: 'anterior' }],
  ['poné un timer de 10 minutos', 'crear_timer', { segundos: 600 }],
  ['timer de media hora', 'crear_timer', { segundos: 1800 }],
  ['avisame en 5 minutos que saque la pizza', 'crear_timer', { segundos: 300, etiqueta: 'saque la pizza' }],
  ['recordame llamar a mamá en 1 hora y 15 minutos', 'crear_timer', { segundos: 4500, etiqueta: 'llamar a mama' }],
  ['poné un timer de cinco minutos para los fideos', 'crear_timer', { segundos: 300, etiqueta: 'los fideos' }],
  ['poné una alarma', 'crear_timer', {}],
  ['arrancá un pomodoro', 'crear_timer', { segundos: 1500, etiqueta: 'Pomodoro' }],
  ['cancelá el timer', 'cancelar_timers', {}],
  ['pará la alarma', 'cancelar_timers', {}],
  ['¿cuánto falta?', 'ver_timers', {}],
  ['bloqueá la compu', 'bloquear_pc', {}],
  ['sacá una captura de pantalla', 'captura', {}],
  ['¿cómo está la compu?', 'estado_pc', {}],
  ['buen día', 'buen_dia', {}],
  ['hola', 'saludo', {}],
  ['Hola Pixie', 'saludo', {}],
  ['gracias!', 'gracias', {}],
  ['¿qué podés hacer?', 'ayuda', {}],
  ['chau', 'ocultar', {}]
]

for (const [phrase, action, params] of CASES) {
  test(`«${phrase}» → ${action}`, () => {
    const result = interpret(phrase)
    assert.ok(result, `no entendió «${phrase}»`)
    assert.equal(result.action, action)
    if (params) assert.deepEqual(result.params, params)
  })
}

test('no inventa acciones para frases sin sentido', () => {
  assert.equal(interpret('el perro de mi vecino'), null)
  assert.equal(interpret(''), null)
  assert.equal(interpret('   '), null)
})

test('normaliza acentos, signos y muletillas', () => {
  assert.equal(normalize('¿Podés ABRIR YouTube, por favor?'), 'abrir youtube')
})

test('reconoce sí y no para confirmar', () => {
  assert.ok(isYes('Sí'))
  assert.ok(isYes('dale'))
  assert.ok(isNo('no'))
  assert.ok(!isYes('no'))
})
