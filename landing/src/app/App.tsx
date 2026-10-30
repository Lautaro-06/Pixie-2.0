import React, { useEffect, useState } from 'react';
import {
  Download, Mic, Brain, CalendarClock, Eye, Monitor, Timer, CloudSun, Gamepad2,
  ShieldCheck, Lock, Keyboard, Check, AlertTriangle, ExternalLink, Music, Sparkles,
} from 'lucide-react';
import { gifCycleAll } from './gifs';
import logo from '../images/PIXIE-LogoEyes.png';

const REPO = 'Lautaro-06/Pixie-2.0';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const REPO_URL = `https://github.com/${REPO}`;

interface Release {
  version: string;
  url: string;
  sizeMb: number | null;
}

function useLatestRelease() {
  const [release, setRelease] = useState<Release | null>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const exe = (data.assets ?? []).find((a: { name: string }) => a.name.endsWith('.exe'));
        setRelease({
          version: data.tag_name,
          url: exe?.browser_download_url ?? RELEASES_URL,
          sizeMb: exe ? Math.round(exe.size / 1_048_576) : null,
        });
      })
      .catch(() => setRelease(null));
  }, []);
  return release;
}

function PixieFace({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % gifCycleAll.length), 3500);
    return () => clearInterval(id);
  }, []);
  const box = size === 'lg' ? 'w-56 h-40 sm:w-72 sm:h-52' : 'w-24 h-16';
  return (
    <div className={`${box} rounded-2xl bg-black border border-white/10 glow-md flex items-center justify-center overflow-hidden`}>
      <img src={gifCycleAll[idx]} alt="Cara animada de Pixie" className="w-full h-full object-contain" />
    </div>
  );
}

