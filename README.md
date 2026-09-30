# Pixie

Pixie es un asistente de escritorio para Windows. Vive en una esquina de la pantalla con su cara animada: lo llamás con **Ctrl+Espacio**, le escribís lo que necesitás y lo hace en tu compu.

## Qué hace (versión 0.1)

| Pedido de ejemplo | Qué hace |
|---|---|
| «buen día» | Te dice la fecha, la hora, el clima y tus timers |
| «¿qué hora es?», «¿qué día es hoy?» | Hora y fecha |
| «¿cómo está el clima?», «mi ciudad es Córdoba» | Clima con Open-Meteo y cambio de ciudad |
| «abrí YouTube», «abrí Spotify», «abrime descargas», «entrá a github.com» | Abre sitios, apps y carpetas |
| «cerrá el bloc de notas» | Cierra una app (pregunta antes) |
| «buscá recetas de pizza», «poné lofi en youtube» | Busca en Google o YouTube |
| «subí el volumen», «bajá el volumen 20», «silenciá» | Volumen |
| «pausá la música», «siguiente canción» | Controla la música que esté sonando |
| «timer de 10 minutos», «avisame en 5 minutos que saque la pizza», «pomodoro» | Timers con aviso de Windows, sonido y voz |
| «¿cuánto falta?», «cancelá el timer» | Consulta o cancela timers |
| «bloqueá la compu» | Bloquea la PC (pregunta antes) |
| «sacá una captura» | Abre el recorte de pantalla de Windows |
| «¿cómo está la compu?» | Uso de CPU y memoria |
| «ayuda», «chau» | Lo que sabe hacer, o se esconde |

Pixie solo puede hacer lo que está en su lista de acciones: no ejecuta comandos libres. Lo riesgoso pide confirmación y todo lo que hace queda anotado en `historial.txt`.

## Cómo correrlo

Necesitás Windows 10 u 11, [Node.js 22](https://nodejs.org) y Git.

```bash
npm install
npm run dev
```

`npm install` también descarga Electron (unos 100 MB). Si en algún momento aparece el error `Electron uninstall`, corré `npx install-electron` y después de nuevo `npm run dev`.

Aparece la cara de Pixie abajo a la derecha y un ícono al lado del reloj de Windows. Apretá **Ctrl+Espacio** (o tocá el botón debajo de la cara, o el ícono) y escribile. La cara se puede arrastrar a cualquier lugar de la pantalla.

Otros comandos:

```bash
npm test          # prueba que Pixie entienda las frases
npm run build     # compila la app
npm run dist:win  # arma el instalador en dist/
```

## Cómo está armado

```
src/
  main/            ← Node.js: la parte que tiene permisos sobre Windows
    index.js       ← arranque, atajo global y conexión con la interfaz
    brain.js       ← entiende las frases (reglas, sin IA todavía)
    actions/       ← la lista cerrada de acciones, una por tema
    catalog.js     ← apps, sitios y carpetas que sabe abrir
    windows.js     ← ayudantes para hablar con Windows
    config.js      ← configuración y historial en la compu
    window.js      ← la ventana flotante
    tray.js        ← el ícono al lado del reloj
  preload/         ← el puente seguro entre la interfaz y las acciones
  renderer/        ← la interfaz en React (la cara y la barra para escribir)
test/              ← pruebas de las frases
```

La interfaz (React) nunca toca Windows directamente: le pasa el texto a `main`, que decide qué acción corresponde y solo ejecuta las que están en `src/main/actions`.

## Sumar una app

Desde el ícono de Pixie → «Abrir config.json», agregá la app en `apps`:

```json
"apps": [
  {
    "nombre": "Minecraft",
    "alias": ["minecraft", "mine"],
    "abrir": { "tipo": "ruta", "valor": "C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft.exe" },
    "proceso": "Minecraft.exe"
  }
]
```

`tipo` puede ser `ruta` (un archivo), `uri` (un protocolo como `spotify:`) o `start` (un programa que Windows ya conoce, como `notepad.exe`). `proceso` es opcional y sirve para poder cerrarla. Reiniciá Pixie después de guardar.

## Sumar una acción

1. Escribí la acción en el archivo que corresponda de `src/main/actions/` (o en uno nuevo que sumes a `actions/index.js`).
2. Agregá en `src/main/brain.js` una regla que la reconozca.
3. Sumá frases de ejemplo en `test/brain.test.js` y corré `npm test`.

## Para probar en Windows

Estas partes se escribieron sin poder probarlas en una PC con Windows. Revisen que funcionen y anoten lo que falle:

- Volumen, silencio y controles de música.
- Bloquear la compu y cerrar apps.
- Abrir Spotify, Discord, WhatsApp, Steam y VS Code (dependen de que estén instalados).
- La voz de Pixie: necesita una voz en español instalada en Windows (Configuración → Hora e idioma → Voz).
- El atajo Ctrl+Espacio: si otro programa lo usa, Pixie prueba con Ctrl+Shift+Espacio.

## Próximos pasos

- Entender pedidos libres con IA, usando estas mismas acciones como herramientas.
- Hablarle con la voz.
- Rutinas: «modo estudio», «buenas noches».
- Más caras para cada reacción.

## Equipo

Sofia Power · Thomas Barrera Fuentes · Mauro Joel Beltrán · Lautaro Gabriel Palombo
