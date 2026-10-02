# Pixie

Pixie es un asistente de escritorio para Windows. Vive en una esquina de la pantalla con su cara animada: lo llamás con **Ctrl+Espacio**, le escribís lo que necesitás y lo hace en tu compu.

## Qué hace (versión 0.5)

Le hablás como a una persona: entiende sinónimos, voseo, errores de tipeo en los nombres («abrí yutub») y varios pedidos juntos («abrí YouTube y subí el volumen»). Si no entiende, te propone opciones. **Con una clave de IA entiende cualquier cosa** y conversa de verdad (ver [Con IA](#con-ia-entiende-cualquier-cosa)).

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
| «juguemos», «jugamos al pong», «revancha» | Pong contra Pixie: su cara se vuelve el juego |
| «dale like», «suscribime», «saltá el anuncio», «poné subtítulos», «adelantá 30 segundos», «velocidad 1,5», «siguiente video», «¿qué estoy viendo?» | YouTube en Chrome (con la extensión) |
| «resumime este mail», «¿de qué trata esta página?» | Resume el mail abierto en Gmail o la página que estás viendo (con la extensión) |
| El micrófono de la barra o **Ctrl+Alt+Espacio** | Le hablás por voz (con IA de Gemini o Groq) |
| «¿qué ves en mi pantalla?», «ayudame con esto», «explicame este error» | Mira tu pantalla y te ayuda (con IA de Gemini o Claude) |
| «mandame por WhatsApp que compre pan», «mandame mis pendientes por WhatsApp» | Te escribe al celular (ver [WhatsApp](#whatsapp-al-celular)) |
| «subí el brillo», «brillo al 40», «la pantalla está muy oscura» | Brillo de la pantalla (en notebooks) |
| «prendé el Bluetooth», «apagá el Bluetooth» | Bluetooth |
| «tomé agua», «ya me estiré», «¿cuánta agua tomé hoy?» | Registro de salud |
| «¿qué canción es esta?» | Te dice qué está sonando (Spotify, YouTube…) |
| «hacé un respaldo» | Guarda una copia de su memoria en la nube |
| «estado de la IA» | Dice si la IA está activada y cuál usa |

## Pixie se acuerda, se da cuenta y habla primero

**Se acuerda.** Guarda tu nombre, lo que le contás, tus pendientes y tu agenda. Los eventos con hora te los avisa 15 minutos antes y a la hora; los que son de un día, la noche anterior y esa mañana. Los avisos siguen andando aunque reinicies la compu.

**Se da cuenta.** Sabe qué tipo de cosa estás haciendo (estudio, videos, redes, juegos, música…) y cuánto tiempo, si te fuiste de la compu, si se cortó internet y cuánta batería queda.

**Habla primero.** Sin que le preguntes:

- La primera vez que te ve en el día, te saluda con el resumen: agenda, pendientes y clima.
- Te recuerda lo que tenés agendado.
- Después de 50 minutos seguidos te propone una pausa.
- Si llevás 40 minutos en videos o redes, te pregunta si volvemos a lo tuyo. Si hay un Pomodoro andando, te lo dice enseguida.
- Te saluda cuando volvés, avisa si se corta internet o queda poca batería, y a la madrugada te sugiere ir a dormir.
- Después de algo que tenías agendado, te pregunta cómo te fue («Hoy tenías la prueba de historia. ¿Cómo te fue?») y se acuerda de lo que le contestes.
- Si hace más de una hora y media que no charlan, te habla de algo: te invita a un Pong, te cuenta un chiste o un dato curioso, te recuerda un pendiente o te pregunta si tomaste agua. Como mucho 4 veces por día, entre las 10 y las 22, y nunca si estás estudiando, jugando o en un Pomodoro.
- Cada dos horas sin anotar un vaso de agua te pregunta si tomaste (se apaga con `"recordatoriosSalud": false`).
- En pantalla completa (juegos, videos, presentaciones), **en una reunión o llamada** (Zoom, Meet, Teams o cualquier app usando el micrófono) o en modo no molestar se queda callado. Solo los recordatorios y la batería muy baja avisan igual, sin voz.
- Si no estás frente a la compu (bloqueada o 5 minutos sin tocarla), los recordatorios y los timers te llegan por WhatsApp.

Los avisos aparecen arriba de la cara sin sacarte el teclado de lo que estabas haciendo.

**Tiene su propio ánimo.** Se pone contento cuando le hablás (más si le decís algo lindo), se aburre si lo ignorás mucho tiempo y tiene sueño de noche. La cara lo muestra: se menea cuando está contento, suspira cuando está aburrido y bosteza cuando está cansado.

### Privacidad

Todo queda en la compu, en `%APPDATA%\Pixie`: `memoria.json` (lo que Pixie sabe) e `historial.txt` (lo que hizo). Del uso de la compu solo guarda el tipo de actividad y el nombre de la app, nunca el título de las ventanas ni lo que escribís. «olvidate de todo» borra la memoria.

La pantalla solo se mira cuando se lo pedís: la foto va a la IA para responderte y no se guarda. Lo que decís por el micrófono solo se graba mientras el botón está rojo, y el audio va a la IA para pasarlo a texto. Los WhatsApp pasan por CallMeBot, un servicio gratuito de terceros.

Con la IA activada, cada mensaje que va a la IA viaja a ese servicio junto con el contexto que necesita: fecha, qué app estás usando, tu nombre, lo que le contaste, tus pendientes y tu agenda. Cuando le pedís resumir un mail o una página, también se manda ese texto. **En el plan gratis de Gemini, Google puede usar lo que se manda para mejorar sus productos**: no le cuentes nada que no quieras compartir. Con Ollama nada sale de la compu. La clave queda solo en tu compu, en `config.json`.

## Voz

**Hablarle.** Tocá el micrófono de la barra o apretá **Ctrl+Alt+Espacio** desde cualquier app, decí lo que necesitás y quedate callado: Pixie entiende que terminaste, lo pasa a texto y lo hace. Necesita la IA de Gemini (o Groq). Si el micrófono no anda, revisá en Configuración de Windows → Privacidad → Micrófono que las apps de escritorio tengan permiso.

**Su voz.** Con Gemini, Pixie habla con una voz natural, con acento argentino y un tono que cambia según cómo está (contenta, triste, sorprendida…). Empieza a hablar en menos de un segundo porque el audio llega en pedacitos mientras se genera. El plan gratis alcanza para unas 100 frases por día; las frases repetidas no gastan. Cuando se acaba, o sin internet, usa la voz de Windows.

**Se escucha aunque haya música.** Mientras habla, pausa lo que esté sonando (Spotify, YouTube, cualquier app que responda a las teclas multimedia) y después lo sigue. No lo hace si la frase es muy corta ni si le acabás de pedir música.

**Sonidos.** Hace bips de robotito según la emoción, y al arrancar aparece con un salto y abre los ojos. Los sonidos y la voz se apagan desde el pie de la barra.

| config.json | Qué hace |
|---|---|
| `vozNatural` | `false` para usar siempre la voz de Windows |
| `vozIA` | La voz de Gemini (por defecto `Leda`; otras: `Kore`, `Puck`, `Aoede`, `Zephyr`) |
| `pausarMusicaAlHablar` | `false` para que no pause la música |
| `atajoVoz` | Otro atajo para hablarle (por defecto `Control+Alt+Space`) |

## WhatsApp al celular

Pixie te puede escribir por WhatsApp, **solo a tu número**, usando [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) (gratis para uso personal). Se activa una vez:

1. Agendá en el celular el número **+34 684 77 00 05** (CallMeBot).
2. Mandale por WhatsApp: `I allow callmebot to send me messages`
3. Te responde con tu **apikey**. Ponela en `config.json` junto con tu número (con código de país):

   ```json
   "whatsapp": { "telefono": "+5491112345678", "apikey": "123456" }
   ```

4. Guardá (Pixie lo lee solo, no hace falta reiniciarlo) y decile «probá el WhatsApp».

Con eso, si no estás frente a la compu, los recordatorios y los timers te llegan al celular (como mucho uno por minuto). Para que no lo haga: `"avisosAlCelular": false`.

## Respaldo en la nube

Cada 6 horas y al cerrarse, Pixie guarda una copia de su memoria en la compu (`%APPDATA%\Pixie\respaldos`) y en **OneDrive** (carpeta `Pixie`), que Windows sube a la nube solo. Guarda los últimos 7 días y nunca copia las claves. Si se rompe la compu, en la nueva Pixie recupera sus recuerdos al arrancar. Para usar otra carpeta (por ejemplo Google Drive): `"carpetaRespaldo": "G:\\Mi unidad\\Pixie"`.

## Pong

Pedile jugar y sus ojos y su boca se transforman en un Pong. Pixie maneja la paleta de la derecha y vos la de la izquierda, con el mouse o con las flechas ↑↓ (o W y S). Gana el primero que llega a 3. Cuando te hace un punto se ríe; cuando se lo hacés vos, te felicita. Al final podés pedir la revancha o volver a su cara. Está calibrado para que sea parejo: si prestás atención le ganás, si te distraés te gana.

## Con IA: entiende cualquier cosa

Sin IA, Pixie entiende con reglas: rápido, gratis y sin internet, pero con frases que conoce. Con IA entiende **cualquier cosa** que le escribas: le podés contar cosas, preguntarle lo que sea y pedirle cosas a tu manera («el jueves rindo física, agendalo y recordame estudiar mañana a las 6»). Usa sus mismas acciones como herramientas, sabe qué estás haciendo, qué tenés agendado y lo que le contaste, y guarda solo lo importante de lo que le contás.

Se activa poniendo una clave en `config.json`. Pixie se da cuenta de qué IA es por cómo empieza la clave:

| IA | Costo | Clave | Dónde se saca |
|---|---|---|---|
| **Gemini** (Google) — recomendada | Gratis, con límite de pedidos por minuto y por día | empieza con `AQ.` o `AIza` | https://aistudio.google.com/apikey → *Create API key* |
| **Groq** | Gratis, con límites más chicos | empieza con `gsk_` | https://console.groq.com → *API Keys* |
| **Claude** (Anthropic) | Pago por uso | empieza con `sk-ant-` | https://console.anthropic.com → *API Keys* |
| **Ollama** (en tu compu) | Gratis, sin internet | no lleva | https://ollama.com (necesita una compu potente) |

### Activarla con Gemini (gratis)

1. Entrá a https://aistudio.google.com/apikey con tu cuenta de Google, tocá **Create API key** y copiala. (No hace falta el *Playground* ni pagar nada: si te ofrece un plan pago, cerralo.)
2. Abrí Pixie (`npm run dev`) para que cree su configuración.
3. Apretá **Win + R**, escribí `notepad %APPDATA%\Pixie\config.json` y Enter. Agregá la clave al final (ojo con la coma de la línea de antes):

   ```json
   {
     "ciudad": "Buenos Aires",
     "lugar": null,
     "atajo": "Control+Space",
     "apps": [],
     "claveIA": "AQ...."
   }
   ```

4. Guardá: Pixie lo lee solo en un par de segundos. Para probar: «estado de la IA» o «¿qué es un agujero negro?» (con IA te lo explica; sin IA abre Google).

Si `config.json` queda mal escrito (por ejemplo, falta una coma), Pixie lo avisa en la terminal y no lo toca: lo arreglás, guardás y lo lee solo. Por las dudas deja una copia en `config.roto.json`.

### Ollama: IA en tu propia compu

Instalá Ollama desde https://ollama.com, bajá el modelo con `ollama pull qwen2.5:7b` (unos 5 GB) y poné en `config.json` `"proveedorIA": "ollama"` (sin clave). Anda sin internet y nada sale de la compu, pero necesita al menos 8 GB de RAM libres y sin placa de video responde lento. En compus más justas probá `"modeloIA": "llama3.2:3b"`.

### Otras opciones de config.json

| Clave | Qué hace |
|---|---|
| `modeloIA` | Cambia el modelo. Por defecto: `gemini-flash-lite-latest` (Gemini, responde en un segundo; si se acaba su límite gratis o está saturado, Pixie prueba con `gemini-flash-latest`), `llama-3.3-70b-versatile` (Groq), `claude-opus-5-5` (Claude), `qwen2.5:7b` (Ollama) |
| `proveedorIA` | Fuerza la IA: `gemini`, `groq`, `claude` u `ollama` |
| `urlIA` | Para usar otro servicio compatible con el formato de OpenAI (por ejemplo LM Studio) |
| `esfuerzoIA` | Solo Claude: cuánto piensa antes de responder (`low`, `medium` o `high`) |
| `ia` | `false` para apagar la IA sin borrar la clave |

Las órdenes cortas que las reglas ya entienden («abrí Spotify», «subí el volumen») no pasan por la IA: son instantáneas y no gastan el límite gratis. Van a la IA la charla, las preguntas, las frases largas y lo que las reglas no entienden. Si no hay internet o la IA falla, Pixie sigue con las reglas, y el error queda escrito en la terminal y en `historial.txt`.

Las acciones riesgosas (apagar, bloquear, cerrar apps) siempre te piden confirmación con botones, aunque las pida la IA.

## Pixie para Chrome (YouTube y Gmail)

Para que Pixie pueda darle like a un video o resumir un mail, instalá la extensión que está en la carpeta `extension/`:

1. En Chrome, abrí `chrome://extensions` (en Edge, `edge://extensions`).
2. Activá el **Modo de desarrollador** (arriba a la derecha en Chrome, a la izquierda en Edge).
3. Tocá **Cargar extensión sin empaquetar** (o «Cargar desempaquetada») y elegí la carpeta `extension` de este repo.

Con Pixie abierto, la extensión se conecta sola (tarda hasta 30 segundos). Después probá con un video de YouTube abierto: «dale like» o «¿qué estoy viendo?». Para el mail, abrí uno en Gmail y decile «resumime este mail».

Sin IA, el resumen es simple (de quién es, el asunto y las primeras oraciones). Con IA es un resumen de verdad y le podés hacer preguntas sobre el mail o la página.

La extensión solo hace algo cuando se lo pide Pixie, y Pixie solo acepta conexiones de extensiones del navegador desde la misma compu (`127.0.0.1`, puerto 47631).

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

Aparece la cara de Pixie abajo a la derecha y un ícono al lado del reloj de Windows. Apretá **Ctrl+Espacio** (o tocá el botón debajo de la cara, o el ícono) y escribile. La cara se puede arrastrar a cualquier lugar de la pantalla. Si hacés clic en otra ventana, Pixie no se calla: termina de pensar, escuchar o hablar, y 10 segundos después se achica dejando la respuesta en el globito. La **×** la achica sin callarla; **Esc** la cierra y la calla.

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
    brain.js       ← entiende las frases con reglas flexibles (sin internet)
    ai.js          ← el cerebro con IA: conversa y usa las acciones como herramientas
    ai-compatible.js ← cómo hablar con Gemini, Groq y Ollama (Claude va por su propia librería)
    ai-tools.js    ← las acciones que la IA puede usar
    browser.js     ← la conexión con la extensión de Chrome
    content.js     ← chistes y datos curiosos
    tts.js         ← la voz natural (Gemini, en streaming)
    media-session.js ← la música que suena en Windows (pausar mientras habla, qué canción es)
    phone.js       ← los WhatsApp al celular
    backup.js      ← el respaldo en OneDrive
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
  renderer/        ← la interfaz en React: la barra para escribir, la cara (src/face/) y el Pong (src/games/)
extension/         ← la extensión «Pixie para Chrome» (YouTube, Gmail y páginas)
test/              ← pruebas de las frases, fechas, memoria, iniciativa, la cara, el Pong, la IA y más
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

`tipo` puede ser `ruta` (un archivo), `uri` (un protocolo como `spotify:`) o `start` (un programa que Windows ya conoce, como `notepad.exe`). `proceso` es opcional y sirve para poder cerrarla.

## Sumar una acción

1. Escribí la acción en el archivo que corresponda de `src/main/actions/` (o en uno nuevo que sumes a `actions/index.js`).
2. Agregá en `src/main/brain.js` una regla que la reconozca.
3. Sumá frases de ejemplo en `test/brain.test.js` y corré `npm test`.

## Para probar en Windows

Lo nuevo de la versión 0.5. Probado acá con Gemini de verdad: la voz natural, pasar la voz a texto y mirar una captura de pantalla. Falta probar en una PC con Windows:

- **Micrófono:** que pida permiso y te escuche (el botón del micrófono y Ctrl+Alt+Espacio).
- **Pausar la música** mientras habla, y «¿qué canción es esta?» con Spotify abierto.
- **Brillo** (en una notebook) y **Bluetooth**.
- **Mirar la pantalla:** abrí algo con un error y decile «explicame este error».
- **Modo reunión:** entrar a un Meet o Zoom y ver que no hable solo.
- **WhatsApp:** activarlo y decirle «probá el WhatsApp».
- **Respaldo:** «hacé un respaldo» y fijarse que aparezca la carpeta Pixie en OneDrive.

De la versión 0.4:

- **La IA:** que responda con una clave real de Gemini (gratis), que use las acciones («poné un timer de 5 minutos y contame un chiste») y que guarde lo que le contás («mi perro se llama Toby» y después «¿cómo se llama mi perro?»).
- **La extensión:** que se conecte con Pixie, los botones de YouTube (like, suscribirse, anuncios, subtítulos) y el resumen de un mail de Gmail. YouTube y Gmail cambian su página seguido: si algo no anda, pásenme qué pedido fue y qué contestó Pixie.
- **Pong:** que la ventana se agrande bien y que se juegue cómodo con el mouse y las flechas.
- **Hablar primero:** agendar algo para dentro de 5 minutos y ver que 2 horas después pregunte cómo te fue.

## Próximos pasos

- Llamarlo diciendo «Pixie, ¿estás ahí?» (sin tocar nada).
- Charla fluida por voz, sin esperar a que termine cada frase.
- Plugins para que cualquiera le sume herramientas.
- Cambiar el fondo de pantalla según el clima o el ánimo.
- Más juegos en la cara de Pixie.

## Equipo

Sofia Power · Thomas Barrera Fuentes · Mauro Joel Beltrán · Lautaro Gabriel Palombo
