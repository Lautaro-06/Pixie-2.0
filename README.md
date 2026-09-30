# Pixie

Pixie es un asistente de escritorio para Windows. Vive en una esquina de la pantalla con su cara animada: lo llamás con **Ctrl+Espacio**, le escribís lo que necesitás y lo hace en tu compu.

## Qué hace (versión 0.3)

Le hablás como a una persona: entiende sinónimos, voseo, errores de tipeo en los nombres («abrí yutub») y varios pedidos juntos («abrí YouTube y subí el volumen»). Si no entiende, te propone opciones.

| Pedido de ejemplo | Qué hace |
|---|---|
| «buen día» | Fecha, hora, clima y tus timers |
| «¿qué hora es?», «¿qué día es hoy?» | Hora y fecha |
| «¿cómo está el clima?», «clima en Córdoba», «mi ciudad es Rosario» | Clima con Open-Meteo |
| «abrí YouTube», «quiero ver Netflix», «spotify», «abrime descargas» | Abre sitios, apps y carpetas |
| «cerrá Spotify y Discord» | Cierra apps (pregunta antes) |
| «buscá recetas de pizza», «¿qué es la fotosíntesis?» | Busca en Google |
| «poné videos de gatos», «poneme música de Duki» | Busca en YouTube |
| «¿dónde queda Tucumán?» | Busca en Google Maps |
| «subí el volumen», «más fuerte», «no se escucha», «silenciá» | Volumen |
| «poné música», «pasá de tema», «otra canción» | Controla la música que esté sonando |
| «timer de 10 minutos», «avisame en 5 minutos que saque la pizza», «pomodoro» | Timers con aviso, sonido y voz |
| «¿cuánto es 25 por 4?», «20% de 300» | Cuentas |
| «bloqueá la compu», «me voy», «apagá la compu» | Bloquear, apagar o reiniciar (pregunta antes) |
| «sacá una captura», «¿cómo está la compu?» | Recorte de pantalla y uso de CPU y memoria |
| «contame un chiste», «dato curioso», «¿quién sos?», «estoy aburrido» | Charla |
| «me llamo Lauti», «¿cómo me llamo?» | Aprende tu nombre y lo usa |
| «el martes tengo prueba de historia», «mañana a las 17 tengo dentista» | Agenda con avisos |
| «¿qué tengo esta semana?», «¿cuándo es la prueba?» | Consulta la agenda |
| «anotá comprar cartuchos», «¿qué tengo pendiente?», «ya compré los cartuchos» | Lista de pendientes |
| «acordate que mi color favorito es el azul», «¿cuál es mi color favorito?», «¿qué sabés de mí?» | Recuerda lo que le contás |
| «¿qué estoy haciendo?», «¿cuánto usé la compu hoy?», «¿cuánto estuve en YouTube?» | Se da cuenta de lo que hacés |
| «no me molestes por media hora», «ya podés hablar» | Modo no molestar |

## Pixie se acuerda, se da cuenta y habla primero

**Se acuerda.** Guarda tu nombre, lo que le contás, tus pendientes y tu agenda. Los eventos con hora te los avisa 15 minutos antes y a la hora; los que son de un día, la noche anterior y esa mañana. Los avisos siguen andando aunque reinicies la compu.

**Se da cuenta.** Sabe qué tipo de cosa estás haciendo (estudio, videos, redes, juegos, música…) y cuánto tiempo, si te fuiste de la compu, si se cortó internet y cuánta batería queda.

**Habla primero.** Sin que le preguntes:

- La primera vez que te ve en el día, te saluda con el resumen: agenda, pendientes y clima.
- Te recuerda lo que tenés agendado.
- Después de 50 minutos seguidos te propone una pausa.
- Si llevás 40 minutos en videos o redes, te pregunta si volvemos a lo tuyo. Si hay un Pomodoro andando, te lo dice enseguida.
- Te saluda cuando volvés, avisa si se corta internet o queda poca batería, y a la madrugada te sugiere ir a dormir.
- En pantalla completa (juegos, videos, presentaciones) o en modo no molestar se queda callado. Solo los recordatorios y la batería muy baja avisan igual, sin voz.

Los avisos aparecen arriba de la cara sin sacarte el teclado de lo que estabas haciendo.

**Tiene su propio ánimo.** Se pone contento cuando le hablás (más si le decís algo lindo), se aburre si lo ignorás mucho tiempo y tiene sueño de noche. La cara lo muestra: se menea cuando está contento, suspira cuando está aburrido y bosteza cuando está cansado.

### Privacidad

Todo queda en la compu, en `%APPDATA%\Pixie`: `memoria.json` (lo que Pixie sabe) e `historial.txt` (lo que hizo). Del uso de la compu solo guarda el tipo de actividad y el nombre de la app, nunca el título de las ventanas ni lo que escribís. «olvidate de todo» borra la memoria.

## La cara de Pixie

Se dibuja por código a partir del diseño original del ESP32, así que tiene muchas expresiones:

- **Solo:** pestañea, mira para los costados, sigue el mouse con la mirada y, si no lo usás por 2 minutos, se duerme (se despierta si acercás el mouse o lo llamás).
- **Mientras le escribís:** te mira; **mientras piensa**, pone «…».
- **Cuando responde:** mueve la boca y reacciona según lo que pasó: feliz, enamorado, guiño, confundido, enojado, triste, sorprendido, alarma o música.

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
    brain.js       ← entiende las frases (reglas flexibles, sin IA todavía)
    calc.js        ← la calculadora
    dates.js       ← entiende fechas y horas («el martes a las 6 de la tarde»)
    memory.js      ← la memoria: nombre, datos, pendientes, agenda y uso
    awareness.js   ← lo que ve de la compu (ventana activa, inactividad, batería, internet)
    usage.js       ← qué tipo de actividad es cada app
    initiative.js  ← decide cuándo hablar primero
    feelings.js    ← su estado de ánimo
    mind.js        ← junta todo lo anterior y lo revisa cada 5 segundos
    actions/       ← la lista cerrada de acciones, una por tema
    catalog.js     ← apps, sitios y carpetas que sabe abrir
    windows.js     ← ayudantes para hablar con Windows
    config.js      ← configuración y historial en la compu
    window.js      ← la ventana flotante
    tray.js        ← el ícono al lado del reloj
  preload/         ← el puente seguro entre la interfaz y las acciones
  renderer/        ← la interfaz en React: la barra para escribir y la cara (src/face/)
test/              ← pruebas de las frases, fechas, memoria, iniciativa, la cara y más
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

Lo nuevo de la versión 0.3 que todavía no se probó en una PC con Windows:

- «¿qué estoy haciendo?» y «¿cuánto usé la compu hoy?»: dependen de un proceso de PowerShell que corre de fondo. Si no responden bien, pásenme lo que diga la terminal.
- El resumen al empezar el día, los recordatorios de la agenda y el aviso de pausa (se puede probar agendando algo para dentro de 20 minutos).
- Que se quede callado en pantalla completa y con «no me molestes».
- El aviso de batería (en notebooks) y el de internet (desconectando el wifi).

## Próximos pasos

- Entender cualquier pedido con IA, usando estas mismas acciones como herramientas y la memoria como contexto.
- Hablarle con la voz.
- Rutinas: «modo estudio», «buenas noches».

## Equipo

Sofia Power · Thomas Barrera Fuentes · Mauro Joel Beltrán · Lautaro Gabriel Palombo
