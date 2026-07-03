import type { Metadata } from 'next';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { FuelPurchase } from '@/lib/types';
import FuelClient from './FuelClient';

export const metadata: Metadata = { title: 'Fuel & Propane' };
export const dynamic = 'force-dynamic';

export default async function FuelPage() {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM fuel_purchases ORDER BY purchase_date DESC, id DESC'
  );
  const currentYear = new Date().getFullYear();
  return (
    <FuelClient
      initialPurchases={rows as FuelPurchase[]}
      currentYear={currentYear}
    />
  );
}
