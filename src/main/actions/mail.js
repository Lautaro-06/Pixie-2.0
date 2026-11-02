// Mails de Gmail: «¿tengo mails nuevos?», «leeme el mail de la profe», «leémelo», «avisame de los mails»,
// «no me avises más de los mails de Netflix». Todo con la extensión de Chrome (ver mail.js).
import { listText, findMail } from '../mail.js'
import { pageForAI, quickSummary } from './browser.js'
import { runAction } from './index.js'

const NO_EXTENSION = 'Para ver tus mails necesito mi extensión de Chrome. Te abrí mis ajustes: en Agenda está cómo instalarla (es una sola vez). En Chrome tenés que haber entrado a Gmail.'
const OLD_EXTENSION = 'Mi extensión de Chrome está desactualizada: en chrome://extensions tocá recargar en «Pixie para Chrome».'

// Si no pudo mirar, por qué
function problem(st, ctx) {
  if (st.estado === 'sin-extension') {
    ctx.openSettings?.('ajustes/agenda')
    return { text: NO_EXTENSION, face: 'idle' }
  }
  if (st.estado === 'extension-vieja') return { text: OLD_EXTENSION, face: 'confused' }
  if (st.estado === 'error') return { text: `No pude mirar tus mails: ${st.error}`, face: 'confused' }
  return null
}

async function readOne(mail, ctx) {
  // Se abre en Chrome (así lo ves y queda leído) y se lee entero
  if (mail.link && ctx.browser?.connected()) {
    try {
      const page = await ctx.browser.request('abrir_mail', { link: mail.link }, 40 * 1000)
      let summary = null
      if (ctx.ai?.enabled()) {
        try {
          summary = await ctx.ai.summarize('mail', pageForAI(page))
        } catch {
          summary = null
        }
      }
      return { text: summary ? `Es de ${mail.de}. ${summary}` : quickSummary(page), face: 'happy' }
    } catch (err) {
      ctx.log?.(`leer mail: ${err.message}`)
    }
  }
  // Si no se pudo abrir: lo que se ve en el aviso
  const start = mail.resumen ? ` Empieza así: «${mail.resumen.slice(0, 200)}${mail.resumen.length > 200 ? '…' : ''}».` : ''
  return { text: `Es de ${mail.de}: «${mail.asunto}».${start} Para leerlo entero, abrilo en Gmail.`, face: 'idle' }
}

export const mailActions = [
  {
    name: 'mails',
    description: 'Mails de Gmail: revisar los sin leer, leer uno (de alguien o por número), prender o apagar los avisos, o no avisar de alguien',
    run: async ({ accion = 'revisar', de, n, on, solo }, ctx) => {
      const mail = ctx.mail
      if (!mail) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }

      if (accion === 'avisos') {
        mail.setAlerts(on !== false)
        if (on === false) return { text: 'Listo, no te aviso más de los mails. Si querés saber, preguntame «¿tengo mails?».', face: 'happy' }
        const st = await mail.refresh({ force: true, silent: true })
        const extra = st.estado === 'sin-extension' ? ' Pero primero necesito mi extensión de Chrome: en mis ajustes, en Agenda, está cómo instalarla.' : ''
        if (st.estado === 'sin-extension') ctx.openSettings?.('ajustes/agenda')
        return { text: `¡Dale! Te aviso cuando te llegue un mail. Solo miro quién lo manda y el asunto, no los abro.${extra}`, face: 'happy' }
      }

      if (accion === 'silenciar') {
        if (!de) return { text: '¿De quién no querés que te avise? Decime, por ejemplo, «no me avises de los mails de Netflix».', face: 'confused' }
        mail.mute(de)
        return { text: `Listo, no te aviso más de los mails de ${de}.`, face: 'happy' }
      }

      if (accion === 'leer') {
        // «leémelo» justo después de un aviso: ese mail. Si no, el mail que tengas abierto en Gmail.
        let list = mail.recent()
        if (!list.length && (de || n)) {
          const st = await mail.refresh({ force: true, silent: true })
          const p = problem(st, ctx)
          if (p) return p
          list = mail.mailbox().mails
        }
        if (!list.length) return runAction('resumir', { que: solo ? 'pagina' : 'mail' }, ctx)
        const found = findMail(list, { de, n: Number.isInteger(n) ? n : undefined })
        if (!found) return { text: `No encontré un mail sin leer${de ? ` de ${de}` : ''}.`, face: 'confused' }
        return readOne(found, ctx)
      }

      // Revisar: los sin leer, lo más nuevo primero
      const st = await mail.refresh({ force: true, silent: true })
      const p = problem(st, ctx)
      if (p && !st.leido) return p
      const box = mail.mailbox()
      mail.remember(box.mails.slice(0, 3))
      const old = st.estado === 'ok' ? '' : ' (es lo último que vi: ahora no pude volver a mirar)'
      const offer = !st.avisos && !ctx.getConfig?.().mailOfrecido ? ' Si querés, te aviso cuando te llegue uno: decime «avisame de los mails».' : ''
      return {
        text: `${listText(box)}${old}${offer}`,
        face: box.mails.length ? 'surprised' : 'happy',
        suggestions: box.mails.length ? ['leeme el primero', 'abrí Gmail'] : undefined
      }
    }
  }
]
