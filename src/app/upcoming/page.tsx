import type { Metadata } from 'next';
import Link from 'next/link';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import DetailsToggle from '@/components/DetailsToggle';
import GateCodeEditor from '@/components/GateCodeEditor';

export const metadata: Metadata = { title: 'Upcoming' };

// Re-fetch on every request — this is live reservation data
export const dynamic = 'force-dynamic';

// ── Date helpers ────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function formatShort(dateStr: string) {
  const d = parseDate(dateStr);
  return {
    day:   d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    dow:   d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

function formatFull(dateStr: string) {
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((parseDate(dateStr).getTime() - today().getTime()) / 86_400_000);
}

function nightsRemaining(departureStr: string): number {
  return Math.ceil((parseDate(departureStr).getTime() - today().getTime()) / 86_400_000);
}

// ── DB fetch ────────────────────────────────────────────────────────

async function getData(): Promise<{ current: Stay | null; upcoming: Stay[] }> {
  const pool = getPool();
  const todayStr = today().toISOString().slice(0, 10);

  const [[currentRows], [upcomingRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT s.*, m.name AS membership_name FROM stays s
       LEFT JOIN memberships m ON m.id = s.membership_id
       WHERE s.arrival <= ? AND s.departure >= ?
       ORDER BY s.arrival DESC LIMIT 1`,
      [todayStr, todayStr]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT s.*, m.name AS membership_name FROM stays s
       LEFT JOIN memberships m ON m.id = s.membership_id
       WHERE s.arrival > ?
       ORDER BY s.arrival ASC LIMIT 5`,
      [todayStr]
    ),
  ]);

  return {
    current:  (currentRows[0] as Stay) ?? null,
    upcoming: upcomingRows as Stay[],
  };
}

// ── Balance badge ───────────────────────────────────────────────────

function BalanceBadge({ stay }: { stay: Stay }) {
  if (stay.balance_due <= 0) return null;
  if (stay.status !== 'Booked' && stay.status !== 'Deposit Paid') return null;
  const cls = stay.status === 'Deposit Paid' ? 'badge badge-amber' : 'badge badge-red';
  const label = stay.status === 'Deposit Paid' ? 'Balance' : 'Unpaid';
  return (
    <span className={cls}>
      {label}: ${stay.balance_due.toFixed(2)}
    </span>
  );
}

// ── Hero card (current or next-up) ─────────────────────────────────

