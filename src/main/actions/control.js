// Usar las apps: escribir, apretar atajos, tocar botones por su nombre, moverse por la página y
// manejar ventanas. Todo pasa en la app que tenés adelante (si le escribiste a Pixie, en la que
// estabas usando antes). Lo que puede hacer perder algo pregunta antes.
import { FriendlyError, BlockedError } from '../windows.js'
import { checkQuery } from '../safety.js'
import { parseCombo, shortcutFor, risky, bestElement, elementNames, findWindow, comboLabel } from '../control.js'
import { findTarget, openActions } from './open.js'

const MAX_TEXT = 2000

function hands(ctx) {
  if (!ctx.hands?.available()) throw new FriendlyError('Usar las apps por ahora solo funciona en Windows.')
  return ctx.hands
}

// La ventana donde hacerlo (primero se fija que haya manos: si no es Windows, lo dice)
async function target(ctx) {
  hands(ctx)
  return ctx.targetWindow()
}

// Busca un botón por su nombre en la ventana y lo toca (si no lo encuentra, lo busca en la pantalla con la IA)
async function touch(ctx, win, objetivo) {
  const h = hands(ctx)
  const { elementos } = await h.request('elementos', { hwnd: win.hwnd }, 12000)
  const el = bestElement(elementos, objetivo)
  if (el) {
    await ctx.withPixieHidden({ x: el.x, y: el.y }, () => h.request('usar', { id: el.id, clic: true }))
    return { text: `Toqué «${el.nombre}».`, face: 'happy' }
  }
  const spot = await ctx.locateOnScreen?.(objetivo)
  if (spot) {
    await ctx.withPixieHidden(spot, () => h.request('clic', { x: spot.x, y: spot.y }))
    return { text: `Toqué «${objetivo}».`, face: 'happy' }
  }
  const some = elementNames(elementos, 6)
  return {
    text: `No encontré «${objetivo}» en ${win.proceso || 'la ventana'}.${some.length ? ` Veo, por ejemplo: ${some.join(', ')}.` : ''}`,
    face: 'confused'
  }
}

