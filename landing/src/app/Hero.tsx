import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m as motion, useReducedMotion } from 'motion/react';
import PixieScreen, { Mood } from './PixieScreen';
import { DownloadButton, Release } from './download';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DEMOS = [
  { ask: 'abrí YouTube y subí el volumen', reply: 'Listo, ya está abierto.', reaction: 'happy' },
  { ask: 'avisame en 5 minutos que saque la pizza', reply: 'Dale, en 5 minutos te aviso.', reaction: 'wink' },
  { ask: 'el jueves rindo física, agendalo', reply: 'Agendado. Te aviso antes.', reaction: 'love' },
  { ask: 'juguemos al pong', reply: '¡Dale! Gana el primero que llega a 3.', reaction: 'wiggle' },
];

export default function Hero({ release }: { release: Release | null }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(-1);
  const [answered, setAnswered] = useState(false);
  const [mood, setMood] = useState<Mood>('idle');
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>({ type: 'boot', id: 0 });
  const [speech, setSpeech] = useState<{ id: number; ms: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const timer = useRef<number>();
  const shown = useRef(-1);

  const play = (i: number) => {
    clearTimeout(timer.current);
    shown.current = i;
    setActive(i);
    setAnswered(false);
    setMood('thinking');
    timer.current = window.setTimeout(() => {
      setMood('idle');
      setAnswered(true);
      setReaction({ type: DEMOS[i].reaction, id: Date.now() });
      setSpeech({ id: Date.now(), ms: 1400 });
    }, 800);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Se muestra sola hasta que alguien toca un pedido.
  useEffect(() => {
    if (reduce || touched) return;
    const id = setInterval(() => {
      if (document.hidden || window.scrollY > 300) return;
      play((shown.current + 1) % DEMOS.length);
    }, 5200);
    return () => clearInterval(id);
  }, [reduce, touched]);

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, transform: 'translateY(14px)' },
          animate: { opacity: 1, transform: 'translateY(0px)' },
          transition: { duration: 0.6, delay, ease: EASE_OUT },
        };

  return (
    <section className="hero">
      <motion.div className="hero-device" {...rise(0)}>
        <div className="bezel">
          <PixieScreen mood={mood} reaction={reaction} speech={speech} label="Cara de Pixie, que te mira y reacciona" />
        </div>
        <div className="hero-reply" aria-live="polite">
          <AnimatePresence mode="wait">
            {answered && active >= 0 && (
              <motion.p
                key={active}
                className="reply"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(6px) scale(0.97)' }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px) scale(1)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {DEMOS[active].reply}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="hero-copy">
        <div>
          <motion.h1 {...rise(0.08)}>Pixie, ¿estás?</motion.h1>
          <motion.p className="hero-lead" {...rise(0.14)}>
            Una asistente para Windows que vive en una esquina de tu pantalla. La llamás con la voz o con{' '}
            <kbd>Ctrl+Espacio</kbd>, le pedís algo y lo hace en tu compu.
          </motion.p>
        </div>
        <motion.div {...rise(0.2)}>
          <DownloadButton release={release} />
        </motion.div>
      </div>

      <motion.div className="hero-try" {...rise(0.26)}>
        <p>Probá un pedido <span>(demo con respuestas de ejemplo)</span></p>
        <ul>
          {DEMOS.map((d, i) => (
            <li key={d.ask}>
              <button
                type="button"
                aria-pressed={active === i}
                onClick={() => {
                  setTouched(true);
                  play(i);
                }}
              >
                «{d.ask}»
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
