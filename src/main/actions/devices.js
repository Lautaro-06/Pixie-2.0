// La compu y el celular: brillo, Bluetooth y WhatsApp.
import { getBrightness, setBrightness, setBluetooth, launch, FriendlyError } from '../windows.js'
import { describeWhen, startOfDay, addDays } from '../dates.js'

const STEP = 20

export const deviceActions = [
  {
    name: 'voz',
    description: 'Cambia o cuenta qué voz usa Pixie (natural de la compu, de Gemini o de Windows)',
    run: ({ accion }, ctx) => {
      const v = ctx.voice
      if (!v) return { text: 'Todavía estoy arrancando.', face: 'confused' }
      if (accion === 'instalar' || (accion === 'natural' && !v.available())) {
        v.use(true)
        const r = v.install()
        if (r === 'ya') return { text: 'Ya tengo la voz natural instalada. ¡Te hablo con ella!', face: 'happy' }
        if (r === 'bajando') return { text: v.status(), face: 'happy' }
        return { text: 'Dale, la bajo ahora. Mientras tanto sigo con la voz de Windows.', face: 'happy' }
      }
      if (accion === 'natural') {
        v.use(true)
        return { text: '¡Listo! Vuelvo a mi voz natural.', face: 'happy' }
      }
      if (accion === 'gemini') {
        v.use('gemini')
        return { text: 'Uso la voz de Gemini. Ojo: son solo 10 frases gratis por día.', face: 'happy' }
      }
      if (accion === 'windows') {
        v.use(false)
        return { text: 'Listo, uso la voz de Windows.', face: 'happy' }
      }
      return { text: v.status(), face: 'happy', suggestions: v.available() ? undefined : ['instalá la voz natural'] }
    }
  },
  {
    name: 'ver_pantalla',
    description: 'Mira tu pantalla (una foto que no se guarda) y te ayuda con lo que ve',
    run: ({ pregunta }, ctx) => ctx.lookAtScreen(pregunta)
  },
  {
    name: 'brillo',
    description: 'Sube, baja o pone el brillo de la pantalla',
    run: async ({ cambio, valor }) => {
      if (cambio === 'ver') return { text: `El brillo está en ${await getBrightness()}%.`, face: 'happy' }
      let target = Number(valor)
      if (cambio !== 'poner' || Number.isNaN(target)) {
        const now = await getBrightness()
        target = now + (cambio === 'bajar' ? -STEP : STEP)
      }
      const level = await setBrightness(Math.max(5, Math.min(100, target)))
      return { text: `Brillo al ${level}%.`, face: cambio === 'bajar' ? 'idle' : 'happy' }
    }
  },
  {
    name: 'bluetooth',
    description: 'Prende o apaga el Bluetooth, o abre su configuración',
    run: async ({ estado }) => {
      if (estado === 'prender' || estado === 'apagar') {
        try {
          await setBluetooth(estado === 'prender')
          return { text: estado === 'prender' ? 'Bluetooth prendido.' : 'Bluetooth apagado.', face: 'happy' }
        } catch (err) {
          if (err instanceof FriendlyError) throw err
          // Si Windows no me deja, abro la configuración para que lo hagas vos
        }
      }
      await launch({ tipo: 'uri', valor: 'ms-settings:bluetooth' })
      return { text: estado === 'abrir' ? 'Te abrí la configuración de Bluetooth.' : 'No pude cambiarlo solo: te abrí la configuración de Bluetooth.', face: 'happy' }
    }
  },
  {
    name: 'whatsapp',
    description: 'Te manda un WhatsApp a tu celular (solo a tu número)',
    run: async ({ texto }, ctx) => {
      const t = String(texto ?? '').trim()
      const plain = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      let body = t
      if (/^(a|para) (mi |la |el )?[a-zñ]+\b/.test(plain) && !/^a mi (celu|celular|numero)/.test(plain)) {
        return { text: 'Por ahora solo te puedo mandar WhatsApp a vos, a tu número.', face: 'confused' }
      }
      if (!t || /^(prueba|probar|un mensaje de prueba|algo)$/.test(plain)) {
        body = '¡Hola! Soy Pixie. Así te voy a avisar cuando no estés en la compu.'
      } else if (/^(la )?(lista de )?(mis )?pendientes$/.test(plain)) {
        const todos = ctx.memory.listTodos()
        body = todos.length ? `Tus pendientes:\n${todos.map((x, i) => `${i + 1}. ${x.texto}`).join('\n')}` : 'No tenés pendientes. ¡Bien ahí!'
      } else if (/^(la |mi )?agenda( de la semana)?$/.test(plain)) {
        const now = new Date()
        const events = ctx.memory.eventsBetween(startOfDay(now), addDays(startOfDay(now), 8))
        body = events.length ? `Tu agenda:\n${events.map((e) => `• ${e.texto}: ${describeWhen(e.cuando, e.conHora, now)}`).join('\n')}` : 'No tenés nada agendado esta semana.'
      }
      await ctx.phone.send(`Pixie: ${body}`)
      return { text: 'Listo, te lo mandé por WhatsApp.', face: 'happy' }
    }
  }
]
