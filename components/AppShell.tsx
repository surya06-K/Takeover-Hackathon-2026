'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from './LanguageProvider';

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
  const { tr } = useLang();

  if (pathname === '/login' || pathname === '/') return null;

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) =>
        tab.fab ? (
          <Link key={tab.href} href={tab.href} className="tab-scan" aria-label={tr('navScanAria')}>
            {tab.icon}
            <small>{tr('navScan').toUpperCase()}</small>
          </Link>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-item ${pathname.startsWith(tab.href) ? 'active' : ''}`}
            aria-label={tr(tab.labelKey)}
          >
            <span className="tab-ic" aria-hidden>
              {tab.icon}
            </span>
            <span className="tab-label">{tr(tab.labelKey)}</span>
          </Link>
        )
      )}
    </nav>
  );
}
