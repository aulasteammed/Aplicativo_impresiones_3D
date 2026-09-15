'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import Impresora3D from '@/components/Impresora3D';
import { IconoLinea } from '@/components/Iconos';

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: '/', label: 'Dashboard',
    icon: <IconoLinea><path d="M4 20V10M12 20V4M20 20v-6" /></IconoLinea>,
  },
  {
    href: '/solicitudes', label: 'Solicitudes',
    icon: <IconoLinea><path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /><path d="M8 12h8M8 16h5" /></IconoLinea>,
  },
  { href: '/proyectos', label: 'Camas de impresión', icon: <Impresora3D className="h-[1.2em] w-[1.2em]" /> },
  {
    href: '/historial', label: 'Historial',
    icon: <IconoLinea><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></IconoLinea>,
  },
  {
    href: '/inventario', label: 'Inventario',
    icon: <IconoLinea><path d="M12 3 4 7v10l8 4 8-4V7Z" /><path d="M4 7l8 4 8-4M12 11v10" /></IconoLinea>,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [protegido, setProtegido] = useState(false);

  // Solo se muestra "Cerrar sesión" si la app está protegida por clave.
  useEffect(() => {
    fetch('/api/auth/estado')
      .then((r) => r.json())
      .then((d) => setProtegido(!!d?.protegido))
      .catch(() => setProtegido(false));
  }, []);

  async function salir() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }


  if (pathname === '/login') return null;

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex flex-col items-center gap-1 px-5 pb-5 pt-7">
        <Image src="/IdentificadorAulaSTEAM.png" alt="Aula STEAM Sonny Jiménez" width={170} height={87} priority className="h-auto w-[170px]" />
        <p className="text-xs text-slate-400">Gestión de Impresión 3D</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const activo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activo ? 'bg-steam-50 text-steam-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {activo && <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full bg-naranja-500" />}
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {protegido && (
        <div className="px-3">
          <button
            onClick={salir}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <IconoLinea><path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></IconoLinea>
            Cerrar sesión
          </button>
        </div>
      )}
      <div className="border-t border-slate-100 px-5 py-5 text-[11px] leading-relaxed text-slate-400">
        Aula STEAM Sonny Jiménez M3-119
        <br />
        UNAL Medellín · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
