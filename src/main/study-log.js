// El seguimiento de estudio: cada sesión de Pomodoro que terminás queda anotada en estudio.json (en tu
// compu): cuándo, de qué materia, cuánto estudiaste, los ciclos, el foco, la adherencia y los temas que
// tenías abiertos. Con eso Pixie arma el resumen del final («Hoy hiciste 4 ciclos…»), la racha de días
// seguidos y la vista de Ajustes → Mi estudio. El temario es la lista de temas que soltás ahí (solo los
// títulos): Pixie va tachando los que ve que estudiaste.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseSyllabus, topicSeen, daySummary, streakDays, statsText, trackerView, subjectName } from './study-stats.js'

const MAX_SESSIONS = 600

export * from './study-stats.js'

// ── Lo que se guarda ──

export function createStudyLog(file, { now = () => new Date() } = {}) {
  let data = { version: 1, sesiones: [], temario: null }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    data = { version: 1, sesiones: Array.isArray(raw.sesiones) ? raw.sesiones : [], temario: raw.temario ?? null }
  } catch {
    // primera vez (o se rompió el archivo): empieza vacío
  }
  const save = () => {
    try {
      writeFileSync(file, JSON.stringify(data, null, 2))
    } catch {
      // sin disco: queda en memoria hasta cerrar Pixie
    }
  }

  return {
    sessions: () => data.sesiones,
    // Anota una sesión terminada (las de menos de un minuto no cuentan)
    record(sesion) {
      if (!sesion || (sesion.estudiadoMin ?? 0) < 1) return null
      const clean = {
        inicio: sesion.inicio,
        fin: sesion.fin,
        materia: sesion.materia ? subjectName(String(sesion.materia).slice(0, 40)) : null,
        tipo: sesion.tipo ?? null,
        metodo: sesion.metodo ?? null,
        completo: Boolean(sesion.completo),
        estudiadoMin: sesion.estudiadoMin,
        focoMin: sesion.focoMin ?? sesion.estudiadoMin,
        distraidoMin: sesion.distraidoMin ?? 0,
        planeadoMin: sesion.planeadoMin ?? sesion.estudiadoMin,
        ciclos: sesion.ciclos ?? 0,
        ciclosPlaneados: sesion.ciclosPlaneados ?? 0,
        adherencia: sesion.adherencia ?? null,
        temas: (sesion.temas ?? []).slice(0, 8).map((t) => String(t).slice(0, 80))
      }
      data.sesiones.push(clean)
      if (data.sesiones.length > MAX_SESSIONS) data.sesiones = data.sesiones.slice(-MAX_SESSIONS)
      save()
      return clean
    },
    today: () => daySummary(data.sesiones, now()),
    streak: () => streakDays(data.sesiones, now()),
    stats: (periodo) => statsText(data.sesiones, periodo, now()),
    view: (goal) => trackerView(data.sesiones, { now: now(), goal, temario: data.temario }),
    clear() {
      data.sesiones = []
      save()
    },

    // El temario: { materia, temas: [{ texto, visto, cuando, auto }] }
    temario: () => data.temario,
    setTemario(materia, texto) {
      const temas = parseSyllabus(texto)
      if (!temas.length) return null
      data.temario = { materia: String(materia ?? '').trim().slice(0, 40) || null, creado: now().toISOString(), temas: temas.map((t) => ({ texto: t, visto: false, cuando: null, auto: false })) }
      save()
      return data.temario
    },
    clearTemario() {
      data.temario = null
      save()
    },
    markTopic(index, visto) {
      const t = data.temario?.temas?.[index]
      if (!t) return data.temario
      t.visto = Boolean(visto)
      t.cuando = t.visto ? now().toISOString() : null
      t.auto = false
      save()
      return data.temario
    },
    // Tacha solo los temas que aparecen en lo que estudiaste; devuelve los nuevos
    markSeen(titles) {
      const list = data.temario?.temas
      if (!list?.length || !titles?.length) return []
      const fresh = list.filter((t) => !t.visto && topicSeen(t.texto, titles))
      for (const t of fresh) Object.assign(t, { visto: true, cuando: now().toISOString(), auto: true })
      if (fresh.length) save()
      return fresh.map((t) => t.texto)
    }
  }
}
