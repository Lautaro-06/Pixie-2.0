import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { opened } from './helpers/electron-stub.mjs'
import { parseICS, findCalendarUrl, createCalendars, wallTime } from '../src/main/calendars.js'
import { parseFeed, createNews, decodeEntities } from '../src/main/news.js'
import { createMemory } from '../src/main/memory.js'
import { createInitiative, TIMES } from '../src/main/initiative.js'
import { createSettings } from '../src/main/settings.js'
import { interpretAll } from '../src/main/brain.js'
import { runAction } from '../src/main/actions/index.js'
import { resetNews } from '../src/main/actions/news.js'

const MIN = 60 * 1000
const ICS = readFileSync(new URL('./fixtures/calendario.ics', import.meta.url), 'utf8')
const tmp = (name) => mkdtempSync(join(tmpdir(), `pixie-${name}-`))
const ar = (iso) => new Date(`${iso}-03:00`) // hora de Argentina
const act = (text) => interpretAll(text)?.map((i) => [i.action, i.params])
const quiet = { log: () => {} }
// Un cifrado de mentira (en la app es el de la cuenta de Windows)
const cipher = { available: () => true, encrypt: (t) => Buffer.from(`x${t}`).toString('base64'), decrypt: (b) => Buffer.from(b, 'base64').toString().slice(1) }
const response = (status, text) => ({ ok: status >= 200 && status < 300, status, text: async () => text })

// ───────────── Calendarios ─────────────

test('lee un calendario de Google: clases que se repiten, entregas de Classroom y cambios', () => {
  const { nombre, eventos } = parseICS(ICS, { from: ar('2026-11-01T00:00:00'), to: ar('2026-11-30T00:00:00') })
  assert.equal(nombre, 'Matemática 5°B')
  const clases = eventos.filter((e) => e.texto === 'Clase de matemática').map((e) => e.cuando)
  // Lunes y miércoles a las 8 (hora argentina), 10 veces: sin el 4 (salteado) ni el 11 (se movió)
  assert.deepEqual(
    clases,
    ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25'].map((d) => ar(`${d}T08:00:00`).toISOString())
  )
  const moved = eventos.find((e) => /cambió de horario/.test(e.texto))
  assert.equal(moved.cuando, ar('2026-11-11T10:00:00').toISOString())
  const entrega = eventos.find((e) => e.texto.startsWith('Entrega: TP 3'))
  assert.equal(entrega.conHora, false)
  assert.match(entrega.texto, /título largo que Google parte en dos renglones$/, 'junta los renglones partidos')
  const d = new Date(entrega.cuando)
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 5, 0], 'de todo el día: el 5 en tu compu')
  assert.equal(eventos.find((e) => e.texto === 'Prueba de física').cuando, '2026-11-03T20:00:00.000Z')
  assert.equal(eventos.find((e) => e.texto === 'Clase de matemática').lugar, 'Aula 12, primer piso')
  assert.ok(!eventos.some((e) => /canceló|hace mucho/.test(e.texto)))
})

test('las horas de otra zona horaria quedan bien', () => {
  assert.equal(wallTime({ y: 2026, mo: 10, d: 2, h: 8 }, { timeZone: 'America/Argentina/Buenos_Aires' }).toISOString(), '2026-11-02T11:00:00.000Z')
  assert.equal(wallTime({ y: 2026, mo: 6, d: 1, h: 12 }, { timeZone: 'Europe/Madrid' }).toISOString(), '2026-07-01T10:00:00.000Z')
  assert.equal(wallTime({ y: 2026, mo: 0, d: 15, h: 12 }, { timeZone: 'Europe/Madrid' }).toISOString(), '2026-01-15T11:00:00.000Z')
  // Una zona que no conoce (las de Outlook): la toma como hora de la compu
  assert.equal(wallTime({ y: 2026, mo: 0, d: 15, h: 12 }, { timeZone: 'Argentina Standard Time' }).getHours(), 12)
})

test('encuentra la dirección secreta en lo que copiaste', () => {
  assert.equal(
    findCalendarUrl('Dirección: https://calendar.google.com/calendar/ical/abc%40gmail.com/private-1a2b/basic.ics ¡no la compartas!'),
    'https://calendar.google.com/calendar/ical/abc%40gmail.com/private-1a2b/basic.ics'
  )
  assert.equal(findCalendarUrl('webcal://example.com/clases.ics'), 'https://example.com/clases.ics')
  assert.equal(findCalendarUrl('https://calendar.google.com/calendar/r'), null)
  assert.equal(findCalendarUrl(''), null)
})

