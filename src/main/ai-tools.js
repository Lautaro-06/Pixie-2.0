// Las acciones de Pixie que la IA puede usar, con la forma de sus datos.
// El orden es fijo para que el pedido sea siempre igual (y se aproveche el caché).

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
    description: 'Sube, baja o silencia el volumen de la compu. Cada paso es 2%.',
    input_schema: obj({ cambio: oneOf(['subir', 'bajar', 'silenciar']), pasos: int('Cantidad de pasos', 1, 50) }, ['cambio'])
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
    name: 'leer_pagina',
    description: 'Lee el mail abierto en Gmail o el texto de la página abierta en Chrome, para resumirlo o responder preguntas sobre eso.',
    input_schema: obj({ que: oneOf(['mail', 'pagina']) }, ['que'])
  }
]

export const AI_TOOL_NAMES = new Set(AI_TOOLS.map((t) => t.name))
