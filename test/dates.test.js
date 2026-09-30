import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWhen, withoutSpans, describeWhen } from '../src/main/dates.js'

// Miércoles 30 de septiembre de 2026, 18:00
const NOW = new Date(2026, 8, 30, 18, 0)

function when(text) {
  const r = parseWhen(text, NOW)
  if (!r) return null
  const d = r.date
  const date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  return r.hasTime ? `${date} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : date
}

const CASES = [
  ['manana tengo prueba', '2026-10-1'],
  ['pasado manana', '2026-10-2'],
  ['hoy a las 20', '2026-9-30 20:00'],
  ['a las 6 de la tarde', '2026-10-1 18:00'], // ya pasó hoy: mañana
  ['a las 21:30', '2026-9-30 21:30'],
  ['a las 9 y media', '2026-10-1 9:30'],
  ['a las ocho de la noche', '2026-9-30 20:00'],
  ['a las 3', '2026-10-1 15:00'],
  ['manana a la manana', '2026-10-1 9:00'],
  ['manana a la noche', '2026-10-1 21:00'],
  ['esta noche', '2026-9-30 21:00'],
  ['el martes', '2026-10-6'],
  ['el miercoles', '2026-10-7'], // hoy es miércoles: el que viene
  ['este miercoles', '2026-9-30'],
  ['el viernes a las 10', '2026-10-2 10:00'],
  ['el 15 de octubre', '2026-10-15'],
  ['el 5', '2026-10-5'], // ya pasó el 5 de este mes
  ['15/10', '2026-10-15'],
  ['el 2 de marzo', '2027-3-2'],
  ['en 3 dias', '2026-10-3'],
  ['la semana que viene', '2026-10-7']
]

for (const [text, expected] of CASES) {
  test(`«${text}» → ${expected}`, () => assert.equal(when(text), expected))
}

test('no ve fechas donde no hay', () => {
  assert.equal(parseWhen('abri youtube', NOW), null)
  assert.equal(parseWhen('timer de 15 minutos', NOW), null)
  assert.equal(parseWhen('por la manana en la escuela es aburrido el 20% de las veces', NOW)?.hasTime, true)
})

test('saca la fecha del texto', () => {
  const t = 'el martes a las 10 tengo dentista'
  assert.equal(withoutSpans(t, parseWhen(t, NOW).spans), 'tengo dentista')
})

test('describe fechas', () => {
  assert.equal(describeWhen(new Date(2026, 8, 30, 20, 0), true, NOW), 'hoy a las 20:00')
  assert.equal(describeWhen(new Date(2026, 9, 1), false, NOW), 'mañana')
  assert.equal(describeWhen(new Date(2026, 9, 6), false, NOW), 'el martes')
})