test('suma un calendario, guarda la dirección cifrada y avisa antes', async () => {
  const file = join(tmp('cal'), 'calendarios.json')
  let now = ar('2026-11-02T07:00:00')
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    if (url.includes('roto')) return response(404, 'no')
    if (url.includes('pagina')) return response(200, '<html>hola</html>')
    return response(200, ICS)
  }
  const cals = createCalendars({ file, cipher, fetchImpl, now: () => now })
  assert.match((await cals.add('hola')).mensaje, /no parece la dirección/)
  assert.match((await cals.add('https://x.com/roto.ics')).mensaje, /no anda/)
  assert.match((await cals.add('https://x.com/pagina.ics')).mensaje, /no es un calendario/)
  const r = await cals.add('https://calendar.google.com/calendar/ical/yo/private-1/basic.ics')
  assert.equal(r.ok, true)
  assert.match(r.mensaje, /Sumé «Matemática 5°B»: tiene \d+ cosas en los próximos 7 días/)
  assert.match((await cals.add('https://calendar.google.com/calendar/ical/yo/private-1/basic.ics')).mensaje, /ya lo tengo/)
  assert.ok(cals.has('webcal://calendar.google.com/calendar/ical/yo/private-1/basic.ics'))
  // En el archivo, la dirección no está a la vista
  const saved = readFileSync(file, 'utf8')
  assert.doesNotMatch(saved, /private-1/)
  assert.match(saved, /urlCifrada/)

  // Sus eventos se ven en la agenda de Pixie
  const mem = createMemory(join(tmp('mem'), 'memoria.json'))
  mem.setExternal({ eventsBetween: cals.eventsBetween, dueAlerts: cals.dueAlerts })
  mem.addEvent({ texto: 'dentista', cuando: ar('2026-11-02T17:00:00'), conHora: true })
  const today = mem.eventsBetween(ar('2026-11-02T00:00:00'), ar('2026-11-02T23:59:00'))
  assert.deepEqual(
    today.map((e) => e.texto),
    ['Clase de matemática', 'dentista']
  )
  assert.equal(today[0].calendario, 'Matemática 5°B')

  // Avisa 15 minutos antes de la clase (no a la hora), una sola vez
  now = ar('2026-11-02T07:44:00')
  assert.deepEqual(mem.dueAlerts(now).map((a) => a.clave), [])
  now = ar('2026-11-02T07:46:00')
  const due = mem.dueAlerts(now)
  assert.deepEqual(due.map((a) => [a.evento.texto, a.clave]), [['Clase de matemática', 'antes']])
  assert.deepEqual(mem.dueAlerts(now), [])
  // La entrega de todo el día: la noche anterior a las 20
  now = new Date(2026, 10, 4, 20, 1)
  assert.ok(mem.dueAlerts(now).some((a) => a.evento.texto.startsWith('Entrega') && a.clave === 'noche'))

  // Sin avisos para ese calendario
  const id = cals.status()[0].id
  cals.setAlerts(id, false)
  now = ar('2026-11-09T07:46:00')
  assert.deepEqual(cals.dueAlerts(now), [])

  // Al volver a abrir Pixie la encuentra (descifrada) y no avisa de lo que ya pasó
  const again = createCalendars({ file, cipher, fetchImpl, now: () => ar('2026-11-16T07:50:00') })
  await again.refresh()
  assert.equal(again.status()[0].nombre, 'Matemática 5°B')
  assert.equal(again.status()[0].avisos, false)
  assert.equal(urls.at(-1), 'https://calendar.google.com/calendar/ical/yo/private-1/basic.ics')
  again.remove(id)
  assert.equal(again.count(), 0)
})

test('si el calendario deja de andar, lo dice y sigue con lo que tenía', async () => {
  let fail = false
  const cals = createCalendars({
    file: join(tmp('cal2'), 'calendarios.json'),
    fetchImpl: async () => {
      if (fail) throw new Error('sin internet')
      return response(200, ICS)
    },
    now: () => ar('2026-11-01T12:00:00')
  })
  await cals.add('https://calendar.google.com/calendar/ical/yo/private-2/basic.ics')
  fail = true
  await cals.refresh()
  const st = cals.status()[0]
  assert.match(st.error, /internet/)
  assert.ok(st.proximos > 0)
})

