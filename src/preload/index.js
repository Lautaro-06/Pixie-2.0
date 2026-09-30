// Puente seguro: lo único que la interfaz (React) puede pedirle a la compu.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pixie', {
  ask: (text) => ipcRenderer.invoke('pixie:ask', String(text)),
  confirm: (yes) => ipcRenderer.invoke('pixie:confirm', Boolean(yes)),
  info: () => ipcRenderer.invoke('pixie:info'),
  setMode: (mode) => ipcRenderer.send('pixie:mode', mode),
  hide: () => ipcRenderer.send('pixie:hide'),
  onEvent: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pixie:event', handler)
    return () => ipcRenderer.removeListener('pixie:event', handler)
  }
})
