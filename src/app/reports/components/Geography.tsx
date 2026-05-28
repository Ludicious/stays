'use client';

import { useState } from 'react';
import type { GeographyRow } from '@/lib/report-types';

interface Props {
  data: GeographyRow[];
}

type SortKey = keyof Pick<
  GeographyRow,
  'state' | 'country' | 'totalNights' | 'totalSpend' | 'avgPerNight' | 'freeNights' | 'freePercent'
>;

const fmt  = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD = (n: number) => `$${n.toFixed(2)}`;

export default function Geography({ data }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('totalNights');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(typeof data[0]?.[key] === 'string' ? 'asc' : 'desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number;
    const bn = bv as number;
    return sortDir === 'asc' ? an - bn : bn - an;
  });

  const th = (key: SortKey, label: string, numeric = false) => (
    <th
      className={sortKey === key ? 'sorted' : ''}
      onClick={() => handleSort(key)}
      style={{ textAlign: numeric ? 'right' : 'left' }}
    >
      {label} <span className="sort-indicator">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  return (
    <div className="report-card">
      <h2 className="report-section-title">Where the Money Goes (Geography)</h2>
      <div className="stays-table-wrap">
        <table className="stays-table">
          <thead>
            <tr>
              {th('state',       'State / Province')}
              {th('country',     'Country')}
              {th('totalNights', 'Nights',    true)}
              {th('totalSpend',  'Total Spend', true)}
              {th('avgPerNight', 'Avg $/Night', true)}
              {th('freeNights',  'Free Nights', true)}
              {th('freePercent', '% Free',     true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={`${row.state}||${row.country}`} style={{ cursor: 'default' }}>
                <td>{row.state}</td>
                <td className="td-loc">{row.country}</td>
                <td className="td-num">{row.totalNights}</td>
                <td className="td-num">{fmt(row.totalSpend)}</td>
                <td className="td-num">{row.totalNights > 0 ? fmtD(row.avgPerNight) : '—'}</td>
                <td className="td-num">{row.freeNights}</td>
                <td className="td-num">{row.freePercent.toFixed(0)}%</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  No stays found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
