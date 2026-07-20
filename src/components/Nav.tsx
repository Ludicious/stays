'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/upcoming',    label: 'Upcoming'    },
  { href: '/calendar',    label: 'Calendar'    },
  { href: '/stays',       label: 'Stays'       },
  { href: '/fuel',        label: 'Fuel'        },
  { href: '/reports',     label: 'Reports'     },
  { href: '/quick-add',   label: 'Quick Add'   },
  { href: '/memberships', label: 'Memberships' },
  { href: '/import',      label: 'Import'      },
];

export default function Nav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const navRef    = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/upcoming' && pathname.startsWith(href));

  const handleLogout = async () => {
    setMenuOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Close on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <nav className="nav" ref={navRef}>
      <Link href="/upcoming" className="nav-brand">
        Noteworthy <span>Nomads</span>
      </Link>

      {/* Desktop link row */}
      <div className="nav-links">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? 'nav-link active' : 'nav-link'}
          >
            {label}
          </Link>
        ))}
        <button onClick={handleLogout} className="nav-logout">Log out</button>
      </div>

      {/* Hamburger button — mobile only */}
      <button
        className={`nav-hamburger${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(m => !m)}
        aria-expanded={menuOpen}
        aria-controls="nav-mobile-menu"
        aria-label="Menu"
      >
        <span /><span /><span />
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="nav-mobile-menu" className="nav-mobile-menu">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-mobile-link${isActive(href) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <button className="nav-mobile-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
