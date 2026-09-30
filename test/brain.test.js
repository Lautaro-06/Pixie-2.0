import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpret, interpretAll, normalize, suggest, isYes, isNo } from '../src/main/brain.js'
import { evaluate, toExpression } from '../src/main/calc.js'

// [frase, acción esperada, parámetros esperados (opcional)]
const CASES = [
  // Hora, fecha y clima
  ['¿Qué hora es?', 'decir_hora', {}],
  ['decime la hora por favor', 'decir_hora', {}],
  ['tenés hora?', 'decir_hora', {}],
  ['¿Qué día es hoy?', 'decir_hora', { fecha: true }],
  ['¿Cómo está el clima?', 'clima', {}],
  ['¿va a llover?', 'clima', {}],
  ['qué tal el clima', 'clima', {}],
  ['¿necesito campera?', 'clima', {}],
  ['clima en Córdoba', 'clima', { ciudad: 'cordoba' }],
  ['mi ciudad es Córdoba', 'configurar_ciudad', { ciudad: 'cordoba' }],

  // Abrir: con distintos verbos, sin verbo y con errores de tipeo
  ['Abrí YouTube', 'abrir', { objetivo: 'youtube' }],
  ['¿podés abrir la calculadora?', 'abrir', { objetivo: 'calculadora' }],
  ['hola pixie, abrí spotify', 'abrir', { objetivo: 'spotify' }],
  ['abrime mis descargas', 'abrir', { objetivo: 'descargas' }],
  ['entrá a github.com', 'abrir', { objetivo: 'github.com' }],
  ['quiero ver netflix', 'abrir', { objetivo: 'netflix' }],
  ['necesito el bloc de notas', 'abrir', { objetivo: 'bloc de notas' }],
  ['poné spotify', 'abrir', { objetivo: 'spotify' }],
  ['quiero que abras discord', 'abrir', { objetivo: 'discord' }],
  ['youtube', 'abrir', { objetivo: 'youtube' }],
  ['abrí yutub', 'abrir', { objetivo: 'youtube' }],
  ['abri spotyfi', 'abrir', { objetivo: 'spotify' }],
  ['whatsap', 'abrir', { objetivo: 'whatsapp' }],
  ['abrí google drive', 'abrir', { objetivo: 'google drive' }],
  ['abrí el cohete espacial', 'abrir', { objetivo: 'cohete espacial' }],
  ['cerrá el bloc de notas', 'cerrar_app', { objetivo: 'bloc de notas' }],
  ['cerrá spotfy', 'cerrar_app', { objetivo: 'spotify' }],

  // Búsquedas
  ['buscá recetas de pizza', 'buscar', { sitio: 'google', consulta: 'recetas de pizza' }],
  ['googleá el mundial 86', 'buscar', { sitio: 'google', consulta: 'el mundial 86' }],
  ['poné lofi para estudiar en youtube', 'buscar', { sitio: 'youtube', consulta: 'lofi para estudiar' }],
  ['buscá en youtube tutoriales de react', 'buscar', { sitio: 'youtube', consulta: 'tutoriales de react' }],
  ['poné videos de gatos', 'buscar', { sitio: 'youtube', consulta: 'gatos' }],
  ['poneme música de Duki', 'buscar', { sitio: 'youtube', consulta: 'música de duki' }],
  ['¿qué es la fotosíntesis?', 'buscar', { sitio: 'google', consulta: 'que es la fotosintesis' }],
  ['¿quién fue San Martín?', 'buscar', { sitio: 'google', consulta: 'quien fue san martin' }],
  ['¿dónde queda Tucumán?', 'buscar', { sitio: 'maps', consulta: 'tucuman' }],

  // Volumen y música
  ['subí el volumen', 'volumen', { cambio: 'subir', pasos: 5 }],
  ['bajá el volumen 20', 'volumen', { cambio: 'bajar', pasos: 10 }],
  ['más fuerte', 'volumen', { cambio: 'subir', pasos: 5 }],
  ['no se escucha nada', 'volumen', { cambio: 'subir', pasos: 5 }],
  ['está muy fuerte', 'volumen', { cambio: 'bajar', pasos: 5 }],
  ['volumen al máximo', 'volumen', { cambio: 'subir', pasos: 50 }],
  ['silenciá la compu', 'volumen', { cambio: 'silenciar' }],
  ['pausá la música', 'musica', { control: 'pausa' }],
  ['poné música', 'musica', { control: 'pausa' }],
  ['cortá la música', 'musica', { control: 'pausa' }],
  ['siguiente canción', 'musica', { control: 'siguiente' }],
  ['pasá de tema', 'musica', { control: 'siguiente' }],
  ['otra canción', 'musica', { control: 'siguiente' }],
  ['poné el tema anterior', 'musica', { control: 'anterior' }],

  // Timers
  ['poné un timer de 10 minutos', 'crear_timer', { segundos: 600 }],
  ['timer de media hora', 'crear_timer', { segundos: 1800 }],
  ['5 minutos', 'crear_timer', { segundos: 300 }],
  ['en media hora', 'crear_timer', { segundos: 1800 }],
  ['avisame en 5 minutos que saque la pizza', 'crear_timer', { segundos: 300, etiqueta: 'saque la pizza' }],
  ['recordame llamar a mamá en 1 hora y 15 minutos', 'crear_timer', { segundos: 4500, etiqueta: 'llamar a mama' }],
  ['poné un timer de cinco minutos para los fideos', 'crear_timer', { segundos: 300, etiqueta: 'los fideos' }],
  ['despertame en 20 min', 'crear_timer', { segundos: 1200 }],
  ['poné una alarma', 'crear_timer', {}],
  ['arrancá un pomodoro', 'crear_timer', { segundos: 1500, etiqueta: 'Pomodoro' }],
  ['cancelá el timer', 'cancelar_timers', {}],
  ['pará la alarma', 'cancelar_timers', {}],
  ['¿cuánto falta?', 'ver_timers', {}],

  // Sistema
  ['bloqueá la compu', 'bloquear_pc', {}],
  ['me voy a comer', 'bloquear_pc', {}],
  ['sacá una captura de pantalla', 'captura', {}],
  ['¿cómo está la compu?', 'estado_pc', {}],
  ['la compu anda lenta', 'estado_pc', {}],

  // Cuentas
  ['¿cuánto es 25 por 4?', 'calcular', { expresion: '25*4' }],
  ['12 + 30', 'calcular', { expresion: '12+30' }],
  ['calculá el 20% de 300', 'calcular', { expresion: '(20/100*300)' }],

  // Charla
  ['buen día', 'buen_dia', {}],
  ['hola', 'saludo', {}],
  ['Hola Pixie', 'saludo', {}],
  ['¿cómo estás?', 'charla', { tema: 'como_estas' }],
  ['¿quién sos?', 'charla', { tema: 'quien_sos' }],
  ['contame un chiste', 'charla', { tema: 'chiste' }],
  ['decime un dato curioso', 'charla', { tema: 'dato' }],
  ['sos un genio', 'charla', { tema: 'carino' }],
  ['estoy aburrido', 'charla', { tema: 'aburrido' }],
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

test('entiende varios pedidos juntos', () => {
  const actions = (text) => interpretAll(text).map((i) => [i.action, i.params])
  assert.deepEqual(actions('abrí YouTube y subí el volumen'), [
    ['abrir', { objetivo: 'youtube' }],
    ['volumen', { cambio: 'subir', pasos: 5 }]
  ])
  assert.deepEqual(actions('abrí youtube, spotify y discord'), [
    ['abrir', { objetivo: 'youtube' }],
    ['abrir', { objetivo: 'spotify' }],
    ['abrir', { objetivo: 'discord' }]
  ])
  assert.deepEqual(actions('cerrá spotify y discord'), [
    ['cerrar_app', { objetivo: 'spotify' }],
    ['cerrar_app', { objetivo: 'discord' }]
  ])
  assert.deepEqual(actions('decime la hora y el clima'), [['decir_hora', {}], ['clima', {}]])
  assert.deepEqual(actions('sos un genio, gracias'), [['gracias', {}]])
})

test('no parte frases que son un solo pedido', () => {
  assert.deepEqual(interpretAll('buscá perros y gatos').map((i) => i.params), [{ sitio: 'google', consulta: 'perros y gatos' }])
  assert.deepEqual(interpretAll('avisame en 1 hora y 15 minutos').map((i) => i.params), [{ segundos: 4500 }])
  assert.deepEqual(interpretAll('timer de hora y media').map((i) => i.params), [{ segundos: 5400 }])
})

test('usa las apps agregadas en config.json', () => {
  const customApps = [{ nombre: 'Minecraft', alias: ['minecraft', 'mine'], abrir: { tipo: 'ruta', valor: 'x' } }]
  assert.deepEqual(interpret('quiero jugar minecraft', { customApps }).params, { objetivo: 'minecraft' })
})

test('no inventa acciones para frases sin sentido', () => {
  assert.equal(interpret('el perro de mi vecino'), null)
  assert.equal(interpretAll('el perro de mi vecino'), null)
  assert.equal(interpret(''), null)
  assert.equal(interpret('   '), null)
})

test('sugiere opciones cuando no entiende', () => {
  const s = suggest('quiero algo con el volumne')
  assert.ok(s.includes('subí el volumen'))
  assert.ok(s.some((x) => x.startsWith('buscá ')))
  assert.ok(suggest('el yutube ese').includes('abrí YouTube'))
})

test('normaliza acentos, signos y muletillas', () => {
  assert.equal(normalize('¿Podés ABRIR YouTube, por favor?'), 'abrir youtube')
  assert.equal(normalize('abrí youtube, spotify'), 'abri youtube , spotify')
})

test('reconoce sí y no para confirmar', () => {
  assert.ok(isYes('Sí'))
  assert.ok(isYes('dale'))
  assert.ok(isNo('no'))
  assert.ok(!isYes('no'))
})

test('calculadora', () => {
  assert.equal(evaluate('25*4'), 100)
  assert.equal(evaluate('(2+3)^2'), 25)
  assert.equal(evaluate('10/4'), 2.5)
  assert.equal(evaluate('1/0'), null)
  assert.equal(evaluate('2+'), null)
  assert.equal(toExpression('10 dividido 4'), '10/4')
  assert.equal(toExpression('3 x 5'), '3*5')
  assert.equal(toExpression('hola'), null)
  assert.equal(toExpression('5 minutos'), null)
})

test('frases de ánimo, estudio, apagado y más', () => {
  const a = (p) => interpret(p)
  assert.deepEqual(a('estoy triste').params, { tema: 'animo' })
  assert.deepEqual(a('tengo que estudiar').params, { tema: 'estudiar' })
  assert.deepEqual(a('te odio').params, { tema: 'insulto' })
  assert.deepEqual(a('se escucha muy bajo').params, { cambio: 'subir', pasos: 5 })
  assert.equal(a('reproducí').action, 'musica')
  assert.deepEqual(a('apagá la compu').params, { modo: 'apagar' })
  assert.deepEqual(a('reiniciá la pc').params, { modo: 'reiniciar' })
  assert.equal(a('cancelá el apagado').action, 'cancelar_apagado')
})
