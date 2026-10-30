// Noticias: «¿qué noticias hay?», «noticias de TN», «noticias de deportes», «más noticias» y «abrí la segunda».
import { launch } from '../windows.js'

const PER_PAGE = 3

// Lo último que leyó en voz alta (para «más noticias» y «abrí la segunda») y lo que ya contó en un aviso
let page = { items: [], from: 0, fuentes: null, tema: null }
const told = new Set()

const sourcesOf = (ctx, fuente) => (fuente ? [fuente] : ctx.getConfig?.().noticiasFuentes ?? ['infobae', 'tn'])
const names = (items) => [...new Set(items.map((it) => it.fuente))].join(' y ')

function readOut(items) {
  return items.map((it) => `«${it.titulo}» (${it.fuente})`).join('. ')
}

export const newsActions = [
  {
    name: 'noticias',
    description: 'Cuenta los últimos titulares de Infobae y TN (o de uno), opcionalmente de un tema; «más» sigue con los siguientes',
    run: async ({ fuente, tema, mas, aviso }, ctx) => {
      if (!ctx.news) return { text: 'Todavía estoy arrancando. Pedímelo en un ratito.', face: 'confused' }
      // De vez en cuando Pixie cuenta un titular nuevo por su cuenta
      if (aviso) {
        let items
        try {
          items = await ctx.news.latest({ fuentes: sourcesOf(ctx) })
        } catch {
          return { text: '' }
        }
        const fresh = items.find((it) => !told.has(it.titulo))
        if (!fresh) return { text: '' }
        told.add(fresh.titulo)
        page = { items: [fresh, ...items.filter((it) => it !== fresh)], from: 0, fuentes: sourcesOf(ctx), tema: null }
        return { text: `Che, lo último de ${fresh.fuente}: «${fresh.titulo}». ¿Querés más noticias?`, face: 'surprised', suggestions: ['más noticias', 'abrí la primera'] }
      }
      if (mas && page.items.length) {
        const from = page.from + PER_PAGE
        const items = page.items.slice(from, from + PER_PAGE)
        if (!items.length) return { text: 'Por ahora no hay más noticias nuevas. Pedímelas de nuevo en un rato.', face: 'idle' }
        page = { ...page, from }
        for (const it of items) told.add(it.titulo)
        return { text: `Más: ${readOut(items)}.`, face: 'happy', suggestions: ['más noticias', 'abrí la primera'] }
      }
      let items
      try {
        items = await ctx.news.latest({ fuentes: sourcesOf(ctx, fuente), tema })
      } catch (err) {
        return { text: err.message, face: 'confused' }
      }
      if (!items.length) {
        return { text: tema ? `No encontré noticias de ${tema} en este momento.` : 'No encontré noticias en este momento.', face: 'confused' }
      }
      page = { items, from: 0, fuentes: sourcesOf(ctx, fuente), tema }
      const first = items.slice(0, PER_PAGE)
      for (const it of first) told.add(it.titulo)
      const what = tema ? `Lo último sobre ${tema}` : `Lo último de ${names(first)}`
      return { text: `${what}: ${readOut(first)}.`, face: 'happy', suggestions: ['más noticias', 'abrí la primera'] }
    }
  },
  {
    name: 'abrir_noticia',
    description: 'Abre en el navegador una de las noticias que Pixie acaba de leer (1 = la primera)',
    run: async ({ n }) => {
      const visible = page.items.slice(page.from, page.from + PER_PAGE)
      if (!visible.length) return { text: 'No tengo noticias para abrir. Pedime «noticias» primero.', face: 'confused' }
      const i = n === -1 ? visible.length - 1 : Math.max(1, Number(n) || 1) - 1
      const it = visible[i]
      if (!it?.link) return { text: `Te leí ${visible.length} noticias. ¿Cuál abro?`, face: 'confused' }
      await launch({ tipo: 'uri', valor: it.link })
      return { text: `Te abrí la noticia de ${it.fuente}.`, face: 'happy' }
    }
  }
]

// Para las pruebas
export function resetNews() {
  page = { items: [], from: 0, fuentes: null, tema: null }
  told.clear()
}

