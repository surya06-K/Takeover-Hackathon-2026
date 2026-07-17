'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useA11y } from './AccessibilityProvider';

const TABS = [
  { href: '/home', labelKey: 'navHome' as const, icon: '🏠' },
  { href: '/udhaar', labelKey: 'navUdhaar' as const, icon: '📒' },
  { href: '/scan', labelKey: 'navScan' as const, icon: '📷', fab: true },
  { href: '/sales', labelKey: 'navSales' as const, icon: '🧾' },
  { href: '/stock', labelKey: 'navStock' as const, icon: '📦' },
];

/** Bottom tab bar (mobile-first) — hidden on login and marketing pages. */
export default function AppShell() {
  const pathname = usePathname();
  const { tr } = useA11y();

  if (pathname === '/login' || pathname === '/') return null;

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) =>
        t.fab ? (
          <Link key={t.href} href={t.href} className="tab-scan" aria-label={tr('navScanAria')}>
            {t.icon}
            <small>{tr('navScan').toUpperCase()}</small>
          </Link>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            className={`tab-item ${pathname.startsWith(t.href) ? 'active' : ''}`}
            aria-label={tr(t.labelKey)}
          >
            <span className="tab-ic" aria-hidden>
              {t.icon}
            </span>
            <span className="tab-label">{tr(t.labelKey)}</span>
          </Link>
        )
      )}
    </nav>
  );
}
