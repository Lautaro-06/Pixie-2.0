import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PixieScreen, { Mood } from './PixieScreen';

gsap.registerPlugin(ScrollTrigger);

const PINNED_QUERY = '(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)';

const MOMENTS = [
  {
    id: 'manana',
    clock: '8:30',
    title: 'A la mañana, te pone al día.',
    text: 'Le decís «buen día» y te cuenta la fecha, el clima de tu ciudad, tu agenda y tus timers.',
    bubble: 'Buen día. Hoy tenés dentista a las 17.',
    reaction: 'happy',
    notes: ['Lunes', '— comprar cartuchos', '— llamar al dentista'],
  },
  {
    id: 'tarde',
    clock: '15:10',
    title: 'Mientras estudiás, no estorba.',
    text: 'Sabe si estás estudiando, viendo videos o jugando. Te propone pausas y no molesta en reuniones.',
    bubble: 'Hace rato que estudiás. ¿Una pausa?',
    reaction: 'yawn',
    notes: ['Física, unidad 3', 'F = m · a', 'Repasar ejercicios 4 a 9'],
  },
  {
    id: 'noche',
    clock: '23:40',
    title: 'A la noche, se acuerda por vos.',
    text: 'Guarda tu agenda y tus pendientes, y te avisa antes de cada evento, aunque reinicies la compu.',
    bubble: 'El jueves rendís física. Te aviso antes.',
    reaction: 'wink',
    notes: ['Para el jueves', '— rendir física', '— llevar calculadora'],
  },
];

function Desktop({ moment, children }: { moment: number; children?: React.ReactNode }) {
  const m = MOMENTS[moment];
  return (
    <>
      <div className="desk-window" aria-hidden>
        <p className="desk-window-title">apuntes.txt</p>
        {m.notes.map(n => <p key={n}>{n}</p>)}
      </div>
      {children}
      <div className="desk-bar" aria-hidden>
        <span>Escena ilustrativa</span>
        <time>{m.clock}</time>
      </div>
    </>
  );
}

function Pinned() {
  const root = useRef<HTMLElement>(null);
  const [moment, setMoment] = useState(0);
  const [asleep, setAsleep] = useState(false);
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    setReaction({ type: MOMENTS[moment].reaction, id: Date.now() });
  }, [moment]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          start: 'top top',
          end: '+=280%',
          scrub: 0.4,
          onUpdate: self => {
            const p = self.progress;
            setMoment(p < 0.42 ? 0 : p < 0.74 ? 1 : 2);
            setAsleep(p > 0.95);
          },
        },
      });
      // Se achica hasta su esquina, y el día avanza a su alrededor.
      tl.fromTo('.desk-pixie', { scale: 3, x: '-24vw', y: '-22vh' }, { scale: 1, x: 0, y: 0, duration: 1 })
        .fromTo('.desk-bubble', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.8)
        .fromTo('.day-text-0', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7)
        .fromTo('.desk-tarde', { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.7)
        .to('.day-text-0', { opacity: 0, duration: 0.25 }, 1.7)
        .fromTo('.day-text-1', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 1.95)
        .fromTo('.desk-noche', { opacity: 0 }, { opacity: 1, duration: 0.5 }, 2.8)
        .to('.day-text-1', { opacity: 0, duration: 0.25 }, 2.8)
        .fromTo('.day-text-2', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 3.05)
        .to({}, { duration: 0.7 });
    }, root);
    return () => ctx.revert();
  }, []);

  // GSAP envuelve la sección al fijarla: React solo toca este div de afuera.
  return (
    <div>
      <section ref={root} className={`day is-pinned is-${MOMENTS[moment].id}`} aria-label="Un día con Pixie">
      <div className="desk-wall desk-manana" />
      <div className="desk-wall desk-tarde" />
      <div className="desk-wall desk-noche" />
      <div className="day-texts">
        {MOMENTS.map((m, i) => (
          <div key={m.id} className={`day-text day-text-${i}`}>
            <h2>{m.title}</h2>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <Desktop moment={moment}>
        <div className="desk-pixie">
          <p className="reply desk-bubble">{MOMENTS[moment].bubble}</p>
          <div className="bezel is-small">
            <PixieScreen
              mood={(asleep ? 'sleeping' : 'idle') as Mood}
              reaction={reaction}
              label="Pixie en la esquina de la pantalla"
            />
          </div>
        </div>
      </Desktop>
    </section>
    </div>
  );
}

function Stacked() {
  return (
    <section className="day is-stacked" aria-label="Un día con Pixie">
      {MOMENTS.map((m, i) => (
        <article key={m.id} className={`day-panel is-${m.id}`}>
          <h2>{m.title}</h2>
          <p>{m.text}</p>
          <div className="day-panel-desk">
            <Desktop moment={i}>
              <div className="desk-pixie">
                <p className="reply">{m.bubble}</p>
                <div className="bezel is-small">
                  <PixieScreen mood={i === 2 ? 'sleeping' : 'idle'} label="Pixie en la esquina de la pantalla" />
                </div>
              </div>
            </Desktop>
          </div>
        </article>
      ))}
    </section>
  );
}

export default function DayScene() {
  const [pinned, setPinned] = useState(() => window.matchMedia(PINNED_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(PINNED_QUERY);
    const onChange = () => setPinned(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return pinned ? <Pinned /> : <Stacked />;
}
