import { Suspense, lazy, useEffect, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import logo from '../images/PIXIE-LogoEyes.png';
import Aurora from './Aurora';
import Hero, { Closing } from './Hero';
import Reveal from './Reveal';
import PixieScreen from './PixieScreen';
import { DownloadButton, REPO_URL, useLatestRelease } from './download';

const DayScene = lazy(() => import('./DayScene'));
const Companion = lazy(() => import('./Companion'));

const WIDE_QUERY = '(min-width: 900px)';

const PARTS = [
  { id: 'ojos', name: 'Ojos', reaction: 'lookAround', text: 'Mira tu pantalla para ayudarte con un error, y se da cuenta si estudiás, ves videos o jugás.' },
  { id: 'oidos', name: 'Oídos', reaction: 'wake', text: 'La llamás con «Pixie, ¿estás?». No manda audio a ningún lado hasta que la llamás.' },
  { id: 'memoria', name: 'Memoria', reaction: 'wink', text: 'Se acuerda de tu nombre, tu agenda y tus pendientes, y te avisa antes de cada evento.' },
  { id: 'boca', name: 'Boca', reaction: 'laugh', text: 'Te habla con la voz de Windows, o con una voz natural de acento argentino.' },
  { id: 'manos', name: 'Manos', reaction: 'wiggle', text: 'No se ven, pero abre apps y sitios, sube el volumen, ajusta el brillo y saca capturas.' },
];

const PROVIDERS = [
  { name: 'Gemini', note: 'Gratis, con límite por día. La recomendada: la bienvenida te guía paso a paso.' },
  { name: 'Groq', note: 'Gratis, con límites más chicos.' },
  { name: 'Claude', note: 'Pago por uso.' },
  { name: 'Ollama', note: 'Gratis y en tu propia compu, sin internet. Necesita una compu potente.' },
];

const STEPS = [
  { title: 'Descargá el instalador', desc: 'Guardá el archivo Pixie-…-instalador.exe y abrilo.' },
  { title: 'Pasá el aviso de Windows', desc: 'Pixie todavía no tiene firma digital, por eso aparece la pantalla azul. Tocá Más información y después Ejecutar de todas formas.' },
  { title: 'Configurala en un minuto', desc: 'Aparece su cara abajo a la derecha y una bienvenida te pide tu nombre y la clave gratis de la IA.' },
];

const FAQ = [
  { q: '¿Es gratis?', a: 'Sí, Pixie es gratis y de código abierto. Para conversar con IA ponés tu propia clave: la de Gemini es gratis y alcanza para unos 500 pedidos por día.' },
  { q: '¿Es seguro? ¿Por qué Windows me avisa?', a: 'El aviso aparece porque el instalador todavía no tiene firma digital, un certificado pago. El código es abierto y lo podés revisar en GitHub.' },
  { q: '¿Funciona sin internet?', a: 'En parte. Sin IA entiende las órdenes que conoce, como «abrí Spotify» o «subí el volumen», sin internet. Para conversar de todo necesita una IA: en línea, o Ollama en tu compu.' },
  { q: '¿Me escucha todo el tiempo?', a: 'Solo si activás «Pixie, ¿estás?». Compara lo que oye con tu voz en la compu y no manda audio a ningún lado hasta que la llamás. Mientras está prendido, Windows muestra el ícono del micrófono.' },
  { q: '¿Tengo que actualizarla a mano?', a: 'No. Busca versiones nuevas al arrancar y cada 6 horas, y te pregunta si te actualizás ahora. Si decís que no, se instala sola la próxima vez que se cierre.' },
  { q: '¿Qué necesito para usarla?', a: 'Windows 10 u 11. Para la IA en línea, también internet.' },
];

const TEAM = ['Sofia Power', 'Thomas Barrera Fuentes', 'Mauro Joel Beltrán', 'Lautaro Gabriel Palombo'];

function Anatomy() {
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);

  return (
    <section id="partes" className="anatomy">
      <Reveal className="anatomy-head">
        <h2>Parte por parte.</h2>
        <p className="lead">También pone música y YouTube, hace timers y Pomodoro, te cuenta el clima y juega al Pong.</p>
      </Reveal>
      <div className="anatomy-stage">
        <div className="anatomy-face">
          <div className="bezel">
            <PixieScreen reaction={reaction} label="Cara de Pixie, con sus partes señaladas" />
          </div>
        </div>
        {PARTS.map((p, i) => (
          <article
            key={p.id}
            className={`part part-${p.id}`}
            onPointerEnter={() => setReaction({ type: p.reaction, id: Date.now() })}
          >
            <Reveal delay={i * 0.06}>
              <i className="part-line" aria-hidden />
              <h3>{p.name}</h3>
              <p>{p.text}</p>
            </Reveal>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const release = useLatestRelease();
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <Aurora />
      <header className="top">
        <a href="#" className="top-brand">
          <img src={logo} alt="" width={24} height={24} />
          Pixie
        </a>
        <nav aria-label="Secciones">
          <a href="#partes">Qué hace</a>
          <a href="#ia">IA</a>
          <a href="#privacidad">Privacidad</a>
          <a href="#instalar">Instalar</a>
          <DownloadButton release={release} compact />
        </nav>
      </header>

      <main>
        <Hero release={release} />

        <Suspense fallback={<div className="day-loading" />}>
          <DayScene />
        </Suspense>

        <Anatomy />

        <section id="ia" className="ai">
          <Reveal className="ai-head">
            <h2>Elegí qué IA la hace pensar.</h2>
            <p className="lead">Cada persona pone su propia clave, y la podés cambiar cuando quieras desde Ajustes.</p>
          </Reveal>
          <dl className="providers">
            {PROVIDERS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.07}>
                <dt>{p.name}</dt>
                <dd>{p.note}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        <section id="privacidad" className="split">
          <h2>
            <span>Tu memoria vive en tu compu.</span> <span>Lo que mandás a una IA en línea, no.</span>
          </h2>
          <ul className="split-here">
            <li>Tu memoria y tu agenda se guardan en tu PC, con una copia de respaldo en tu OneDrive.</li>
            <li>Del uso de la compu solo anota el tipo de actividad, nunca lo que escribís.</li>
            <li>La clave de la IA queda cifrada con tu cuenta de Windows.</li>
            <li>Tiene un filtro de contenido siempre activo, y las acciones riesgosas, como apagar la compu, piden confirmación.</li>
          </ul>
          <ul className="split-away">
            <li>Cada mensaje viaja a ese servicio con lo que necesita para responderte: tu nombre, lo que le contaste, tus pendientes, tu agenda y la app que estás usando.</li>
            <li>También el texto del mail o la página que le pidas resumir.</li>
            <li>En el plan gratis de Gemini, Google puede usarlo para mejorar sus productos.</li>
            <li>Con Ollama, la IA corre en tu compu.</li>
          </ul>
        </section>

        <section id="instalar" className="install">
          <Reveal>
            <h2>Tres pasos y está andando.</h2>
            <ol>
              {STEPS.map(s => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </li>
              ))}
            </ol>
          </Reveal>
          <figure className="smartscreen">
            <div className="smartscreen-pile" aria-hidden>
              <div className="smartscreen-window">
                <p className="smartscreen-step">Primero</p>
                <p className="smartscreen-title">Windows protegió su PC</p>
                <p>SmartScreen de Microsoft Defender impidió el inicio de una aplicación no reconocida. Si ejecuta esta aplicación, podría poner su PC en riesgo.</p>
                <p className="smartscreen-link">Más información</p>
                <p className="smartscreen-actions"><span>No ejecutar</span></p>
              </div>
              <div className="smartscreen-window">
                <p className="smartscreen-step">Después</p>
                <p className="smartscreen-title">Windows protegió su PC</p>
                <p>Aplicación: Pixie-…-instalador.exe<br />Editor: Editor desconocido</p>
                <p className="smartscreen-actions"><span className="is-next">Ejecutar de todas formas</span><span>No ejecutar</span></p>
              </div>
            </div>
            <figcaption>Recreación del aviso de Windows. Primero tocá «Más información»; ahí aparece «Ejecutar de todas formas».</figcaption>
          </figure>
        </section>

        <section id="preguntas" className="faq">
          <h2>Preguntas de antes de bajarla.</h2>
          <Reveal>
            {FAQ.map(f => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown aria-hidden size={20} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </Reveal>
        </section>

        <Closing release={release}>
          <h2>Acá estoy.</h2>
          <p className="led-lead">Lista en un minuto, en una esquina de tu pantalla.</p>
        </Closing>
      </main>

      {wide && (
        <Suspense fallback={null}>
          <Companion />
        </Suspense>
      )}

      <footer className="foot">
        <p>Pixie empezó como un reloj de escritorio con ESP32 y una pantalla OLED. Hecha por estudiantes de Buenos Aires: {TEAM.join(', ')}.</p>
        <div>
          <a href={REPO_URL}>Código fuente <ExternalLink aria-hidden size={14} /></a>
          <a href={`${REPO_URL}/releases`}>Todas las versiones <ExternalLink aria-hidden size={14} /></a>
        </div>
      </footer>
    </LazyMotion>
  );
}
