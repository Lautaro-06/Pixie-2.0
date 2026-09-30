// Dentro de la app de escritorio, window.pixie lo pone el preload.
// Si abrís la interfaz en el navegador (para diseñar), se usa esta versión de prueba.
const preview = {
  ask: async (text) => ({
    text: `Vista de prueba: en la app de escritorio haría «${text}».`,
    face: 'happy'
  }),
  confirm: async () => ({ text: 'Listo.', face: 'happy' }),
  info: async () => ({ shortcut: 'Ctrl+Espacio', version: 'navegador' }),
  setMode: () => {},
  hide: () => {},
  onEvent: () => () => {}
}

export const api = window.pixie ?? preview
export const isPreview = !window.pixie
