// Qué hay de nuevo en cada versión. Cuando Pixie se actualiza, lo cuenta ella misma la primera vez que
// arranca con la versión nueva («¿qué hay de nuevo?» lo repite con más detalle).
// Al publicar una versión nueva, sumala ACÁ ARRIBA (la más nueva primero).
//   corto: cómo lo dice Pixie en una frase («te aviso de los mails nuevos»)
//   detalle: lo que se lee en «¿qué hay de nuevo?» y en Ajustes → Actualizaciones

export const CHANGELOG = [
  {
    version: '0.16.3',
    nuevo: [],
    mejoras: [
      {
        corto: '«Pixie, ¿estás?» te escucha aunque tu micrófono llegue bajito',
        detalle:
          '«Pixie, ¿estás?» te escucha aunque tu micrófono llegue bajito (por ejemplo, el de unos auriculares): antes descartaba la frase sin compararla. Y si grabaste tu voz con otro micrófono, te aviso para que la grabes de nuevo con el que usás ahora.'
      },
      {
        corto: 'si la IA tarda, le pregunto también al otro modelo',
        detalle: 'Si la IA tarda más de 5 segundos (pasa cuando Google tiene mucha demanda), le pregunto también al otro modelo y me quedo con la primera respuesta.'
      },
      {
        corto: 'si Classroom no se deja leer de fondo, lo abro un momento',
        detalle: 'Si Classroom no se deja leer de fondo, cuando me lo pedís lo abro un momento en Chrome, lo leo y vuelvo a donde estabas. Mi extensión se actualiza sola, y si no la puedo leer, el informe dice qué vi en la página.'
      },
      { corto: 'entiendo «pasame el informe» y «qué tiene tu última versión»', detalle: 'Entiendo «pasame el informe» y «¿qué tiene tu última versión?» al instante, sin pasar por la IA.' }
    ]
  },
  {
    version: '0.16.2',
    nuevo: [],
    mejoras: [
      {
        corto: 'tu número de WhatsApp queda cifrado y solo en tu compu, y nunca se muestra entero',
        detalle:
          'Tu número de WhatsApp queda cifrado con tu cuenta de Windows y solo en esta compu: no viaja con Pixie ni con el respaldo, y en Ajustes nunca se muestra entero (solo cómo termina). Si en esta compu había un número de antes, lo borré: si es el tuyo, ponelo de nuevo en Ajustes → WhatsApp (es un minuto). También hay un botón para borrarlo.'
      }
    ]
  },
  {
    version: '0.16.1',
    nuevo: [],
    mejoras: [
      {
        corto: 'hago tus pedidos al instante, sin esperar a la IA',
        detalle: 'Hago tus pedidos al instante aunque la frase sea larga («recordame mañana a las 8 que tengo que llevar el TP», «poné un timer de 10 minutos para los fideos»): la IA queda para charlar y para lo que no entiendo sola.'
      },
      {
        corto: 'si la IA está saturada, igual hago lo que me pediste',
        detalle: 'Si la IA de Google está saturada (el error 503), pruebo con otro modelo y otra vez un segundo después; y si sigue sin andar, hago igual lo que entendí. Ya no te muestro códigos de error.'
      },
      {
        corto: 'Classroom contesta enseguida y busca en todas tus cuentas',
        detalle: 'Classroom contesta enseguida con lo último que leí (y lo vuelvo a leer de fondo), y lo busco en todas tus cuentas de Google, no solo en la primera. Para eso hay que recargar una vez mi extensión en chrome://extensions; de ahora en más se actualiza sola.'
      },
      { corto: '«agendalo en el calendar» lo anoto en mi agenda', detalle: '«Agendá en el calendar que el viernes tengo prueba» lo anoto en mi agenda y te aviso yo (a tu Google Calendar no puedo escribir, solo lo leo).' }
    ]
  },
  {
    version: '0.16.0',
    nuevo: [
      {
        corto: 'me acuerdo de todo lo que hablamos, aunque me cierres o me actualice',
        detalle:
          'Me acuerdo de todo lo que hablamos, aunque me cierres, se apague la compu o me actualice: queda guardado solo en tu compu. Preguntame «¿de qué hablamos ayer?», «¿qué te conté del viaje?» o «¿qué sabés de mí?». Lo personal (tu salud, tu familia, tu pareja, la plata, tus creencias) me lo acuerdo pero no lo saco yo: solo hablo de eso si vos lo traés. Las contraseñas, tarjetas y claves no las guardo nunca. Lo ves y lo borrás en Ajustes → Memoria y privacidad.'
      },
      {
        corto: 'si me actualizo en medio de algo, sigo donde estaba',
        detalle: 'Si me actualizo o me reinicio en medio de algo, sigo donde estaba: el Pomodoro sigue en el mismo bloque, los timers siguen andando (y si alguno se cumplió mientras tanto, te aviso enseguida) y la charla sigue donde la dejamos.'
      },
      {
        corto: 'te mando los recordatorios y los timers por WhatsApp apenas se cumplen',
        detalle: 'Te mando por WhatsApp los recordatorios de tu agenda y los timers apenas se cumplen. Cada uno lo activa con su número en Ajustes → WhatsApp, en 3 pasos y gratis, y elige si le escribo siempre o solo cuando no está en la compu.'
      }
    ],
    mejoras: [
      { corto: 'leo los textos largos enteros, sin cortarme a la mitad', detalle: 'Leo los textos largos enteros, con cualquier voz: la natural, la de Gemini o la de Windows. Antes me cortaba a la mitad.' },
      { corto: 'los Ajustes están ordenados y arrancan con un resumen de cómo está todo', detalle: 'Los Ajustes están ordenados en grupos (Pixie, Estudio, Conexiones y Sistema) y arrancan en Inicio, que te muestra de un vistazo qué está listo y qué falta configurar.' },
      { corto: '«recordame mañana a las 8 que tengo…» ya se guarda bien', detalle: '«Recordame mañana a las 8 que tengo que llevar el TP» ahora se guarda como recordatorio (antes a veces lo tomaba como una pregunta y no lo anotaba).' },
      { corto: 'ya no uso emojis', detalle: 'Ya no uso emojis: ni en lo que digo, ni en mis avisos, ni en Ajustes.' },
      { corto: 'los colectivos los buscás en Google Maps', detalle: 'Saqué lo de dónde viene el colectivo en vivo (necesitaba una clave de la Ciudad que no se podía conseguir). «¿Dónde para el 152?» te abre las paradas en Google Maps, y «¿cómo llego a…?» te arma el recorrido.' }
    ]
  },
  {
    version: '0.15.0',
    nuevo: [
      {
        corto: 'te cuento cuánto estudiaste al terminar: los ciclos, tu racha de días seguidos y la adherencia',
        detalle:
          'Al terminar un Pomodoro te cuento cuánto estudiaste hoy («Hoy hiciste 4 ciclos, 1 hora y 40 de estudio»), cuántos días seguidos llevás, tu adherencia (de lo que planeaste, cuánto estudiaste sin distraerte) y los temas que vimos. Preguntame «¿cuánto estudié esta semana?» o «¿cuál es mi racha?».'
      },
      {
        corto: 'tenés tu seguimiento de estudio en Ajustes → Mi estudio',
        detalle: 'En Ajustes → Mi estudio tenés tu seguimiento, como un habit tracker: la semana día por día (progreso, ciclos, adherencia y estado), el mes por materia y tu racha.'
      },
      {
        corto: 'soltás tu temario y voy tachando los temas que estudiás',
        detalle: 'Soltá la lista de temas en Ajustes → Mi estudio (o decime «los temas son: …») y, mientras estudiás, voy tachando los que veo en lo que tenés abierto. Al final te digo cuáles faltan.'
      },
      {
        corto: 'te recomiendo el método según lo que vas a estudiar',
        detalle: 'Te recomiendo el método según lo que vas a hacer: para memorizar, repaso activo y repetición espaciada; para ejercicios o programación, bloques largos; para leer teoría, resumen propio y técnica Feynman. Si no sé qué vas a estudiar, te pregunto.'
      },
      { corto: 'si dejás el mouse encima mío, me corro', detalle: 'Si dejás el mouse encima mío, me corro para no taparte un botón (se apaga en Ajustes → Vos y Pixie). Para llamarme, usá el atajo.' }
    ],
    mejoras: [
      { corto: 'sé mejor qué te distrae: la música no, un video de una clase tampoco', detalle: 'Sé mejor qué te distrae en un bloque: la música no; un video de YouTube de una clase tampoco; las redes, el streaming, los juegos y las compras sí; un chat, si te quedás más de 3 minutos.' },
      { corto: 'podés saltar el descanso o terminar por hoy desde el aviso o mi menú', detalle: '«Saltar el descanso» y «Terminar por hoy» están en mis avisos, en mi menú (clic derecho) y en Ajustes.' }
    ]
  },
  {
    version: '0.14.0',
    nuevo: [
      {
        corto: 'tengo modo Pomodoro para estudiar: armo el plan con el tiempo que tenés y no te molesto mientras estudiás',
        detalle:
          'Tengo modo Pomodoro para estudiar: decime «quiero estudiar química 2 horas» (o armalo en Ajustes → Pomodoro) y te armo los bloques con sus descansos y cómo conviene estudiar esa materia. Mientras estudiás no te paso avisos (te los cuento en el descanso: preguntame «¿qué me perdí?»), te aviso si te vas a Instagram o a un juego, y en los últimos 2 minutos de cada bloque te ofrezco un mini test de repaso. En el descanso me pongo anteojos de sol, tomo unos mates y suena un sonido de victoria.'
      },
      { corto: 'el Pomodoro y los timers se ven en mi pantallita y los pausás tocándola', detalle: 'El Pomodoro se ve en mi pantallita como bloques en fila (rojos para estudiar, verdes para descansar): el de ahora se va llenando y los que terminaste quedan con una tilde. Los timers se ven con el tiempo grande y una barrita. Tocala para pausarlos o seguir.' },
      { corto: 'si me contás que tenés que estudiar, te ofrezco un Pomodoro', detalle: 'Si me contás que tenés que estudiar o que tenés una prueba, te ofrezco armar un Pomodoro (lo podés apagar en Ajustes → Pomodoro).' }
    ],
    mejoras: [
      { corto: 'el Pomodoro ya no es un timer fijo de 25 minutos', detalle: 'El Pomodoro ya no es un timer fijo de 25 minutos: tiene bloques, descansos (y uno largo cada tanto), se pausa, se puede saltar el descanso y, con IA, te doy consejos a medida para cada bloque.' }
    ]
  },
  {
    version: '0.13.0',
    nuevo: [
      { corto: 'me disfrazo según lo que hacés: anteojos 3D y pochoclos si mirás algo, auriculares si escuchás música y más', detalle: 'Me disfrazo según lo que estás haciendo: anteojos 3D y pochoclos si mirás YouTube, Netflix, Cuevana, Kick, Twitch o Instagram; anteojos y la compu si trabajás en Word, PowerPoint o VS Code; auriculares si escuchás música; un joystick si jugás; un libro si leés; el celu si chateás, y boina y pincel si dibujás.' },
      { corto: 'te digo cómo llegar a cualquier lado y dónde viene el colectivo', detalle: '«¿Cómo llego al Obelisco?» te abre el recorrido en Google Maps y te dice cuánto tardás desde tu casa. «¿Dónde viene el 60?» te dice dónde está el colectivo más cerca (con una clave gratis de la Ciudad, en Ajustes → Mapas y colectivos).' },
      { corto: 'elegís qué apps de tu compu puedo abrir y usar', detalle: 'En Ajustes → Apps elegís qué apps de tu compu puedo abrir y cuáles puedo usar. Y ahora abro cualquier app instalada, no solo las que conocía.' }
    ],
    mejoras: [
      { corto: 'me muevo más fluido y tengo gestos nuevos', detalle: 'Me muevo más fluido (sin saltos, a 60 cuadros por segundo y con el brillo de los LEDs) y tengo gestos nuevos: ojos de estrella, mareada, me estiro, estornudo, asiento y bailo.' },
      { corto: '«Pixie, ¿estás?» ya no se queda sorda si no tocás el teclado', detalle: '«Pixie, ¿estás?» ya no deja de escucharte cuando pasás un rato sin tocar el teclado (mirando un video o desde la cama), ni si cerraste Ajustes a mitad de una prueba, ni si la voz de Windows se trababa.' },
      { corto: 'si algo necesita Chrome, lo abro yo', detalle: 'Si algo necesita Chrome y está cerrado, lo abro y después hago lo que me pediste (sin decirte que está cerrado).' }
    ]
  },
  {
    version: '0.12.0',
    nuevo: [
      { corto: 'te cuento qué hay de nuevo cada vez que me actualizo', detalle: 'Cada vez que me actualizo te cuento qué hay de nuevo y qué mejoré. Preguntame «¿qué hay de nuevo?» cuando quieras.' },
      { corto: 'me acuerdo de cuándo me contaste cada cosa', detalle: 'Me acuerdo de cuándo me contaste cada cosa: si hace un mes me dijiste «mañana tengo prueba», ya sé que eso pasó. Y si me contás algo nuevo («mi perro se llama Rocky»), reemplazo lo viejo.' },
      { corto: 'te pregunto por los pendientes viejos', detalle: 'Si tenés un pendiente anotado hace semanas, de vez en cuando te pregunto si sigue o si lo borro.' },
      { corto: 'te aviso si mañana entregás algo y estás jugando', detalle: 'Si a la noche estás jugando o mirando videos y al otro día tenés una entrega o una prueba, te lo recuerdo una vez.' }
    ],
    mejoras: [
      { corto: '«Pixie, ¿estás?» ya no deja de andar después de actualizarme', detalle: '«Pixie, ¿estás?» se da cuenta si el micrófono se quedó mudo (al actualizarme, al volver de suspender la compu o al cambiar de micrófono) y lo vuelve a abrir solo.' },
      { corto: 'aprendo qué avisos te sirven', detalle: 'Si no me das bola a un tipo de aviso (el agua, las pausas, las charlas o las noticias), te lo digo menos seguido.' },
      { corto: 'cuando volvés te cuento lo que viene', detalle: 'Cuando volvés a la compu te cuento lo próximo de tu agenda de hoy y si tenés mails sin leer.' }
    ]
  },
  {
    version: '0.11.0',
    nuevo: [
      { corto: 'te aviso de los mails nuevos de Gmail', detalle: 'Te cuento tus mails sin leer de Gmail («¿tengo mails?»), te leo uno («leémelo») y, si me lo pedís, te aviso cuando llega uno. Con mi extensión de Chrome.' }
    ],
    mejoras: []
  },
  {
    version: '0.10.2',
    nuevo: [],
    mejoras: [
      { corto: 'contesto más rápido cuando me hablás', detalle: 'Contesto más rápido cuando me hablás: pienso menos para lo simple, no espero otra vuelta de la IA y mi voz se va cargando mientras te entiendo.' }
    ]
  },
  {
    version: '0.10.1',
    nuevo: [],
    mejoras: [{ corto: 'si falla el modelo de voz, te entiendo igual', detalle: 'Si falla el modelo de IA que pasa tu voz a texto, uso el de siempre: ya no te digo «¿Hay internet?» de más.' }]
  },
  {
    version: '0.10.0',
    nuevo: [
      { corto: 'uso tus apps: escribo, aprieto botones y atajos', detalle: 'Uso tus apps, no solo las abro: escribo, aprieto atajos («guardá», «negrita»), toco botones, bajo la página y cambio de ventana.' }
    ],
    mejoras: [{ corto: 'te escucho mejor', detalle: '«Pixie, ¿estás?» te reconoce más veces y aprende de cómo la llamás; no te corto mientras hablás y entiendo mejor las palabras.' }]
  },
  {
    version: '0.9.1',
    nuevo: [{ corto: 'leo tus tareas de Classroom', detalle: 'Leo tus Pendientes de Classroom con mi extensión de Chrome y los sumo a la agenda.' }],
    mejoras: []
  },
  {
    version: '0.9.0',
    nuevo: [
      { corto: 'sumo tu Google Calendar a mi agenda', detalle: 'Sumo tu Google Calendar: te aviso antes de cada clase o evento.' },
      { corto: 'te cuento las noticias de Infobae y TN', detalle: 'Te cuento las noticias de Infobae y TN («¿qué noticias hay?»).' }
    ],
    mejoras: []
  },
  {
    version: '0.8.0',
    nuevo: [
      { corto: 'me llamás diciendo «Pixie, ¿estás?»', detalle: 'Me llamás diciendo «Pixie, ¿estás?», sin tocar nada.' },
      { corto: 'tengo un menú en mi ventanita', detalle: 'Tengo un menú en mi ventanita (el botón ⋯ o clic derecho) para todo, hasta para cerrarme.' }
    ],
    mejoras: [{ corto: 'me instalo sin clave y te explico cómo sacarla', detalle: 'En otra compu me instalo sin clave y te explico paso a paso cómo sacar una gratis.' }]
  }
]

