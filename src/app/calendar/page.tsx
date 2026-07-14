import type { Metadata } from 'next';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';
import CalendarClient from './CalendarClient';

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

async function getAllStays(): Promise<Stay[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*, m.name AS membership_name
     FROM stays s
     LEFT JOIN memberships m ON m.id = s.membership_id
     ORDER BY s.arrival ASC`
  );
  return rows as Stay[];
}

export default async function CalendarPage() {
  const stays = await getAllStays();
  return <CalendarClient stays={stays} />;
}
