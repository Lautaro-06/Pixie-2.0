import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the build works under any GitHub Pages subpath
  base: './',
  plugins: [react(), tailwindcss()],
  // La cara se dibuja con el código de la app, que vive fuera de landing/
  server: { fs: { allow: ['..'] } },
})
