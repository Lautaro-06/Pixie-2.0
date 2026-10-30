// Dentro de la app de escritorio, window.pixie lo pone el preload.
// Si abrís la interfaz en el navegador (para diseñar), se usa esta versión de prueba.

// Ajustes de prueba: se guardan solo mientras está abierta la página
let fakeSettings = {
  version: 'navegador',
  bienvenidaHecha: false,
  general: { nombre: '', ciudad: 'Buenos Aires', atajo: 'Ctrl+Shift+Espacio', arrancarConWindows: true, recordatoriosSalud: true, avisosAlCelular: true },
  apariencia: { pantallaReposo: 'cara' },
  ia: { activa: true, estado: 'No encuentro la clave de IA.', proveedor: null, modelo: null, clave: '', tieneClave: false },
  voz: { modo: 'natural', estado: 'Uso la voz de Windows hasta que se baje la natural.' },
  actualizaciones: { state: 'dev', current: 'navegador', texto: 'Las actualizaciones andan en la app instalada.' },
  ayuda: { errores: 0 }
}
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
      voz: patch.vozModo ? { ...fakeSettings.voz, modo: patch.vozModo } : fakeSettings.voz,
      ia: 'iaActiva' in patch ? { ...fakeSettings.ia, activa: patch.iaActiva } : fakeSettings.ia
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
  gameResult: () => {},
  reportError: (info) => console.error(info),
  onEvent: () => () => {},
  settings: previewSettings
}

export const api = window.pixie ?? preview
export const isPreview = !window.pixie