// "0.10.2" > "0.9.1"
export function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  const pb = String(b).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

// Las versiones nuevas desde «from» (sin incluirla) hasta «to» (incluida), la más nueva primero.
// Sin «from»: solo la versión «to».
export function entriesBetween(from, to, list = CHANGELOG) {
  return list.filter((e) => compareVersions(e.version, to) <= 0 && (from ? compareVersions(e.version, from) > 0 : compareVersions(e.version, to) === 0))
}

const join = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`)
const short = (v) => String(v).replace(/\.0$/, '')

// Lo que dice Pixie al arrancar con una versión nueva: corto, lo más importante
export function updateText(from, to, list = CHANGELOG) {
  const entries = entriesBetween(from, to, list)
  const nuevo = entries.flatMap((e) => e.nuevo).slice(0, 3).map((x) => x.corto)
  const mejoras = entries.flatMap((e) => e.mejoras).slice(0, 2).map((x) => x.corto)
  let text = `¡Me actualicé a la versión ${short(to)}!`
  if (nuevo.length) text += ` Lo nuevo: ${join(nuevo)}.`
  if (mejoras.length) text += ` ${nuevo.length ? 'Y mejoré' : 'Mejoré'}: ${join(mejoras)}.`
  if (!nuevo.length && !mejoras.length) text += ' Arreglé algunas cositas por dentro.'
  return text
}

// «¿Qué hay de nuevo?»: todo lo de la última versión (o de una en particular), con detalle
export function whatsNewText(version, list = CHANGELOG) {
  const e = list.find((x) => compareVersions(x.version, version) === 0) ?? list.find((x) => compareVersions(x.version, version) < 0)
  if (!e) return `Tengo la versión ${short(version)}.`
  const parts = [`En la versión ${short(e.version)}:`]
  for (const x of e.nuevo) parts.push(x.detalle)
  if (e.mejoras.length) parts.push(`${e.nuevo.length ? 'Además, mejoré cosas.' : 'Mejoré cosas.'} ${e.mejoras.map((x) => x.detalle).join(' ')}`)
  return parts.join(' ')
}