// ───────────── Noticias ─────────────

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Infobae</title>
<item><title><![CDATA[Arrancó la inscripción a las becas &quot;Progresar&quot; para estudiantes]]></title><link>https://www.infobae.com/sociedad/2026/10/30/becas/</link><pubDate>Fri, 30 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Cómo anotarse paso a paso.</p>]]></description></item>
<item><title>El dólar cerró estable este viernes</title><link>https://www.infobae.com/economia/dolar/</link><pubDate>Fri, 30 Oct 2026 11:00:00 GMT</pubDate></item>
<item><title>Mirá el video de muertes reales que circula</title><link>https://www.infobae.com/otra/</link></item>
</channel></rss>`
const GOOGLE = `<rss><channel><item><title>River ganó el clásico y es puntero - TN</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Fri, 30 Oct 2026 13:00:00 GMT</pubDate></item>
<item><title>Llega el calor: así va a estar el tiempo - TN</title><link>https://news.google.com/rss/articles/def</link></item></channel></rss>`
const ATOM = `<feed><entry><title>Titular en Atom &amp; algo más</title><link href="https://ejemplo.com/a"/><updated>2026-10-30T10:00:00Z</updated></entry></feed>`

test('lee los titulares de un RSS (y de Google Noticias y Atom)', () => {
  const items = parseFeed(RSS, { nombre: 'Infobae' })
  assert.equal(items.length, 3)
  assert.equal(items[0].titulo, 'Arrancó la inscripción a las becas "Progresar" para estudiantes')
  assert.equal(items[0].resumen, 'Cómo anotarse paso a paso.')
  assert.equal(items[0].fecha, '2026-10-30T12:00:00.000Z')
  assert.equal(parseFeed(GOOGLE, { nombre: 'TN' })[0].titulo, 'River ganó el clásico y es puntero')
  assert.deepEqual(parseFeed(ATOM)[0], { titulo: 'Titular en Atom & algo más', link: 'https://ejemplo.com/a', fecha: '2026-10-30T10:00:00.000Z' })
  assert.equal(decodeEntities('&#225;rbol &#x1F600; &laquo;hola&raquo;'), 'árbol 😀 «hola»')
  assert.deepEqual(parseFeed('no es un rss'), [])
})

test('junta Infobae y TN, prueba otra dirección si una falla y no lee titulares violentos', async () => {
  const calls = []
  let offline = false
  let t = 0
  const news = createNews({
    now: () => t,
    fetchImpl: async (url) => {
      calls.push(url)
      if (offline) throw new Error('sin internet')
      if (url.includes('infobae.com/arc')) return response(200, RSS)
      if (url.startsWith('https://news.google.com') && url.includes('tn.com.ar')) return response(200, GOOGLE)
      if (url.includes('tn.com.ar')) return response(503, '') // el RSS de TN no anda: usa Google Noticias
      return response(404, '')
    }
  })
  const all = await news.latest()
  assert.deepEqual(
    all.map((it) => `${it.fuente}: ${it.titulo}`),
    [
      'Infobae: Arrancó la inscripción a las becas "Progresar" para estudiantes',
      'TN: River ganó el clásico y es puntero',
      'Infobae: El dólar cerró estable este viernes',
      'TN: Llega el calor: así va a estar el tiempo'
    ]
  )
  assert.ok(calls.some((u) => u.includes('news.google.com')))
  assert.deepEqual((await news.latest({ tema: 'dólar' })).map((it) => it.titulo), ['El dólar cerró estable este viernes'])
  assert.deepEqual((await news.latest({ fuentes: ['tn'] })).map((it) => it.fuente), ['TN', 'TN'])
  // Guarda un rato: no vuelve a pedir enseguida, y sin internet usa lo último que tenía
  const before = calls.length
  await news.latest()
  assert.equal(calls.length, before)
  t = 11 * MIN
  offline = true
  assert.equal((await news.latest()).length, 4)
  const empty = createNews({ fetchImpl: async () => { throw new Error('nada') } })
  await assert.rejects(empty.latest(), /¿Hay internet\?/)
})

