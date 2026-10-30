import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import SettingsApp from './settings/SettingsApp.jsx'
import { api } from './api.js'
import './styles.css'

// La misma interfaz sirve para dos ventanas: la cara (sin #) y la de Ajustes/bienvenida (#ajustes, #bienvenida)
const view = decodeURIComponent(location.hash.slice(1))
const isSettings = view === 'bienvenida' || view.startsWith('ajustes')
if (isSettings) document.body.classList.add('ventana-ajustes')

// Los errores de la interfaz quedan anotados para el informe de diagnóstico
const report = (message, stack) => api.reportError?.({ message: String(message ?? 'error'), stack: String(stack ?? '') })
window.addEventListener('error', (e) => report(e.message, e.error?.stack))
window.addEventListener('unhandledrejection', (e) => report(e.reason?.message ?? e.reason, e.reason?.stack))

// Si la cara se rompe, se vuelve a cargar sola (como mucho 3 veces seguidas)
const RELOADS_KEY = 'pixie.recargas'
class Recover extends Component {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  componentDidCatch(error, info) {
    report(error?.message, `${error?.stack ?? ''}\n${info?.componentStack ?? ''}`)
    let count = 0
    try {
      count = Number(sessionStorage.getItem(RELOADS_KEY) ?? 0)
      sessionStorage.setItem(RELOADS_KEY, String(count + 1))
    } catch {
      // sin sessionStorage: igual recarga una vez
    }
    if (count < 3) setTimeout(() => location.reload(), 1500)
  }

  componentDidMount() {
    // Si anduvo un rato bien, se olvida de las recargas anteriores
    this.calm = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOADS_KEY)
      } catch {
        // nada
      }
    }, 60000)
  }

  componentWillUnmount() {
    clearTimeout(this.calm)
  }

  render() {
    return this.state.broken ? null : this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Recover>{isSettings ? <SettingsApp initial={view} /> : <App />}</Recover>
  </StrictMode>
)
