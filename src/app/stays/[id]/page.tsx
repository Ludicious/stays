import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import StayDetailClient from '@/components/StayDetailClient';

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
  const stay   = await getStay(id);
  return { title: stay ? stay.name : 'Stay not found' };
}

export default async function StayDetailPage({ params }: Params) {
  const { id } = await params;
  const stay   = await getStay(id);
  if (!stay) notFound();

  return (
    <main className="page">
      <StayDetailClient stay={stay} />
    </main>
  );
}
