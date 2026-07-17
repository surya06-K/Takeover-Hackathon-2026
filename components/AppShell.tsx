'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/udhaar', label: 'Udhaar', icon: '📒' },
  { href: '/scan', label: 'Scan', icon: '📷', fab: true },
  { href: '/sales', label: 'Sales', icon: '🧾' },
  { href: '/stock', label: 'Stock', icon: '📦' },
];

/** Bottom tab bar (mobile-first) — hidden on login and marketing pages. */
export default function AppShell() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/') return null;

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) =>
        t.fab ? (
          <Link key={t.href} href={t.href} className="tab-scan" aria-label="Scan a page">
            {t.icon}
            <small>SCAN</small>
          </Link>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            className={`tab-item ${pathname.startsWith(t.href) ? 'active' : ''}`}
          >
            <span className="tab-ic" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        )
      )}
    </nav>
  );
}
