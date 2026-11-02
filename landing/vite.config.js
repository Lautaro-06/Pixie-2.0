import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Si el navegador no llega a la API de GitHub, el botón baja igual este instalador.
async function latestInstaller() {
  try {
    const token = process.env.GITHUB_TOKEN
    const res = await fetch('https://api.github.com/repos/Lautaro-06/Pixie-2.0/releases/latest', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    const exe = data.assets.find(a => a.name.endsWith('.exe'))
    return { version: data.tag_name, url: exe.browser_download_url, sizeMb: Math.round(exe.size / 1_048_576) }
  } catch (err) {
    console.warn('No se pudo leer la última Release para el respaldo de descarga:', err.message)
    return null
  }
}

export default defineConfig({
  // Relative base so the build works under any GitHub Pages subpath
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __FALLBACK_RELEASE__: JSON.stringify(await latestInstaller()) },
  // La cara se dibuja con el código de la app, que vive fuera de landing/
  server: { fs: { allow: ['..'] } },
})
