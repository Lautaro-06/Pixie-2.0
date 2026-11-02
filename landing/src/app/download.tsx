import { useEffect, useState } from 'react';
import { AnimatePresence, m as motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Download } from 'lucide-react';

const REPO = 'Lautaro-06/Pixie-2.0';

export interface Release {
  version: string;
  url: string;
  sizeMb: number;
}

declare const __FALLBACK_RELEASE__: Release | null;

export function useLatestRelease() {
  const [release, setRelease] = useState<Release | null>(__FALLBACK_RELEASE__);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const exe = (data.assets ?? []).find((a: { name: string }) => a.name.endsWith('.exe'));
        if (!exe) return;
        setRelease({
          version: data.tag_name,
          url: exe.browser_download_url,
          sizeMb: Math.round(exe.size / 1_048_576),
        });
      })
      .catch(() => {});
  }, []);
  return release;
}

function isWindows() {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return /win/i.test(uaData?.platform || navigator.platform || navigator.userAgent);
}

function isPhone() {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return uaData?.mobile || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function DownloadButton({ release, compact = false }: { release: Release | null; compact?: boolean }) {
  const [windows] = useState(isWindows);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState<'no' | 'si' | 'error'>('no');
  const reduce = useReducedMotion();

  if (!windows) {
    if (compact) return null;
    const link = window.location.origin + window.location.pathname;
    const copy = () =>
      navigator.clipboard.writeText(link).then(() => setCopied('si'), () => setCopied('error'));
    return (
      <div className="cta">
        <button type="button" className="cta-button" onClick={copy}>
          {copied === 'si' ? <Check aria-hidden size={20} className="shrink-0" /> : <Copy aria-hidden size={20} className="shrink-0" />}
          {copied === 'si' ? 'Link copiado' : 'Copiar link para la compu'}
        </button>
        <p className="cta-note" aria-live="polite">
          {copied === 'error'
            ? `Abrí ${link} en una compu con Windows.`
            : isPhone()
              ? 'Pixie es para Windows 10 y 11. Abrí este link en tu compu para bajarla.'
              : 'Por ahora Pixie es solo para Windows 10 y 11. Abrí este link en una compu con Windows.'}
        </p>
      </div>
    );
  }

  if (!release) {
    if (compact) return null;
    return <p className="cta-note">No pudimos encontrar el instalador. Probá de nuevo en un rato.</p>;
  }

  if (compact) {
    return (
      <a href={release.url} className="cta-button is-compact">
        <Download aria-hidden size={16} /> Descargar
      </a>
    );
  }

  return (
    <div className="cta">
      <a href={release.url} className="cta-button has-shimmer" onClick={() => setStarted(true)}>
        <span className="shimmer" aria-hidden><span /></span>
        <Download aria-hidden size={20} className="shrink-0" /> Descargar gratis
      </a>
      <p className="cta-note">{`${release.version} · ${release.sizeMb} MB · Windows 10 y 11`}</p>
      <div aria-live="polite">
        <AnimatePresence>
          {started && (
            <motion.p
              className="cta-after"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(6px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            >
              Al abrirlo, Windows puede avisar «Windows protegió su PC». Es normal:{' '}
              <a href="#instalar">mirá qué tocar</a>.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