function HeroCard({ stay, isCurrent }: { stay: Stay; isCurrent: boolean }) {
  const mapsUrl = stay.full_address
    ? `https://maps.google.com/?q=${encodeURIComponent(stay.full_address)}`
    : stay.name
    ? `https://maps.google.com/?q=${encodeURIComponent(stay.name)}`
    : null;

  const remaining = isCurrent
    ? nightsRemaining(stay.departure)
    : daysUntil(stay.arrival);

  return (
    <div className="hero-card">
      <p className="section-label" style={{ marginBottom: 8 }}>
        {isCurrent ? '📍 Currently here' : '⏭ Up next'}
      </p>
      <h1 className="stay-name">{stay.name}</h1>
      <p className="stay-location">
        {[stay.city, stay.state].filter(Boolean).join(', ')}
        {stay.country && stay.country !== 'USA' ? ` · ${stay.country}` : ''}
      </p>

      <div className="info-rows">
        {/* Address */}
        {stay.full_address && (
          <div className="info-row">
            <span className="info-label">Address</span>
            <span className="info-value">
              {stay.full_address}
              {mapsUrl && (
                <>
                  {' · '}
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                    Open in Maps ↗
                  </a>
                </>
              )}
            </span>
          </div>
        )}
        {!stay.full_address && mapsUrl && (
          <div className="info-row">
            <span className="info-label">Maps</span>
            <span className="info-value">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                Open in Maps ↗
              </a>
            </span>
          </div>
        )}

        {/* Gate code — always shown so it can be added at check-in */}
        <div className="info-row">
          <span className="info-label">Gate code</span>
          <span className="info-value">
            <GateCodeEditor stayId={stay.id} initialCode={stay.gate_code} />
          </span>
        </div>

        {/* Check-in */}
        {(stay.check_in_time || stay.check_in_instructions) && (
          <div className="info-row">
            <span className="info-label">Check-in</span>
            <span className="info-value">
              {stay.check_in_time && <strong>{stay.check_in_time}</strong>}
              {stay.check_in_time && stay.check_in_instructions && <br />}
              {stay.check_in_instructions}
            </span>
          </div>
        )}

        {/* Phone */}
        {stay.phone && (
          <div className="info-row">
            <span className="info-label">Phone</span>
            <span className="info-value">
              <a href={`tel:${stay.phone.replace(/\D/g, '')}`}>{stay.phone}</a>
            </span>
          </div>
        )}

        {/* Dates / nights */}
        <div className="info-row">
          <span className="info-label">Dates</span>
          <span className="info-value">
            {formatFull(stay.arrival)} → {formatFull(stay.departure)}
            {' · '}
            {stay.nights} night{stay.nights !== 1 ? 's' : ''}
            <span className="nights-remaining">
              {isCurrent
                ? ` · ${remaining} night${remaining !== 1 ? 's' : ''} remaining`
                : remaining > 0
                ? ` · ${remaining} day${remaining !== 1 ? 's' : ''} away`
                : ' · Arriving today'}
            </span>
          </span>
        </div>

        {/* Balance badge */}
        {(stay.balance_due > 0 &&
          (stay.status === 'Booked' || stay.status === 'Deposit Paid')) && (
          <div className="info-row">
            <span className="info-label">Balance</span>
            <span className="info-value">
              <BalanceBadge stay={stay} />
            </span>
          </div>
        )}
      </div>

      {/* Collapsible details */}
      <DetailsToggle>
        <div className="info-rows" style={{ borderTop: 'none' }}>
          {stay.confirmation_number && (
            <div className="info-row">
              <span className="info-label">Confirmation</span>
              <span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                {stay.confirmation_number}
              </span>
            </div>
          )}
          {stay.website && (
            <div className="info-row">
              <span className="info-label">Website</span>
              <span className="info-value">
                <a href={stay.website} target="_blank" rel="noopener noreferrer">
                  {stay.website.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </span>
            </div>
          )}
          {stay.total_charged > 0 && (
            <div className="info-row">
              <span className="info-label">Total</span>
              <span className="info-value">
                ${stay.total_charged.toFixed(2)}
                {stay.deposit_paid > 0 && ` · Paid: $${stay.deposit_paid.toFixed(2)}`}
              </span>
            </div>
          )}
          {stay.notes && (
            <div className="info-row">
              <span className="info-label">Notes</span>
              <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>
                {stay.notes}
              </span>
            </div>
          )}
          {stay.membership_name && (
            <div className="info-row">
              <span className="info-label">Program</span>
              <span className="info-value">{stay.membership_name}</span>
            </div>
          )}
        </div>
      </DetailsToggle>
    </div>
  );
}

// ── Upcoming list item ──────────────────────────────────────────────

function UpcomingCard({ stay }: { stay: Stay }) {
  const days     = daysUntil(stay.arrival);
  const isSoon   = days >= 0 && days <= 7;
  const dateInfo = formatShort(stay.arrival);

  const typeLabel: Record<string, string> = {
    Paid:           'Paid',
    Free:           'Free',
    Membership:     'Mbr',
    Storage:        'Storage',
    Boondocking:    'Boondock',  // deprecated
    'Harvest Host': 'HH',       // deprecated
  };

  return (
    <Link href={`/stays/${stay.id}`} className={`stay-card${isSoon ? ' soon' : ''}`}>
      <div className="date-block">
        <div className="day">{dateInfo.day}</div>
        <div className="month">{dateInfo.month}</div>
        <div className="dow">{dateInfo.dow}</div>
      </div>

      <div className="stay-info">
        <div className="s-name">{stay.name}</div>
        <div className="s-location">
          {[stay.city, stay.state].filter(Boolean).join(', ')}
        </div>
        <div className="s-badges">
          {isSoon && <span className="badge badge-soon">Soon</span>}
          <BalanceBadge stay={stay} />
        </div>
      </div>

      <div className="stay-meta">
        <div className="s-nights">{stay.nights}</div>
        <div className="s-nights-label">nights</div>
        <div className="s-type">{typeLabel[stay.stay_type] ?? stay.stay_type}</div>
      </div>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default async function UpcomingPage() {
  const { current, upcoming } = await getData();

  // If no current stay, promote the first upcoming stay to hero position
  const hero     = current ?? upcoming[0] ?? null;
  const isCurrent = !!current;
  const listItems = current ? upcoming : upcoming.slice(1);

  if (!hero && !listItems.length) {
    return (
      <main className="page">
        <div className="empty-state">
          <p style={{ fontSize: 32 }}>🏕</p>
          <p>No upcoming stays found.</p>
          <p>
            <Link href="/quick-add" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
              Add your first stay →
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      {hero && <HeroCard stay={hero} isCurrent={isCurrent} />}

      {listItems.length > 0 && (
        <>
          <p className="section-label">Upcoming</p>
          <div className="upcoming-list">
            {listItems.map(s => (
              <UpcomingCard key={s.id} stay={s} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
