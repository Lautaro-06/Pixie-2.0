import { useEffect, useRef } from 'react';
import { renderFace, WIDTH, HEIGHT } from '../../../src/renderer/src/face/draw.js';
import { REACTIONS, compose, talking } from '../../../src/renderer/src/face/animations.js';

const PIXEL_ON = '#9cd3ff';
const PIXEL_DOT = '#0c131c';
const SCREEN = '#04060a';
const FOLLOW_MS = 4000;
const SMALL_WIDTH = 192;
const TINY_WIDTH = 128;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type Mood = 'idle' | 'listening' | 'thinking' | 'sleeping';

interface Props {
  mood?: Mood;
  reaction?: { type: string; id: number } | null;
  speech?: { id: number; ms: number } | null;
  label?: string;
  bare?: boolean;
}

// La misma cara de la app: dibuja con renderFace y anima con REACTIONS.
export default function PixieScreen({ mood = 'idle', reaction = null, speech = null, label = 'Cara de Pixie', bare = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef({
    mood,
    moodStart: performance.now(),
    overlays: [] as { kind: string; duration: number; fn: unknown; start: number }[],
    follow: null as { at: number; look: { lookX: number; lookY: number } } | null,
  });

  useEffect(() => {
    const e = engine.current;
    if (e.mood !== mood) {
      e.mood = mood;
      e.moodStart = performance.now();
    }
  }, [mood]);

  useEffect(() => {
    const def = reaction && REACTIONS[reaction.type];
    if (!def) return;
    const e = engine.current;
    e.overlays = e.overlays.filter(o => o.kind !== 'reaction' && o.kind !== 'idle');
    e.overlays.push({ kind: 'reaction', duration: def[0], fn: def[1], start: performance.now() });
  }, [reaction]);

  useEffect(() => {
    if (!speech) return;
    const e = engine.current;
    e.overlays = e.overlays.filter(o => o.kind !== 'talk');
    e.overlays.unshift({ kind: 'talk', duration: speech.ms, fn: talking, start: performance.now() });
  }, [speech]);

  // Mira hacia el puntero, igual que en el escritorio.
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || ev.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      engine.current.follow = {
        at: Date.now(),
        look: {
          lookX: Math.round(clamp((ev.clientX - (r.left + r.width / 2)) / 450, -1, 1) * 4) / 4,
          lookY: Math.round(clamp((ev.clientY - (r.top + r.height / 2)) / 300, -1, 1) * 3) / 3,
        },
      };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Pestañeos y miradas al azar.
  useEffect(() => {
    let timer: number;
    const next = () => {
      timer = window.setTimeout(() => {
        const e = engine.current;
        const busy = e.overlays.some(o => o.kind === 'reaction' || o.kind === 'idle');
        if (!busy && e.mood === 'idle') {
          const r = Math.random();
          const type = r < 0.18 ? 'doubleBlink' : r < 0.3 ? 'glanceLeft' : r < 0.42 ? 'glanceRight' : 'blink';
          const [duration, fn] = REACTIONS[type];
          e.overlays.push({ kind: 'idle', duration, fn, start: performance.now() });
        }
        next();
      }, 1600 + Math.random() * 3600);
    };
    next();
    return () => clearTimeout(timer);
  }, []);

  // Dibuja unas 30 veces por segundo, solo si se ve y si la cara cambió.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = document.createElement('canvas');
    let cell = 2;
    let visible = true;
    let last: Uint8Array | null = null;
    const host = canvas.parentElement!;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Múltiplo entero del tamaño de la grilla: si no, los píxeles quedan desparejos.
      let room: number;
      if (bare) {
        room = host.parentElement!.clientWidth;
      } else {
        const bezel = canvas.closest('.bezel') as HTMLElement;
        const box = getComputedStyle(bezel);
        const frame = parseFloat(box.paddingLeft) * 2 + parseFloat(box.borderLeftWidth) * 2;
        room = bezel.classList.contains('is-tiny') ? TINY_WIDTH
          : bezel.classList.contains('is-small') ? SMALL_WIDTH
          : bezel.parentElement!.clientWidth - frame;
      }
      cell = Math.max(2, Math.floor((room * dpr) / WIDTH));
      canvas.width = cell * WIDTH;
      canvas.height = cell * HEIGHT;
      canvas.style.width = `${(cell * WIDTH) / dpr}px`;
      canvas.style.height = `${(cell * HEIGHT) / dpr}px`;
      // La grilla apagada se dibuja una sola vez; en cada cuadro solo van los píxeles prendidos.
      grid.width = canvas.width;
      grid.height = canvas.height;
      const g = grid.getContext('2d')!;
      if (!bare) {
        g.fillStyle = SCREEN;
        g.fillRect(0, 0, grid.width, grid.height);
        if (cell >= 5) {
          g.fillStyle = PIXEL_DOT;
          for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) g.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
        }
      }
      last = null;
    };

    const tick = () => {
      if (!visible || document.hidden) return;
      const e = engine.current;
      const now = performance.now();
      e.overlays = e.overlays.filter(o => now - o.start < o.duration);
      const follow = e.follow && Date.now() - e.follow.at < FOLLOW_MS ? e.follow.look : null;
      const bits: Uint8Array = renderFace(compose(e.mood, e.moodStart, e.overlays, now, { still, follow }));
      if (last && last.every((v, i) => v === bits[i])) return;
      last = bits;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(grid, 0, 0);
      const gap = cell >= 5 ? 1 : 0;
      ctx.fillStyle = PIXEL_ON;
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          if (bits[y * WIDTH + x]) ctx.fillRect(x * cell, y * cell, cell - gap, cell - gap);
        }
      }
    };

    const sized = new ResizeObserver(fit);
    sized.observe(bare ? host.parentElement! : canvas.closest('.bezel')!.parentElement!);
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    seen.observe(canvas);
    fit();
    tick();
    const id = setInterval(tick, 33);
    return () => {
      clearInterval(id);
      sized.disconnect();
      seen.disconnect();
    };
  }, []);

  return (
    <div className="pixie-fit">
      <canvas ref={canvasRef} className="pixie-screen" role="img" aria-label={label} />
    </div>
  );
}
