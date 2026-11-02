// Qué hay de nuevo en cada versión. Cuando Pixie se actualiza, lo cuenta ella misma la primera vez que
// arranca con la versión nueva («¿qué hay de nuevo?» lo repite con más detalle).
// Al publicar una versión nueva, sumala ACÁ ARRIBA (la más nueva primero).
//   corto: cómo lo dice Pixie en una frase («te aviso de los mails nuevos»)
//   detalle: lo que se lee en «¿qué hay de nuevo?» y en Ajustes → Actualizaciones

export const CHANGELOG = [
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