export const controlActions = [
  {
    name: 'escribir',
    description: 'Escribe un texto donde está el cursor, en la app que tenés adelante',
    run: async ({ texto }, ctx) => {
      const t = String(texto ?? '').slice(0, MAX_TEXT)
      if (!t.trim()) return { text: '¿Qué escribo?', face: 'confused' }
      const blocked = checkQuery(t)
      if (blocked) throw new BlockedError(blocked)
      const win = await target(ctx)
      await hands(ctx).request('escribir', { texto: t }, 8000 + t.length * 20)
      return { text: `Escribí ${t.length > 60 ? 'el texto' : `«${t}»`} en ${win.proceso || 'la ventana'}.`, face: 'happy', speak: t.length <= 60 }
    }
  },
  {
    name: 'teclas',
    description: 'Aprieta una tecla o un atajo (Ctrl+S, Enter, flecha abajo, Alt+Tab) en la app que tenés adelante',
    confirm: ({ teclas }) => Boolean(risky(parseCombo(teclas ?? '')?.teclas ?? [])),
    confirmText: ({ teclas }) => `Eso va a ${risky(parseCombo(teclas ?? '')?.teclas ?? [])}. ¿Lo hago?`,
    run: async ({ teclas, veces }, ctx) => {
      const combo = parseCombo(teclas ?? '')
      if (!combo) return { text: `No entendí la tecla «${teclas}». Probá, por ejemplo, «apretá control S» o «apretá enter».`, face: 'confused' }
      await target(ctx)
      const n = Math.max(1, Math.min(20, Math.round(Number(veces) || 1)))
      for (let i = 0; i < n; i++) await hands(ctx).request('teclas', { teclas: combo.teclas })
      return { text: `Apreté ${combo.nombre}${n > 1 ? ` ${n} veces` : ''}.`, face: 'happy' }
    }
  },
  {
    name: 'atajo',
    description: 'Hace algo común en la app de adelante: guardar, copiar, pegar, cortar, deshacer, rehacer, seleccionar todo, imprimir, nueva pestaña, cerrar pestaña, recargar, atrás, negrita, cursiva, subrayado…',
    run: async ({ accion }, ctx) => {
      const win = await target(ctx)
      const s = shortcutFor(accion ?? '', win.proceso)
      if (!s) return { text: `No sé hacer «${accion}» todavía.`, face: 'confused' }
      if (s.botones) {
        // Word, Excel y PowerPoint en castellano usan otros atajos: se toca el botón
        for (const name of s.botones) {
          const r = await touch(ctx, win, name)
          if (r.face === 'happy') return { text: `${s.dicho}.`, face: 'happy' }
        }
      }
      await hands(ctx).request('teclas', { teclas: s.teclas })
      return { text: `${s.dicho}.`, face: 'happy' }
    }
  },
  {
    name: 'clic',
    description: 'Toca un botón, menú, pestaña, link u opción de la app de adelante, por su nombre (lo que dice el botón)',
    run: async ({ objetivo }, ctx) => {
      if (!String(objetivo ?? '').trim()) return { text: '¿Qué toco?', face: 'confused' }
      const win = await target(ctx)
      return touch(ctx, win, objetivo)
    }
  },
  {
    name: 'desplazar',
    description: 'Mueve la página o la lista para arriba o para abajo en la app de adelante',
    run: async ({ direccion, cantidad }, ctx) => {
      await target(ctx)
      const n = Math.max(1, Math.min(30, Math.round(Number(cantidad) || 5)))
      const down = direccion !== 'arriba'
      await hands(ctx).request('rueda', { muescas: down ? -n : n })
      return { text: down ? 'Bajé.' : 'Subí.', face: 'happy', speak: false }
    }
  },
  {
    name: 'ventana',
    description: 'Maximiza, minimiza o restaura la ventana de adelante, la pone a la izquierda o a la derecha, o la cierra (pide confirmación)',
    confirm: ({ accion }) => accion === 'cerrar',
    confirmText: () => '¿Cierro la ventana que tenés adelante? Si tenés algo sin guardar, se puede perder.',
    run: async ({ accion }, ctx) => {
      const win = await target(ctx)
      const h = hands(ctx)
      const MODES = { maximizar: 3, minimizar: 6, restaurar: 9 }
      if (accion in MODES) await h.request('estado', { hwnd: win.hwnd, modo: MODES[accion] })
      else if (accion === 'izquierda') await h.request('teclas', { teclas: [0x5b, 0x25] })
      else if (accion === 'derecha') await h.request('teclas', { teclas: [0x5b, 0x27] })
      else if (accion === 'cerrar') await h.request('teclas', { teclas: [0x12, 0x73] })
      else return { text: '¿La maximizo, la minimizo o la pongo a un costado?', face: 'confused' }
      const done = { maximizar: 'Maximizada', minimizar: 'Minimizada', restaurar: 'Listo', izquierda: 'A la izquierda', derecha: 'A la derecha', cerrar: 'Cerrada' }
      return { text: `${done[accion]}.`, face: 'happy', speak: false }
    }
  },
  {
    name: 'ir_a',
    description: 'Trae al frente una app que ya está abierta (si no está abierta, la abre)',
    run: async ({ app }, ctx) => {
      const h = hands(ctx)
      const found = findTarget(app, ctx)
      const windows = await h.request('ventanas')
      const win = findWindow(Array.isArray(windows) ? windows : [], app, found?.item?.proceso)
      if (!win) {
        if (found) return openActions.find((a) => a.name === 'abrir').run({ objetivo: app }, ctx)
        return { text: `No encontré «${app}» abierta.`, face: 'confused' }
      }
      ctx.hidePixieFocus?.()
      const r = await h.request('enfocar', { hwnd: win.hwnd })
      if (!r.ok) return { text: `No pude traer ${found?.item?.nombre ?? app} al frente. Tocala en la barra de tareas.`, face: 'confused' }
      return { text: `Listo, ${found?.item?.nombre ?? win.proceso} al frente.`, face: 'happy', speak: false }
    }
  },
  {
    name: 'ver_elementos',
    description: 'Dice qué botones, menús y opciones se pueden tocar en la ventana de adelante',
    run: async (_params, ctx) => {
      const win = await target(ctx)
      const { elementos } = await hands(ctx).request('elementos', { hwnd: win.hwnd }, 12000)
      const names = elementNames(elementos, 25)
      if (!names.length) return { text: `No veo botones con nombre en ${win.proceso || 'la ventana'}. Probá con «¿qué ves en mi pantalla?».`, face: 'confused' }
      return { text: `En ${win.proceso || 'la ventana'} puedo tocar: ${names.join(', ')}.`, face: 'happy', speak: false }
    }
  }
]

export { comboLabel }
