import type { Metadata } from 'next';
import { Header, Footer } from '@/components/shell';
import './globals.css';
import './reference-theme.css';
import './audience.css';
export const metadata: Metadata = {
  title: {
    default: 'TopChess Global · Tu siguiente gran jugada',
    template: '%s · TopChess Global',
  },
  description:
    'Aprende ajedrez online con un profesor, un grupo reducido y un plan. Cuatro clases por 50 € al mes.',
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
