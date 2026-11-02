import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseGmailFeed, parseMailbox, announceText, listText, findMail, createMail } from '../src/main/mail.js'
import { runAction } from '../src/main/actions/index.js'
import { interpretAll } from '../src/main/brain.js'
import { BrowserError } from '../src/main/browser.js'

const FEED = readFileSync(new URL('./fixtures/gmail.atom', import.meta.url), 'utf8')
const entry = (id, name, email, subject) =>
  `<entry><title>${subject}</title><summary>Hola</summary><link rel="alternate" href="https://mail.google.com/mail?message_id=${id}&amp;view=conv" type="text/html" /><issued>2026-11-02T14:00:00Z</issued><id>tag:gmail.google.com,2004:${id}</id><author><name>${name}</name><email>${email}</email></author></entry>`
const withEntries = (...entries) => FEED.replace('<entry>', `${entries.join('\n')}\n<entry>`)

test('lee el aviso de mails de Gmail: quién, asunto, las primeras palabras y el link', () => {
  const feed = parseGmailFeed(FEED)
  assert.equal(feed.cuenta, 'alumno.prueba@gmail.com')
  assert.equal(feed.total, 5, 'Gmail dice cuántos hay sin leer aunque muestre menos')
  assert.equal(feed.mails.length, 3)
  const [profe, classroom] = feed.mails
  assert.equal(profe.de, 'Profe Química')
  assert.equal(profe.email, 'profe.quimica@escuela.edu.ar')
  assert.equal(profe.asunto, 'Trabajo práctico N°3 & consignas')
  assert.match(profe.resumen, /^Hola chicos/)
  assert.equal(profe.link, 'https://mail.google.com/mail?account_id=alumno.prueba@gmail.com&message_id=19a1b2c3d4e5f601&view=conv&extsrc=atom')
  assert.equal(profe.cuando, '2026-11-02T13:00:00.000Z')
  assert.equal(classroom.id, 'tag:gmail.google.com,2004:1847000000000000002')
  assert.equal(parseGmailFeed('<html>Iniciá sesión</html>'), null, 'la página para entrar no es el aviso')
})

test('junta varias cuentas, y la bandeja abierta si el aviso no anduvo', () => {
  const other = FEED.replace('alumno.prueba@gmail.com</title>', 'lauti.escuela@gmail.com</title>').replace('<fullcount>5', '<fullcount>1')
  const box = parseMailbox({ cuentas: [{ cuenta: 0, xml: FEED }, { cuenta: 1, xml: other }] })
  assert.deepEqual(box.cuentas, ['alumno.prueba@gmail.com', 'lauti.escuela@gmail.com'])
  assert.equal(box.total, 6)
  assert.equal(box.mails[0].de, 'Profe Química', 'lo más nuevo primero')
  const inbox = parseMailbox({ cuentas: [{ cuenta: 'yo@gmail.com', total: 1, filas: [{ id: 't1', de: 'Mamá', email: 'mama@gmail.com', asunto: 'Comprá pan', resumen: ' - porfa', link: 'https://mail.google.com/mail/u/0/#inbox/t1' }] }] })
  assert.equal(inbox.mails[0].asunto, 'Comprá pan')
  assert.equal(inbox.mails[0].resumen, 'porfa')
})

test('cuenta los mails en pocas palabras, sin leer en voz alta el spam', () => {
  const { mails } = parseGmailFeed(FEED)
  assert.equal(announceText([mails[0]]), 'Te llegó un mail de Profe Química: «Trabajo práctico N°3 & consignas».')
  assert.equal(announceText(mails.slice(0, 2)), 'Te llegaron 2 mails: de Profe Química («Trabajo práctico N°3 & consignas») y de Classroom («Nueva tarea: Avance del Proyecto»).')
  const many = [...mails, { ...mails[0], id: 'x', de: 'Mamá' }, { ...mails[0], id: 'y', de: 'Juan' }]
  assert.equal(announceText(many), 'Te llegaron 5 mails, de Profe Química, Classroom, Netflix y otros.')
  assert.match(announceText([{ ...mails[0], asunto: 'Videos porno gratis' }]), /un mail que parece spam/)
  assert.match(listText(parseGmailFeed(FEED)), /^Tenés 5 mails sin leer\. Los últimos: de Profe Química: «Trabajo práctico/)
  assert.equal(listText({ total: 0, mails: [] }), 'No tenés mails sin leer. ¡Bandeja limpia!')
  assert.equal(listText({ total: 1, mails: [mails[2]] }), 'Tenés 1 mail sin leer. Es de Netflix: «Nuevos estrenos de la semana».')
})

test('encuentra el mail que pedís: por quién lo manda o por número', () => {
  const { mails } = parseGmailFeed(FEED)
  assert.equal(findMail(mails, { de: 'la profe de química' }).de, 'Profe Química')
  assert.equal(findMail(mails, { de: 'netflix' }).de, 'Netflix')
  assert.equal(findMail(mails, { n: 2 }).de, 'Google Classroom')
  assert.equal(findMail(mails, { n: -1 }).de, 'Netflix')
  assert.equal(findMail(mails, { de: 'el club de fútbol' }), null)
  assert.equal(findMail(mails).de, 'Profe Química')
})

