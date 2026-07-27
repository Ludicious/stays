'use client';

import { useState, useMemo } from 'react';
import type { FuelPurchase, FuelType, State } from '@/lib/types';
import FilterBar from '@/components/FilterBar';
import type { FilterDef } from '@/components/FilterBar';

const FUEL_TYPES: FuelType[] = ['Diesel', 'Gasoline', 'DEF', 'Propane'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type EditState = {
  id:             number;
  fuelType:       FuelType;
  date:           string;
  cost:           string;
  discountAmount: string;
  settled:        boolean;
  gallons:        string;
  odometer:       string;
  fullFill:       boolean;
  stateCode:      string;
  notes:          string;
};

interface TotalsRow {
  type:        FuelType;
  currentYear: number;
  allTime:     number;
}

function computeTotals(purchases: FuelPurchase[], currentYear: number): TotalsRow[] {
  return FUEL_TYPES.map(type => {
    const matching     = purchases.filter(p => p.fuel_type === type);
    const yearMatching = matching.filter(p => p.purchase_date.startsWith(String(currentYear)));
    return {
      type,
      allTime:     matching.reduce((sum, p) => sum + p.total_cost, 0),
      currentYear: yearMatching.reduce((sum, p) => sum + p.total_cost, 0),
    };
  }).filter(r => r.allTime > 0);
}

function sortPurchases(purchases: FuelPurchase[]): FuelPurchase[] {
  return [...purchases].sort((a, b) => {
    const d = b.purchase_date.localeCompare(a.purchase_date);
    return d !== 0 ? d : b.id - a.id;
  });
}

// Toggle button pair — shared between add form and edit form
function TogglePair({
  value, onChange, trueLabel, falseLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <div className="seg-control" role="group">
      <button
        type="button"
        className={`seg-btn${value ? ' active' : ''}`}
        onClick={() => onChange(true)}
        aria-pressed={value}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        className={`seg-btn${!value ? ' active' : ''}`}
        onClick={() => onChange(false)}
        aria-pressed={!value}
      >
        {falseLabel}
      </button>
    </div>
  );
}

interface Props {
  initialPurchases: FuelPurchase[];
  states:           State[];
  currentYear:      number;
}

export default function FuelClient({ initialPurchases, states, currentYear }: Props) {
  const [purchases,        setPurchases]        = useState<FuelPurchase[]>(initialPurchases);
  const [fuelType,         setFuelType]         = useState<FuelType>('Diesel');
  const [date,             setDate]             = useState(todayStr());
  const [cost,             setCost]             = useState('');
  const [discountAmount,   setDiscountAmount]   = useState('');
  const [settled,          setSettled]          = useState(true);
  const [gallons,          setGallons]          = useState('');
  const [odometer,         setOdometer]         = useState('');
  const [fullFill,         setFullFill]         = useState(true);
  const [stateCode,        setStateCode]        = useState('');
  const [notes,            setNotes]            = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [formError,        setFormError]        = useState<string | null>(null);
  const [edit,             setEdit]             = useState<EditState | null>(null);
  const [editSubmitting,   setEditSubmitting]   = useState(false);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<number | null>(null);
  const [filterFuelType,   setFilterFuelType]   = useState('');
  const [filterFuelYear,   setFilterFuelYear]   = useState('');
  const [filterSettled,    setFilterSettled]    = useState('');

  const fuelYears = useMemo(() => {
    const seen = new Set<string>();
    for (const p of purchases) seen.add(p.purchase_date.slice(0, 4));
    return Array.from(seen).sort().reverse();
  }, [purchases]);

  const visiblePurchases = useMemo(() => {
    let r = purchases;
    if (filterFuelType) r = r.filter(p => p.fuel_type === filterFuelType);
    if (filterFuelYear) r = r.filter(p => p.purchase_date.startsWith(filterFuelYear));
    if (filterSettled === 'unsettled') r = r.filter(p => !p.settled);
    return r;
  }, [purchases, filterFuelType, filterFuelYear, filterSettled]);

  const hasFuelFilter = !!(filterFuelType || filterFuelYear || filterSettled);
  const displayYear   = filterFuelYear ? Number(filterFuelYear) : currentYear;
  const totals        = computeTotals(visiblePurchases, displayYear);

  const hasUnsettled = purchases.some(p => !p.settled);

  const fuelFilters: FilterDef[] = [
    {
      key:     'fuelType',
      label:   'Type',
      options: [
        { value: '', label: 'All' },
        ...FUEL_TYPES
          .filter(t => purchases.some(p => p.fuel_type === t))
          .map(t => ({ value: t, label: t })),
      ],
      value:    filterFuelType,
      onChange: setFilterFuelType,
    },
    {
      key:     'year',
      label:   'Year',
      options: [{ value: '', label: 'All' }, ...fuelYears.map(y => ({ value: y, label: y }))],
      value:    filterFuelYear,
      onChange: setFilterFuelYear,
    },
    ...(hasUnsettled ? [{
      key:     'settled',
      label:   'Status',
      options: [
        { value: '',          label: 'All' },
        { value: 'unsettled', label: 'Unsettled' },
      ],
      value:    filterSettled,
      onChange: setFilterSettled,
    } as FilterDef] : []),
  ];

  // ── Add new purchase ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costNum     = parseFloat(cost);
    const discountNum = discountAmount ? parseFloat(discountAmount) : null;
    if (!date) { setFormError('Date is required.'); return; }
    if (isNaN(costNum) || costNum <= 0) { setFormError('Total cost must be a positive number.'); return; }
    if (discountNum != null && discountNum < 0) { setFormError('Discount must be >= 0.'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/fuel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          purchase_date:   date,
          fuel_type:       fuelType,
          total_cost:      costNum,
          discount_amount: discountNum,
          settled,
          gallons:         gallons  ? parseFloat(gallons)    : null,
          odometer:        odometer ? parseInt(odometer, 10) : null,
          full_fill:       fullFill,
          state_code:      stateCode || null,
          notes:           notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save.');
      }
      const created = await res.json() as FuelPurchase;
      setPurchases(prev => sortPurchases([created, ...prev]));
      setCost('');
      setDiscountAmount('');
      setSettled(true);
      setGallons('');
      setOdometer('');
      setFullFill(true);
      setStateCode('');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit helpers ──────────────────────────────────────────────────
  const openEdit = (p: FuelPurchase) => {
    setEdit({
      id:             p.id,
      fuelType:       p.fuel_type,
      date:           p.purchase_date,
      cost:           String(p.total_cost),
      discountAmount: p.discount_amount != null ? String(p.discount_amount) : '',
      settled:        Boolean(p.settled),
      gallons:        p.gallons   != null ? String(p.gallons)   : '',
      odometer:       p.odometer  != null ? String(p.odometer)  : '',
      fullFill:       Boolean(p.full_fill),
      stateCode:      p.state_code ?? '',
      notes:          p.notes ?? '',
    });
    setConfirmDeleteId(null);
  };

  const upd = <K extends keyof EditState>(key: K, val: EditState[K]) =>
    setEdit(prev => prev ? { ...prev, [key]: val } : prev);

  const saveEdit = async () => {
    if (!edit) return;
    const costNum     = parseFloat(edit.cost);
    const discountNum = edit.discountAmount ? parseFloat(edit.discountAmount) : null;
    if (isNaN(costNum) || costNum <= 0) return;

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/fuel/${edit.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          purchase_date:   edit.date,
          fuel_type:       edit.fuelType,
          total_cost:      costNum,
          discount_amount: discountNum,
          settled:         edit.settled,
          gallons:         edit.gallons  ? parseFloat(edit.gallons)    : null,
          odometer:        edit.odometer ? parseInt(edit.odometer, 10) : null,
          full_fill:       edit.fullFill,
          state_code:      edit.stateCode || null,
          notes:           edit.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as FuelPurchase;
      setPurchases(prev => sortPurchases(prev.map(p => p.id === edit.id ? updated : p)));
      setEdit(null);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/fuel/${id}`, { method: 'DELETE' });
      setPurchases(prev => prev.filter(p => p.id !== id));
      setEdit(null);
      setConfirmDeleteId(null);
    } catch {
      // silent — entry stays in list on network error
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <main className="page">
      <h1 className="page-title">Fuel & Propane</h1>

      {/* ── Entry form ──────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Fuel type */}
        <div className="form-group">
          <p className="form-label">Fuel type</p>
          <div className="seg-control" role="group" aria-label="Fuel type">
            {FUEL_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`seg-btn${fuelType === t ? ' active' : ''}`}
                onClick={() => setFuelType(t)}
                aria-pressed={fuelType === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Full fill + Settled toggles */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 4 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <p className="form-label" style={{ marginBottom: 6 }}>Fill</p>
            <TogglePair
              value={fullFill}
              onChange={setFullFill}
              trueLabel="Full"
              falseLabel="Partial"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <p className="form-label" style={{ marginBottom: 6 }}>Status</p>
            <TogglePair
              value={settled}
              onChange={setSettled}
              trueLabel="Settled"
              falseLabel="Provisional"
            />
          </div>
        </div>

        {/* Cost + Date — primary required */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" htmlFor="fuel-cost">Total cost ($)</label>
            <input
              id="fuel-cost"
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" htmlFor="fuel-date">Date</label>
            <input
              id="fuel-date"
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Discount — shown when Provisional OR discount already entered */}
        {(!settled || discountAmount) && (
          <div className="form-group">
            <label className="form-label" htmlFor="fuel-discount">
              Discount amount ($){' '}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>TSD Open Roads / rebate</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                id="fuel-discount"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                style={{ maxWidth: 160 }}
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value)}
                placeholder="0.00"
              />
              {discountAmount && cost && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Gross: ${(parseFloat(cost || '0') + parseFloat(discountAmount || '0')).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Optional: gallons, odometer (Diesel only), state, notes */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 120px' }}>
            <label className="form-label" htmlFor="fuel-gallons">Gallons</label>
            <input
              id="fuel-gallons"
              type="number"
              step="0.001"
              min="0.001"
              className="form-input"
              value={gallons}
              onChange={e => setGallons(e.target.value)}
              placeholder="—"
            />
          </div>
          {fuelType === 'Diesel' && (
            <div className="form-group" style={{ flex: '1 1 140px' }}>
              <label className="form-label" htmlFor="fuel-odometer">Odometer</label>
              <input
                id="fuel-odometer"
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={odometer}
                onChange={e => setOdometer(e.target.value)}
                placeholder="—"
              />
            </div>
          )}
          <div className="form-group" style={{ flex: '1 1 120px' }}>
            <label className="form-label" htmlFor="fuel-state">State</label>
            <select
              id="fuel-state"
              className="form-input"
              value={stateCode}
              onChange={e => setStateCode(e.target.value)}
            >
              <option value="">—</option>
              {states.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '3 1 200px' }}>
            <label className="form-label" htmlFor="fuel-notes">Notes</label>
            <input
              id="fuel-notes"
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Vendor, location, etc."
              maxLength={255}
            />
          </div>
        </div>

        {formError && <p className="form-error">{formError}</p>}

        <div className="submit-row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !cost || !date}
          >
            {submitting ? 'Saving…' : 'Log purchase'}
          </button>
        </div>
      </form>

      {/* ── Filters ───────────────────────────────────────────── */}
      {purchases.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <FilterBar
            filters={fuelFilters}
            onClear={() => { setFilterFuelType(''); setFilterFuelYear(''); setFilterSettled(''); }}
            hasActive={hasFuelFilter}
          />
        </div>
      )}

      {/* ── Totals block ──────────────────────────────────────── */}
      {totals.length > 0 && (
        <section style={{ marginTop: 32, marginBottom: 8 }}>
          <p className="section-label">Spend by type</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 6, color: 'var(--text-muted)', fontWeight: 500 }}>
                  Type
                </th>
                <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {displayYear}
                </th>
                <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--text-muted)', fontWeight: 500 }}>
                  All-time
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.map(row => (
                <tr key={row.type} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0' }}>{row.type}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>
                    {row.currentYear > 0 ? `$${row.currentYear.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>
                    ${row.allTime.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Entries list ──────────────────────────────────────── */}
      {visiblePurchases.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <p className="section-label">
            Entries{hasFuelFilter ? ` (${visiblePurchases.length} of ${purchases.length})` : ''}
          </p>
          {visiblePurchases.map(p => (
            <div key={p.id}>
              {edit?.id === p.id ? (
                /* EDIT ROW */
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                  {/* Row 1: type, date, cost, discount, gallons, odometer, state, notes */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <select
                      className="form-input"
                      style={{ flex: '1 1 110px' }}
                      value={edit.fuelType}
                      onChange={e => upd('fuelType', e.target.value as FuelType)}
                    >
                      {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="date"
                      className="form-input"
                      style={{ flex: '1 1 140px' }}
                      value={edit.date}
                      onChange={e => upd('date', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      style={{ flex: '1 1 100px' }}
                      value={edit.cost}
                      onChange={e => upd('cost', e.target.value)}
                      placeholder="Cost ($)"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      style={{ flex: '1 1 100px' }}
                      value={edit.discountAmount}
                      onChange={e => upd('discountAmount', e.target.value)}
                      placeholder="Discount ($)"
                    />
                    <input
                      type="number"
                      step="0.001"
                      className="form-input"
                      style={{ flex: '1 1 90px' }}
                      value={edit.gallons}
                      onChange={e => upd('gallons', e.target.value)}
                      placeholder="Gallons"
                    />
                    {edit.fuelType === 'Diesel' && (
                      <input
                        type="number"
                        className="form-input"
                        style={{ flex: '1 1 110px' }}
                        value={edit.odometer}
                        onChange={e => upd('odometer', e.target.value)}
                        placeholder="Odometer"
                      />
                    )}
                    <select
                      className="form-input"
                      style={{ flex: '1 1 100px' }}
                      value={edit.stateCode}
                      onChange={e => upd('stateCode', e.target.value)}
                    >
                      <option value="">State —</option>
                      {states.map(s => (
                        <option key={s.code} value={s.code}>{s.code}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: '3 1 180px' }}
                      value={edit.notes}
                      onChange={e => upd('notes', e.target.value)}
                      placeholder="Notes"
                      maxLength={255}
                    />
                  </div>
                  {/* Row 2: full fill + settled toggles */}
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fill</span>
                      <TogglePair
                        value={edit.fullFill}
                        onChange={v => upd('fullFill', v)}
                        trueLabel="Full"
                        falseLabel="Partial"
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</span>
                      <TogglePair
                        value={edit.settled}
                        onChange={v => upd('settled', v)}
                        trueLabel="Settled"
                        falseLabel="Provisional"
                      />
                    </div>
                    {edit.discountAmount && edit.cost && (
                      <div style={{ alignSelf: 'flex-end', fontSize: 13, color: 'var(--text-muted)', paddingBottom: 4 }}>
                        Gross: ${(parseFloat(edit.cost || '0') + parseFloat(edit.discountAmount || '0')).toFixed(2)}
                      </div>
                    )}
                  </div>
                  {/* Row 3: action buttons */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13, padding: '4px 14px' }}
                      onClick={saveEdit}
                      disabled={editSubmitting}
                    >
                      {editSubmitting ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="btn"
                      style={{ fontSize: 13, padding: '4px 14px' }}
                      onClick={() => { setEdit(null); setConfirmDeleteId(null); }}
                    >
                      Cancel
                    </button>
                    <span style={{ marginLeft: 'auto' }}>
                      {confirmDeleteId === p.id ? (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 8 }}>Delete?</span>
                          <button
                            className="btn"
                            style={{ fontSize: 13, padding: '4px 12px', color: '#dc2626', marginRight: 6 }}
                            onClick={() => handleDelete(p.id)}
                          >
                            Yes
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: 13, padding: '4px 12px' }}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn"
                          style={{ fontSize: 13, padding: '4px 14px', color: '#dc2626' }}
                          onClick={() => setConfirmDeleteId(p.id)}
                        >
                          Delete
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                /* READ ROW */
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(p)}
                  onKeyDown={e => e.key === 'Enter' && openEdit(p)}
                  style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
                    gap: '4px 12px', padding: '10px 0',
                    borderTop: '1px solid var(--border)', cursor: 'pointer',
                    opacity: p.settled ? 1 : 0.7,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, width: 90 }}>
                    {p.purchase_date}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, flexShrink: 0, width: 68 }}>
                    {p.fuel_type}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    ${p.total_cost.toFixed(2)}
                  </span>
                  {p.discount_amount != null && (
                    <span style={{ fontSize: 12, color: 'var(--green)', flexShrink: 0 }}>
                      −${p.discount_amount.toFixed(2)}
                    </span>
                  )}
                  {!p.settled && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--gold-dark)',
                      border: '1px solid var(--gold-dark)', borderRadius: 3,
                      padding: '1px 5px', flexShrink: 0,
                    }}>
                      provisional
                    </span>
                  )}
                  {!p.full_fill && (
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 3,
                      padding: '1px 5px', flexShrink: 0,
                    }}>
                      partial
                    </span>
                  )}
                  {p.state_code && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {p.state_code}
                    </span>
                  )}
                  {p.gallons != null && (
                    <>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {p.gallons} gal
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                        ${(p.total_cost / p.gallons).toFixed(3)}/gal
                      </span>
                    </>
                  )}
                  {p.odometer != null && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {p.odometer.toLocaleString()} mi
                    </span>
                  )}
                  {p.notes && (
                    <span
                      style={{
                        fontSize: 13, color: 'var(--text-muted)',
                        minWidth: 0, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {p.notes}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      ) : purchases.length > 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <p>No purchases match the active filters.</p>
          <p style={{ marginTop: 8 }}>
            <button
              type="button"
              style={{ color: 'var(--gold-dark)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
              onClick={() => { setFilterFuelType(''); setFilterFuelYear(''); setFilterSettled(''); }}
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <p style={{ fontSize: 32 }}>⛽</p>
          <p>No fuel purchases logged yet.</p>
        </div>
      )}
    </main>
  );
}
