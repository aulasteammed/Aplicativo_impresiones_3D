import type { Config } from 'tailwindcss';

// Paleta institucional de Aula STEAM, extraída directamente del logo oficial
// (public/IdentificadorAulaSTEAM.png): azul marino #1b1472 ("AULA STEAM") y
// naranja #f49600 ("Sonny Jiménez"). `steam` mantiene su nombre para no romper
// las clases ya usadas en toda la app (bg-steam-600, text-steam-700, etc.) —
// solo cambia a qué color apunta cada tono.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        steam: {
          50: '#f6f5f9',
          100: '#e7e6f4',
          200: '#c6c3ef',
          300: '#6e64e4',
          400: '#3427d9',
          500: '#251c9d',
          600: '#1b1472', // color exacto del logo ("AULA STEAM")
          700: '#140f54',
          800: '#0e0a3a',
          900: '#070620',
        },
        naranja: {
          50: '#f9f8f5',
          100: '#f4efe6',
          200: '#efdec3',
          300: '#ffd084',
          400: '#ffb43c',
          500: '#f49600', // color exacto del logo ("Sonny Jiménez")
          600: '#c17700',
          700: '#9d6100',
          800: '#7f4e00',
          900: '#603b00',
        },
      },
    },
  },
  plugins: [],
};

export default config;