function setup({ cfg = {}, connected = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pixie-mails-'))
  const file = join(dir, 'mails.json')
  const state = { xml: FEED, fail: null, connected, t: Date.parse('2026-11-02T13:10:00Z'), cfg: { ...cfg }, told: [], classroom: 0, requests: [] }
  const browser = {
    connected: () => state.connected,
    request: async (cmd, args) => {
      state.requests.push([cmd, args])
      if (state.fail) throw state.fail
      if (cmd === 'mails') return { cuentas: [{ cuenta: 0, xml: state.xml }] }
      if (cmd === 'abrir_mail') return { ok: true, kind: 'mail', subject: 'Trabajo práctico N°3', sender: 'Profe Química', text: 'Hola chicos. El TP es para el jueves. Lean el capítulo 4 antes de empezar.' }
      throw new BrowserError(`Pedido desconocido: ${cmd}`)
    }
  }
  const make = () =>
    createMail({
      browser,
      file,
      getConfig: () => state.cfg,
      saveConfig: (p) => (state.cfg = { ...state.cfg, ...p }),
      now: () => state.t,
      onNew: (list) => state.told.push(list.map((m) => m.de)),
      onClassroom: () => state.classroom++
    })
  return { state, file, make, browser }
}

test('la primera vez no avisa de lo que ya tenías; después avisa solo lo nuevo', async () => {
  const { state, file, make } = setup({ cfg: { mailAvisos: true } })
  const mail = make()
  let st = await mail.refresh()
  assert.equal(st.estado, 'ok')
  assert.equal(st.sinLeer, 5)
  assert.deepEqual(state.told, [])
  assert.ok(existsSync(file))
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(saved.vistos.length, 3)
  assert.ok(!JSON.stringify(saved).includes('Química'), 'solo guarda cuáles vio, no de quién ni qué dicen')
  // Llega uno de Mamá
  state.xml = withEntries(entry('m1', 'Mamá', 'mama@gmail.com', 'Comprá pan'))
  state.t += 3 * 60 * 1000
  st = await mail.refresh()
  assert.deepEqual(state.told, [['Mamá']])
  assert.deepEqual(st.nuevos.map((m) => m.de), ['Mamá'])
  assert.deepEqual(mail.recent().map((m) => m.de), ['Mamá'], '«leémelo» se refiere a ese')
  // No pregunta de nuevo enseguida
  state.t += 60 * 1000
  assert.deepEqual((await mail.refresh()).nuevos, [])
  assert.equal(state.requests.length, 2)
  // Al abrir Pixie de nuevo, no repite
  state.t += 3 * 60 * 1000
  const again = make()
  await again.refresh()
  assert.deepEqual(state.told, [['Mamá']])
})

test('de quien silenciaste no avisa, sin los avisos prendidos no avisa, y un mail de Classroom relee las tareas', async () => {
  const { state, make } = setup({ cfg: { mailAvisos: false } })
  const mail = make()
  await mail.refresh()
  state.xml = withEntries(entry('n1', 'Netflix', 'info@mailer.netflix.com', 'Estrenos'), entry('c1', 'Google Classroom', 'no-reply@classroom.google.com', 'Nueva tarea: TP 4'))
  state.t += 3 * 60 * 1000
  await mail.refresh()
  assert.deepEqual(state.told, [], 'con los avisos apagados no dice nada')
  assert.equal(state.classroom, 1)
  mail.setAlerts(true)
  assert.equal(state.cfg.mailAvisos, true)
  assert.equal(state.cfg.mailOfrecido, true)
  mail.mute('Netflix')
  mail.mute('netflix')
  assert.deepEqual(state.cfg.mailsSilenciados, ['netflix'])
  state.xml = withEntries(entry('n2', 'Netflix', 'info@mailer.netflix.com', 'Más estrenos'), entry('p1', 'Profe Física', 'fisica@escuela.edu.ar', 'Prueba'))
  state.t += 3 * 60 * 1000
  await mail.refresh()
  assert.deepEqual(state.told, [['Profe Física']])
  mail.unmute('Netflix')
  assert.deepEqual(state.cfg.mailsSilenciados, [])
})

test('sin la extensión, o con la extensión vieja, lo dice', async () => {
  const off = setup({ connected: false })
  assert.equal((await off.make().refresh()).estado, 'sin-extension')
  const old = setup()
  old.state.fail = new BrowserError('Pedido desconocido: mails')
  assert.equal((await old.make().refresh()).estado, 'extension-vieja')
  const out = setup()
  out.state.fail = new BrowserError('Entrá a Gmail en Chrome con tu cuenta y probá de nuevo.')
  const st = await out.make().refresh()
  assert.equal(st.estado, 'error')
  assert.match(st.error, /Entrá a Gmail/)
})

function actionCtx(s) {
  const ctx = {
    mail: s.make(),
    browser: s.browser,
    getConfig: () => s.state.cfg,
    log: () => {},
    openSettings: (v) => (ctx.opened = v),
    readPage: async (que) => ({ ok: true, kind: que, title: 'Una página', text: 'Texto de la página.' }),
    ai: { enabled: () => false }
  }
  return ctx
}

test('«¿tengo mails?», «leeme el de la profe», «avisame» y «no me avises de…»', async () => {
  const s = setup()
  const ctx = actionCtx(s)
  let r = await runAction('mails', { accion: 'revisar' }, ctx)
  assert.match(r.text, /^Tenés 5 mails sin leer\. Los últimos: de Profe Química/)
  assert.match(r.text, /decime «avisame de los mails»/, 'ofrece los avisos si nunca los ofreció')
  assert.deepEqual(r.suggestions, ['leeme el primero', 'abrí Gmail'])
  r = await runAction('mails', { accion: 'leer', n: 1 }, ctx)
  assert.match(r.text, /^Es de Profe Química: «Trabajo práctico N°3»\. .*capítulo 4/)
  assert.deepEqual(s.state.requests.at(-1), ['abrir_mail', { link: 'https://mail.google.com/mail?account_id=alumno.prueba@gmail.com&message_id=19a1b2c3d4e5f601&view=conv&extsrc=atom' }])
  // Si no lo puede abrir, cuenta lo que se ve en el aviso
  s.state.fail = new BrowserError('El navegador no respondió.')
  r = await runAction('mails', { accion: 'leer', de: 'netflix' }, ctx)
  assert.match(r.text, /^Es de Netflix: «Nuevos estrenos de la semana»\. Empieza así: «Mirá lo nuevo que llegó\.»/)
  s.state.fail = null
  r = await runAction('mails', { accion: 'avisos', on: true }, ctx)
  assert.match(r.text, /Te aviso cuando te llegue un mail/)
  assert.equal(s.state.cfg.mailAvisos, true)
  r = await runAction('mails', { accion: 'silenciar', de: 'Netflix' }, ctx)
  assert.equal(r.text, 'Listo, no te aviso más de los mails de Netflix.')
  r = await runAction('mails', { accion: 'avisos', on: false }, ctx)
  assert.equal(s.state.cfg.mailAvisos, false)
})

test('«leémelo» sin un mail recién avisado lee la página abierta, como antes', async () => {
  const s = setup()
  const ctx = actionCtx(s)
  const r = await runAction('mails', { accion: 'leer', solo: true }, ctx)
  assert.match(r.text, /Una página/)
  assert.equal(s.state.requests.length, 0, 'no fue a mirar los mails')
})

test('sin la extensión, explica cómo instalarla y abre los ajustes', async () => {
  const s = setup({ connected: false })
  const ctx = actionCtx(s)
  const r = await runAction('mails', {}, ctx)
  assert.match(r.text, /necesito mi extensión de Chrome/)
  assert.equal(ctx.opened, 'ajustes/agenda')
})

test('entiende cómo se piden los mails', () => {
  const one = (t) => interpretAll(t)?.[0] ?? null
  assert.deepEqual(one('¿Tengo mails nuevos?'), { action: 'mails', params: { accion: 'revisar' } })
  assert.deepEqual(one('¿me llegó algún correo?'), { action: 'mails', params: { accion: 'revisar' } })
  assert.deepEqual(one('revisá mi gmail'), { action: 'mails', params: { accion: 'revisar' } })
  assert.deepEqual(one('Sí, avisame de los mails'), { action: 'mails', params: { accion: 'avisos', on: true } })
  assert.deepEqual(one('no me avises más de los mails'), { action: 'mails', params: { accion: 'avisos', on: false } })
  assert.deepEqual(one('no me avises más de los mails de Netflix'), { action: 'mails', params: { accion: 'silenciar', de: 'netflix' } })
  assert.deepEqual(one('leeme el mail de la profe'), { action: 'mails', params: { accion: 'leer', de: 'la profe' } })
  assert.deepEqual(one('leémelo'), { action: 'mails', params: { accion: 'leer', solo: true } })
  assert.deepEqual(one('leeme el segundo'), { action: 'mails', params: { accion: 'leer', n: 2 } })
  assert.deepEqual(one('resumime el mail'), { action: 'resumir', params: { que: 'mail' } })
  assert.notEqual(one('mandale un mail a la profe')?.action, 'mails')
  assert.notEqual(one('tengo que mandar un mail')?.action, 'mails')
  assert.deepEqual(one('revisá mi WhatsApp'), { action: 'chats_privados', params: {} })
})

test('si preguntás vos, contesta sin el aviso aparte', async () => {
  const { state, make } = setup({ cfg: { mailAvisos: true } })
  const mail = make()
  await mail.refresh()
  state.xml = withEntries(entry('m9', 'Mamá', 'mama@gmail.com', 'Llamame'))
  state.t += 60 * 1000
  const st = await mail.refresh({ force: true, silent: true })
  assert.deepEqual(st.nuevos.map((m) => m.de), ['Mamá'])
  assert.deepEqual(state.told, [])
})