function DownloadButton({ release, big = false }: { release: Release | null; big?: boolean }) {
  return (
    <div className="flex flex-col items-center sm:items-start gap-2">
      <a
        href={release?.url ?? RELEASES_URL}
        className={`inline-flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors ${big ? 'px-6 py-3.5 text-base' : 'px-4 py-2 text-sm'}`}
      >
        <Download className={big ? 'w-5 h-5' : 'w-4 h-4'} />
        Descargar para Windows
      </a>
      {big && (
        <span className="text-xs text-muted-foreground font-mono">
          {release
            ? `${release.version}${release.sizeMb ? ` · ${release.sizeMb} MB` : ''} · Windows 10 y 11`
            : 'Windows 10 y 11 · gratis'}
        </span>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: Mic, title: 'La llamás con la voz', desc: 'Decí «Pixie, ¿estás?» y te escucha. Reconoce tu voz en la compu, sin mandar audio a ningún lado hasta que la llamás.' },
  { icon: Brain, title: 'IA que entiende cualquier cosa', desc: 'Con una clave gratis de Gemini conversa de verdad. También anda con Groq, Claude u Ollama 100% local.' },
  { icon: CalendarClock, title: 'Se acuerda de todo', desc: 'Tu nombre, tu agenda, tus pendientes y lo que le contás. Te avisa antes de cada evento, aunque reinicies la compu.' },
  { icon: Eye, title: 'Se da cuenta y habla primero', desc: 'Sabe si estás estudiando, viendo videos o jugando. Te propone pausas, te saluda a la mañana y no molesta en reuniones.' },
  { icon: Monitor, title: 'Maneja tu compu', desc: 'Abre apps y sitios, sube el volumen, ajusta el brillo, saca capturas y mira tu pantalla para ayudarte con un error.' },
  { icon: Music, title: 'Música y YouTube', desc: '«Poné goteo de Duki» y lo reproduce de una. Con la extensión de Chrome da like, saltea anuncios y resume mails.' },
  { icon: Timer, title: 'Timers y Pomodoro', desc: '«Avisame en 5 minutos que saque la pizza». Si no estás frente a la compu, el aviso te llega por WhatsApp.' },
  { icon: CloudSun, title: 'Clima y resumen del día', desc: '«Buen día» y te cuenta la fecha, el clima de tu ciudad, tu agenda y tus timers.' },
  { icon: Gamepad2, title: 'Juega al Pong', desc: 'Sus ojos y su boca se transforman en un Pong. Gana el primero que llega a 3; si te distraés, te gana.' },
];

const EXAMPLES = [
  'abrí YouTube y subí el volumen',
  'el jueves rindo física, agendalo',
  '¿qué ves en mi pantalla?',
  'avisame en 10 minutos',
  '¿cómo está el clima?',
  'juguemos al pong',
];

const STEPS = [
  { title: 'Descargá el instalador', desc: 'Tocá «Descargar para Windows» y guardá el archivo Pixie-…-instalador.exe.' },
  { title: 'Abrilo', desc: 'Como Pixie todavía no tiene firma digital, Windows muestra «Windows protegió su PC». Tocá Más información → Ejecutar de todas formas.' },
  { title: 'Configurala en un minuto', desc: 'Aparece su cara abajo a la derecha y una bienvenida te pide tu nombre y la clave gratis de la IA. Si nunca sacaste una, te guía paso a paso.' },
];

const TEAM = ['Sofia Power', 'Thomas Barrera Fuentes', 'Mauro Joel Beltrán', 'Lautaro Gabriel Palombo'];

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-16 sm:py-20">
      <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">{eyebrow}</p>
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 max-w-2xl">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const release = useLatestRelease();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-white/8 bg-background/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-7 w-auto" />
            <span className="font-mono font-bold text-primary tracking-wide">PIXIE</span>
          </a>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#funciones" className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors">Funciones</a>
            <a href="#instalar" className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors">Instalar</a>
            <DownloadButton release={release} />
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <section className="pt-16 pb-12 sm:pt-24 sm:pb-16 flex flex-col-reverse sm:flex-row items-center gap-10 sm:gap-14">
          <div className="flex-1 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              Pixie 2.0 · ahora en tu escritorio
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-4">
              Tu asistente que vive<br className="hidden sm:block" /> en una esquina de la pantalla.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto sm:mx-0">
              Llamala diciendo <span className="text-foreground font-semibold">«Pixie, ¿estás?»</span> o con{' '}
              <kbd className="font-mono text-sm px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-foreground">Ctrl+Espacio</kbd>,
              pedile lo que necesitás y lo hace en tu compu.
            </p>
            <DownloadButton release={release} big />
          </div>
          <PixieFace />
        </section>

        {/* Examples */}
        <div className="flex flex-wrap justify-center sm:justify-start gap-2 pb-4">
          {EXAMPLES.map(e => (
            <span key={e} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-muted-foreground">
              «{e}»
            </span>
          ))}
        </div>

        <Section id="funciones" eyebrow="Qué hace" title="Le hablás como a una persona. Entiende voseo, sinónimos y hasta «abrí yutub».">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 glow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="instalar" eyebrow="Instalación" title="Tres pasos y está andando.">
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="font-semibold mt-2 mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4 glow-accent">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90">
              El aviso azul de Windows es normal: aparece con cualquier programa nuevo sin certificado pago. Pixie es de código abierto y podés revisar todo en{' '}
              <a href={REPO_URL} className="text-primary underline underline-offset-2">GitHub</a>.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex gap-3">
              <Keyboard className="w-4 h-4 text-primary shrink-0 mt-1" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Se actualiza sola.</span> Busca versiones nuevas al arrancar y cada 6 horas, y te pregunta antes de instalarlas.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex gap-3">
              <Check className="w-4 h-4 text-primary shrink-0 mt-1" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Requisitos:</span> Windows 10 u 11 e internet para la IA. La clave de Gemini es gratis y cada persona pone la suya.
              </p>
            </div>
          </div>
        </Section>

        <Section eyebrow="Privacidad" title="Lo tuyo queda en tu compu.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <Lock className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Memoria local y claves cifradas</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lo que Pixie sabe de vos se guarda en tu PC. Del uso de la compu solo anota el tipo de actividad, nunca lo que escribís. La clave de la IA queda cifrada con tu cuenta de Windows. Con Ollama, nada sale de la compu.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <ShieldCheck className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Filtro de contenido siempre activo</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pensada para que la use cualquiera: nunca abre ni busca contenido para adultos, violento ni ilegal, y Google abre con búsqueda segura. Las acciones riesgosas, como apagar la compu, siempre piden confirmación.
              </p>
            </div>
          </div>
        </Section>

        <Section eyebrow="Equipo" title="Hecho por estudiantes de Buenos Aires.">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <ul className="flex flex-wrap gap-2">
              {TEAM.map(n => (
                <li key={n} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">{n}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted-foreground mt-6 max-w-2xl">
            Pixie empezó como un reloj de escritorio con ESP32 y una pantalla OLED. Su cara se dibuja a partir de ese diseño original, ahora viviendo en tu escritorio.
          </p>
        </Section>

        {/* Final CTA */}
        <section className="my-8 rounded-3xl border border-white/10 bg-white/[0.03] glow-md p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8">
          <PixieFace size="sm" />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold mb-2">¿La probás?</h2>
            <p className="text-muted-foreground text-sm">Gratis, de código abierto y lista en un minuto.</p>
          </div>
          <DownloadButton release={release} big />
        </section>
      </main>

      <footer className="border-t border-white/8 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 items-center justify-between text-sm text-muted-foreground">
          <span className="font-mono">PIXIE · {new Date().getFullYear()}</span>
          <div className="flex gap-5">
            <a href={REPO_URL} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              Código fuente <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href={`https://github.com/${REPO}/releases`} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              Todas las versiones <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
