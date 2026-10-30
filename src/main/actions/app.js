// Acciones sobre Pixie misma: actualizarse, decir su versión y armar el informe de diagnóstico.

export const appActions = [
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
