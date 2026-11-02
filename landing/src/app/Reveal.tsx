import { ReactNode } from 'react';
import { m as motion, useReducedMotion } from 'motion/react';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Entra una sola vez, al aparecer en pantalla, y se desenfoca suave.
export default function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)', transform: 'translateY(14px)' }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