test('cuenta las noticias, sigue con «más» y abre la que le pedís', async () => {
  resetNews()
  const items = Array.from({ length: 7 }, (_, i) => ({ titulo: `Titular ${i + 1}`, link: `https://www.infobae.com/n${i + 1}`, fuente: i % 2 ? 'TN' : 'Infobae' }))
  const ctx = { ...quiet, getConfig: () => ({}), news: { latest: async ({ tema } = {}) => (tema ? items.filter((it) => it.titulo.endsWith('7')) : items) } }
  let r = await runAction('noticias', {}, ctx)
  assert.equal(r.text, 'Lo último de Infobae y TN: «Titular 1» (Infobae). «Titular 2» (TN). «Titular 3» (Infobae).')
  assert.deepEqual(r.suggestions, ['más noticias', 'abrí la primera'])
  r = await runAction('noticias', { mas: true }, ctx)
  assert.match(r.text, /^Más: «Titular 4».*«Titular 6»/)
  r = await runAction('abrir_noticia', { n: 2 }, ctx)
  assert.equal(r.text, 'Te abrí la noticia de Infobae.')
  assert.equal(opened.at(-1), 'https://www.infobae.com/n5')
  await runAction('noticias', { mas: true }, ctx)
  assert.match((await runAction('noticias', { mas: true }, ctx)).text, /no hay más noticias/)
  assert.match((await runAction('noticias', { tema: 'dólar' }, { ...ctx, news: { latest: async () => [] } })).text, /No encontré noticias de dólar/)
  // Por su cuenta: un titular que todavía no contó
  resetNews()
  assert.match((await runAction('noticias', { aviso: true }, ctx)).text, /^Che, lo último de Infobae: «Titular 1»/)
  assert.match((await runAction('noticias', { aviso: true }, ctx)).text, /«Titular 2»/)
  assert.equal((await runAction('noticias', { aviso: true }, { ...ctx, news: { latest: async () => { throw new Error('x') } } })).text, '')
  resetNews()
  assert.match((await runAction('abrir_noticia', { n: 1 }, ctx)).text, /Pedime «noticias» primero/)
})

test('entiende los pedidos de noticias y de la agenda', () => {
  assert.deepEqual(act('¿qué noticias hay?'), [['noticias', {}]])
  assert.deepEqual(act('noticias de TN'), [['noticias', { fuente: 'tn' }]])
  assert.deepEqual(act('qué dice infobae'), [['noticias', { fuente: 'infobae' }]])
  assert.deepEqual(act('noticias de deportes'), [['noticias', { tema: 'deportes' }]])
  assert.deepEqual(act('más noticias'), [['noticias', { mas: true }]])
  assert.deepEqual(act('abrí la segunda'), [['abrir_noticia', { n: 2 }]])
  assert.deepEqual(act('abrí chrome'), [['abrir', { objetivo: 'chrome' }]])
  assert.equal(act('tengo una noticia buenísima'), undefined)
  assert.deepEqual(act('conectá mi Google Calendar'), [['conectar_calendario', {}]])
  assert.deepEqual(act('sumá Classroom'), [['conectar_calendario', {}]])
  assert.deepEqual(act('¿qué tengo que entregar?'), [['ver_agenda', { dias: 14, entregas: true }]])
  assert.deepEqual(act('mis tareas'), [['ver_pendientes', {}]])
})

test('de vez en cuando cuenta una noticia, si querés y sin cortarte', () => {
  const mem = createMemory(join(tmp('ini'), 'memoria.json'))
  mem.markDone('resumen', new Date(2026, 9, 30, 9))
  const times = { ...TIMES, pausaCada: Infinity, agua: Infinity, charla: Infinity }
  const base = { inactivoSeg: 0, bloqueada: false, online: true, bateria: null, pantallaCompleta: false, actividad: null, pomodoro: false, noticias: 'aveces' }
  const at = (h, m = 0) => new Date(2026, 9, 30, h, m)
  const kinds = (r) => r.notices.map((n) => n.kind)
  const ini = createInitiative(times)
  assert.deepEqual(kinds(ini.tick(at(10), base, mem)), [])
  assert.deepEqual(kinds(ini.tick(at(10, 20), base, mem)), ['noticias'])
  assert.deepEqual(kinds(ini.tick(at(11), base, mem)), [], 'espaciadas')
  assert.deepEqual(kinds(ini.tick(at(14), { ...base, actividad: { categoria: 'estudio', app: 'Word' } }, mem)), [], 'no mientras estudiás')
  assert.deepEqual(kinds(ini.tick(at(17), base, mem)), ['noticias'])
  assert.deepEqual(kinds(ini.tick(at(21, 50), base, mem)), [], 'como mucho 2 por día')
  const off = createInitiative(times)
  const quietMem = createMemory(join(tmp('ini2'), 'memoria.json'))
  quietMem.markDone('resumen', at(9))
  off.tick(at(10), { ...base, noticias: 'nunca' }, quietMem)
  assert.ok(!kinds(off.tick(at(10, 30), { ...base, noticias: 'nunca' }, quietMem)).includes('noticias'), 'con «nunca», nunca')
})

