import type { Metadata } from 'next';
import Link from 'next/link';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import StaysTable from '@/components/StaysTable';

export const metadata: Metadata = { title: 'Stays' };
export const dynamic = 'force-dynamic';

type StaysMode = 'all' | 'review' | 'hookup';

async function getAllStays(mode: StaysMode): Promise<Stay[]> {
  const pool = getPool();
  const whereClause =
    mode === 'review'
      ? `WHERE (
          (s.stay_type = 'Membership' AND s.membership_id IS NULL)
          OR (s.stay_type = 'Free' AND s.site_category IS NULL)
          OR s.stay_type IN ('Boondocking', 'Harvest Host')
        )`
      : mode === 'hookup'
      ? 'WHERE s.hookup_type IS NULL'
      : '';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, m.name AS membership_name
     FROM stays s
     LEFT JOIN memberships m ON m.id = s.membership_id
     ${whereClause}
     ORDER BY s.arrival DESC`
  );
  return rows as Stay[];
}

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string; hookup?: string }>;
}) {
  const { review, hookup } = await searchParams;
  const mode: StaysMode =
    review === '1' ? 'review' : hookup === 'none' ? 'hookup' : 'all';
  const stays = await getAllStays(mode);

  const countLabel =
    mode === 'review' ? `${stays.length} needing review`
    : mode === 'hookup' ? `${stays.length} missing hookup`
    : `${stays.length} total`;

  return (
    <main className="page page-wide">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Stays</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{countLabel}</span>
        <span style={{ marginLeft: 'auto' }}>
          {mode !== 'all' ? (
            <Link href="/stays" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline' }}>
              ← All stays
            </Link>
          ) : (
            <span style={{ display: 'flex', gap: 16 }}>
              <Link href="/stays?review=1" style={{ fontSize: 13, color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                Needs review ⚑
              </Link>
              <Link href="/stays?hookup=none" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline' }}>
                No hookup ✎
              </Link>
            </span>
          )}
        </span>
      </div>

      {stays.length === 0 ? (
        <div className="empty-state">
          {mode === 'review' ? (
            <>
              <p style={{ fontSize: 32 }}>✓</p>
              <p>No stays need review — all clean!</p>
              <p>
                <Link href="/stays" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                  ← All stays
                </Link>
              </p>
            </>
          ) : mode === 'hookup' ? (
            <>
              <p style={{ fontSize: 32 }}>✓</p>
              <p>All stays have hookup type recorded.</p>
              <p>
                <Link href="/stays" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                  ← All stays
                </Link>
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 32 }}>🏕</p>
              <p>No stays yet.</p>
              <p>
                <Link href="/quick-add" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                  Add your first stay →
                </Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <StaysTable stays={stays} />
      )}
    </main>
  );
}
