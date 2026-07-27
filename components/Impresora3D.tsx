// Logo animado de impresora 3D (FDM): marco + cama + cabezal que se desliza y una
// pieza que se va imprimiendo por capas. Usa `currentColor`, así toma el color del
// contexto (blanco en la barra lateral, índigo en el login, etc.). La animación vive
// en globals.css (clases i3d-*) y se desactiva con prefers-reduced-motion.

export default function Impresora3D({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={`i3d ${className ?? ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {/* Marco: barra superior y postes */}
      <path d="M3.5 4.5 H20.5" />
      <path d="M5 4.5 V17" />
      <path d="M19 4.5 V17" />

      {/* Cama de impresión y patas */}
      <path d="M3 17 H21" />
      <path d="M6.5 17 V18.8" />
      <path d="M17.5 17 V18.8" />

      {/* Pieza que se imprime (crece por capas desde la cama) */}
      <path
        className="i3d-obj"
        d="M9.5 17 L9.5 13 Q9.5 12.2 10.3 12.2 L13.7 12.2 Q14.5 12.2 14.5 13 L14.5 17 Z"
        fill="currentColor"
        fillOpacity="0.22"
      />

      {/* Cabezal que se desliza en X (carro + boquilla) */}
      <g className="i3d-head">
        <rect x="10" y="3.5" width="4" height="2" rx="0.6" fill="currentColor" fillOpacity="0.22" />
        <path d="M12 5.5 V6.6" />
        <path d="M10.9 6.7 H13.1 L12 8.7 Z" fill="currentColor" strokeWidth="1" />
      </g>
    </svg>
  );
}
