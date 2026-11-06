import { papersAction } from '../papers.js'

export default {
  id: 'cientifico',
  nombre: 'Científico',
  descripcion: 'Investigación, lectura de papers y organización de preguntas científicas.',
  instruccionesIA: 'Separá resultados, hipótesis y opiniones. No inventes referencias: solo recomendá publicaciones obtenidas de fuentes consultadas durante la búsqueda.',
  acciones: [papersAction],
  señales: [{ apps: ['Zotero', 'Mendeley', 'JabRef', 'EndNote', 'arXiv', 'PubMed'] }],
  fuentes: ['Crossref'],
  fuentesNoticias: []
}
