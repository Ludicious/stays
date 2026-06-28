'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Stay } from '@/lib/types';

type SortKey = 'arrival' | 'name' | 'city' | 'nights' | 'stay_type' | 'status' | 'total_charged' | 'balance_due';

function parseDate(str: string): number {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function formatDate(str: string): string {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function statusClass(status: string): string {
  return ({
    Stayed:         'detail-status stayed',
    Booked:         'detail-status booked',
    'Deposit Paid': 'detail-status deposit-paid',
    'Paid in Full': 'detail-status paid-in-full',
    Cancelled:      'detail-status cancelled',
  } as Record<string, string>)[status] ?? 'detail-status';
}

const TYPE_LABEL: Record<string, string> = {
  Paid:           'Paid',
  Free:           'Free',
  Membership:     'Mbr',
  Storage:        'Storage',
  Boondocking:    'Boondock',  // deprecated
  'Harvest Host': 'HH',       // deprecated
};

// Short hookup label — shown as compact badge alongside type
const HOOKUP_SHORT: Record<string, string> = {
  Full:            'FHU',
  'Water+Electric':'W+E',
  Electric:        'E',
  Dry:             'Dry',
  'N/A':           '',
};

function compare(a: Stay, b: Stay, key: SortKey): number {
  switch (key) {
    case 'arrival':       return parseDate(a.arrival) - parseDate(b.arrival);
    case 'name':          return a.name.localeCompare(b.name);
    case 'city':          return (a.city ?? '').localeCompare(b.city ?? '');
    case 'nights':        return a.nights - b.nights;
    case 'stay_type':     return a.stay_type.localeCompare(b.stay_type);
    case 'status':        return a.status.localeCompare(b.status);
    case 'total_charged': return a.total_charged - b.total_charged;
    case 'balance_due':   return a.balance_due - b.balance_due;
    default:              return 0;
  }
}

export default function StaysTable({ stays }: { stays: Stay[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('arrival');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const copy = [...stays].sort((a, b) => compare(a, b, sortKey));
    return sortDir === 'desc' ? copy.reverse() : copy;
  }, [stays, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const Th = ({ col, label }: { col: SortKey; label: string }) => {
    const active = sortKey === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={active ? 'sorted' : ''}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <span className="sort-indicator" aria-hidden>
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </th>
    );
  };

  return (
    <div className="stays-table-wrap">
      <table className="stays-table">
        <thead>
          <tr>
            <Th col="arrival"       label="Arrival"    />
            <Th col="name"          label="Campground" />
            <Th col="city"          label="Location"   />
            <Th col="nights"        label="Nights"     />
            <Th col="stay_type"     label="Type"       />
            <Th col="status"        label="Status"     />
            <Th col="total_charged" label="Total"      />
            <Th col="balance_due"   label="Balance"    />
          </tr>
        </thead>
        <tbody>
          {sorted.map(stay => {
            const hookupBadge = stay.hookup_type ? HOOKUP_SHORT[stay.hookup_type] : null;
            return (
              <tr
                key={stay.id}
                onClick={() => router.push(`/stays/${stay.id}`)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') router.push(`/stays/${stay.id}`);
                }}
              >
                <td className="td-date">{formatDate(stay.arrival)}</td>
                <td className="td-name">
                  {stay.name}
                  {stay.membership_name && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {stay.membership_name}
                    </span>
                  )}
                </td>
                <td className="td-loc">
                  {[stay.city, stay.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="td-num">{stay.nights}</td>
                <td>
                  {TYPE_LABEL[stay.stay_type] ?? stay.stay_type}
                  {hookupBadge && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {hookupBadge}
                    </span>
                  )}
                </td>
                <td>
                  <span className={statusClass(stay.status)} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {stay.status}
                  </span>
                </td>
                <td className="td-num">
                  {stay.total_charged > 0 ? `$${stay.total_charged.toFixed(2)}` : '—'}
                </td>
                <td className="td-num">
                  {stay.balance_due > 0
                    ? <span className="balance-due">${stay.balance_due.toFixed(2)}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
