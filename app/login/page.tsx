'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'No se pudo iniciar sesión.');
        setCargando(false);
        return;
      }
      // Redirección "dura" para que el navegador reenvíe ya con la cookie puesta.
      const destino = new URLSearchParams(window.location.search).get('next');
      window.location.href = destino && destino.startsWith('/') ? destino : '/';
    } catch {
      setError('Error de conexión. Intente de nuevo.');
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-steam-gradient p-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl" aria-hidden>🖨️</div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">Aula STEAM</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión de Impresión 3D</p>
        </div>

        <label htmlFor="clave" className="mt-7 block text-sm font-medium text-gray-700">
          Clave de acceso
        </label>
        <input
          id="clave"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Ingrese la clave"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-steam-500 focus:ring-2 focus:ring-steam-200"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando || !clave}
          className="mt-6 w-full rounded-lg bg-steam-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-steam-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? 'Verificando…' : 'Entrar'}
        </button>

        <p className="mt-5 text-center text-xs text-gray-400">
          Acceso restringido al personal del aula.
        </p>
      </form>
    </div>
  );
}
