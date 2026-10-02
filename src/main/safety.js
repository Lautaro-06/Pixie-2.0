// Filtro de contenido: a Pixie la puede usar cualquiera (por ejemplo en una feria),
// así que nunca abre ni busca contenido para adultos, gore o cosas ilegales.
// Se aplica a todo lo que abre o busca, lo pida la persona o la IA. No se puede
// apagar desde el chat; en config.json se pueden sumar sitios ("sitiosBloqueados").

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Sitios conocidos (también bloquea sus subdominios)
const DOMAINS = {
  adultos: [
    'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com', 'tube8.com', 'spankbang.com',
    'youjizz.com', 'motherless.com', 'brazzers.com', 'onlyfans.com', 'fansly.com', 'chaturbate.com', 'stripchat.com',
    'bongacams.com', 'cam4.com', 'livejasmin.com', 'myfreecams.com', 'camsoda.com', 'rule34.xxx', 'rule34.paheal.net',
    'e621.net', 'nhentai.net', 'e-hentai.org', 'hanime.tv', 'hentaihaven.xxx', 'erome.com', 'fapello.com', 'thothub.to',
    'eporner.com', 'tnaflix.com', 'porntrex.com', 'hqporner.com', 'beeg.com', 'sex.com', 'literotica.com', 'f95zone.to',
    'pornpics.com', 'imagefap.com', 'efukt.com', 'cuevana-xxx.com', 'poringa.net'
  ],
  violento: [
    'bestgore.com', 'bestgore.fun', 'theync.com', 'kaotic.com', 'goregrish.com', 'documentingreality.com', 'crazyshit.com',
    'watchpeopledie.tv', 'seegore.com', 'gorecenter.com', 'deathaddict.com', 'hoodsite.com', 'gorevideo.org'
  ],
  ilegal: ['silkroad.com', 'darknetlive.com', 'dread.onion']
}

// Palabras dentro del nombre del sitio
const HOST_WORDS = {
  adultos: /porn|xxx|hentai|nsfw|xvideo|xnxx|xhamster|rule34|onlyfans|(^|[.-])sex|camgirl|escort/,
  violento: /(^|[.-])(best|see|real|watch)?gore([.-]|center|grish|$)|deathaddict|watchpeopledie/,
  ilegal: /\.onion$|darknet|darkweb|deepweb/
}

// Búsquedas (sobre el texto sin tildes). Pensado para no bloquear tareas del colegio:
// "educación sexual", "efectos de la cocaína" o "armas de la Segunda Guerra" pasan.
const QUERY_WORDS = {
  adultos:
    /\b(porn\w*|xxx|nopor|hentai|rule ?34|r34|onlyfans|only fans|xvideos|xnxx|xhamster|pornhub|chaturbate|camgirls?|sexcam|webcam (de )?sexo|sexting|nudes|tetas|tetonas|culonas|putas|escorts?|cogiendo|lolis?|milfs?)\b|\bsexo (explicito|en vivo|gratis|caliente|duro)\b|\bvideos? (de |con )?sexo\b|\b(fotos?|videos?|chicas?|mujeres|hombres|famosas?) (desnud|en bolas|sin ropa)|\bdesnud[oa]s? (fotos?|videos?|reales?)\b/,
  violento:
    /(?<!\bal )\bgore\b|\b(decapitad|decapitacion|desmembrad|desmembramiento|snuff)\w*|\bcadaver(es)? (reales?|de verdad)\b|\bmuertes? reales?\b|\bvideos? de (muertes|muertos|asesinatos|suicidios)\b|\bgente muriendo\b|\basesinatos? (reales?|en vivo|grabados?)\b|\bsuicidios? (en vivo|grabados?|reales?)\b|\bfotos? de (muertos|cadaveres)\b|\baccidentes? (fatales|mortales) (videos?|fotos?)\b/,
  ilegal: /\b(dark ?web|deep ?web|darknet|tor browser|mercado negro)\b|\.onion\b|\bhackear (una |la )?(cuenta|instagram|facebook|whatsapp|wifi)/
}

// Conseguir cosas ilegales: el verbo y la cosa cerca, en cualquier orden
// ("comprar cocaína", "dni falso comprar"). "Efectos de la cocaína" pasa.
const VERBS = '(comprar|compro|vender|vendo|venta|conseguir|consigo|venden|precio)'
const ITEMS =
  '(droga|drogas|cocaina|merca|faso|marihuana|porro|lsd|extasis|pastillas|metanfetamina|crack|paco|armas?|pistolas?|revolver|municiones|balas|escopetas?|documentos? falsos?|dni falso|billetes? falsos?|plata falsa|tarjetas? clonadas?|cuentas? robadas?)'
const NEAR = '(?:\\s+\\S+){0,3}\\s+'
const ILLEGAL_GOODS = new RegExp(`\\b${VERBS}${NEAR}${ITEMS}\\b|\\b${ITEMS}${NEAR}${VERBS}\\b`)

const MESSAGES = {
  adultos: '¡Eh, no! Eso no lo abro: no muestro contenido para adultos. ¿Te ayudo con otra cosa?',
  violento: 'Eso no: no muestro contenido violento ni gore. ¿Buscamos otra cosa?',
  ilegal: 'Eso no lo busco: no ayudo a conseguir cosas ilegales. ¿Te ayudo con otra cosa?'
}

export function blockedMessage(categoria) {
  return MESSAGES[categoria] ?? 'Eso no lo puedo abrir.'
}

function hostOf(url) {
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const matchesDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`)

// ¿Este sitio está bloqueado? Devuelve la categoría o null
export function checkUrl(url, extra = []) {
  const host = hostOf(url)
  if (!host) return null
  for (const d of extra ?? []) if (d && matchesDomain(host, hostOf(String(d)))) return 'adultos'
  for (const [categoria, list] of Object.entries(DOMAINS)) if (list.some((d) => matchesDomain(host, d))) return categoria
  for (const [categoria, re] of Object.entries(HOST_WORDS)) if (re.test(host)) return categoria
  return null
}

// ¿Esta búsqueda pide algo bloqueado? Devuelve la categoría o null
export function checkQuery(text) {
  const t = fold(text)
  for (const [categoria, re] of Object.entries(QUERY_WORDS)) if (re.test(t)) return categoria
  if (ILLEGAL_GOODS.test(t)) return 'ilegal'
  // Una dirección escrita como búsqueda: "pornhub.com"
  const domain = t.match(/\b[a-z0-9-]+(\.[a-z0-9-]+)+\b/)
  return domain ? checkUrl(domain[0]) : null
}
