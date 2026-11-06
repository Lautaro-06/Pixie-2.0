export default {
  id: 'libre',
  nombre: 'Otro / personalizado',
  descripcion: 'Un perfil conversacional para trabajos que no tienen un perfil propio.',
  instruccionesIA: (work) => {
    const description = String(work.descripcionLibre ?? '').trim()
    return description
      ? `La persona trabaja en este rubro: ${description}. Adaptá tus respuestas a ese contexto. No des por sentado que conocés todos los procedimientos o normas del rubro: preguntá cuando falte contexto, distinguí hechos de sugerencias y usá solo las fuentes que la persona eligió si necesitás información específica. En salud, asuntos legales o finanzas, aclará que no reemplazás a un profesional.`
      : 'Adaptá la conversación a cualquier rubro que describa la persona. Preguntá cuando falte contexto y no presentes conocimiento general como exhaustivo o necesariamente actualizado. Si se trata de salud, asuntos legales o finanzas, aclará que no reemplazás a un profesional.'
  },
  acciones: [],
  señales: [],
  fuentes: [],
  fuentesNoticias: []
}
