import type { ReactNode } from 'react';

// Ícono de línea genérico (mismo trazo que Impresora3D: stroke, sin relleno) —
// evita depender de emojis, que se ven distinto según el sistema operativo.
export function IconoLinea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type Props = { className?: string };

export const IconoLupa = ({ className }: Props) => (
  <IconoLinea className={className}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.35-4.35" /></IconoLinea>
);

export const IconoGrafico = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M4 20V10M12 20V4M20 20v-6" /></IconoLinea>
);

export const IconoDescarga = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></IconoLinea>
);

export const IconoBasura = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M5 6h14" /><path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" /><path d="M7 6v13.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5V6" /><path d="M10 10.5v6M14 10.5v6" /></IconoLinea>
);

export const IconoAdvertencia = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 9.5v4.2" /><path d="M12 17h.01" /></IconoLinea>
);

export const IconoCheck = ({ className }: Props) => (
  <IconoLinea className={className}><path d="m4 12 5.5 5.5L20 7" /></IconoLinea>
);

export const IconoCerrar = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M5 5l14 14M19 5L5 19" /></IconoLinea>
);

export const IconoReloj = ({ className }: Props) => (
  <IconoLinea className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></IconoLinea>
);

export const IconoCalendario = ({ className }: Props) => (
  <IconoLinea className={className}><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 9.5h17" /><path d="M8 3v3.5M16 3v3.5" /></IconoLinea>
);

export const IconoSobre = ({ className }: Props) => (
  <IconoLinea className={className}><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="m3.5 6 8.5 7 8.5-7" /></IconoLinea>
);

export const IconoHilo = ({ className }: Props) => (
  <IconoLinea className={className}><circle cx="12" cy="12" r="9" /><path d="M6 8.5c3 1.5 9 1.5 12 0M6 12c3 1.5 9 1.5 12 0M6 15.5c3 1.5 9 1.5 12 0" /></IconoLinea>
);

export const IconoLlave = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M14.5 6.5a4 4 0 0 0-5.4 4.9L3 17.5V21h3.5l6.1-6.1a4 4 0 0 0 4.9-5.4l-2.9 2.9-2-2Z" /></IconoLinea>
);

export const IconoLapiz = ({ className }: Props) => (
  <IconoLinea className={className}><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8L17.3 5.5a2 2 0 0 0-2.8 0L4 16v4Z" /><path d="m13.5 7 3.5 3.5" /></IconoLinea>
);
