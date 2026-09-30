// Hace que `import ... from 'electron'` use el Electron de mentira en las pruebas.
import { register } from 'node:module'

const stub = new URL('./electron-stub.mjs', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function resolve(spec, ctx, next) {
  if (spec === 'electron') return { url: ${JSON.stringify(stub)}, shortCircuit: true }
  return next(spec, ctx)
}`)
)
