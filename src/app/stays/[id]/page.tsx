import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import GateCodeEditor from '@/components/GateCodeEditor';
import DetailsToggle from '@/components/DetailsToggle';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function getStay(id: string): Promise<Stay | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM stays WHERE id = ?', [id]
  );
  return rows.length ? (rows[0] as Stay) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const stay = await getStay(id);
  return { title: stay ? stay.name : 'Stay not found' };
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFull(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function statusClass(status: string) {
  return {
    Stayed:          'detail-status stayed',
    Booked:          'detail-status booked',
    'Deposit Paid':  'detail-status deposit-paid',
    'Paid in Full':  'detail-status paid-in-full',
    Cancelled:       'detail-status cancelled',
  }[status] ?? 'detail-status';
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function StayDetailPage({ params }: Params) {
  const { id } = await params;
  const stay = await getStay(id);
  if (!stay) notFound();

  const mapsUrl = stay.full_address
    ? `https://maps.google.com/?q=${encodeURIComponent(stay.full_address)}`
    : `https://maps.google.com/?q=${encodeURIComponent(stay.name)}`;

  return (
    <main className="page">
      <Link href="/upcoming" className="detail-back">← Upcoming</Link>

      <span className={statusClass(stay.status)}>{stay.status}</span>

      <div className="hero-card" style={{ marginTop: 12 }}>
        <h1 className="stay-name">{stay.name}</h1>
        <p className="stay-location">
          {[stay.city, stay.state].filter(Boolean).join(', ')}
          {stay.country && stay.country !== 'USA' ? ` · ${stay.country}` : ''}
          {' · '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {stay.stay_type}
          </span>
        </p>

        <div className="info-rows">
          {/* Dates */}
          <div className="info-row">
            <span className="info-label">Dates</span>
            <span className="info-value">
              {formatFull(stay.arrival)} → {formatFull(stay.departure)}
              {' · '}{stay.nights} night{stay.nights !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Address */}
          <div className="info-row">
            <span className="info-label">Address</span>
            <span className="info-value">
              {stay.full_address
                ? <>{stay.full_address}{' · '}<a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">Open in Maps ↗</a></>
                : <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">Open in Maps ↗</a>
              }
            </span>
          </div>

          {/* Gate code — always shown, editable */}
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

          {/* Email */}
          {stay.email && (
            <div className="info-row">
              <span className="info-label">Email</span>
              <span className="info-value">
                <a href={`mailto:${stay.email}`}>{stay.email}</a>
              </span>
            </div>
          )}

          {/* Financials */}
          {stay.total_charged > 0 && (
            <div className="info-row">
              <span className="info-label">Charges</span>
              <span className="info-value">
                Total: ${stay.total_charged.toFixed(2)}
                {stay.deposit_paid > 0 && ` · Paid: $${stay.deposit_paid.toFixed(2)}`}
                {stay.balance_due  > 0 && (
                  <span className={`badge ${stay.status === 'Deposit Paid' ? 'badge-amber' : 'badge-red'}`} style={{ marginLeft: 8 }}>
                    Balance: ${stay.balance_due.toFixed(2)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible extras */}
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
            {stay.program && (
              <div className="info-row">
                <span className="info-label">Program</span>
                <span className="info-value">{stay.program}</span>
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
            {stay.notes && (
              <div className="info-row">
                <span className="info-label">Notes</span>
                <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>
                  {stay.notes}
                </span>
              </div>
            )}
            {(stay.lat && stay.lng) && (
              <div className="info-row">
                <span className="info-label">Coords</span>
                <span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {stay.lat.toFixed(5)}, {stay.lng.toFixed(5)}
                </span>
              </div>
            )}
          </div>
        </DetailsToggle>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        Full editing coming in Session 3.
      </p>
    </main>
  );
}
