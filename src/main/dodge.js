// Pixie se corre si dejás el mouse encima: así no tapa un botón o algo que tenés que tocar.
// Para llamarla está el atajo (o «Pixie, ¿estás?»), y para moverla a mano, la llamás y la arrastrás.
// Solo esquiva cuando está chiquita (sin el globito ni la barra para escribir) y no la estás arrastrando.

const DWELL_MS = 300 // cuánto tiene que quedarse el mouse encima
const AFTER_USER_MOVE_MS = 1500 // si la acabás de arrastrar, no se escapa
const AFTER_MODE_MS = 2500 // recién se achicó (la acabás de usar): espera un poco
const GAP = 28 // cuánto lugar deja entre ella y el mouse
const ANIMATION_MS = 200

const inside = (r, p, pad = 0) => p.x >= r.x - pad && p.x < r.x + r.width + pad && p.y >= r.y - pad && p.y < r.y + r.height + pad

// Adónde moverse: el lugar más cerca que no quede debajo del mouse (y dentro de la pantalla)
// bounds: { x, y, width, height } de Pixie; cursor: { x, y }; area: la zona de trabajo de la pantalla
export function dodgeTarget(bounds, cursor, area, gap = GAP) {
  const { width, height } = bounds
  const clamp = (c) => ({
    x: Math.round(Math.min(Math.max(c.x, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(c.y, area.y), area.y + area.height - height))
  })
  const candidates = [
    { x: cursor.x - width - gap, y: bounds.y }, // a la izquierda del mouse
    { x: cursor.x + gap, y: bounds.y }, // a la derecha
    { x: bounds.x, y: cursor.y - height - gap }, // arriba
    { x: bounds.x, y: cursor.y + gap } // abajo
  ]
    .map(clamp)
    .filter((c) => !inside({ ...c, width, height }, cursor, gap / 2))
  if (!candidates.length) return null
  const dist = (c) => Math.hypot(c.x - bounds.x, c.y - bounds.y)
  return candidates.sort((a, b) => dist(a) - dist(b))[0]
}

// getWindow: la ventana de Pixie; getMode: 'compact' | 'notice' | 'expanded' | 'game'
// workArea(bounds): la zona de trabajo de la pantalla donde está; enabled(): si está prendido en Ajustes
export function createDodger({ getWindow, getMode, workArea, enabled = () => true, now = () => Date.now(), setTimer = setTimeout, log = () => {} }) {
  let overSince = null
  let lastUserMove = 0
  let lastMode = null
  let modeChangedAt = 0
  let animatingUntil = 0
  let watched = null

  // Si la ventana se mueve y no fue ella, la estás arrastrando
  function watch(win) {
    if (watched === win) return
    watched = win
    win.on('move', () => {
      if (now() > animatingUntil) lastUserMove = now()
    })
  }

  function moveTo(win, from, to) {
    const steps = 8
    animatingUntil = now() + ANIMATION_MS + 120
    for (let i = 1; i <= steps; i++) {
      setTimer(() => {
        if (win.isDestroyed()) return
        const k = 1 - (1 - i / steps) ** 3 // frena al llegar
        win.setPosition(Math.round(from.x + (to.x - from.x) * k), Math.round(from.y + (to.y - from.y) * k))
      }, (ANIMATION_MS / steps) * i)
    }
  }

  // Se llama cada vez que se mueve el mouse
  function check(cursor) {
    const win = getWindow()
    if (!win || win.isDestroyed() || !win.isVisible()) return false
    watch(win)
    const mode = getMode()
    if (mode !== lastMode) {
      lastMode = mode
      modeChangedAt = now()
    }
    const b = win.getBounds()
    const t = now()
    const blocked = !enabled() || mode !== 'compact' || t - modeChangedAt < AFTER_MODE_MS || t - lastUserMove < AFTER_USER_MOVE_MS || t < animatingUntil
    if (blocked || !inside(b, cursor)) {
      overSince = null
      return false
    }
    overSince ??= t
    if (t - overSince < DWELL_MS) return false
    overSince = null
    const to = dodgeTarget(b, cursor, workArea(b))
    if (!to) return false
    moveTo(win, b, to)
    log(`me corrí para no tapar lo que ibas a tocar (${b.x},${b.y} → ${to.x},${to.y})`)
    return true
  }

  return { check }
}
