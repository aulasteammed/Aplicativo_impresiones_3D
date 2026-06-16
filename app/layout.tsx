import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Aula STEAM — Gestión de Impresión 3D',
  description: 'Gestión de solicitudes, proyectos e inventario de impresión y diseño 3D — Aula STEAM Sonny Jiménez, UNAL Medellín',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
