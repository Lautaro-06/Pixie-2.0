import { ReactNode, useEffect, useRef, useState } from 'react';
import { m as motion, useReducedMotion } from 'motion/react';
import PixieScreen from './PixieScreen';
import { DownloadButton, Release } from './download';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FACTS = ['Gratis', 'Código abierto', 'Windows 10 y 11', 'Se actualiza sola'];

function useRise() {
  const reduce = useReducedMotion();
  return (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay } }
      : {
          initial: { opacity: 0, transform: 'translateY(18px)' },
          animate: { opacity: 1, transform: 'translateY(0px)' },
          transition: { duration: 0.7, delay, ease: EASE_OUT },
        };
}

// La pregunta ocupa la pantalla en diagonal, y Pixie la contesta.
export default function Hero({ release }: { release: Release | null }) {
  const rise = useRise();
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>({ type: 'boot', id: 0 });
  const react = (type: string) => setReaction({ type, id: Date.now() });

  return (
    <section className="stage">
      <h1>
        <motion.span className="stage-t1" {...rise(0.05)}>Pixie,</motion.span>{' '}
        <motion.span className="stage-t2" {...rise(0.15)}>¿estás?</motion.span>
      </h1>
      <motion.div className="stage-face" {...rise(0.25)}>
        <PixieScreen bare reaction={reaction} label="Cara de Pixie, que te mira y reacciona" />
        <motion.p className="reply stage-answer" aria-hidden {...rise(1.1)}>Acá estoy.</motion.p>
      </motion.div>
      <motion.div
        className="stage-text"
        {...rise(0.3)}
        onPointerEnter={() => react('happy')}
        onFocus={() => react('happy')}
        onClick={() => react('love')}
      >
        <p>
          Una asistente para Windows que vive en una esquina de tu pantalla. La llamás con la voz o con{' '}
          <kbd>Ctrl+Espacio</kbd>, le pedís algo y lo hace en tu compu.
        </p>
        <DownloadButton release={release} />
      </motion.div>
      <motion.ul className="stage-facts" {...rise(0.4)}>
        {FACTS.map(f => <li key={f}>{f}</li>)}
      </motion.ul>
    </section>
  );
}

export function Closing({ release, children }: { release: Release | null; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);
  const react = (type: string) => setReaction({ type, id: Date.now() });

  useEffect(() => {
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) react('wake');
    }, { threshold: 0.5 });
    seen.observe(section.current!);
    return () => seen.disconnect();
  }, []);

  return (
    <section ref={section} className="led">
      <div className="led-face">
        <PixieScreen bare reaction={reaction} label="Cara de Pixie, que te mira y reacciona" />
      </div>
      <div className="led-copy">{children}</div>
      <div
        className="led-cta"
        onPointerEnter={() => react('happy')}
        onFocus={() => react('happy')}
        onClick={() => react('love')}
      >
        <DownloadButton release={release} />
      </div>
    </section>
  );
}
