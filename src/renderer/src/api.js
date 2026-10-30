// Dentro de la app de escritorio, window.pixie lo pone el preload.
// Si abrís la interfaz en el navegador (para diseñar), se usa esta versión de prueba.

// Ajustes de prueba: se guardan solo mientras está abierta la página
let fakeSettings = {
  version: 'navegador',
  bienvenidaHecha: false,
  general: { nombre: '', ciudad: 'Buenos Aires', atajo: 'Ctrl+Shift+Espacio', arrancarConWindows: true, recordatoriosSalud: true, avisosAlCelular: true },
  apariencia: { pantallaReposo: 'cara' },
  agenda: { calendarios: [] },
  noticias: { fuentes: ['infobae', 'tn'], avisos: 'aveces' },
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
    for (const k of ['nombre', 'ciudad', 'arrancarConWindows', 'recordatoriosSalud', 'avisosAlCelular']) if (k in patch) g[k] = patch[k]
    if (patch.atajo) g.atajo = patch.atajo.replace('Control', 'Ctrl').replace('Space', 'Espacio')
    fakeSettings = {
      ...fakeSettings,
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
    fakeSettings = { ...fakeSettings, agenda: { calendarios: [...fakeSettings.agenda.calendarios, cal] } }
    return { ok: true, mensaje: '¡Listo! Sumé «Matemática 5°B»: tiene 3 cosas en los próximos 7 días.', ...fakeSettings }
  },
  clipboardCalendar: async () => ({ encontrada: false }),
  removeCalendar: async (id) => (fakeSettings = { ...fakeSettings, agenda: { calendarios: fakeSettings.agenda.calendarios.filter((c) => c.id !== id) } }),
  calendarAlerts: async (id, on) =>
    (fakeSettings = { ...fakeSettings, agenda: { calendarios: fakeSettings.agenda.calendarios.map((c) => (c.id === id ? { ...c, avisos: on } : c)) } }),
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
  gameResult: () => {},
  reportError: (info) => console.error(info),
  onEvent: () => () => {},
  settings: previewSettings
}

export const api = window.pixie ?? preview
export const isPreview = !window.pixie
