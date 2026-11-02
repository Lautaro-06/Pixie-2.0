import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PixieScreen, { Mood } from './PixieScreen';

gsap.registerPlugin(ScrollTrigger);

const PINNED_QUERY = '(min-width: 900px) and (min-height: 480px)';

const MOMENTS = [
  {
    id: 'manana',
    clock: '8:30',
    title: 'A la mañana, te pone al día.',
    text: 'Le decís «buen día» y te cuenta la fecha, el clima de tu ciudad, tu agenda y tus timers.',
    bubble: 'Buen día. Hoy tenés dentista a las 17.',
    reaction: 'happy',
  },
  {
    id: 'tarde',
    clock: '15:10',
    title: 'Mientras estudiás, no estorba.',
    text: 'Sabe si estás estudiando, viendo videos o jugando. Te propone pausas y no molesta en reuniones.',
    bubble: 'Hace rato que estudiás. ¿Una pausa?',
    reaction: 'yawn',
  },
  {
    id: 'noche',
    clock: '23:40',
    title: 'A la noche, se acuerda por vos.',
    text: 'Guarda tu agenda y tus pendientes, y te avisa antes de cada evento, aunque reinicies la compu.',
    bubble: 'El jueves rendís física. Te aviso antes.',
    reaction: 'wink',
  },
];

function Windows({ moment }: { moment: number }) {
  if (moment === 0) {
    return (
      <>
        <div className="w w-clima">
          <p className="w-title">Clima</p>
          <p className="w-big">18°</p>
          <p>Parcialmente nublado</p>
        </div>
        <div className="w w-agenda">
          <p className="w-title">Hoy</p>
          <p><b>17:00</b> Dentista</p>
          <p><b>Pendiente</b> Comprar cartuchos</p>
        </div>
      </>
    );
  }
  if (moment === 1) {
    return (
      <>
        <div className="w w-notes">
          <p className="w-title">apuntes.txt</p>
          <p><b>Física, unidad 3</b></p>
          <p>F = m · a</p>
          <p>Repasar ejercicios 4 a 9</p>
          <p>Traer calculadora</p>
          <p>Fuerza = masa × aceleración</p>
          <p>Preguntar el ejercicio 7</p>
          <p>Repasar unidad 2 el martes</p>
        </div>
        <div className="w w-timer">
          <p className="w-title">Pomodoro</p>
          <p className="w-big">18:42</p>
        </div>
      </>
    );
  }
  return (
    <div className="w w-aviso">
      <p className="w-title">Agenda de la semana</p>
      <p className="w-big">Jueves</p>
      <p>Rendir física</p>
    </div>
  );
}

function Monitor({ moment, mood = 'idle', reaction = null }: { moment: number; mood?: Mood; reaction?: { type: string; id: number } | null }) {
  const m = MOMENTS[moment];
  return (
    <div className={`monitor is-${m.id}`} aria-hidden>
      {MOMENTS.map((x, i) => <div key={x.id} className={`monitor-wall is-${x.id}${i === moment ? ' is-on' : ''}`} />)}
      <div key={moment} className="monitor-windows"><Windows moment={moment} /></div>
      <div className="monitor-pixie">
        <p key={m.bubble} className="reply monitor-say">{m.bubble}</p>
        <div className="bezel is-small is-tiny">
          <PixieScreen mood={mood} reaction={reaction} label="Pixie en la esquina de la pantalla" />
        </div>
      </div>
      <div className="monitor-bar">
        <span>Escena ilustrativa</span>
        <time>{m.clock}</time>
      </div>
    </div>
  );
}

function Pinned() {
  const root = useRef<HTMLElement>(null);
  const shown = useRef(0);
  const [moment, setMoment] = useState(0);
  const [asleep, setAsleep] = useState(false);
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.rail-progress', { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          start: 'top top',
          end: '+=220%',
          scrub: 0.4,
          onUpdate: self => {
            const next = self.progress < 0.34 ? 0 : self.progress < 0.68 ? 1 : 2;
            if (shown.current !== next) {
              shown.current = next;
              setMoment(next);
              setReaction({ type: MOMENTS[next].reaction, id: Date.now() });
            }
            setAsleep(self.progress > 0.95);
          },
        },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  // GSAP envuelve la sección al fijarla: React solo toca este div de afuera.
  return (
    <div>
      <section ref={root} className="day" aria-label="Un día con Pixie">
        <div className="day-top">
          <h2>Un día con Pixie.</h2>
          <div className="day-track" aria-hidden>
            <i className="rail-line"><i className="rail-progress" /></i>
            {MOMENTS.map((m, i) => (
              <span key={m.id} className={`day-stamp${i === moment ? ' is-on' : ''}`}>{m.clock}</span>
            ))}
          </div>
        </div>
        {MOMENTS.map((m, i) => (
          <div key={m.id} className={`day-copy is-${m.id}${i === moment ? ' is-on' : ''}`}>
            <span className="rail-time">{m.clock}</span>
            <h3>{m.title}</h3>
            <p>{m.text}</p>
          </div>
        ))}
        <Monitor moment={moment} mood={asleep ? 'sleeping' : 'idle'} reaction={reaction} />
      </section>
    </div>
  );
}

function Stacked() {
  return (
    <section className="day-stacked" aria-label="Un día con Pixie">
      <h2>Un día con Pixie.</h2>
      {MOMENTS.map((m, i) => (
        <article key={m.id}>
          <div className="day-note">
            <span className="rail-time">{m.clock}</span>
            <h3>{m.title}</h3>
            <p>{m.text}</p>
          </div>
          <Monitor moment={i} mood={i === 2 ? 'sleeping' : 'idle'} />
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
