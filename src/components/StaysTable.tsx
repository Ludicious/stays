'use client';

import { useEffect, useState, useMemo } from 'react';
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

export default function StaysTable({ stays }: { stays: Stay[] }) {
  const router = useRouter();
  const [sortKey,       setSortKey]       = useState<SortKey>('arrival');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [filterYear,    setFilterYear]    = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterHookup,  setFilterHookup]  = useState('');
  const [filterState,   setFilterState]   = useState('');
  const [filterReview,  setFilterReview]  = useState('');
  const [drawerOpen,    setDrawerOpen]    = useState(false);

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

  const activeFilterCount = [
    filterYear,
    filterType,
    filterHookup,
    filterState,
    filterReview === '1' ? '1' : '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterYear('');
    setFilterType('');
    setFilterHookup('');
    setFilterState('');
    setFilterReview('');
  };

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

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Sort-only header cell
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

  // Sort indicator text for filterable headers
  const si = (col: SortKey) =>
    sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div>
      {/* Above-table controls */}
      <div className="stays-controls">
        <span className="stays-count">{countLabel}</span>

        {/* Mobile: Filters button (hidden on desktop via CSS) */}
        <button
          type="button"
          className="mobile-filters-btn"
          onClick={() => setDrawerOpen(true)}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {/* Review chip — always visible on all screen sizes */}
        <button
          type="button"
          className={`filter-chip${filterReview === '1' ? ' active' : ''}`}
          onClick={() => setFilterReview(r => r === '1' ? '' : '1')}
        >
          Needs review ⚑
        </button>

        {hasActive && (
          <button type="button" className="filter-clear" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

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
                {/* ARRIVAL — sort label + year filter select */}
                <th
                  className={`th-filterable${sortKey === 'arrival' ? ' sorted' : ''}`}
                  aria-sort={sortKey === 'arrival' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="th-sort-label" onClick={() => toggleSort('arrival')}>
                    Arrival
                    <span className="sort-indicator" aria-hidden>{si('arrival')}</span>
                  </div>
                  <select
                    className={`th-filter-select${filterYear ? ' has-value' : ''}`}
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                    aria-label="Filter by year"
                  >
                    <option value="">All years</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </th>

                <Th col="name" label="Campground" />

                {/* LOCATION — sort label + state filter select */}
                <th
                  className={`th-filterable${sortKey === 'city' ? ' sorted' : ''}`}
                  aria-sort={sortKey === 'city' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="th-sort-label" onClick={() => toggleSort('city')}>
                    Location
                    <span className="sort-indicator" aria-hidden>{si('city')}</span>
                  </div>
                  {states.length > 1 && (
                    <select
                      className={`th-filter-select${filterState ? ' has-value' : ''}`}
                      value={filterState}
                      onChange={e => setFilterState(e.target.value)}
                      aria-label="Filter by state"
                    >
                      <option value="">All states</option>
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </th>

                <Th col="nights" label="Nights" />

                {/* TYPE — sort label + type & hookup filter selects */}
                <th
                  className={`th-filterable${sortKey === 'stay_type' ? ' sorted' : ''}`}
                  aria-sort={sortKey === 'stay_type' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="th-sort-label" onClick={() => toggleSort('stay_type')}>
                    Type
                    <span className="sort-indicator" aria-hidden>{si('stay_type')}</span>
                  </div>
                  <div className="th-filter-pair">
                    <select
                      className={`th-filter-select${filterType ? ' has-value' : ''}`}
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      aria-label="Filter by stay type"
                    >
                      <option value="">Type</option>
                      {types.map(t => (
                        <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
                      ))}
                    </select>
                    <select
                      className={`th-filter-select${filterHookup ? ' has-value' : ''}`}
                      value={filterHookup}
                      onChange={e => setFilterHookup(e.target.value)}
                      aria-label="Filter by hookup type"
                    >
                      <option value="">Hookup</option>
                      <option value="Full">Full</option>
                      <option value="Water+Electric">W+E</option>
                      <option value="Electric">Elec</option>
                      <option value="Dry">Dry</option>
                      <option value="N/A">N/A</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </th>

                <Th col="status"        label="Status"  />
                <Th col="total_charged" label="Total"   />
                <Th col="balance_due"   label="Balance" />
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

      {/* Mobile filter drawer (bottom sheet) */}
      {drawerOpen && (
        <div className="mobile-filter-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="mobile-filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="mobile-filter-header">
              <span className="mobile-filter-title">Filters</span>
              <button
                type="button"
                className="mobile-filter-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>
            <div className="mobile-filter-body">
              <div className="form-group">
                <label className="form-label">Year</label>
                <select
                  className="form-input"
                  value={filterYear}
                  onChange={e => setFilterYear(e.target.value)}
                >
                  <option value="">All years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stay type</label>
                <select
                  className="form-input"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="">All types</option>
                  {types.map(t => (
                    <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hookup</label>
                <select
                  className="form-input"
                  value={filterHookup}
                  onChange={e => setFilterHookup(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="Full">Full</option>
                  <option value="Water+Electric">Water + Electric</option>
                  <option value="Electric">Electric</option>
                  <option value="Dry">Dry</option>
                  <option value="N/A">N/A</option>
                  <option value="none">None (unrecorded)</option>
                </select>
              </div>
              {states.length > 1 && (
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    className="form-input"
                    value={filterState}
                    onChange={e => setFilterState(e.target.value)}
                  >
                    <option value="">All states</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Review</label>
                <select
                  className="form-input"
                  value={filterReview}
                  onChange={e => setFilterReview(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="1">Needs review ⚑</option>
                </select>
              </div>
            </div>
            <div className="mobile-filter-footer">
              {hasActive && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setDrawerOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
