import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemory, similarity, alertsFor } from '../src/main/memory.js'

const fresh = () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pixie-')), 'memoria.json')
  return { file, mem: createMemory(file) }
}

test('guarda y vuelve a leer desde el disco', () => {
  const { file, mem } = fresh()
  mem.setName('Lautaro')
  mem.addFact('mi color favorito es el azul')
  const again = createMemory(file)
  assert.equal(again.getName(), 'Lautaro')
  assert.equal(again.listFacts()[0].texto, 'mi color favorito es el azul')
  assert.ok(JSON.parse(readFileSync(file, 'utf8')).datos.length === 1)
})

test('pendientes: agregar, tachar por parecido o número, vaciar', () => {
  const { mem } = fresh()
  mem.addTodo('comprar cartuchos')
  mem.addTodo('llamar a la abuela')
  mem.addTodo('entregar el TP de historia')
  assert.equal(mem.completeTodo({ buscar: 'ya compré los cartuchos' }).texto, 'comprar cartuchos')
  assert.equal(mem.completeTodo({ numero: 2 }).texto, 'entregar el TP de historia')
  assert.equal(mem.completeTodo({ buscar: 'algo que no existe' }), null)
  assert.equal(mem.clearTodos(), 1)
})

test('agenda: busca eventos y avisa a tiempo', () => {
  const { mem } = fresh()
  const prueba = mem.addEvent({ texto: 'prueba de historia', cuando: new Date(2026, 9, 6), conHora: false })
  mem.addEvent({ texto: 'dentista', cuando: new Date(2026, 9, 2, 17, 0), conHora: true })
  assert.equal(mem.findEvent('cuando es la prueba').id, prueba.id)
  assert.equal(mem.eventsBetween(new Date(2026, 9, 1), new Date(2026, 9, 3)).length, 1)

  assert.deepEqual(mem.dueAlerts(new Date(2026, 9, 2, 16, 44)), [])
  const due = mem.dueAlerts(new Date(2026, 9, 2, 16, 46))
  assert.deepEqual(due.map((d) => [d.evento.texto, d.clave]), [['dentista', 'antes']])
  assert.deepEqual(mem.dueAlerts(new Date(2026, 9, 2, 16, 50)), []) // no repite
  const eve = mem.dueAlerts(new Date(2026, 9, 5, 20, 1))
  // el aviso del dentista ya es viejo y no se manda; la prueba avisa la noche anterior
  assert.deepEqual(eve.map((d) => [d.evento.texto, d.clave]), [['prueba de historia', 'noche']])
})

test('los avisos muy viejos no se mandan', () => {
  const { mem } = fresh()
  mem.addEvent({ texto: 'reunión', cuando: new Date(2026, 9, 2, 10, 0), conHora: true })
  assert.deepEqual(mem.dueAlerts(new Date(2026, 9, 2, 22, 0)), [])
})

test('olvidar', () => {
  const { mem } = fresh()
  mem.addFact('mi perro se llama Toby')
  mem.addTodo('comprar pan')
  assert.equal(mem.forget('el perro').texto, 'mi perro se llama Toby')
  assert.equal(mem.listFacts().length, 0)
  mem.forgetAll()
  assert.equal(mem.listTodos().length, 0)
})

test('uso de la compu por día', () => {
  const { mem } = fresh()
  const day = new Date(2026, 8, 30, 10)
  mem.addUsage(day, 'video', 'YouTube', 60)
  mem.addUsage(day, 'video', 'YouTube', 30)
  mem.addUsage(day, 'estudio', 'Word', 120)
  const u = mem.getUsage(day)
  assert.equal(u.total, 210)
  assert.equal(u.categorias.video, 90)
  assert.equal(u.apps.Word, 120)
})

test('parecido entre textos', () => {
  assert.ok(similarity('cual es mi color favorito', 'mi color favorito es el azul') >= 0.5)
  assert.equal(similarity('perro', 'comprar pan'), 0)
})

test('avisos de eventos sin hora: la noche anterior y a la mañana', () => {
  const [noche, dia] = alertsFor(new Date(2026, 9, 6), false)
  assert.equal(new Date(noche.at).getDate(), 5)
  assert.equal(new Date(noche.at).getHours(), 20)
  assert.equal(new Date(dia.at).getHours(), 8)
})
