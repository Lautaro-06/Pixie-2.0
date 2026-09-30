// Calculadora de Pixie: entiende cuentas escritas con números o palabras
// ("5 por 3", "20% de 300", "(2 + 3) al cuadrado"). No usa eval.

const WORDS = [
  [/^\s*(?:el|la|los|las)\s+/, ''],
  [/(\d+(?:[.,]\d+)?)\s*(?:%|por ?ciento)\s*de\s*(\d+(?:[.,]\d+)?)/g, '($1/100*$2)'],
  [/\bal cuadrado\b/g, '^2'],
  [/\bal cubo\b/g, '^3'],
  [/\belevado a(?:l)?\b/g, '^'],
  [/\bdividido (?:en|por)\b|\bdividido\b|\bsobre\b/g, '/'],
  [/\bmultiplicado por\b|\bpor\b|(?<=\d)\s*x\s*(?=\d)/g, '*'],
  [/\bmas\b/g, '+'],
  [/\bmenos\b/g, '-']
]

export function toExpression(text) {
  let s = String(text)
  for (const [re, rep] of WORDS) s = s.replace(re, rep)
  s = s.replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '')
  return /^[\d.+\-*/^()]+$/.test(s) && /\d/.test(s) && /[+\-*/^]/.test(s) ? s : null
}

export function evaluate(expression) {
  const src = String(expression)
  let i = 0
  const peek = () => src[i]
  const eat = (c) => (src[i] === c ? (i++, true) : false)

  function number() {
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(src.slice(i))
    if (!m) throw new Error('número esperado')
    i += m[0].length
    return parseFloat(m[0])
  }
  function primary() {
    if (eat('(')) {
      const v = expr()
      if (!eat(')')) throw new Error('falta )')
      return v
    }
    return number()
  }
  function unary() {
    if (eat('-')) return -unary()
    if (eat('+')) return unary()
    return primary()
  }
  function power() {
    const base = unary()
    return eat('^') ? base ** power() : base
  }
  function term() {
    let v = power()
    for (;;) {
      if (eat('*')) v *= power()
      else if (eat('/')) v /= power()
      else return v
    }
  }
  function expr() {
    let v = term()
    for (;;) {
      if (eat('+')) v += term()
      else if (eat('-')) v -= term()
      else return v
    }
  }

  try {
    const v = expr()
    if (i !== src.length || peek() !== undefined || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}
