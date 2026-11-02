// Las acciones de Pixie que la IA puede usar, con la forma de sus datos.
// El orden es fijo para que el pedido sea siempre igual (y se aproveche el caché).
import { SHORTCUT_NAMES } from './control.js'

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false })
const str = (description) => ({ type: 'string', description })
const int = (description, minimum, maximum) => ({ type: 'integer', description, minimum, maximum })
const oneOf = (values, description) => ({ type: 'string', enum: values, description })

export const AI_TOOLS = [
  {
    name: 'abrir',
    description: 'Abre una app, un sitio web o una carpeta de la compu (por ejemplo "YouTube", "Spotify", "descargas", "github.com").',
    input_schema: obj({ objetivo: str('Nombre de la app, sitio, carpeta o dirección web') }, ['objetivo'])
  },
  {
    name: 'cerrar_app',
    description: 'Cierra una app abierta. Pide confirmación al usuario antes.',
    input_schema: obj({ objetivo: str('Nombre de la app') }, ['objetivo'])
  },
  {
    name: 'buscar',
    description: 'Busca algo en Google, en YouTube o en Google Maps y lo abre en el navegador.',
    input_schema: obj({ sitio: oneOf(['google', 'youtube', 'maps']), consulta: str('Qué buscar') }, ['sitio', 'consulta'])
  },
  {
    name: 'volumen',
    description: 'Sube, baja o silencia el volumen de la compu (cada paso es 2%), o lo pone en un porcentaje.',
    input_schema: obj({ cambio: oneOf(['subir', 'bajar', 'silenciar', 'poner']), pasos: int('Cantidad de pasos', 1, 50), valor: int('Para poner: el porcentaje', 0, 100) }, ['cambio'])
  },
  {
    name: 'musica',
    description: 'Controla la música o el video que esté sonando: pausa/play, siguiente o anterior.',
    input_schema: obj({ control: oneOf(['pausa', 'siguiente', 'anterior']) }, ['control'])
  },
  {
    name: 'crear_timer',
    description: 'Pone un timer o recordatorio corto que suena cuando termina. Para Pomodoro usá 1500 segundos y etiqueta "Pomodoro".',
    input_schema: obj({ segundos: int('Duración en segundos', 1, 86400), etiqueta: str('Qué recordar al terminar (opcional)') }, ['segundos'])
  },
  { name: 'ver_timers', description: 'Dice cuánto falta en los timers activos.', input_schema: obj() },
  { name: 'cancelar_timers', description: 'Cancela todos los timers.', input_schema: obj() },
  {
    name: 'clima',
    description: 'Consulta el clima actual y el pronóstico de hoy (de la ciudad del usuario o de otra).',
    input_schema: obj({ ciudad: str('Ciudad, si no es la del usuario') })
  },
  {
    name: 'agendar',
    description: 'Guarda en la agenda algo que pasa en un día (y hora) concretos. Pixie avisa antes automáticamente.',
    input_schema: obj(
      {
        texto: str('Qué es, corto: "prueba de historia", "dentista"'),
        cuando: str('Fecha y hora local en formato AAAA-MM-DDTHH:MM (si no hay hora, usá T00:00)'),
        conHora: { type: 'boolean', description: 'true si tiene hora concreta' }
      },
      ['texto', 'cuando', 'conHora']
    )
  },
  {
    name: 'ver_agenda',
    description: 'Lista lo agendado para los próximos días.',
    input_schema: obj({ dias: int('Cuántos días mirar', 1, 60) })
  },
  { name: 'agregar_pendiente', description: 'Anota una tarea pendiente sin fecha.', input_schema: obj({ texto: str('La tarea') }, ['texto']) },
  {
    name: 'completar_pendiente',
    description: 'Tacha un pendiente, por texto parecido o por número de la lista.',
    input_schema: obj({ buscar: str('Texto parecido al pendiente'), numero: int('Número en la lista', 1, 99) })
  },
  {
    name: 'recordar_dato',
    description: 'Guarda algo que el usuario contó sobre sí mismo o su vida (gustos, familia, planes, cómo le fue). Escribilo en primera persona del usuario: "mi perro se llama Toby".',
    input_schema: obj({ texto: str('El dato') }, ['texto'])
  },
  {
    name: 'olvidar',
    description: 'Borra de la memoria un dato, pendiente o evento de la agenda.',
    input_schema: obj({ buscar: str('Texto parecido a lo que hay que borrar') }, ['buscar'])
  },
  {
    name: 'uso_hoy',
    description: 'Cuenta cuánto usó la compu hoy, en total o en una app o tipo de actividad.',
    input_schema: obj({ buscar: str('App o actividad, por ejemplo "youtube" o "videos" (opcional)') })
  },
  { name: 'estado_pc', description: 'Uso de CPU y memoria de la compu.', input_schema: obj() },
  { name: 'captura', description: 'Abre el recorte de pantalla de Windows.', input_schema: obj() },
  { name: 'bloquear_pc', description: 'Bloquea la compu. Pide confirmación al usuario antes.', input_schema: obj() },
  {
    name: 'apagar_pc',
    description: 'Apaga o reinicia la compu en 30 segundos. Pide confirmación al usuario antes.',
    input_schema: obj({ modo: oneOf(['apagar', 'reiniciar']) }, ['modo'])
  },
  {
    name: 'no_molestar',
    description: 'Pixie deja de hablar y de dar avisos por un rato.',
    input_schema: obj({ minutos: int('Minutos', 1, 480) }, ['minutos'])
  },
  { name: 'jugar', description: 'Empieza un partido de Pong contra Pixie (su cara se vuelve el juego).', input_schema: obj() },
  {
    name: 'reproducir',
    description: 'Busca y reproduce enseguida un tema, artista o video en YouTube (por ejemplo "goteo de duki"). Usala cuando pidan poner o escuchar algo.',
    input_schema: obj({ consulta: str('Qué poner: tema, artista o video') }, ['consulta'])
  },
  {
    name: 'youtube_click',
    description: 'Pone el video número N de la lista de YouTube que el usuario tiene abierta (búsqueda, inicio o sugeridos).',
    input_schema: obj({ n: int('Número del video en la lista, empezando en 1', 1, 10) }, ['n'])
  },
  {
    name: 'youtube',
    description: 'Interactúa con el video de YouTube que está abierto en Chrome: like, dislike, suscribirse, saltar anuncio, subtítulos, velocidad, adelantar o atrasar segundos, siguiente video, o saber qué se está viendo.',
    input_schema: obj(
      {
        accion: oneOf(['like', 'dislike', 'suscribir', 'saltar_anuncio', 'subtitulos', 'velocidad', 'mas_rapido', 'mas_lento', 'adelantar', 'atrasar', 'siguiente', 'pausa', 'que_veo']),
        valor: { type: 'number', description: 'Para velocidad (0.25 a 3) o segundos para adelantar/atrasar' }
      },
      ['accion']
    )
  },
  {
    name: 'registrar_agua',
    description: 'Anota que el usuario tomó agua (para su registro de salud).',
    input_schema: obj({ vasos: int('Cuántos vasos (por defecto 1)', 1, 10) })
  },
  { name: 'registrar_pausa', description: 'Anota que el usuario hizo una pausa para estirarse.', input_schema: obj() },
  { name: 'ver_salud', description: 'Cuánta agua tomó y cuántas pausas hizo hoy el usuario.', input_schema: obj() },
  { name: 'respaldar', description: 'Guarda una copia de la memoria de Pixie en la nube (OneDrive) o en la compu.', input_schema: obj() },
  {
    name: 'brillo',
    description: 'Cambia el brillo de la pantalla: subir o bajar un poco, poner un valor (0-100) o ver cuánto está.',
    input_schema: obj({ cambio: oneOf(['subir', 'bajar', 'poner', 'ver']), valor: int('Para poner: el porcentaje', 0, 100) }, ['cambio'])
  },
  {
    name: 'bluetooth',
    description: 'Prende o apaga el Bluetooth, o abre su configuración.',
    input_schema: obj({ estado: oneOf(['prender', 'apagar', 'abrir']) }, ['estado'])
  },
  {
    name: 'whatsapp',
    description: 'Le manda un WhatsApp al celular del usuario (solo a su propio número). Para mandarle sus pendientes o su agenda, poné "pendientes" o "agenda" como texto.',
    input_schema: obj({ texto: str('El mensaje') }, ['texto'])
  },
  {
    name: 'voz',
    description: 'La voz de Pixie: decir cuál usa, instalar la voz natural (argentina, sin internet), o cambiar a la de Windows o a la de Gemini.',
    input_schema: obj({ accion: oneOf(['estado', 'instalar', 'natural', 'windows', 'gemini']) }, ['accion'])
  },
  { name: 'que_suena', description: 'Dice qué canción o video está sonando en la compu (Spotify, YouTube, etc.).', input_schema: obj() },
  {
    name: 'ver_pantalla',
    description: 'Saca una foto de la pantalla del usuario y la analiza para ayudarlo (errores, ejercicios, lo que esté viendo). Usala solo cuando pida ayuda con lo que está viendo ("esto", "acá", "mirá mi pantalla"), nunca para revisar sus chats o cuentas. Si tiene una app de chat adelante, Pixie le pregunta antes.',
    input_schema: obj({ pregunta: str('Qué quiere saber el usuario sobre su pantalla') }, ['pregunta'])
  },
  {
    name: 'noticias',
    description: 'Lee los últimos titulares de Infobae y TN (o de uno), opcionalmente filtrados por un tema ("dólar", "River"). Usala para preguntas de actualidad. mas: true sigue con los siguientes.',
    input_schema: obj({ fuente: oneOf(['infobae', 'tn'], 'Solo de este diario'), tema: str('Palabra para filtrar, por ejemplo "dólar"'), mas: { type: 'boolean', description: 'Seguir con las siguientes' } })
  },
  {
    name: 'abrir_noticia',
    description: 'Abre en el navegador una de las noticias que se acaban de leer (n = 1 es la primera)',
    input_schema: obj({ n: int('Cuál de las noticias leídas', 1, 3) }, ['n'])
  },
  {
    name: 'escribir',
    description: 'Escribe un texto donde está el cursor, en la app que el usuario tiene adelante (un documento, un chat, un buscador). Los saltos de línea se escriben como Enter.',
    input_schema: obj({ texto: str('El texto exacto a escribir') }, ['texto'])
  },
  {
    name: 'teclas',
    description: 'Aprieta una tecla o un atajo en la app de adelante, por ejemplo "enter", "ctrl+s", "alt+tab", "flecha abajo", "f5".',
    input_schema: obj({ teclas: str('La tecla o el atajo'), veces: int('Cuántas veces (1 si no se dice)', 1, 20) }, ['teclas'])
  },
  {
    name: 'atajo',
    description: 'Hace algo común en la app de adelante sin saber el atajo (en Word en castellano los atajos cambian: esto lo resuelve).',
    input_schema: obj({ accion: oneOf(SHORTCUT_NAMES) }, ['accion'])
  },
  {
    name: 'clic',
    description: 'Toca un botón, menú, pestaña, link, opción o campo de la app de adelante por su nombre (lo que dice). Si no sabés cómo se llama, usá ver_elementos primero.',
    input_schema: obj({ objetivo: str('Lo que dice el botón o el elemento, por ejemplo "Enviar" o "Nuevo documento"') }, ['objetivo'])
  },
  {
    name: 'desplazar',
    description: 'Mueve la página o la lista de la app de adelante para arriba o para abajo.',
    input_schema: obj({ direccion: oneOf(['arriba', 'abajo']), cantidad: int('Cuánto (1 a 30, 5 si no se dice)', 1, 30) }, ['direccion'])
  },
  {
    name: 'ventana',
    description: 'Maximiza, minimiza o restaura la ventana de adelante, la pone a un costado, o la cierra (pide confirmación).',
    input_schema: obj({ accion: oneOf(['maximizar', 'minimizar', 'restaurar', 'izquierda', 'derecha', 'cerrar']) }, ['accion'])
  },
  {
    name: 'ir_a',
    description: 'Trae al frente una app que ya está abierta (si no está abierta, la abre). Usala antes de escribir o tocar algo en otra app.',
    input_schema: obj({ app: str('El nombre de la app, por ejemplo "Word" o "WhatsApp"') }, ['app'])
  },
  {
    name: 'ver_elementos',
    description: 'Lista los botones, menús y opciones con nombre que se pueden tocar en la ventana de adelante.',
    input_schema: obj()
  },
  {
    name: 'classroom',
    description: 'Lee los Pendientes de Classroom del usuario (tareas asignadas, materia y fecha de entrega). Usala si pregunta por sus tareas o entregas de Classroom.',
    input_schema: obj()
  },
  {
    name: 'conectar_calendario',
    description: 'Abre la sección para sumar el Google Calendar del usuario a la agenda de Pixie y explica cómo (Classroom va con la herramienta classroom)',
    input_schema: obj()
  },
  {
    name: 'leer_pagina',
    description: 'Lee el mail abierto en Gmail o el texto de la página abierta en Chrome, para resumirlo o responder preguntas sobre eso.',
    input_schema: obj({ que: oneOf(['mail', 'pagina']) }, ['que'])
  },
  {
    name: 'cambiar_atajo',
    description: 'Dice o cambia el atajo de teclado para llamar a Pixie. Sin atajo, dice cuál usa.',
    input_schema: obj({ atajo: str('El atajo nuevo, por ejemplo "Ctrl+Alt+P". Tiene que llevar Ctrl o Alt.') })
  },
  {
    name: 'actualizar',
    description: 'Busca una versión nueva de Pixie y, si ya está bajada, la instala y reinicia. Usala solo si el usuario pide actualizar.',
    input_schema: obj()
  }
]

export const AI_TOOL_NAMES = new Set(AI_TOOLS.map((t) => t.name))
