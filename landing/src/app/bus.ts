// Cualquier sección le puede pedir algo a la Pixie de la esquina.
export interface Say {
  text: string | null;
  reaction: string | null;
  mood?: 'sleeping';
}

const listeners = new Set<(s: Say) => void>();

export function say(text: string | null, reaction: string | null, mood?: 'sleeping') {
  listeners.forEach(l => l({ text, reaction, mood }));
}

export function listen(fn: (s: Say) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