test('los ajustes muestran la agenda y las noticias', async () => {
  let cfg = {}
  let clip = ''
  const added = []
  const s = createSettings({
    getConfig: () => cfg,
    saveConfig: (p) => (cfg = { ...cfg, ...p }),
    memory: { getName: () => '', setName: () => {} },
    voices: { status: () => '' },
    updates: { status: () => ({ state: 'idle' }), describe: () => '' },
    ai: {},
    loginItem: { get: () => false, set: () => {} },
    changeShortcut: () => ({ ok: true }),
    shortcutLabel: () => 'Ctrl+Shift+Espacio',
    setCity: async () => '',
    readClipboard: () => clip,
    calendars: {
      status: () => added.map((u, i) => ({ id: `c${i}`, nombre: 'Clases', avisos: true, proximos: 2 })),
      add: async (u) => (u ? (added.push(u), { ok: true, mensaje: '¡Listo! Sumé «Clases».' }) : { ok: false, mensaje: 'Eso no parece la dirección de un calendario.' }),
      has: (u) => added.includes(u),
      remove: () => added.pop(),
      setAlerts: () => {}
    },
    news: { latest: async () => [{ titulo: 'Uno', fuente: 'TN' }] }
  })
  assert.deepEqual(s.snapshot().noticias, { fuentes: ['infobae', 'tn'], avisos: 'aveces' })
  const r = await s.apply({ noticiasFuentes: ['tn', 'otro'], noticiasAvisos: 'seguido' })
  assert.deepEqual(r.noticias, { fuentes: ['tn'], avisos: 'seguido' })
  await s.apply({ noticiasAvisos: 'cualquiera' })
  assert.equal(cfg.noticiasAvisos, 'seguido')
  // Copiaste la dirección: la encuentra una vez, la prueba y no la vuelve a ofrecer
  clip = 'algo que no es'
  assert.deepEqual(s.clipboardCalendar(), { encontrada: false })
  clip = 'https://calendar.google.com/calendar/ical/yo/private-9/basic.ics'
  assert.deepEqual(s.clipboardCalendar(), { encontrada: true })
  const res = await s.addCalendar(null)
  assert.equal(res.ok, true)
  assert.equal(res.agenda.calendarios.length, 1)
  assert.deepEqual(s.clipboardCalendar(), { encontrada: false })
  assert.deepEqual(await s.previewNews(), { ok: true, titulares: [{ titulo: 'Uno', fuente: 'TN' }] })
})

test('«¿qué tengo que entregar?» cuenta solo entregas y pruebas', async () => {
  const mem = createMemory(join(tmp('entregas'), 'memoria.json'))
  const soon = (days, h = null) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    if (h === null) d.setHours(0, 0, 0, 0)
    else d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }
  mem.setExternal({
    eventsBetween: () => [
      { texto: 'Clase de matemática', cuando: soon(1, 8), conHora: true, calendario: 'Mate' },
      { texto: 'TP 3: funciones', cuando: soon(2), conHora: false, calendario: 'Mate' },
      { texto: 'Prueba de física', cuando: soon(3, 10), conHora: true, calendario: 'Física' }
    ]
  })
  const r = await runAction('ver_agenda', { dias: 14, entregas: true }, { ...quiet, memory: mem })
  assert.match(r.text, /^Para entregar o rendir: TP 3: funciones .* y Prueba de física/)
  assert.doesNotMatch(r.text, /Clase/)
  const none = createMemory(join(tmp('entregas2'), 'memoria.json'))
  assert.match((await runAction('ver_agenda', { dias: 14, entregas: true }, { ...quiet, memory: none })).text, /No tenés entregas/)
})

test('un evento que se repite desde hace años aparece igual', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/Argentina/Buenos_Aires:20150302T190000
RRULE:FREQ=DAILY
UID:diario
SUMMARY:Sacar al perro
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20100515
RRULE:FREQ=YEARLY
UID:cumple
SUMMARY:Cumple de la abuela
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Argentina/Buenos_Aires:20200907T080000
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
UID:quincenal
SUMMARY:Taller cada dos semanas
END:VEVENT
END:VCALENDAR`
  const { eventos } = parseICS(ics, { from: ar('2026-05-10T00:00:00'), to: ar('2026-05-24T00:00:00') })
  assert.equal(eventos.filter((e) => e.texto === 'Sacar al perro').length, 14)
  assert.equal(eventos.filter((e) => e.texto === 'Cumple de la abuela').length, 1)
  // 7 de septiembre de 2020 era lunes: cada dos semanas cae el 11 de mayo de 2026 (y no el 18)
  assert.deepEqual(
    eventos.filter((e) => e.texto === 'Taller cada dos semanas').map((e) => e.cuando),
    [ar('2026-05-11T08:00:00').toISOString()]
  )
})
