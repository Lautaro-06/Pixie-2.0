// Acciones sobre Pixie misma: actualizarse, decir su versión, su atajo, cerrarse y armar el informe de diagnóstico.
import { parseShortcut, shortcutText } from '../shortcut.js'
import { describeWhen } from '../dates.js'

export const appActions = [
  {
    name: 'ajustes',
    description: 'Abre la ventana de Ajustes de Pixie (nombre, atajo, IA, voz, qué muestra en reposo, actualizaciones)',
    run: (_params, ctx) => {
      if (!ctx.openSettings) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      ctx.openSettings('ajustes')
      return { text: 'Te abrí mis ajustes.', face: 'happy' }
    }
  },
  {
    name: 'cerrar_pixie',
    description: 'Cierra Pixie del todo (pide confirmación). Para esconderla un rato, mejor «escondete».',
    confirm: true,
    confirmText: () => '¿Me cierro del todo? Para volver a abrirme vas a tener que buscarme en el menú Inicio. Si solo querés que me corra, decime «escondete».',
    run: (_params, ctx) => {
      if (!ctx.quit) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      setTimeout(() => ctx.quit(), 1800)
      return { text: '¡Chau! Me cierro.', face: 'sad' }
    }
  },
  {
    name: 'clave_ia',
    description: 'Explica paso a paso cómo conseguir gratis la clave de Gemini y abre la guía',
    run: (_params, ctx) => {
      ctx.openSettings?.('ajustes/ia')
      if (ctx.ai?.enabled()) return { text: 'Ya tengo IA. Te abrí mis ajustes por si la querés cambiar.', face: 'happy' }
      return {
        text: 'Te abrí la guía paso a paso. Es gratis: entrás a Google AI Studio con tu cuenta de Google, tocás «Crear clave de API» y la copiás. Yo la encuentro sola cuando la copiás.',
        face: 'happy'
      }
    }
  },
  {
    name: 'palabra_magica',
    description: 'Explica cómo llamar a Pixie con la voz («Pixie, ¿estás?») y abre donde se graba',
    run: (_params, ctx) => {
      const w = ctx.wake?.status()
      ctx.openSettings?.('ajustes/voz')
      if (w?.activa) return { text: 'Ya te escucho: decí «Pixie, ¿estás?» y te atiendo. Si no te reconozco bien, grabá tu voz de nuevo en Ajustes.', face: 'happy' }
      if (w?.grabada) return { text: 'Tengo tu voz grabada pero no estoy escuchando. Prendelo en Ajustes → Voz.', face: 'idle' }
      return { text: 'Te abrí mis ajustes: decí tres veces «Pixie, ¿estás?» y aprendo tu voz. Después me llamás así, sin tocar nada.', face: 'happy' }
    }
  },
  {
    name: 'conectar_calendario',
    description: 'Explica cómo sumar tu Google Calendar a la agenda de Pixie y abre donde se hace',
    run: (_params, ctx) => {
      ctx.openSettings?.('ajustes/agenda')
      const n = ctx.calendars?.count() ?? 0
      const ya = n ? `Ya tengo ${n === 1 ? 'un calendario' : `${n} calendarios`}. ` : ''
      return {
        text: `${ya}Te abrí mi agenda en Ajustes: copiá la «dirección secreta en formato iCal» de tu Google Calendar y yo la encuentro sola. Si no sabés dónde está, tocá «No sé dónde está» y te guío paso a paso. Las tareas de Classroom las leo con mi extensión de Chrome.`,
        face: 'happy'
      }
    }
  },
  {
    name: 'classroom',
    description: 'Lee tus Pendientes de Classroom (con la extensión de Chrome) y cuenta qué tenés que entregar',
    run: async (_params, ctx) => {
      if (!ctx.classroom) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      const st = await ctx.classroom.refresh({ force: true })
      if (st.estado === 'sin-extension' && !st.leido) {
        ctx.openSettings?.('ajustes/agenda')
        return {
          text: 'Las materias de Classroom no tienen dirección secreta, así que las leo con mi extensión de Chrome. Te abrí mis ajustes: en Agenda está cómo instalarla (es una sola vez).',
          face: 'idle'
        }
      }
      if (st.estado === 'extension-vieja') return { text: 'Mi extensión de Chrome está desactualizada: en chrome://extensions tocá recargar en «Pixie para Chrome».', face: 'confused' }
      if (st.estado === 'error' && !st.leido) return { text: `No pude leer Classroom: ${st.error}`, face: 'confused' }
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tasks = ctx.classroom.tasks()
      const upcoming = tasks.filter((x) => x.cuando && new Date(x.cuando) >= today).sort((a, b) => new Date(a.cuando) - new Date(b.cuando))
      const old = st.estado === 'ok' ? '' : ' (es lo último que leí: ahora no pude volver a mirar)'
      if (!tasks.length) return { text: `En Classroom no tenés tareas asignadas.${old}`, face: 'happy' }
      const names = upcoming.slice(0, 3).map((x) => `${x.titulo}${x.materia ? ` (${x.materia})` : ''} ${describeWhen(new Date(x.cuando), false, now)}`)
      const sinFecha = tasks.length - upcoming.length
      const total = tasks.length === 1 ? 'una tarea pendiente' : `${tasks.length} tareas pendientes`
      const next = names.length ? ` Lo próximo: ${names.join('; ')}.` : ''
      const rest = sinFecha ? ` ${sinFecha === 1 ? 'Una no tiene' : `${sinFecha} no tienen`} fecha de entrega.` : ''
      return { text: `En Classroom tenés ${total}.${next}${rest}${old}`, face: upcoming.length ? 'surprised' : 'happy' }
    }
  },
  {
    name: 'chats_privados',
    description: 'Explica que Pixie no puede entrar a WhatsApp ni a otros chats',
    run: () => ({
      text: 'No puedo entrar a tu WhatsApp ni leer tus chats: no tengo acceso. Lo único que puedo es mirar tu pantalla si me lo pedís («mirá mi pantalla»), y ahí veo lo mismo que vos.',
      face: 'idle'
    })
  },
  {
    name: 'cambiar_atajo',
    description: 'Dice o cambia el atajo de teclado para llamar a Pixie (por ejemplo Ctrl+Alt+P)',
    run: ({ atajo }, ctx) => {
      if (!atajo) return { text: `Me llamás con ${ctx.shortcutLabel()}. Para cambiarlo decime, por ejemplo, «cambiá el atajo a Ctrl+Alt+P».`, face: 'idle' }
      const accel = parseShortcut(atajo)
      if (!accel) {
        return { text: 'No entendí ese atajo. Tiene que llevar Ctrl o Alt y una tecla, por ejemplo «cambiá el atajo a Ctrl+Alt+P».', face: 'confused' }
      }
      const r = ctx.changeShortcut?.(accel)
      if (!r) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      if (!r.ok) {
        return { text: `${shortcutText(accel)} lo está usando otro programa. Probá con otro, por ejemplo Ctrl+Alt+P.`, face: 'confused' }
      }
      return { text: `¡Listo! Ahora me llamás con ${shortcutText(accel)}.`, face: 'happy' }
    }
  },
  {
    name: 'actualizar',
    description: 'Busca una versión nueva de Pixie y, si ya está bajada, la instala y reinicia',
    run: async (_params, ctx) => {
      const updates = ctx.updates
      if (!updates) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      let s = updates.status()
      if (s.state === 'dev') return { text: updates.describe(), face: 'confused' }
      if (s.state === 'ready') {
        setTimeout(() => updates.install(), 2500)
        return { text: `¡Me actualizo a la versión ${s.available}! Vuelvo en unos segundos.`, face: 'happy', speak: false }
      }
      if (s.state === 'downloading') {
        return { text: `Estoy bajando la versión ${s.available} (${s.progress} %). Te aviso cuando esté lista.`, face: 'idle' }
      }
      s = await updates.check()
      if (s.state === 'ready') {
        setTimeout(() => updates.install(), 2500)
        return { text: `¡Me actualizo a la versión ${s.available}! Vuelvo en unos segundos.`, face: 'happy', speak: false }
      }
      if (s.state === 'downloading') {
        return { text: `¡Hay una versión nueva, la ${s.available}! La estoy bajando y te aviso cuando esté lista.`, face: 'happy' }
      }
      if (s.state === 'offline') return { text: 'No pude fijarme si hay una versión nueva porque no hay internet.', face: 'confused' }
      if (s.state === 'error') return { text: 'No pude fijarme si hay una versión nueva. Probá en un rato.', face: 'confused' }
      return { text: `Ya tengo la última versión (${s.current}).`, face: 'happy' }
    }
  },
  {
    name: 'version',
    description: 'Dice qué versión de Pixie está instalada y si hay una nueva',
    run: (_params, ctx) => ({ text: ctx.updates?.describe() ?? 'Todavía estoy arrancando.', face: 'idle' })
  },
  {
    name: 'diagnostico',
    description: 'Copia el informe de diagnóstico (versión y últimos errores, sin claves) para mandárselo al equipo',
    run: (_params, ctx) => {
      const count = ctx.copyDiagnostics?.()
      if (count === undefined) return { text: 'Todavía no puedo armar el informe.', face: 'confused' }
      const errores =
        count === 0
          ? 'No anoté ningún error desde que arranqué.'
          : count === 1
            ? 'Tiene el único error que anoté.'
            : `Tiene mis últimos ${count} errores.`
      return { text: `Te copié el informe de diagnóstico: pegalo donde quieras con Ctrl+V. ${errores}`, face: 'happy' }
    }
  }
]
