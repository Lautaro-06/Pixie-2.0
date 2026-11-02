import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import logo from '../images/PIXIE-LogoEyes.png';
import Hero from './Hero';
import PixieScreen from './PixieScreen';
import { DownloadButton, REPO_URL, Release, useLatestRelease } from './download';

const DayScene = lazy(() => import('./DayScene'));

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

function Closing({ release }: { release: Release | null }) {
  const ref = useRef<HTMLElement>(null);
  const [reaction, setReaction] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setReaction({ type: 'wake', id: Date.now() });
    }, { threshold: 0.5 });
    seen.observe(ref.current!);
    return () => seen.disconnect();
  }, []);

  return (
    <section ref={ref} className="closing">
      <div>
        <div className="bezel">
          <PixieScreen reaction={reaction} />
        </div>
      </div>
      <div>
        <h2>Acá estoy.</h2>
        <p>Lista en un minuto, en una esquina de tu pantalla.</p>
        <DownloadButton release={release} />
      </div>
    </section>
  );
}

export default function App() {
  const release = useLatestRelease();

  return (
    <LazyMotion features={domAnimation}>
      <header className="top">
        <a href="#" className="top-brand">
          <img src={logo} alt="" width={24} height={24} />
          Pixie
        </a>
        <nav aria-label="Secciones">
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

        <section id="ia" className="band ai">
          <div className="wrap">
            <h2>Elegí qué IA la hace pensar.</h2>
            <p className="lead">Cada persona pone su propia clave, y la podés cambiar cuando quieras desde Ajustes.</p>
            <dl className="providers">
              {PROVIDERS.map(p => (
                <div key={p.name}>
                  <dt>{p.name}</dt>
                  <dd>{p.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="privacidad" className="band">
          <div className="wrap privacy">
            <h2>Tu memoria vive en tu compu. Vos elegís qué sale.</h2>
            <div>
              <p>Tu memoria y tu agenda se guardan en tu PC, con una copia de respaldo en tu OneDrive. Del uso de la compu solo anota el tipo de actividad, nunca lo que escribís. La clave de la IA queda cifrada con tu cuenta de Windows.</p>
              <p>Con una IA en línea, cada mensaje viaja a ese servicio junto con lo que necesita para responderte: tu nombre, lo que le contaste, tus pendientes, tu agenda y la app que estás usando. En el plan gratis de Gemini, Google puede usarlo para mejorar sus productos. Con Ollama, la IA corre en tu compu.</p>
              <p>Tiene un filtro de contenido siempre activo, y las acciones riesgosas, como apagar la compu, piden confirmación.</p>
            </div>
          </div>
        </section>

        <section id="instalar" className="band">
          <div className="wrap install">
            <div>
              <h2>Tres pasos y está andando.</h2>
              <ol>
                {STEPS.map(s => (
                  <li key={s.title}>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="smartscreen">
              <div aria-hidden>
                <p className="smartscreen-title">Windows protegió su PC</p>
                <p>SmartScreen de Microsoft Defender impidió el inicio de una aplicación no reconocida.</p>
                <p className="smartscreen-link">Más información</p>
                <p className="smartscreen-actions"><span>Ejecutar de todas formas</span><span>No ejecutar</span></p>
              </div>
              <figcaption>Así se ve el aviso, recreado para esta página. Primero tocá «Más información» y aparece «Ejecutar de todas formas».</figcaption>
            </figure>
          </div>
        </section>

        <section className="band">
          <div className="wrap faq">
            <h2>Preguntas de antes de bajarla.</h2>
            <div>
              {FAQ.map(f => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <Closing release={release} />
      </main>

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
