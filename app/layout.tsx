import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'KaagazAI — Your paper register, digital in one photo',
  description:
    'Photograph a handwritten Indian business register — udhaar ledger, bill book or stock register — and KaagazAI turns it into a living digital khata with party balances, phone lookup and exports.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f1e6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,650;1,9..144,650&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/home" className="brand">
              Kaagaz<em>AI</em>
              <span className="brand-hindi">कागज़ → डिजिटल</span>
            </Link>
          </div>
        </header>
        <main className="app-main">{children}</main>
        <AppShell />
      </body>
    </html>
  );
}
