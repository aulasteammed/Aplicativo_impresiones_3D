'use client';

// Envoltorio colapsable para las 5 secciones numeradas del Dashboard: reduce el
// scroll inicial (solo lo crítico viene abierto) sin ocultar del todo la sección
// colapsada — su resumen de una línea sigue siendo visible. El estado se recuerda
// por sección en localStorage (conveniencia por navegador, no es dato compartido).

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export function SeccionColapsable({
  id, numero, titulo, tag, descripcion, resumen, abiertoPorDefecto = false, children,
}: {
  id: string;
  numero: number;
  titulo: string;
  tag?: ReactNode;
  descripcion: string;
  resumen?: ReactNode;
  abiertoPorDefecto?: boolean;
  children: ReactNode;
}) {
  const clave = `dash-sec-${id}`;
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(clave);
      if (guardado != null) setAbierto(guardado === '1');
    } catch { /* localStorage no disponible (ventana privada, etc.): se queda en el valor por defecto */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = () => setAbierto((prev) => {
    const next = !prev;
    try { window.localStorage.setItem(clave, next ? '1' : '0'); } catch { /* noop */ }
    return next;
  });

  return (
    <div className={`sec-col ${abierto ? 'abierta' : ''}`}>
      <button type="button" className="sec-col-h" onClick={alternar} aria-expanded={abierto}>
        <span className="sec-col-chevron">▸</span>
        <h2>{numero} · {titulo}</h2>
        {tag}
        {!abierto && resumen && <span className="sec-col-resumen">{resumen}</span>}
      </button>
      {abierto && (
        <>
          <p className="sec-p">{descripcion}</p>
          {children}
        </>
      )}
    </div>
  );
}
