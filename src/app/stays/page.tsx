import type { Metadata } from 'next';
import Link from 'next/link';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import StaysTable from '@/components/StaysTable';

export const metadata: Metadata = { title: 'Stays' };
export const dynamic = 'force-dynamic';

async function getAllStays(): Promise<Stay[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM stays ORDER BY arrival DESC'
  );
  return rows as Stay[];
}

export default async function StaysPage() {
  const stays = await getAllStays();

  return (
    <main className="page page-wide">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Stays</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stays.length} total</span>
      </div>

      {stays.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 32 }}>🏕</p>
          <p>No stays yet.</p>
          <p>
            <Link href="/quick-add" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
              Add your first stay →
            </Link>
          </p>
        </div>
      ) : (
        <StaysTable stays={stays} />
      )}
    </main>
  );
}
