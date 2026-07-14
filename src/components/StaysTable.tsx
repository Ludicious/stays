'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Stay } from '@/lib/types';
import FilterBar from '@/components/FilterBar';
import type { FilterDef } from '@/components/FilterBar';

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

const STAY_TYPE_ORDER = ['Paid', 'Free', 'Membership', 'Storage', 'Boondocking', 'Harvest Host'];

function needsReview(s: Stay): boolean {
  return (
    (s.stay_type === 'Membership' && s.membership_id === null) ||
    (s.stay_type === 'Free'       && s.site_category === null) ||
    s.stay_type === 'Boondocking' ||
    s.stay_type === 'Harvest Host'
  );
}

const HOOKUP_OPTIONS: { value: string; label: string }[] = [
  { value: '',               label: 'All'      },
  { value: 'Full',           label: 'Full'     },
  { value: 'Water+Electric', label: 'W+E'      },
  { value: 'Electric',       label: 'Electric' },
  { value: 'Dry',            label: 'Dry'      },
  { value: 'none',           label: 'None'     },
];

export default function StaysTable({ stays }: { stays: Stay[] }) {
  const router = useRouter();
  const [sortKey,      setSortKey]      = useState<SortKey>('arrival');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
  const [filterYear,   setFilterYear]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterHookup, setFilterHookup] = useState('');
  const [filterState,  setFilterState]  = useState('');
  const [filterReview, setFilterReview] = useState('');

  const years = useMemo(() => {
    const seen = new Set<string>();
    for (const s of stays) seen.add(s.arrival.slice(0, 4));
    return Array.from(seen).sort().reverse();
  }, [stays]);

  const states = useMemo(() => {
    const seen = new Set<string>();
    for (const s of stays) if (s.state) seen.add(s.state);
    return Array.from(seen).sort();
  }, [stays]);

  const types = useMemo(
    () => STAY_TYPE_ORDER.filter(t => stays.some(s => s.stay_type === t)),
    [stays],
  );

  const filtered = useMemo(() => {
    let r = stays;
    if (filterYear)              r = r.filter(s => s.arrival.startsWith(filterYear));
    if (filterType)              r = r.filter(s => s.stay_type === filterType);
    if (filterHookup === 'none') r = r.filter(s => s.hookup_type === null);
    else if (filterHookup)       r = r.filter(s => s.hookup_type === filterHookup);
    if (filterState)             r = r.filter(s => s.state === filterState);
    if (filterReview === '1')    r = r.filter(needsReview);
    return r;
  }, [stays, filterYear, filterType, filterHookup, filterState, filterReview]);

  const sorted = useMemo(() => {
    const copy = [...filtered].sort((a, b) => compare(a, b, sortKey));
    return sortDir === 'desc' ? copy.reverse() : copy;
  }, [filtered, sortKey, sortDir]);

  const hasActive = !!(filterYear || filterType || filterHookup || filterState || filterReview);

  const clearFilters = () => {
    setFilterYear('');
    setFilterType('');
    setFilterHookup('');
    setFilterState('');
    setFilterReview('');
  };

  const stateFilter: FilterDef[] = states.length > 1 ? [{
    key: 'state',
    label: 'State',
    options: [{ value: '', label: 'All' }, ...states.map(st => ({ value: st, label: st }))],
    value: filterState,
    onChange: setFilterState,
  }] : [];

  const filters: FilterDef[] = [
    {
      key: 'year',
      label: 'Year',
      options: [{ value: '', label: 'All' }, ...years.map(y => ({ value: y, label: y }))],
      value: filterYear,
      onChange: setFilterYear,
    },
    {
      key: 'type',
      label: 'Type',
      options: [{ value: '', label: 'All' }, ...types.map(t => ({ value: t, label: TYPE_LABEL[t] ?? t }))],
      value: filterType,
      onChange: setFilterType,
    },
    {
      key: 'hookup',
      label: 'Hookup',
      options: HOOKUP_OPTIONS,
      value: filterHookup,
      onChange: setFilterHookup,
    },
    ...stateFilter,
    {
      key: 'review',
      label: 'Review',
      options: [
        { value: '',  label: 'All'            },
        { value: '1', label: 'Needs review ⚑' },
      ],
      value: filterReview,
      onChange: setFilterReview,
    },
  ];

  const countLabel = hasActive
    ? `${filtered.length} of ${stays.length}`
    : `${stays.length} total`;

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
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{countLabel}</span>
      </div>
      <FilterBar filters={filters} onClear={clearFilters} hasActive={hasActive} />
      {sorted.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 32 }}>🔍</p>
          <p>No stays match the active filters.</p>
          <p style={{ marginTop: 12 }}>
            <button
              type="button"
              style={{
                color: 'var(--gold-dark)', textDecoration: 'underline',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              }}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
