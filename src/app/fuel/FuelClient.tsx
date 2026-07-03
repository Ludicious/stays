'use client';

import { useState } from 'react';
import type { FuelPurchase, FuelType } from '@/lib/types';

const FUEL_TYPES: FuelType[] = ['Diesel', 'Gasoline', 'DEF', 'Propane'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type EditState = {
  id:       number;
  fuelType: FuelType;
  date:     string;
  cost:     string;
  gallons:  string;
  odometer: string;
  notes:    string;
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

interface Props {
  initialPurchases: FuelPurchase[];
  currentYear:      number;
}

export default function FuelClient({ initialPurchases, currentYear }: Props) {
  const [purchases,       setPurchases]       = useState<FuelPurchase[]>(initialPurchases);
  const [fuelType,        setFuelType]        = useState<FuelType>('Diesel');
  const [date,            setDate]            = useState(todayStr());
  const [cost,            setCost]            = useState('');
  const [gallons,         setGallons]         = useState('');
  const [odometer,        setOdometer]        = useState('');
  const [notes,           setNotes]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [edit,            setEdit]            = useState<EditState | null>(null);
  const [editSubmitting,  setEditSubmitting]  = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const totals = computeTotals(purchases, currentYear);

  // ── Add new purchase ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costNum = parseFloat(cost);
    if (!date) { setFormError('Date is required.'); return; }
    if (isNaN(costNum) || costNum <= 0) { setFormError('Total cost must be a positive number.'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/fuel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          purchase_date: date,
          fuel_type:     fuelType,
          total_cost:    costNum,
          gallons:       gallons  ? parseFloat(gallons)    : null,
          odometer:      odometer ? parseInt(odometer, 10) : null,
          notes:         notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save.');
      }
      const created = await res.json() as FuelPurchase;
      setPurchases(prev => sortPurchases([created, ...prev]));
      setCost('');
      setGallons('');
      setOdometer('');
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
      id:       p.id,
      fuelType: p.fuel_type,
      date:     p.purchase_date,
      cost:     String(p.total_cost),
      gallons:  p.gallons  != null ? String(p.gallons)  : '',
      odometer: p.odometer != null ? String(p.odometer) : '',
      notes:    p.notes ?? '',
    });
    setConfirmDeleteId(null);
  };

  const upd = (key: keyof EditState, val: string) =>
    setEdit(prev => prev ? { ...prev, [key]: val } as EditState : prev);

  const saveEdit = async () => {
    if (!edit) return;
    const costNum = parseFloat(edit.cost);
    if (isNaN(costNum) || costNum <= 0) return;

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/fuel/${edit.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          purchase_date: edit.date,
          fuel_type:     edit.fuelType,
          total_cost:    costNum,
          gallons:       edit.gallons  ? parseFloat(edit.gallons)    : null,
          odometer:      edit.odometer ? parseInt(edit.odometer, 10) : null,
          notes:         edit.notes.trim() || null,
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

        {/* Cost + Date — primary required */}
        <div style={{ display: 'flex', gap: 12 }}>
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

        {/* Optional: gallons, odometer (Diesel only), notes */}
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
                  {currentYear}
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
      {purchases.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <p className="section-label">Entries</p>
          {purchases.map(p => (
            <div key={p.id}>
              {edit?.id === p.id ? (
                /* EDIT ROW */
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <select
                      className="form-input"
                      style={{ flex: '1 1 110px' }}
                      value={edit.fuelType}
                      onChange={e => upd('fuelType', e.target.value)}
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
                      step="0.001"
                      className="form-input"
                      style={{ flex: '1 1 100px' }}
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
      ) : (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <p style={{ fontSize: 32 }}>⛽</p>
          <p>No fuel purchases logged yet.</p>
        </div>
      )}
    </main>
  );
}
