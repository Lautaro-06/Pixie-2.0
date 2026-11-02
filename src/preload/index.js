// Puente seguro: lo único que la interfaz (React) puede pedirle a la compu.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pixie', {
  ask: (text) => ipcRenderer.invoke('pixie:ask', String(text)),
  confirm: (yes) => ipcRenderer.invoke('pixie:confirm', Boolean(yes)),
  info: () => ipcRenderer.invoke('pixie:info'),
  setMode: (mode) => ipcRenderer.send('pixie:mode', mode),
  hide: () => ipcRenderer.send('pixie:hide'),
  show: () => ipcRenderer.send('pixie:show'),
  menu: () => ipcRenderer.send('pixie:menu'),
  wakeLog: (line) => ipcRenderer.send('pixie:wake-log', String(line).slice(0, 200)),
  wakeLearn: (frames) => ipcRenderer.send('pixie:wake-learn', frames),
  gameResult: (result) => ipcRenderer.send('pixie:game-result', result),
  voice: (request) => ipcRenderer.invoke('pixie:voice', request),
  voiceStop: (id) => ipcRenderer.send('pixie:voice-stop', id),
  speaking: (on) => ipcRenderer.send('pixie:speaking', Boolean(on)),
  transcribe: (wav) => ipcRenderer.invoke('pixie:transcribe', wav instanceof Uint8Array ? wav : new Uint8Array(wav)),
  reportError: (info) =>
    ipcRenderer.send('pixie:error', { message: String(info?.message ?? info).slice(0, 500), stack: String(info?.stack ?? '').slice(0, 2000) }),
  onEvent: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pixie:event', handler)
    return () => ipcRenderer.removeListener('pixie:event', handler)
  },
  // Solo responden si los pide la ventana de Ajustes (lo controla el proceso principal)
  settings: {
    get: () => ipcRenderer.invoke('ajustes:leer'),
    set: (patch) => ipcRenderer.invoke('ajustes:cambiar', patch),
    testKey: (key) => ipcRenderer.invoke('ajustes:probar-clave', key ?? null),
    saveKey: (key) => ipcRenderer.invoke('ajustes:guardar-clave', key ?? null),
    clipboardKey: () => ipcRenderer.invoke('ajustes:clave-portapapeles'),
    forgetKey: () => ipcRenderer.invoke('ajustes:borrar-clave'),
    openKeyPage: () => ipcRenderer.invoke('ajustes:abrir-ai-studio'),
    checkUpdates: () => ipcRenderer.invoke('ajustes:buscar-version'),
    installUpdate: () => ipcRenderer.invoke('ajustes:instalar-version'),
    copyReport: () => ipcRenderer.invoke('ajustes:copiar-informe'),
    openFolder: () => ipcRenderer.invoke('ajustes:abrir-carpeta'),
    testVoice: () => ipcRenderer.invoke('ajustes:probar-voz'),
    finishWelcome: () => ipcRenderer.invoke('ajustes:bienvenida-lista'),
    saveWake: (plantillas) => ipcRenderer.invoke('ajustes:palabra-guardar', plantillas),
    forgetWake: () => ipcRenderer.invoke('ajustes:palabra-borrar'),
    testingWake: (on) => ipcRenderer.invoke('ajustes:palabra-probando', Boolean(on)),
    wakeTemplates: () => ipcRenderer.invoke('ajustes:palabra-plantillas'),
    speak: (text) => ipcRenderer.invoke('ajustes:decir', String(text).slice(0, 400)),
    addCalendar: (url) => ipcRenderer.invoke('ajustes:calendario-agregar', url ?? null),
    clipboardCalendar: () => ipcRenderer.invoke('ajustes:calendario-portapapeles'),
    removeCalendar: (id) => ipcRenderer.invoke('ajustes:calendario-quitar', String(id)),
    calendarAlerts: (id, on) => ipcRenderer.invoke('ajustes:calendario-avisos', String(id), Boolean(on)),
    openGoogleCalendar: () => ipcRenderer.invoke('ajustes:abrir-google-calendar'),
    previewNews: () => ipcRenderer.invoke('ajustes:noticias-probar'),
    readClassroom: () => ipcRenderer.invoke('ajustes:classroom-leer'),
    openExtensionFolder: () => ipcRenderer.invoke('ajustes:abrir-carpeta-extension'),
    copyExtensionsAddress: () => ipcRenderer.invoke('ajustes:copiar-direccion-extensiones'),
    onView: (callback) => {
      const handler = (_event, view) => callback(view)
      ipcRenderer.on('ajustes:vista', handler)
      return () => ipcRenderer.removeListener('ajustes:vista', handler)
    }
  }
})
