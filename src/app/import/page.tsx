'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { ParseResponse, ParsedStay, CommitStay, CommitResponse } from '@/lib/import-types';
import type { StayType } from '@/lib/types';

// ── Editable row — ParsedStay with user overrides ────────────────────

interface EditableRow {
  // Immutable during preview
  tempId:               number;
  arrival:              string;
  departure:            string;
  full_address:         string | null;
  website:              string | null;
  phone:                string | null;
  email:                string | null;
  lat:                  number | null;
  lng:                  number | null;
  deposit_paid:         number;
  confirmation_number:  string | null;
  city:                 string | null;
  state:                string | null;
  country:              string | null;
  // Flags
  name_is_address_like: boolean;
  is_duplicate:         boolean;
  duplicate_of_id:      number | null;
  duplicate_of_arrival: string | null;
  // User-editable
  skip:          boolean;
  name:          string;
  stay_type:     StayType;
  program:       string;
  total_charged: number;
  notes:         string;
}

function toEditableRow(s: ParsedStay): EditableRow {
  return {
    tempId:               s.tempId,
    arrival:              s.arrival,
    departure:            s.departure,
    full_address:         s.full_address,
    website:              s.website,
    phone:                s.phone,
    email:                s.email,
    lat:                  s.lat,
    lng:                  s.lng,
    deposit_paid:         s.deposit_paid,
    confirmation_number:  s.confirmation_number,
    city:                 s.city,
    state:                s.state,
    country:              s.country,
    name_is_address_like: s.name_is_address_like,
    is_duplicate:         s.is_duplicate,
    duplicate_of_id:      s.duplicate_of_id,
    duplicate_of_arrival: s.duplicate_of_arrival,
    // Editable defaults
    skip:          s.is_duplicate,
    name:          s.name,
    stay_type:     s.suggested_stay_type,
    program:       s.suggested_program ?? '',
    total_charged: s.total_charged,
    notes:         s.notes ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────

type Step   = 0 | 1 | 2 | 3;
type Format = 'rvlife' | 'template';

export default function ImportPage() {
  const [step,         setStep]         = useState<Step>(0);
  const [format,       setFormat]       = useState<Format | null>(null);
  const [dragging,     setDragging]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [parseError,   setParseError]   = useState<string | null>(null);
  const [summary,      setSummary]      = useState<ParseResponse['summary'] | null>(null);
  const [rows,         setRows]         = useState<EditableRow[]>([]);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload handling ──────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setParseError('Please upload a .xlsx file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is too large (max 5 MB).');
      return;
    }

    setParseError(null);
    setLoading(true);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('format', format!);

    try {
      const res  = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const data = await res.json() as ParseResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? 'Parse failed.');
      setSummary(data.summary);
      setRows(data.stays.map(toEditableRow));
      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Parse failed.');
    } finally {
      setLoading(false);
    }
  }, [format]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Row editing ──────────────────────────────────────────────────

  const updateRow = useCallback((i: number, patch: Partial<EditableRow>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }, []);

  const importCount = rows.filter(r => !r.skip).length;

  // ── Commit ───────────────────────────────────────────────────────

  const handleCommit = async () => {
    setParseError(null);
    setLoading(true);

    const stays: CommitStay[] = rows.map(r => ({
      tempId:               r.tempId,
      skip:                 r.skip,
      name:                 r.name,
      arrival:              r.arrival,
      departure:            r.departure,
      full_address:         r.full_address,
      website:              r.website,
      phone:                r.phone,
      email:                r.email,
      lat:                  r.lat,
      lng:                  r.lng,
      total_charged:        r.total_charged,
      deposit_paid:         r.deposit_paid,
      confirmation_number:  r.confirmation_number,
      notes:                r.notes || null,
      city:                 r.city,
      state:                r.state,
      country:              r.country,
      stay_type:            r.stay_type,
      program:              r.program || null,
    }));

    try {
      const res  = await fetch('/api/import/commit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stays }),
      });
      const data = await res.json() as CommitResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? 'Commit failed.');
      setCommitResult(data);
      setStep(3);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Commit failed.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0); setFormat(null); setSummary(null);
    setRows([]); setCommitResult(null); setParseError(null);
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="page-wrap">
      <h1 className="page-title" style={{ marginBottom: 8 }}>Import Stays</h1>

      {/* ── Step 0: Format selector ─────────────────────────────── */}
      {step === 0 && (
        <div className="import-step">
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Choose the format of the file you&apos;re importing.
          </p>
          <div className="format-cards">
            <button
              className="format-card"
              onClick={() => { setFormat('rvlife'); setParseError(null); setStep(1); }}
            >
              <div className="format-card-title">RV Life Tripwizard export</div>
              <div className="format-card-sub">I exported a trip from RV Life Tripwizard</div>
            </button>

            <button
              className="format-card"
              onClick={() => { setFormat('template'); setParseError(null); setStep(1); }}
            >
              <div className="format-card-title">Stays template</div>
              <div className="format-card-sub">
                I&apos;m filling in stays from scratch using your template
              </div>
              <a
                href="/templates/stays-import-template.xlsx"
                download
                className="format-card-dl"
                onClick={e => e.stopPropagation()}
              >
                Download blank template (.xlsx)
              </a>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Upload ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="import-step">
          <button className="import-back" onClick={() => { setStep(0); setParseError(null); }}>
            ← Back
          </button>
          <h2 className="import-step-title">
            {format === 'rvlife' ? 'Upload RV Life Tripwizard export' : 'Upload Stays template'}
          </h2>

          <div
            className={`upload-zone${dragging ? ' upload-zone-drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            {loading ? (
              <div className="upload-zone-inner">
                <div className="import-spinner" />
                <span>Parsing file…</span>
              </div>
            ) : (
              <div className="upload-zone-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                  <path d="M4 16l4-4 4 4 4-4 4 4" /><path d="M4 20h16" /><path d="M12 4v12" />
                </svg>
                <span style={{ fontWeight: 600 }}>Drop .xlsx here or click to select</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Max 5 MB</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleInputChange}
            />
          </div>

          {parseError && (
            <div className="import-error">{parseError}</div>
          )}
        </div>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────── */}
      {step === 2 && summary && (
        <div>
          {/* Summary stats */}
          <div className="import-summary">
            <span className="import-summary-item">{summary.total} stay{summary.total !== 1 ? 's' : ''} detected</span>
            {summary.duplicatesFound > 0 && (
              <span className="import-summary-item import-summary-dup">
                {summary.duplicatesFound} possible duplicate{summary.duplicatesFound !== 1 ? 's' : ''} — will be skipped by default
              </span>
            )}
            {summary.addressLikeNames > 0 && (
              <span className="import-summary-item import-summary-warn">
                {summary.addressLikeNames} name{summary.addressLikeNames !== 1 ? 's look' : ' looks'} like an address — review below
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Skip</th>
                  <th style={{ minWidth: 200 }}>Name</th>
                  <th style={{ width: 100 }}>Arrival</th>
                  <th style={{ width: 100 }}>Departure</th>
                  <th style={{ width: 130 }}>Stay Type</th>
                  <th style={{ width: 140 }}>Program</th>
                  <th style={{ width: 90 }}>Total $</th>
                  <th style={{ minWidth: 180 }}>Flags</th>
                  <th style={{ width: 60 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.tempId} className={row.skip ? 'import-row-skip' : ''}>
                    {/* Skip checkbox */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={e => updateRow(i, { skip: e.target.checked })}
                        title={row.skip ? 'Will be skipped' : 'Will be imported'}
                      />
                    </td>

                    {/* Name */}
                    <td style={{ background: row.name_is_address_like ? 'var(--amber-bg)' : undefined }}>
                      <input
                        type="text"
                        className="import-cell-input"
                        value={row.name}
                        onChange={e => updateRow(i, { name: e.target.value })}
                      />
                      {row.name_is_address_like && (
                        <span className="import-flag-address">
                          ⚠ Name looks like an address — consider renaming
                        </span>
                      )}
                    </td>

                    {/* Arrival / Departure — read-only */}
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{row.arrival}</td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{row.departure}</td>

                    {/* Stay Type */}
                    <td>
                      <select
                        className="import-cell-select"
                        value={row.stay_type}
                        onChange={e => updateRow(i, { stay_type: e.target.value as StayType })}
                      >
                        <option value="Paid">Paid</option>
                        <option value="Boondocking">Boondocking</option>
                        <option value="Harvest Host">Harvest Host</option>
                        <option value="Free">Free</option>
                      </select>
                    </td>

                    {/* Program */}
                    <td>
                      <input
                        type="text"
                        className="import-cell-input"
                        value={row.program}
                        onChange={e => updateRow(i, { program: e.target.value })}
                        placeholder="none"
                      />
                    </td>

                    {/* Total charged */}
                    <td>
                      <input
                        type="number"
                        className="import-cell-input"
                        value={row.total_charged}
                        min={0}
                        step={0.01}
                        onChange={e => updateRow(i, { total_charged: parseFloat(e.target.value) || 0 })}
                        style={{ textAlign: 'right' }}
                      />
                    </td>

                    {/* Flags */}
                    <td>
                      {row.is_duplicate && (
                        <span className="import-flag-dup">
                          ⚠ Possible duplicate — stay #{row.duplicate_of_id}
                          {row.duplicate_of_arrival && ` (${row.duplicate_of_arrival})`}
                        </span>
                      )}
                    </td>

                    {/* Notes count */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {row.notes ? row.notes.length : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No stays detected in this file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {parseError && (
            <div className="import-error">{parseError}</div>
          )}

          <div className="import-actions">
            <button
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={loading || importCount === 0}
            >
              {loading ? 'Importing…' : `Import ${importCount} stay${importCount !== 1 ? 's' : ''}`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setRows([]); setSummary(null); setParseError(null); setStep(1); }}
              disabled={loading}
            >
              Cancel — upload different file
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirmation ─────────────────────────────────── */}
      {step === 3 && commitResult && (
        <div className="import-step">
          <div className="import-success-icon">✓</div>
          <h2 className="import-step-title">
            Imported {commitResult.imported} stay{commitResult.imported !== 1 ? 's' : ''}
          </h2>

          <div className="import-confirm-links">
            {commitResult.hasUpcoming && (
              <Link href="/upcoming" className="btn btn-primary">
                View upcoming stays
              </Link>
            )}
            <Link href="/stays" className="btn btn-ghost">
              View all stays
            </Link>
            <button className="btn btn-ghost" onClick={reset}>
              Import another file
            </button>
          </div>

          {commitResult.errors.length > 0 && (
            <div className="import-error-list">
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                {commitResult.errors.length} row{commitResult.errors.length !== 1 ? 's' : ''} failed to import:
              </p>
              <ul>
                {commitResult.errors.map(e => (
                  <li key={e.tempId}>
                    <strong>{e.name}</strong>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
