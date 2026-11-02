import { useEffect, useRef, useState } from 'react';
import PixieScreen from './PixieScreen';
import { listen, say } from './bus';

const SECTIONS: [string, string, string][] = [
  ['#partes', 'Esa soy yo, parte por parte.', 'happy'],
  ['#ia', 'Vos elegís quién piensa por mí.', 'wink'],
  ['#privacidad', 'Esto te lo digo de frente.', 'surprised'],
  ['#instalar', 'El aviso azul es normal.', 'happy'],
  ['#preguntas', 'Preguntá nomás.', 'lookAround'],
];

const SAY_MS = 5000;

// Después del hero, Pixie se muda a la esquina de tu navegador, como en tu compu.
export default function Companion() {
  const hide = useRef<number>();
  const [text, setText] = useState('');
  const [showing, setShowing] = useState(false);
  const [gone, setGone] = useState(true);
  const [mood, setMood] = useState<'idle' | 'sleeping'>('idle');
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => listen(s => {
    setMood(s.mood ?? 'idle');
    if (s.reaction) setReaction({ type: s.reaction, id: Date.now() });
    if (s.text === null) return;
    setText(s.text);
    setShowing(true);
    clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setShowing(false), SAY_MS);
  }), []);

  useEffect(() => {
    const talk = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const hit = SECTIONS.find(([id]) => entry.target.matches(id));
        if (entry.isIntersecting && hit) say(hit[1], hit[2]);
      });
    }, { threshold: 0.4 });
    SECTIONS.forEach(([id]) => {
      const el = document.querySelector(id);
      if (el) talk.observe(el);
    });

    // Donde ya hay una cara grande, la esquina queda vacía.
    const walls = new Map<Element, boolean>();
    const away = new IntersectionObserver(entries => {
      entries.forEach(e => walls.set(e.target, e.target.matches('.day-stacked') ? e.isIntersecting : e.intersectionRatio > 0.35));
      setGone([...walls.values()].some(Boolean));
    }, { threshold: [0, 0.35, 0.6] });
    document.querySelectorAll('.stage, .led, .day, .day-stacked').forEach(el => away.observe(el));

    return () => {
      talk.disconnect();
      away.disconnect();
    };
  }, []);

  return (
    <div className={`companion${gone ? ' is-gone' : ''}`}>
      <div className="companion-body">
        <p className={`reply companion-say${showing ? ' is-on' : ''}`} aria-hidden>{text}</p>
        <button
          type="button"
          className="companion-face"
          aria-label="Saludar a Pixie"
          onClick={() => say('¡Hola!', 'love')}
        >
          <span className="bezel is-small is-tiny">
            <PixieScreen mood={mood} reaction={reaction} label="Pixie en la esquina de la pantalla" />
          </span>
        </button>
      </div>
    </div>
  );
}
