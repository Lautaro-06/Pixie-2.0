export default {
  id: 'libre',
  nombre: 'Otro / personalizado',
  descripcion: 'Un perfil conversacional para trabajos que no tienen un perfil propio.',
  instruccionesIA: (work) => {
    const description = String(work.descripcionLibre ?? '').trim()
    return description
      ? `La persona trabaja en este rubro: ${description}. Adaptá tus respuestas a ese contexto sin inventar conocimientos ni reemplazar a profesionales de salud, legales o financieros.`
      : 'Adaptá la conversación al rubro que describa la persona. Si se trata de salud, asuntos legales o finanzas, aclara que no reemplazas a un profesional.'
  },
  acciones: [],
  señales: [],
  fuentes: [],
  fuentesNoticias: []
}
