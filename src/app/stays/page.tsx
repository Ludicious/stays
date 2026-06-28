import type { Metadata } from 'next';
import Link from 'next/link';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import StaysTable from '@/components/StaysTable';

export const metadata: Metadata = { title: 'Stays' };
export const dynamic = 'force-dynamic';

async function getAllStays(review: boolean): Promise<Stay[]> {
  const pool = getPool();
  // Review filter: Membership stays missing program, Free stays missing site_category, and deprecated types
  const reviewWhere = review
    ? `WHERE (
        (s.stay_type = 'Membership' AND s.membership_id IS NULL)
        OR (s.stay_type = 'Free' AND s.site_category IS NULL)
        OR s.stay_type IN ('Boondocking', 'Harvest Host')
      )`
    : '';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, m.name AS membership_name
     FROM stays s
     LEFT JOIN memberships m ON m.id = s.membership_id
     ${reviewWhere}
     ORDER BY s.arrival DESC`
  );
  return rows as Stay[];
}

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const { review } = await searchParams;
  const isReview = review === '1';
  const stays = await getAllStays(isReview);

  return (
    <main className="page page-wide">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Stays</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {isReview ? `${stays.length} needing review` : `${stays.length} total`}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {isReview ? (
            <Link href="/stays" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline' }}>
              ← All stays
            </Link>
          ) : (
            <Link href="/stays?review=1" style={{ fontSize: 13, color: 'var(--gold-dark)', textDecoration: 'underline' }}>
              Needs review ⚑
            </Link>
          )}
        </span>
      </div>

      {stays.length === 0 ? (
        <div className="empty-state">
          {isReview ? (
            <>
              <p style={{ fontSize: 32 }}>✓</p>
              <p>No stays need review — all clean!</p>
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
