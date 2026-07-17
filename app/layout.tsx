import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'KaagazAI — Your paper register, digital in one photo',
  description:
    'Photograph a handwritten Indian business register — udhaar ledger, bill book or stock register — and KaagazAI turns it into clean digital records you can review, merge and export.',
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
            <Link href="/" className="brand">
              Kaagaz<em>AI</em>
              <span className="brand-hindi">कागज़ → डिजिटल</span>
            </Link>
            <nav className="nav-links">
              <Link href="/digitize">Digitize</Link>
              <Link href="/ledger">Ledger</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            KaagazAI · Built for shopkeepers who trust paper — and deserve backups.
          </div>
        </footer>
      </body>
    </html>
  );
}
