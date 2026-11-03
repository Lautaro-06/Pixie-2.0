// Dentro de la app de escritorio, window.pixie lo pone el preload.
// Si abrís la interfaz en el navegador (para diseñar), se usa esta versión de prueba.

import { pomodoroView, blockTips, buildPlan } from '../../main/study.js'
import { trackerView, parseSyllabus } from '../../main/study-stats.js'

// Ajustes de prueba: se guardan solo mientras está abierta la página
let fakePomodoro = { minutos: 120, metodo: 'auto', materia: '', tipo: '', ofrecer: true, distracciones: true }
// Unas semanas de estudio de ejemplo para ver Ajustes → Mi estudio
const fakeSessions = (() => {
  const out = []
  const subjects = [['Biología', ['Fotosíntesis', 'Respiración celular']], ['Química', ['Estequiometría']], ['Historia', ['Revolución de Mayo']]]
  for (let back = 24; back >= 0; back--) {
    if (back % 4 === 3) continue
    const d = new Date()
    d.setDate(d.getDate() - back)
    d.setHours(17, 0, 0, 0)
    const [materia, temas] = subjects[back % 3]
    const ciclos = 1 + (back % 4)
    const estudiadoMin = ciclos * 25
    const distraidoMin = back % 5
    out.push({ inicio: d.toISOString(), materia, estudiadoMin, ciclos, planeadoMin: 100, focoMin: estudiadoMin - distraidoMin, distraidoMin, adherencia: Math.round(((estudiadoMin - distraidoMin) / 100) * 100), temas })
  }
  return out
})()
let fakeTemario = { materia: 'Biología', temas: ['La célula', 'Fotosíntesis', 'Respiración celular', 'Mitosis y meiosis', 'ADN y genética'].map((texto, i) => ({ texto, visto: i === 1 || i === 2, auto: i === 1, cuando: null })) }
let fakeGoal = 60
const fakeStudy = () => trackerView(fakeSessions, { goal: fakeGoal, temario: fakeTemario })
let fakeSettings = {
  version: 'navegador',
  bienvenidaHecha: false,
  general: { nombre: '', ciudad: 'Buenos Aires', atajo: 'Ctrl+Shift+Espacio', arrancarConWindows: true, recordatoriosSalud: true, avisosAlCelular: true, esquivarMouse: true },
  apariencia: { pantallaReposo: 'cara' },
  mapas: { casa: '' },
  pomodoro: pomodoroView(fakePomodoro),
  estudio: fakeStudy(),
  apps: {
    actualizado: Date.now(),
    buscando: false,
    lista: ['Calculadora', 'Discord', 'Excel', 'Google Chrome', 'Minecraft Launcher', 'Paint', 'PowerPoint', 'Spotify', 'Steam', 'Visual Studio Code', 'WhatsApp', 'Word'].map((nombre, i) => ({
      id: `app${i}`,
      nombre,
      abrir: nombre !== 'Steam',
      usar: !['Steam', 'WhatsApp'].includes(nombre)
    }))
  },
  agenda: {
    calendarios: [],
    classroom: { estado: 'sin-leer', conectada: false, tareas: 0, conFecha: 0, leido: null, error: null, avisos: true, extension: { carpeta: null, version: '0.11.0', conectada: false, vieja: false } },
    mails: { estado: 'sin-leer', conectada: false, avisos: false, leido: null, sinLeer: 0, cuentas: [], error: null, silenciados: ['Netflix'], extension: { carpeta: null, version: '0.11.0', conectada: false, vieja: false } }
  },
  noticias: { fuentes: ['infobae', 'tn'], avisos: 'aveces' },
  whatsapp: { configurado: false, telefono: '', tieneClave: false, cuando: 'siempre', ultimo: null, bot: '+34 684 77 00 05', activacion: 'I allow callmebot to send me messages', avisos: true },
  memoria: {
    charlas: 42,
    personales: 1,
    datos: [
      { texto: 'juega al fútbol los sábados', creado: '2026-10-30T18:00:00.000Z' },
      { texto: 'su materia favorita es Biología', creado: '2026-10-28T18:00:00.000Z' }
    ],
    dias: [1, 2, 3].map((back) => {
      const d = new Date()
      d.setDate(d.getDate() - back)
      return { fecha: d.toISOString().slice(0, 10), charlas: 5 - back, temas: [['fotosintesis', 'prueba', 'biologia'], ['futbol', 'sabado'], []][back - 1] }
    })
  },
  ia: { activa: true, estado: 'No encuentro la clave de IA.', proveedor: null, modelo: null, clave: '', tieneClave: false },
  voz: { modo: 'natural', estado: 'Uso la voz de Windows hasta que se baje la natural.', palabra: { grabada: false, activa: false, sensibilidad: 'normal' } },
  actualizaciones: { state: 'dev', current: 'navegador', texto: 'Las actualizaciones andan en la app instalada.' },
  ayuda: { errores: 0 }
}
if (new URLSearchParams(location.search).get('voz') === 'grabada') fakeSettings.voz.palabra = { grabada: true, activa: true, sensibilidad: 'normal' }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const previewSettings = {
  get: async () => fakeSettings,
  set: async (patch) => {
    const g = { ...fakeSettings.general }
    for (const k of ['nombre', 'ciudad', 'arrancarConWindows', 'recordatoriosSalud', 'avisosAlCelular', 'esquivarMouse']) if (k in patch) g[k] = patch[k]
    // WhatsApp: el número, la clave y cuándo
    let wpp = fakeSettings.whatsapp
    if ('avisosAlCelular' in patch) wpp = { ...wpp, avisos: patch.avisosAlCelular }
    if (typeof patch.whatsappTelefono === 'string') wpp = { ...wpp, telefono: patch.whatsappTelefono.replace(/[^\d+]/g, '') }
    if (patch.whatsappClave?.trim()) wpp = { ...wpp, tieneClave: true }
    if (patch.whatsappCuando) wpp = { ...wpp, cuando: patch.whatsappCuando }
    wpp = { ...wpp, configurado: Boolean(wpp.telefono && wpp.tieneClave) }
    if (patch.atajo) g.atajo = patch.atajo.replace('Control', 'Ctrl').replace('Space', 'Espacio')
    // Apps: los permisos en la vista previa
    let apps = fakeSettings.apps
    if (patch.appPermiso) apps = { ...apps, lista: apps.lista.map((x) => (x.id === patch.appPermiso.id ? { ...x, ...patch.appPermiso } : x)) }
    if (typeof patch.appsTodas === 'boolean') apps = { ...apps, lista: apps.lista.map((x) => ({ ...x, abrir: patch.appsTodas, usar: patch.appsTodas })) }
    // Pomodoro: lo elegido y el plan que sale
    const pomo = { pomodoroMinutos: 'minutos', pomodoroMetodo: 'metodo', pomodoroMateria: 'materia', pomodoroTipo: 'tipo', pomodoroOfrecer: 'ofrecer', pomodoroDistracciones: 'distracciones' }
    if (patch.metaDiaria) fakeGoal = patch.metaDiaria
    for (const [k, v] of Object.entries(pomo)) if (k in patch) fakePomodoro = { ...fakePomodoro, [v]: patch[k] }
    fakeSettings = {
      ...fakeSettings,
      apps,
      whatsapp: wpp,
      pomodoro: pomodoroView(fakePomodoro),
      estudio: fakeStudy(),
      general: g,
      apariencia: patch.pantallaReposo ? { pantallaReposo: patch.pantallaReposo } : fakeSettings.apariencia,
      voz: {
        ...fakeSettings.voz,
        ...(patch.vozModo ? { modo: patch.vozModo } : {}),
        palabra: {
          ...fakeSettings.voz.palabra,
          ...('palabraMagica' in patch ? { activa: patch.palabraMagica } : {}),
          ...(patch.sensibilidadPalabra ? { sensibilidad: patch.sensibilidadPalabra } : {})
        }
      },
      ia: 'iaActiva' in patch ? { ...fakeSettings.ia, activa: patch.iaActiva } : fakeSettings.ia,
      noticias: {
        fuentes: patch.noticiasFuentes ?? fakeSettings.noticias.fuentes,
        avisos: patch.noticiasAvisos ?? fakeSettings.noticias.avisos
      }
    }
    return { ...fakeSettings, mensajes: patch.atajo ? [`Ahora me llamás con ${g.atajo}.`] : [] }
  },
  testKey: async () => (await wait(600), { ok: true, mensaje: '¡Funciona! Uso Gemini.' }),
  saveKey: async () => {
    await wait(800)
    fakeSettings = { ...fakeSettings, ia: { ...fakeSettings.ia, tieneClave: true, clave: 'AQ.Ab…k3Zq', proveedor: 'Gemini', modelo: 'gemini-flash-lite-latest', estado: 'Estoy usando la IA de Gemini.' } }
    return { ok: true, guardada: true, mensaje: '¡Funciona! Uso Gemini.' }
  },
  clipboardKey: async () => ({ encontrada: false }),
  forgetKey: async () => (fakeSettings = { ...fakeSettings, ia: { ...fakeSettings.ia, tieneClave: false, clave: '' } }),
  openKeyPage: async () => window.open('https://aistudio.google.com/app/apikey', '_blank'),
  checkUpdates: async () => fakeSettings,
  installUpdate: async () => {},
  copyReport: async () => 0,
  openFolder: async () => {},
  testVoice: async () => {},
  finishWelcome: async () => {},
  saveWake: async () => {
    fakeSettings = { ...fakeSettings, voz: { ...fakeSettings.voz, palabra: { grabada: true, activa: true, sensibilidad: 'normal' } } }
    return { ok: true, mensaje: '¡Listo! Ahora llamame diciendo «Pixie, ¿estás?».', ...fakeSettings }
  },
  forgetWake: async () => (fakeSettings = { ...fakeSettings, voz: { ...fakeSettings.voz, palabra: { grabada: false, activa: false, sensibilidad: 'normal' } } }),
  testingWake: async () => {},
  wakeTemplates: async () => null,
  speak: async (text) => console.log('Pixie diría:', text),
  addCalendar: async (url) => {
    await wait(700)
    if (!url) return { ok: false, mensaje: 'Copiá o pegá la dirección primero.', ...fakeSettings }
    const cal = { id: `cal${Date.now()}`, nombre: 'Matemática 5°B', avisos: true, proximos: 3, actualizado: Date.now(), error: null }
    fakeSettings = { ...fakeSettings, agenda: { ...fakeSettings.agenda, calendarios: [...fakeSettings.agenda.calendarios, cal] } }
    return { ok: true, mensaje: '¡Listo! Sumé «Matemática 5°B»: tiene 3 cosas en los próximos 7 días.', ...fakeSettings }
  },
  clipboardCalendar: async () => ({ encontrada: false }),
  readClassroom: async () => {
    await wait(900)
    fakeSettings = {
      ...fakeSettings,
      agenda: { ...fakeSettings.agenda, classroom: { ...fakeSettings.agenda.classroom, estado: 'ok', tareas: 3, conFecha: 2, leido: Date.now(), extension: { ...fakeSettings.agenda.classroom.extension, conectada: true } } }
    }
    return { ...fakeSettings, mensaje: 'Leí tus Pendientes: tenés 3 tareas.' }
  },
  pomodoro: async (accion) => ({ ...fakeSettings, mensaje: `En la app de escritorio haría «${accion}».` }),
  syllabus: async ({ accion, materia, texto, indice, visto } = {}) => {
    if (accion === 'guardar') {
      const temas = parseSyllabus(texto)
      if (temas.length) fakeTemario = { materia: materia || null, temas: temas.map((t) => ({ texto: t, visto: false, auto: false, cuando: null })) }
    }
    if (accion === 'marcar' && fakeTemario?.temas[indice]) fakeTemario.temas[indice] = { ...fakeTemario.temas[indice], visto, auto: false }
    if (accion === 'borrar') fakeTemario = null
    fakeSettings = { ...fakeSettings, estudio: fakeStudy() }
    return { ...fakeSettings, mensaje: accion === 'guardar' ? `Anoté ${fakeTemario?.temas.length ?? 0} temas.` : null }
  },
  clearStudy: async () => {
    fakeSessions.length = 0
    fakeSettings = { ...fakeSettings, estudio: fakeStudy() }
    return { ...fakeSettings, mensaje: 'Borré tu historial de estudio.' }
  },
  pomodoroAdvice: async () => {
    await wait(700)
    return { ia: false, consejos: blockTips(buildPlan({ minutos: fakePomodoro.minutos, metodo: fakePomodoro.metodo, materia: fakePomodoro.materia || null })) }
  },
  searchApps: async () => {
    await wait(600)
    return { ...fakeSettings, mensaje: `Encontré ${fakeSettings.apps.lista.length} apps en tu compu.` }
  },
  readMails: async () => {
    await wait(700)
    fakeSettings = { ...fakeSettings, agenda: { ...fakeSettings.agenda, mails: { ...fakeSettings.agenda.mails, estado: 'ok', sinLeer: 4, cuentas: ['lauti@gmail.com'], leido: Date.now() } } }
    return { ...fakeSettings, mensaje: 'Miré tu Gmail: tenés 4 mails sin leer.' }
  },
  openExtensionFolder: async () => {},
  copyExtensionsAddress: async () => {},
  removeCalendar: async (id) => (fakeSettings = { ...fakeSettings, agenda: { ...fakeSettings.agenda, calendarios: fakeSettings.agenda.calendarios.filter((c) => c.id !== id) } }),
  calendarAlerts: async (id, on) =>
    (fakeSettings = { ...fakeSettings, agenda: { ...fakeSettings.agenda, calendarios: fakeSettings.agenda.calendarios.map((c) => (c.id === id ? { ...c, avisos: on } : c)) } }),
  openGoogleCalendar: async () => window.open('https://calendar.google.com/calendar/r/settings', '_blank'),
  previewNews: async () => (
    await wait(600),
    {
      ok: true,
      titulares: [
        { titulo: 'Así va a estar el tiempo en Buenos Aires este fin de semana', fuente: 'Infobae' },
        { titulo: 'Arrancó la inscripción a las becas para estudiantes secundarios', fuente: 'TN' },
        { titulo: 'Cómo ver el eclipse de esta semana sin dañarse la vista', fuente: 'Infobae' }
      ]
    }
  ),
  whatsapp: async ({ accion } = {}) => {
    if (accion === 'activar') window.open('https://wa.me/34684770005', '_blank')
    if (accion === 'probar') {
      await wait(700)
      fakeSettings = { ...fakeSettings, whatsapp: { ...fakeSettings.whatsapp, ultimo: { ok: true, at: new Date().toISOString() } } }
      return { ...fakeSettings, mensaje: '¡Te lo mandé! Fijate en tu WhatsApp.' }
    }
    return { ...fakeSettings, mensaje: accion === 'portapapeles' ? 'No encontré la clave en lo que copiaste.' : null }
  },
  forgetMemory: async ({ que } = {}) => {
    fakeSettings = { ...fakeSettings, memoria: que === 'todo' ? { charlas: 0, personales: 0, datos: [], dias: [] } : { ...fakeSettings.memoria, charlas: 0, dias: [] } }
    return { ...fakeSettings, mensaje: que === 'todo' ? 'Listo, me olvidé de todo.' : 'Listo, me olvidé de nuestras charlas.' }
  },
  onView: () => () => {}
}

const preview = {
  ask: async (text) => ({
    text: `Vista de prueba: en la app de escritorio haría «${text}».`,
    face: 'happy'
  }),
  confirm: async () => ({ text: 'Listo.', face: 'happy' }),
  // ?reposo=reloj o ?reposo=resumen para ver la pantalla de reposo al diseñar
  info: async () => ({
    shortcut: 'Ctrl+Espacio',
    version: 'navegador',
    pantallaReposo: new URLSearchParams(location.search).get('reposo') ?? 'cara',
    clima: { temp: 23, icon: 'sol' }
  }),
  setMode: () => {},
  hide: () => {},
  show: () => {},
  menu: () => console.log('Acá aparece el menú de Pixie (en la app de escritorio).'),
  wakeLog: () => {},
  wakeLearn: () => {},
  gameResult: () => {},
  timerToggle: async () => null,
  reportError: (info) => console.error(info),
  onEvent: () => () => {},
  settings: previewSettings
}

export const api = window.pixie ?? preview
export const isPreview = !window.pixie
