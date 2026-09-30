// Electron de mentira para correr las pruebas con Node (sin abrir la app).
export const opened = []
export const app = { getPath: (k) => `/tmp/pixie-pruebas/${k}`, getVersion: () => '0.0.0' }
export const shell = {
  openExternal: async (u) => { opened.push(u) },
  openPath: async (p) => { opened.push(p); return '' }
}
export const powerMonitor = { getSystemIdleTime: () => 0, on: () => {} }
export const net = { isOnline: () => true }
