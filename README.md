# Pixie

Pixie es un asistente de escritorio para Windows. Vive en una esquina de la pantalla con su cara animada: la llamás diciendo **«Pixie, ¿estás?»** (o con **Ctrl+Espacio**), le pedís lo que necesitás y lo hace en tu compu.

## Instalar Pixie

1. Entrá a [Releases](https://github.com/Lautaro-06/Pixie-2.0/releases/latest) y bajá `Pixie-…-instalador.exe`.
2. Abrilo. Como Pixie todavía no tiene firma digital, Windows muestra «Windows protegió su PC»: tocá **Más información → Ejecutar de todas formas**.
3. Listo: aparece la cara abajo a la derecha y queda arrancando sola con Windows (se apaga desde el menú de Pixie → **Iniciar con Windows**).
4. La primera vez se abre la **bienvenida**: tu nombre, la clave gratis de la IA y cómo llamarla. Pixie se instala **sin ninguna clave**: cada persona pone la suya. Si nunca sacaste una, tocá **«No entiendo nada: explicame paso a paso»** y te guía de a un paso por vez (y te lo lee en voz alta si querés).

### El menú de Pixie

Todo se hace desde la ventanita: **clic derecho en la cara** (o el botón **⋯** arriba de la barra) abre el menú con **Ajustes**, qué mostrar en reposo, «Pixie, ¿estás?», actualizaciones, arrancar con Windows, la ayuda (informe, historial, carpeta) y **Cerrar Pixie**. Es el mismo menú del ícono al lado del reloj. También podés pedirle «cerrate» (pregunta antes) o «escondete» (se va hasta que la llamás).

### Llamarla con la voz: «Pixie, ¿estás?»

En **Ajustes → Voz** (o en la bienvenida) decís tres veces «Pixie, ¿estás?» y aprende tu voz. Desde ahí la llamás así, sin tocar nada: hace un sonidito, te escucha y, cuando dejás de hablar, hace lo que le pediste. Si le seguís hablando, te sigue escuchando; cuando te quedás callado, vuelve a esperar la frase.

- **Aprende con el uso:** cada vez que la llamás y entiende tu pedido, guarda esa forma de decirlo (las últimas 6) y te reconoce mejor. Si te escucha «casi» y lo repetís enseguida, se despierta igual.
- **No te corta:** escucha según el ruido de tu habitación (anda con micrófonos bajitos y con ruido de fondo) y espera casi 2 segundos de silencio antes de terminar. Para entenderte usa el modelo de Gemini que mejor entiende el audio, sabiendo que le hablás en castellano rioplatense y con los nombres de tus apps.
- **Funciona en la compu:** compara lo que oye con tus grabaciones (sin internet). No manda audio a ningún lado hasta que la llamás. De tu voz guarda solo una huella (números) en `palabra-magica.json`, que no va al respaldo.
- Mientras está prendido, Windows muestra el ícono del micrófono en la barra de tareas.
- Si se despierta sola, elegí **Menos** en «Qué tan fácil me despierto»; si no te escucha, **Más**, o grabá tu voz de nuevo en el lugar donde la vas a usar. **Probar ahora** te muestra si te reconoce.
- Con el micrófono de unos auriculares Bluetooth no se queda escuchando (el sonido quedaría «de llamada»): usá el de la compu u otro.
- Para entender lo que le pedís después de llamarla necesita la IA (Gemini).

### Actualizaciones

Pixie se fija sola si hay una versión nueva al arrancar y cada 6 horas. La baja en segundo plano y, cuando está lista, avisa: «¡Hay una versión nueva de Pixie! ¿Me actualizo ahora?». Tocás **actualizar** y en unos segundos vuelve con la versión nueva. Si no, se instala sola la próxima vez que se cierre.

También se puede pedir: «actualizate», «¿hay una versión nueva?», «¿qué versión tenés?», o desde el ícono → **Buscar actualizaciones**.

### Usar tus apps (no solo abrirlas)

Pixie hace cosas **adentro** de la app que tenés adelante (si le escribiste en su ventanita, en la que estabas usando antes):

- **Escribir:** «escribí: Hola, ¿cómo andás?» escribe eso tal cual, con tildes y signos, donde está el cursor. «escribí hola y mandalo» escribe y aprieta Enter.
- **Atajos con palabras:** «guardá», «copiá», «pegá», «deshacé», «seleccioná todo», «imprimí», «nueva pestaña», «cerrá la pestaña», «recargá la página», «volvé atrás», «poné en negrita»… En Word, Excel y PowerPoint en castellano (que usan otros atajos) toca el botón por su nombre.
- **Teclas:** «apretá control S», «apretá enter», «presioná alt tab dos veces».
- **Tocar botones por lo que dicen:** «tocá el botón Enviar», «hacé clic en Archivo», «clic en Nuevo documento». Los encuentra con la accesibilidad de Windows; si un botón no tiene nombre, con la IA lo busca en una foto de la pantalla.
- **Moverse:** «bajá la página», «subí un poco», «maximizá», «minimizá», «poné la ventana a la izquierda», «cambiá a Word» (si ya está abierta, la trae al frente; «abrí Word» también).
- **«¿Qué botones hay?»** dice qué se puede tocar.
- **Con IA**, pedidos de varios pasos: «en Word escribí un título que diga Informe y ponelo en negrita».

Por seguridad: **no escribe en campos de contraseña**, no escribe lo que bloquea el filtro de contenido y **pregunta antes** de lo que puede hacer perder algo (cerrar la ventana, Alt+F4, borrar sin papelera). Solo funciona en Windows.

### Agenda: Google Calendar y Classroom

Pixie suma tu calendario y tus tareas de Classroom a su agenda: «¿qué tengo hoy?», «¿qué tengo esta semana?», «¿qué tengo que entregar?» y el resumen del día los incluyen, y te avisa **15 minutos antes** de cada clase o evento y **la noche anterior y a la mañana** de cada entrega.

**Google Calendar.** En **Ajustes → Agenda** (o pedile «conectá mi Google Calendar») copiás la **dirección secreta en formato iCal** de tu calendario y Pixie la encuentra sola. Si no sabés dónde está, **«No sé dónde está»** te guía paso a paso (y te lo lee en voz alta). Es gratis y no pide iniciar sesión. La dirección secreta deja ver tu calendario a quien la tenga: Pixie la guarda **cifrada solo en esta compu** (`calendarios.json`, no va al respaldo) y se fija si hay cambios cada 15 minutos. Google solo la da para los calendarios que son tuyos, y algunos colegios la desactivan.

**Classroom.** Las materias de Classroom son calendarios del profe y Google no da su dirección secreta. Por eso Pixie las lee con su **extensión de Chrome** (ver [Pixie para Chrome](#pixie-para-chrome-youtube-gmail-y-classroom)): cada 2 horas, si Chrome está abierto, abre tus **Pendientes** en una pestaña de fondo, los lee y la cierra. Usa la sesión que ya tenés en Chrome, así que anda también con cuentas del colegio. Las tareas con fecha van a la agenda como entregas, con sus avisos. Pedile «¿qué tengo en Classroom?» o tocá **Leer ahora** en Ajustes → Agenda. Lo último que leyó queda en `classroom.json`.

### Noticias

«¿Qué noticias hay?», «noticias de TN», «noticias sobre el dólar», «más noticias» y «abrí la segunda». Lee los titulares de **Infobae** y **TN** por RSS (si el de un diario no responde, usa Google Noticias de ese diario), sin clave y gratis. De vez en cuando te cuenta un titular nuevo por su cuenta (de 9 a 22, nunca mientras estudiás, jugás o estás en una reunión) y suma uno al resumen del día. En **Ajustes → Noticias** elegís los diarios y cada cuánto (**Nunca**, **A veces**: unas 2 por día, o **Más seguido**: unas 4). No lee titulares para adultos ni violentos.

### Ajustes

Clic derecho en la cara de Pixie → **Ajustes…** (o pedile «abrí tus ajustes»). Ahí está todo sin tocar `config.json`:

- **General:** tu nombre, tu ciudad, el atajo (apretás las teclas que quieras), arrancar con Windows, recordatorios de salud y avisos al celular.
- **Agenda** y **Noticias** (ver arriba).
- **Personalización:** qué muestra Pixie cuando no la usás: **su carita**, un **reloj** con la hora grande y la fecha, o un **resumen** con su carita en chiquito, la hora y el clima. Cuando habla, reacciona o la llamás, vuelve la cara.
- **Inteligencia artificial:** poner la clave (con la guía paso a paso), probarla, cambiarla o borrarla.
- **Voz:** «Pixie, ¿estás?» (grabar tu voz, probarla, qué tan fácil se despierta) y cómo suena: natural (argentina, sin internet), la de Windows o Gemini.
- **Actualizaciones** y **Ayuda** (el informe de diagnóstico y la carpeta de Pixie).

### Si el atajo no anda

Si otro programa ya usa **Ctrl+Espacio** (por ejemplo Claude), Pixie toma otro atajo y te avisa cuál: casi siempre **Ctrl+Shift+Espacio**. Lo ves también en el primer renglón del menú de su ícono. Para elegir otro, decile «cambiá el atajo a Ctrl+Alt+P» o cambialo en **Ajustes → General** apretando las teclas (tiene que llevar Ctrl o Alt); si ese también está ocupado, te lo dice. «¿Cuál es tu atajo?» te dice el que tiene ahora.

### Si algo falla

Pixie anota sus errores. Decile «copiame el informe» (o ícono → **Copiar informe de diagnóstico**) y pegá el informe con Ctrl+V donde lo quieras mandar. Trae la versión, la IA y la voz que usa y los últimos errores, **sin claves, contraseñas ni teléfonos**. Los errores también quedan en `errores.log`, en la carpeta de Pixie (ícono → **Abrir la carpeta de Pixie**).

Si la cara se cuelga o se cierra de golpe, se vuelve a cargar sola.

## Qué hace (versión 0.10)

Le hablás como a una persona: entiende sinónimos, voseo, errores de tipeo en los nombres («abrí yutub») y varios pedidos juntos («abrí YouTube y subí el volumen»). Si no entiende, te propone opciones. **Con una clave de IA entiende cualquier cosa** y conversa de verdad (ver [Con IA](#con-ia-entiende-cualquier-cosa)).

| Pedido de ejemplo | Qué hace |
|---|---|
| «buen día» | Fecha, hora, clima y tus timers |
| «¿qué hora es?», «¿qué día es hoy?» | Hora y fecha |
| «¿cómo está el clima?», «clima en Córdoba», «mi ciudad es Rosario» | Clima con Open-Meteo |
| «abrí YouTube», «quiero ver Netflix», «spotify», «abrime descargas» | Abre sitios, apps y carpetas |
| «cerrá Spotify y Discord» | Cierra apps (pregunta antes) |
| «buscá recetas de pizza», «¿qué es la fotosíntesis?» | Busca en Google |
| «poné goteo de Duki», «quiero escuchar a Los Redondos», «poné videos de gatos» | **Lo reproduce de una** en YouTube (el primer video, sin Shorts) |
| «poné el segundo», «abrí el primer video» | Pone el video número N de la lista de YouTube que tenés abierta (con la extensión) |
| «¿dónde queda Tucumán?» | Busca en Google Maps |
| «subí el volumen», «volumen al 50», «más fuerte», «silenciá» | Volumen |
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

La pantalla solo se mira cuando se lo pedís: la foto va a la IA para responderte y no se guarda. **Si tenés adelante una app de chat (WhatsApp, Telegram, Discord), pregunta antes**, porque la foto llevaría tus chats. Pixie no puede entrar a tu WhatsApp ni a tus cuentas: si le pedís «revisá mi WhatsApp», te lo dice. Con «Pixie, ¿estás?» prendido escucha el micrófono todo el tiempo, pero lo analiza en la compu y lo tira; lo que decís después de llamarla (o con el botón del micrófono) va a la IA para pasarlo a texto. Los WhatsApp que te manda pasan por CallMeBot, un servicio gratuito de terceros. Para las noticias, Pixie solo pide los titulares a Infobae, TN o Google Noticias: no les manda nada tuyo. Las direcciones de tus calendarios quedan cifradas en la compu.

Con la IA activada, cada mensaje que va a la IA viaja a ese servicio junto con el contexto que necesita: fecha, qué app estás usando, tu nombre, lo que le contaste, tus pendientes y tu agenda. Cuando le pedís resumir un mail o una página, también se manda ese texto. **En el plan gratis de Gemini, Google puede usar lo que se manda para mejorar sus productos**: no le cuentes nada que no quieras compartir. Con Ollama nada sale de la compu. La clave queda solo en tu compu, cifrada en `config.json`, y **no viaja con el respaldo**: en otra compu Pixie arranca sin clave y con la bienvenida.

## Filtro de contenido

A Pixie la puede usar cualquiera (por ejemplo en una feria), así que **nunca abre ni busca contenido para adultos, gore ni cosas ilegales** (comprar drogas o armas, documentos falsos, dark web). El filtro está en las acciones mismas, así que vale igual si lo pide una persona o la IA:

- **Sitios:** una lista de páginas conocidas de esos tipos, más palabras en el nombre del sitio («porn», «xxx», `.onion`…).
- **Búsquedas:** frases como «videos porno», «gente muriendo» o «dónde compro droga». Está pensado para no bloquear tareas del colegio: «educación sexual», «efectos de la cocaína» o «armas de la Segunda Guerra» pasan.
- **Google** siempre abre con la búsqueda segura activada.
- **La IA** tiene la instrucción de no mostrar, describir ni buscar ese contenido.
- Cada intento bloqueado queda anotado en `historial.txt` (`BLOQUEADO`), para que el equipo lo pueda revisar.

No se puede apagar desde el chat. Para bloquear más sitios: `"sitiosBloqueados": ["sitio1.com", "sitio2.com"]` en `config.json`.

Ningún filtro es perfecto: para una compu que va a usar el público, conviene sumar también el control parental de Windows (Microsoft Family Safety) o un DNS con filtro como el de [Cloudflare para familias](https://one.one.one.one/family/) (1.1.1.3), que bloquea en todo el navegador, no solo en lo que abre Pixie.

## Voz

**Hablarle.** Decí **«Pixie, ¿estás?»** (ver [Llamarla con la voz](#llamarla-con-la-voz-pixie-estás)), tocá el micrófono de la barra o apretá **Ctrl+Alt+Espacio** desde cualquier app, decí lo que necesitás y quedate callado: Pixie entiende que terminaste, lo pasa a texto y lo hace. Necesita la IA de Gemini (o Groq). Si el micrófono no anda, revisá en Configuración de Windows → Privacidad → Micrófono que las apps de escritorio tengan permiso.

**Su voz.** De entrada usa la voz de Windows. Para que hable con una **voz natural con acento argentino**, decile «instalá la voz natural»: baja una sola vez unos 135 MB ([Piper](https://github.com/rhasspy/piper) con la voz [Daniela](https://huggingface.co/rhasspy/piper-voices), de Argentina) y desde ahí habla con esa voz, **en la compu, sin internet y sin límite**. Habla un poco más rápido o más lento según cómo está. «¿qué voz usás?» te dice cuál está usando y «usá la voz de Windows» vuelve a la de siempre.

También puede usar la voz de Gemini («usá la voz de Gemini»), pero el plan gratis da **solo 10 frases por día**; después vuelve sola a la de Windows.

**Auriculares Bluetooth.** Cuando una app usa el micrófono de unos auriculares Bluetooth, Windows los pasa a "manos libres" y todo el sonido queda como de llamada. Por eso, al escucharte, Pixie usa otro micrófono si hay (el de la notebook, por ejemplo).

**Se escucha aunque haya música.** Mientras habla, pausa lo que esté sonando (Spotify, YouTube, cualquier app que responda a las teclas multimedia) y después lo sigue. No lo hace si la frase es muy corta ni si le acabás de pedir música.

**Sonidos.** Hace bips de robotito según la emoción, y al arrancar aparece con un salto y abre los ojos. Los sonidos y la voz se apagan desde el pie de la barra.

| config.json | Qué hace |
|---|---|
| `vozNatural` | `true` (la natural de la compu si está instalada), `false` (siempre la de Windows) o `"gemini"` |
| `vozIA` | Solo para la voz de Gemini: cuál (por defecto `Leda`; otras: `Kore`, `Puck`, `Aoede`, `Zephyr`) |
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

La primera vez que abrís Pixie sin IA aparece la **bienvenida**, que te guía en un minuto. También está en **Ajustes → Inteligencia artificial**:

1. Tocá **Abrir AI Studio** y entrá con tu cuenta de Google. (No hace falta el *Playground* ni pagar nada: si te ofrece un plan pago, cerralo.)
2. Tocá **Create API key** y copiala con el botón de copiar.
3. Listo: Pixie encuentra la clave copiada, la prueba y la guarda **cifrada** en tu compu. Si preferís, la podés pegar en el campo de abajo.

El plan gratis de Gemini alcanza para unos 500 pedidos por día. En el plan gratis, Google puede usar lo que le mandás para mejorar sus productos: no le pases datos privados.

Las claves (la de la IA y la de WhatsApp) quedan cifradas con tu cuenta de Windows dentro de `config.json`, en la sección `"cifrado"`. Si pegás una clave a mano en `config.json` (`"claveIA": "AQ...."`), Pixie la cifra sola la próxima vez que lo lee. Una clave cifrada no se puede usar en otra compu: si restaurás el respaldo en una PC nueva, Pixie te la vuelve a pedir.

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

## Pixie para Chrome (YouTube, Gmail y Classroom)

Para que Pixie pueda darle like a un video, resumir un mail o leer tus Pendientes de Classroom, instalá su extensión. Viene adentro de Pixie: al arrancar, la copia a la carpeta `extension-chrome` de su carpeta de datos.

1. En Pixie: **Ajustes → Agenda → Classroom → Cómo instalar la extensión → Abrir la carpeta** (es `%APPDATA%\Pixie\extension-chrome`).
2. En Chrome, abrí `chrome://extensions` (en Edge, `edge://extensions`).
3. Activá el **Modo de desarrollador** (arriba a la derecha en Chrome, a la izquierda en Edge).
4. Tocá **Cargar extensión sin empaquetar** (o «Cargar desempaquetada») y elegí la carpeta `extension-chrome`.

Con Pixie abierto, la extensión se conecta sola (tarda hasta 30 segundos). Después probá con un video de YouTube abierto: «dale like» o «¿qué estoy viendo?». Para el mail, abrí uno en Gmail y decile «resumime este mail».

**Poner temas.** Con la extensión, «poné goteo de Duki» busca en tu pestaña de YouTube (o abre una), elige el primer video (sin Shorts ni anuncios), lo reproduce y se fija que esté sonando; si Chrome no lo deja arrancar solo, le da play. Sin la extensión, Pixie busca el video y lo abre directo en el navegador. El filtro de contenido vale también para lo que pidas y para el título del video.

**Cuando Pixie se actualiza**, la extensión nueva queda en la misma carpeta: en `chrome://extensions` tocá el botón de recargar de «Pixie para Chrome» (si está desactualizada, Pixie te lo dice). Si la habías instalado desde la carpeta `extension` del proyecto, quitala y cargá la de `extension-chrome`.

Sin IA, el resumen es simple (de quién es, el asunto y las primeras oraciones). Con IA es un resumen de verdad y le podés hacer preguntas sobre el mail o la página.

La extensión solo hace algo cuando se lo pide Pixie, y Pixie solo acepta conexiones de extensiones del navegador desde la misma compu (`127.0.0.1`, puerto 47631).

## La cara de Pixie

Se dibuja por código a partir del diseño original del ESP32, así que tiene muchas expresiones:

- **Solo:** pestañea, mira para los costados, sigue el mouse con la mirada y, si no lo usás por 2 minutos, se duerme (se despierta si acercás el mouse o lo llamás).
- **Mientras le escribís:** te mira; **mientras piensa**, pone «…».
- **Cuando responde:** mueve la boca y reacciona según lo que pasó: feliz, enamorado, guiño, confundido, enojado, triste, sorprendido, alarma o música.

## Cómo correrlo

Para usar Pixie alcanza con el instalador (ver [Instalar Pixie](#instalar-pixie)). Para programarla necesitás Windows 10 u 11, [Node.js 22.12 o más nuevo](https://nodejs.org) y Git.

```bash
npm install
npm run dev
```

Si tu Node es más viejo, `npm install` avisa y te dice cómo actualizarlo. `npm install` también descarga Electron (unos 100 MB). Si en algún momento aparece el error `Electron uninstall`, corré `npx install-electron` y después de nuevo `npm run dev`. En modo desarrollo las actualizaciones automáticas están apagadas.

Aparece la cara de Pixie abajo a la derecha y un ícono al lado del reloj de Windows. Apretá **Ctrl+Espacio** (o tocá el botón debajo de la cara, o el ícono) y escribile. La cara se puede arrastrar a cualquier lugar de la pantalla. Si hacés clic en otra ventana, Pixie no se calla: termina de pensar, escuchar o hablar, y 10 segundos después se achica dejando la respuesta en el globito. La **×** la achica sin callarla; **Esc** la cierra y la calla.

Otros comandos:

```bash
npm test          # prueba que Pixie entienda las frases
npm run build     # compila la app
npm run dist:win  # arma el instalador en dist/
```

### Publicar una versión nueva

GitHub Actions ([`.github/workflows/pixie.yml`](.github/workflows/pixie.yml)) corre las pruebas y arma el instalador en una compu con Windows con cada cambio en `main` (el instalador queda para bajar en la pestaña **Actions**). Para que les llegue a todos:

1. Subí el número de `"version"` en `package.json` (por ejemplo, de 0.6.0 a 0.6.1).
2. Subí el cambio a `main`.

GitHub Actions crea la etiqueta `v0.6.1`, publica la Release con el instalador y, en unas horas como mucho, cada Pixie instalada ofrece actualizarse. Si la versión no cambió, no publica nada: así un arreglo a medias no le llega a nadie.

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
    safety.js      ← el filtro de contenido (adultos, gore, ilegal)
    youtube-search.js ← encuentra el video para «poné tal tema» sin la extensión
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
    window.js      ← la ventana flotante (se vuelve a cargar sola si se cuelga)
    tray.js        ← el menú de Pixie (el ícono al lado del reloj y la ventanita usan el mismo)
    wake-store.js  ← guarda la huella de tu voz para «Pixie, ¿estás?»
    calendars.js   ← lee Google Calendar y Classroom (formato iCal) y los suma a la agenda
    news.js        ← los titulares de Infobae y TN (RSS)
    classroom.js   ← las tareas de Classroom que lee la extensión (y sus fechas de entrega)
    extension-files.js ← copia la extensión de Chrome a la carpeta de datos de Pixie
    hands.js       ← las «manos» en Windows: escribir, teclas, clics y botones (UI Automation)
    control.js     ← entiende atajos dichos con palabras y elige el botón que nombraste
    updates.js     ← las actualizaciones automáticas desde las Releases de GitHub
    diagnostics.js ← anota los errores y arma el informe (sin claves)
    secrets.js     ← cifra las claves de config.json con la cuenta de Windows
    settings.js    ← lo que muestra y cambia la ventana de Ajustes (y la bienvenida)
    settings-window.js ← la ventana de Ajustes
    shortcut.js    ← entiende atajos («control alt p» → Control+Alt+P)
  preload/         ← el puente seguro entre la interfaz y las acciones
  renderer/        ← la interfaz en React: la barra para escribir, la cara (src/face/, con la pantalla de reposo en standby.js),
                     el Pong (src/games/), la ventana de Ajustes y la bienvenida (src/settings/) y
                     «Pixie, ¿estás?» (wake.js reconoce la frase, wake-listener.js escucha el micrófono)
extension/         ← la extensión «Pixie para Chrome» (YouTube, Gmail y páginas)
test/              ← pruebas de las frases, fechas, memoria, iniciativa, la cara, el Pong, la IA y más
scripts/           ← control de la versión de Node antes de npm install
.github/workflows/ ← pruebas, instalador y Releases en GitHub Actions
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

Lo nuevo de la versión 0.10.2 (más rápida al hablarle; acá se probó con respuestas de mentira de Gemini, falta con la de verdad):

- **Tiempo de respuesta:** llamarla y pedirle cosas cortas («poneme música tranqui», «subí el volumen», «anotame estudiar química») y cosas de charla. Tiene que contestar bastante antes que en la 0.10.1. Si algo tarda más de 3 segundos queda anotado en `historial.txt` como «lento: …» (dice si fue entender tu voz o pensar la respuesta): pasanos esas líneas.
- **Pedidos de varios pasos:** «escribí hola en el Bloc de notas» tiene que abrirlo **y** escribir (Pixie contesta enseguida y, si faltaba algo, lo hace y te avisa).

Lo nuevo de la versión 0.10 (las «manos» no se pueden probar fuera de Windows: acá se compiló el código y se probó todo lo demás):

- **Usar apps:** en el Bloc de notas o Word, «escribí: Hola, ¿cómo andás?»; «guardá»; «poné en negrita». En Chrome: «nueva pestaña», «bajá la página», «tocá el botón …». Probalo hablándole y también escribiéndole en su ventanita (tiene que volver a la app de antes).
- **«Pixie, ¿estás?»:** que te reconozca más veces, que no corte mientras hablás bajito o con pausas, y que entienda mejor las palabras. En `historial.txt` quedan las veces que te escuchó «casi» (con la distancia), útil para ajustar.

Lo nuevo de la versión 0.9 (acá se probó con un calendario de ejemplo; a Google, Infobae y TN no se pudo llegar desde el entorno de prueba):

- **Agenda:** sumar tu Google Calendar con la dirección secreta, preguntar «¿qué tengo esta semana?» y «¿qué tengo que entregar?», y ver que avise 15 minutos antes de algo.
- **Classroom (0.9.1):** instalar la extensión desde `extension-chrome`, tocar **Leer ahora** y comparar con tus Pendientes. Acá se probó con una página de ejemplo: si con el Classroom de verdad faltan tareas o salen mal, pasanos el `classroom.json` de la carpeta de Pixie (tiene lo que leyó).
- **Noticias:** «¿qué noticias hay?», «noticias de TN», «más noticias» y «abrí la primera». En Ajustes → Noticias, **Ver los titulares**. Si Infobae o TN no aparecen, pasanos el informe de diagnóstico.

Lo nuevo de la versión 0.8 (acá se probó con un micrófono simulado y voz sintética; falta con tu voz de verdad):

- **«Pixie, ¿estás?»:** grabar tu voz en Ajustes → Voz, tocar **Probar ahora** y llamarla varias veces. Contanos cuántas veces te reconoce y si se despierta sola con la tele, música o gente hablando (y con qué sensibilidad).
- **Charla por voz:** llamarla, pedirle algo y, cuando conteste, pedirle otra cosa sin volver a llamarla. Quedarte callado y ver que vuelva a esperar.
- **Menú:** clic derecho en la cara y el botón ⋯: que aparezca el menú y que **Cerrar Pixie** la cierre.
- **Instalación nueva:** en otra compu (o borrando `%APPDATA%\Pixie`), que arranque sin clave y la bienvenida explique paso a paso cómo sacarla.
- **Pantalla y chats:** con WhatsApp abierto, «¿qué ves en mi pantalla?» tiene que preguntar antes de mirar.

Lo nuevo de la versión 0.7:

- **Bienvenida:** con una instalación nueva (o sin clave), que aparezca, que «Abrir AI Studio» abra el navegador y que, al copiar la clave, Pixie la encuentre sola y diga «¡Funciona!».
- **Ajustes:** abrirlos desde el ícono, cambiar el nombre, la ciudad, el atajo (apretando las teclas) y las casillas, y ver que se guarden.
- **Pantalla de reposo:** elegir «Reloj» y «Resumen» en Personalización y ver que la cara vuelva cuando le hablás.
- **Clave cifrada:** abrir `config.json` y ver que la clave no esté a la vista (está en `"cifrado"`), y que Pixie siga contestando con IA.

De la versión 0.6 (el instalador se arma solo en GitHub; lo que falta es probarlo en una PC):

- **Instalador:** que instale, que la cara aparezca y que el ícono muestre «Pixie 0.6.0».
- **Arrancar con Windows:** reiniciar la compu y ver que Pixie abra sola. Destildar «Iniciar con Windows» y ver que deje de hacerlo.
- **Actualizaciones:** con la 0.6.0 instalada, cuando se publique la 0.6.1 tiene que aparecer el aviso con el botón **actualizar** (o ícono → **Buscar actualizaciones**) y volver con la versión nueva.
- **Informe:** «copiame el informe» y pegarlo en el bloc de notas: que tenga la versión y no tenga claves.

De la versión 0.5. Probado acá con Gemini de verdad: pasar la voz a texto y mirar una captura de pantalla. Falta probar en una PC con Windows:

- **Micrófono:** que pida permiso y te escuche (el botón del micrófono y Ctrl+Alt+Espacio).
- **Voz natural:** «instalá la voz natural», esperar el aviso de que terminó y escuchar cómo habla.
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

- Charla fluida por voz, sin esperar a que termine cada frase.
- Plugins para que cualquiera le sume herramientas.
- Cambiar el fondo de pantalla según el clima o el ánimo.
- Más juegos en la cara de Pixie.

## Equipo

Sofia Power · Thomas Barrera Fuentes · Mauro Joel Beltrán · Lautaro Gabriel Palombo
