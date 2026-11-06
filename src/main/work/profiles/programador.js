import { gitAction } from '../git.js'
import { documentationAction } from '../documentation.js'
import { createProjectAction } from '../create-project.js'

export default {
  id: 'programador',
  nombre: 'Programador',
  descripcion: 'Desarrollo de software y mantenimiento de proyectos.',
  instruccionesIA: 'Respondé como par técnico: priorizá pasos concretos, explicá riesgos antes de operaciones y no afirmes que ejecutaste cambios si una herramienta no lo confirmó.',
  acciones: [gitAction, documentationAction, createProjectAction],
  señales: [{ apps: ['VS Code', 'Visual Studio', 'IntelliJ', 'WebStorm', 'Terminal', 'PowerShell', 'Git Bash'] }],
  fuentes: [],
  fuentesNoticias: []
}
