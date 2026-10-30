// La ventana aparte de Pixie: muestra la bienvenida o los Ajustes (y puede pasar de una a la otra).
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Settings from './Settings.jsx'
import Welcome from './Welcome.jsx'
import './settings.css'

export default function SettingsApp({ initial }) {
  const [view, setView] = useState(initial)
  useEffect(() => api.settings.onView((next) => setView(next)), [])
  useEffect(() => {
    document.title = view === 'bienvenida' ? '¡Hola! Soy Pixie' : 'Ajustes de Pixie'
  }, [view])
  if (view === 'bienvenida') return <Welcome />
  // "ajustes/ia" abre directo en esa sección
  return <Settings key={view} section={view.split('/')[1]} />
}
