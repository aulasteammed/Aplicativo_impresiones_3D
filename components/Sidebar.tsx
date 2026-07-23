'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/solicitudes', label: 'Solicitudes', icon: '📥' },
  { href: '/proyectos', label: 'Camas de impresión', icon: '🖨️' },
  { href: '/historial', label: 'Historial', icon: '📚' },
  { href: '/inventario', label: 'Inventario', icon: '🧵' },
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

  // La pantalla de clave se muestra sola, sin la barra lateral.
  if (pathname === '/login') return null;

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-steam-gradient text-white">
      <div className="px-5 pb-5 pt-7">
        <h1 className="text-xl font-bold tracking-tight">Aula STEAM</h1>
        <p className="mt-1 text-xs text-indigo-200">Gestión de Impresión 3D</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const activo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activo ? 'bg-white/20 text-white shadow-inner' : 'text-indigo-100 hover:bg-white/10 hover:text-white'
              }`}
            >
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden>🔒</span>
            Cerrar sesión
          </button>
        </div>
      )}
      <div className="px-5 py-5 text-[11px] leading-relaxed text-indigo-200">
        Aula STEAM Sonny Jiménez M3-119
        <br />
        UNAL Medellín · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
