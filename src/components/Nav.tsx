'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  const active = (href: string) =>
    pathname === href || (href !== '/upcoming' && pathname.startsWith(href))
      ? 'nav-link active'
      : 'nav-link';

  return (
    <nav className="nav">
      <Link href="/upcoming" className="nav-brand">
        Noteworthy <span>Nomads</span>
      </Link>
      <div className="nav-links">
        <Link href="/upcoming"  className={active('/upcoming')}>Upcoming</Link>
        <Link href="/stays"     className={active('/stays')}>Stays</Link>
        <Link href="/reports"   className={active('/reports')}>Reports</Link>
        <Link href="/quick-add" className={active('/quick-add')}>Quick Add</Link>
        <Link href="/memberships" className={active('/memberships')}>Memberships</Link>
        <Link href="/import"    className={active('/import')}>Import</Link>
      </div>
    </nav>
  );
}
