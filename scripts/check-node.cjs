// Antes de npm install: avisa clarito si la versión de Node es muy vieja para Pixie.
// Está escrito para que ande incluso en versiones viejas de Node.
var MIN = [22, 12, 0]
var version = process.versions.node
var current = version.split('.').map(Number)

function older(a, b) {
  for (var i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

if (older(current, MIN)) {
  console.error('')
  console.error('  Pixie necesita Node.js ' + MIN.join('.') + ' o más nuevo, y tenés el ' + version + '.')
  console.error('  1. Bajá la versión LTS de https://nodejs.org e instalala.')
  console.error('  2. Cerrá y volvé a abrir la terminal (y VS Code).')
  console.error('  3. Fijate con «node -v» que diga v22 o más, y corré de nuevo «npm install».')
  console.error('')
  process.exit(1)
}
