import { useEffect, useRef } from 'react';

// Basado en Aurora Background de 21st.dev (pulkitxm), con los colores de Pixie.
// Dibuja en baja resolución y a 20 cuadros: al ser difuso no se nota y gasta mucho menos.
const LAYERS = [
  ['rgba(156, 211, 255, 0.2)', 'rgba(74, 112, 196, 0.1)', 'transparent'],
  ['rgba(126, 140, 255, 0.13)', 'transparent', 'transparent'],
];
const BLOBS = 4;
const SCALE = 0.2;
const FRAME_MS = 50;

export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let t = 0;
    let raf = 0;
    let lastFrame = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < BLOBS; i++) {
        const [c1, c2, c3] = LAYERS[i % LAYERS.length];
        const phase = (i / BLOBS) * Math.PI * 2 + t;
        const x = w / 2 + Math.sin(phase) * (w * 0.32) + Math.cos(t * 0.5) * (w * 0.1);
        const y = h / 2 + Math.cos(phase * 0.7) * (h * 0.32) + Math.sin(t * 0.3) * (h * 0.1);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.42);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(0.5, c2);
        gradient.addColorStop(1, c3);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth * SCALE);
      canvas.height = Math.ceil(window.innerHeight * SCALE);
      draw();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      t += 0.0025;
      draw();
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="aurora" aria-hidden />;
}
