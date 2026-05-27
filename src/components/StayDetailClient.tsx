'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GateCodeEditor from './GateCodeEditor';
import PlacesAutocomplete, { type PlaceSelection } from './PlacesAutocomplete';
import DetailsToggle from './DetailsToggle';
import type { Stay, StayStatus, StayType } from '@/lib/types';

// ── Constants ────────────────────────────────────────────────────────

const STATUSES: StayStatus[] = ['Booked', 'Deposit Paid', 'Paid in Full', 'Stayed', 'Cancelled'];
const STAY_TYPES: StayType[] = ['Paid', 'Boondocking', 'Harvest Host', 'Free'];
const COUNTRIES              = ['USA', 'Canada'];

// ── Helpers ──────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFull(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
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

// ── Component ────────────────────────────────────────────────────────

export default function StayDetailClient({ stay: initialStay }: { stay: Stay }) {
  const router = useRouter();

  const [stay,         setStay]        = useState<Stay>(initialStay);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft,        setDraft]       = useState('');
  const [saving,       setSaving]      = useState(false);
  const [error,        setError]       = useState<string | null>(null);
  const [showPlaces,   setShowPlaces]  = useState(false);
  const [showDelete,   setShowDelete]  = useState(false);
  const [deleting,     setDeleting]    = useState(false);
  const [deleteError,  setDeleteError] = useState<string | null>(null);
  const [showMarkPaid,  setShowMarkPaid]  = useState(false);
  const [markingPaid,   setMarkingPaid]   = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);

  // ── Edit handlers ────────────────────────────────────────────────

  const openEdit = (field: string, value: string | number | null) => {
    setEditingField(field);
    setDraft(value != null ? String(value) : '');
    setError(null);
    setShowPlaces(false);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setError(null);
    setShowPlaces(false);
  };

  const saveField = async (field: string) => {
    const required = ['name', 'country', 'stay_type', 'status', 'arrival', 'departure'];
    const numeric  = ['total_charged', 'deposit_paid'];

    let value: string | number | null;
    if (numeric.includes(field)) {
      value = parseFloat(draft) || 0;
    } else if (required.includes(field)) {
      if (!draft.trim()) { setError('This field is required.'); return; }
      value = draft.trim();
    } else {
      value = draft.trim() || null;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stays/${stay.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('failed');
      setStay(await res.json());
      setEditingField(null);
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePlaceSelect = async (place: PlaceSelection) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stays/${stay.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         place.name,
          full_address: place.address  || null,
          lat:          place.lat,
          lng:          place.lng,
          place_id:     place.place_id,
          city:         place.city,
          state:        place.state,
          phone:        place.phone,
          website:      place.website,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStay(await res.json());
      setEditingField(null);
      setShowPlaces(false);
    } catch {
      setError('Could not save location — try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    setMarkingPaid(true);
    setMarkPaidError(null);
    try {
      const body: Record<string, unknown> = { deposit_paid: stay.total_charged };
      if (stay.status === 'Booked' || stay.status === 'Deposit Paid') {
        body.status = 'Paid in Full';
      }
      const res = await fetch(`/api/stays/${stay.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error('failed');
      setStay(await res.json());
      setShowMarkPaid(false);
    } catch {
      setMarkPaidError('Could not update — try again.');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/stays/${stay.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      router.push('/stays');
    } catch {
      setDeleting(false);
      setDeleteError('Delete failed — try again.');
    }
  };

  // ── Shared edit controls ─────────────────────────────────────────

  const saveBtns = (field: string) => (
    <>
      <button onClick={() => saveField(field)} disabled={saving} className="btn btn-primary btn-sm">
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={cancelEdit} className="btn btn-ghost btn-sm">Cancel</button>
      {error && <span className="inline-error">{error}</span>}
    </>
  );

  // Enter saves (single-line), Escape always cancels
  const kd = (field: string, multiline = false) =>
    (e: React.KeyboardEvent) => {
      if (!multiline && e.key === 'Enter') saveField(field);
      if (e.key === 'Escape') cancelEdit();
    };

  // ── Row renderers ────────────────────────────────────────────────

  const textRow = (
    label: string,
    field: keyof Stay,
    opts?: { addLabel?: string; inputType?: string; format?: (v: string) => React.ReactNode },
  ) => {
    const raw     = stay[field] as string | null;
    const editing = editingField === (field as string);
    return (
      <div className="info-row">
        <span className="info-label">{label}</span>
        <span className="info-value">
          {editing ? (
            <span className="inline-edit-row">
              <input
                type={opts?.inputType ?? 'text'}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-input"
                autoFocus
                onKeyDown={kd(field as string)}
              />
              {saveBtns(field as string)}
            </span>
          ) : raw ? (
            <>
              {opts?.format ? opts.format(raw) : raw}
              {' '}
              <button onClick={() => openEdit(field as string, raw)} className="edit-btn">Edit</button>
            </>
          ) : (
            <button onClick={() => openEdit(field as string, '')} className="add-field-btn">
              + Add {opts?.addLabel ?? label.toLowerCase()}
            </button>
          )}
        </span>
      </div>
    );
  };

  const textareaRow = (
    label: string,
    field: keyof Stay,
    opts?: { addLabel?: string; rows?: number },
  ) => {
    const raw     = stay[field] as string | null;
    const editing = editingField === (field as string);
    return (
      <div className="info-row">
        <span className="info-label">{label}</span>
        <span className="info-value">
          {editing ? (
            <span className="inline-edit-col">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-textarea"
                rows={opts?.rows ?? 3}
                autoFocus
                onKeyDown={kd(field as string, true)}
              />
              <span className="inline-edit-row">{saveBtns(field as string)}</span>
            </span>
          ) : raw ? (
            <>
              <span style={{ whiteSpace: 'pre-wrap' }}>{raw}</span>
              {' '}
              <button onClick={() => openEdit(field as string, raw)} className="edit-btn">Edit</button>
            </>
          ) : (
            <button onClick={() => openEdit(field as string, '')} className="add-field-btn">
              + Add {opts?.addLabel ?? label.toLowerCase()}
            </button>
          )}
        </span>
      </div>
    );
  };

  const selectRow = (label: string, field: keyof Stay, options: string[]) => {
    const raw     = stay[field] as string;
    const editing = editingField === (field as string);
    return (
      <div className="info-row">
        <span className="info-label">{label}</span>
        <span className="info-value">
          {editing ? (
            <span className="inline-edit-row">
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-select"
                autoFocus
              >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveBtns(field as string)}
            </span>
          ) : (
            <>
              {raw}
              {' '}
              <button onClick={() => openEdit(field as string, raw)} className="edit-btn">Edit</button>
            </>
          )}
        </span>
      </div>
    );
  };

  const dateRow = (
    label: string,
    field: 'arrival' | 'departure',
    suffix?: React.ReactNode,
  ) => {
    const raw     = stay[field];
    const editing = editingField === field;
    return (
      <div className="info-row">
        <span className="info-label">{label}</span>
        <span className="info-value">
          {editing ? (
            <span className="inline-edit-row">
              <input
                type="date"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-input"
                autoFocus
                onKeyDown={kd(field)}
              />
              {saveBtns(field)}
            </span>
          ) : (
            <>
              {formatFull(raw)}{suffix}
              {' '}
              <button onClick={() => openEdit(field, raw)} className="edit-btn">Edit</button>
            </>
          )}
        </span>
      </div>
    );
  };

  const numberRow = (label: string, field: 'total_charged' | 'deposit_paid') => {
    const raw     = stay[field];
    const editing = editingField === field;
    return (
      <div className="info-row">
        <span className="info-label">{label}</span>
        <span className="info-value">
          {editing ? (
            <span className="inline-edit-row">
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-input"
                style={{ maxWidth: 130 }}
                autoFocus
                onKeyDown={kd(field)}
              />
              {saveBtns(field)}
            </span>
          ) : (
            <>
              ${raw.toFixed(2)}
              {' '}
              <button onClick={() => openEdit(field, raw)} className="edit-btn">Edit</button>
            </>
          )}
        </span>
      </div>
    );
  };

  // ── Computed ─────────────────────────────────────────────────────

  const mapsUrl = stay.full_address
    ? `https://maps.google.com/?q=${encodeURIComponent(stay.full_address)}`
    : `https://maps.google.com/?q=${encodeURIComponent(stay.name)}`;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <Link href="/upcoming" className="detail-back">← Upcoming</Link>

      {/* Status badge — editable */}
      {editingField === 'status' ? (
        <div style={{ marginBottom: 10 }}>
          <span className="inline-edit-row">
            <select
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="inline-select"
              autoFocus
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {saveBtns('status')}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <span className={statusClass(stay.status)}>{stay.status}</span>
          {' '}
          <button onClick={() => openEdit('status', stay.status)} className="edit-btn">Edit</button>
        </div>
      )}

      <div className="hero-card" style={{ marginTop: 12 }}>

        {/* Name — with Search Google toggle */}
        {editingField === 'name' ? (
          <div className="name-edit-block">
            {showPlaces ? (
              <PlacesAutocomplete
                value={draft}
                onChange={v => setDraft(v)}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search campground name…"
              />
            ) : (
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="inline-input name-inline-input"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter')  saveField('name');
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
            )}
            <div className="inline-edit-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowPlaces(p => !p)}
                className="btn btn-ghost btn-sm"
              >
                {showPlaces ? '✕ Manual entry' : '🔍 Search Google'}
              </button>
              {!showPlaces && (
                <button
                  onClick={() => saveField('name')}
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? '…' : 'Save'}
                </button>
              )}
              <button onClick={cancelEdit} className="btn btn-ghost btn-sm">Cancel</button>
              {error && <span className="inline-error">{error}</span>}
            </div>
          </div>
        ) : (
          <h1 className="stay-name" style={{ marginBottom: 16 }}>
            {stay.name}
            <button
              onClick={() => openEdit('name', stay.name)}
              className="edit-btn"
              style={{ marginLeft: 10, verticalAlign: 'middle' }}
            >
              Edit
            </button>
          </h1>
        )}

        <div className="info-rows">
          {/* Location */}
          {textRow('City',      'city',     { addLabel: 'city' })}
          {textRow('State',     'state',    { addLabel: 'state' })}
          {selectRow('Country',   'country',   COUNTRIES)}
          {selectRow('Stay type', 'stay_type', STAY_TYPES)}

          {/* Dates */}
          {dateRow('Arrival',   'arrival')}
          {dateRow('Departure', 'departure', (
            <span className="nights-remaining">
              {' · '}{stay.nights} night{stay.nights !== 1 ? 's' : ''}
            </span>
          ))}

          {/* Address */}
          <div className="info-row">
            <span className="info-label">Address</span>
            <span className="info-value">
              {editingField === 'full_address' ? (
                <span className="inline-edit-col">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="inline-textarea"
                    rows={2}
                    autoFocus
                    onKeyDown={kd('full_address', true)}
                  />
                  <span className="inline-edit-row">{saveBtns('full_address')}</span>
                </span>
              ) : stay.full_address ? (
                <>
                  {stay.full_address}
                  {' · '}
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                    Open in Maps ↗
                  </a>
                  {' '}
                  <button
                    onClick={() => openEdit('full_address', stay.full_address!)}
                    className="edit-btn"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">
                    Open in Maps ↗
                  </a>
                  {' '}
                  <button onClick={() => openEdit('full_address', '')} className="add-field-btn">
                    + Add address
                  </button>
                </>
              )}
            </span>
          </div>

          {/* Gate code — unchanged component */}
          <div className="info-row">
            <span className="info-label">Gate code</span>
            <span className="info-value">
              <GateCodeEditor stayId={stay.id} initialCode={stay.gate_code} />
            </span>
          </div>

          {/* Check-in */}
          {textRow('Check-in', 'check_in_time', { addLabel: 'check-in time' })}
          {textareaRow('Instructions', 'check_in_instructions', {
            addLabel: 'instructions',
            rows: 2,
          })}

          {/* Phone */}
          <div className="info-row">
            <span className="info-label">Phone</span>
            <span className="info-value">
              {editingField === 'phone' ? (
                <span className="inline-edit-row">
                  <input
                    type="tel"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="inline-input"
                    autoFocus
                    onKeyDown={kd('phone')}
                  />
                  {saveBtns('phone')}
                </span>
              ) : stay.phone ? (
                <>
                  <a href={`tel:${stay.phone.replace(/\D/g, '')}`}>{stay.phone}</a>
                  {' '}
                  <button onClick={() => openEdit('phone', stay.phone!)} className="edit-btn">Edit</button>
                </>
              ) : (
                <button onClick={() => openEdit('phone', '')} className="add-field-btn">
                  + Add phone
                </button>
              )}
            </span>
          </div>

          {/* Email */}
          <div className="info-row">
            <span className="info-label">Email</span>
            <span className="info-value">
              {editingField === 'email' ? (
                <span className="inline-edit-row">
                  <input
                    type="email"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="inline-input"
                    autoFocus
                    onKeyDown={kd('email')}
                  />
                  {saveBtns('email')}
                </span>
              ) : stay.email ? (
                <>
                  <a href={`mailto:${stay.email}`}>{stay.email}</a>
                  {' '}
                  <button onClick={() => openEdit('email', stay.email!)} className="edit-btn">Edit</button>
                </>
              ) : (
                <button onClick={() => openEdit('email', '')} className="add-field-btn">
                  + Add email
                </button>
              )}
            </span>
          </div>

          {/* Financials */}
          {numberRow('Total', 'total_charged')}
          {numberRow('Paid',  'deposit_paid')}
          {stay.balance_due > 0 && (
            <div className="info-row">
              <span className="info-label">Balance</span>
              <span className="info-value">
                <span className="inline-edit-row" style={{ gap: 10 }}>
                  <span className={`badge ${stay.status === 'Deposit Paid' ? 'badge-amber' : 'badge-red'}`}>
                    ${stay.balance_due.toFixed(2)}
                  </span>
                  {stay.status !== 'Cancelled' && stay.status !== 'Paid in Full' && (
                    <button className="btn-mark-paid" onClick={() => setShowMarkPaid(true)}>
                      Mark as Paid in Full
                    </button>
                  )}
                </span>
                {markPaidError && (
                  <span className="inline-error" style={{ display: 'block', marginTop: 4 }}>
                    {markPaidError}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible extras */}
        <DetailsToggle>
          <div className="info-rows" style={{ borderTop: 'none' }}>
            {textRow('Confirmation', 'confirmation_number', { addLabel: 'confirmation #' })}
            {textRow('Program',      'program',             { addLabel: 'program' })}
            {textRow('Website',      'website',             {
              addLabel: 'website',
              format: (v) => (
                <a href={v} target="_blank" rel="noopener noreferrer">
                  {v.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              ),
            })}
            {textareaRow('Notes', 'notes', { addLabel: 'notes', rows: 4 })}
            {(stay.lat && stay.lng) && (
              <div className="info-row">
                <span className="info-label">Coords</span>
                <span className="info-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {stay.lat.toFixed(5)}, {stay.lng.toFixed(5)}
                </span>
              </div>
            )}
          </div>
        </DetailsToggle>
      </div>

      {/* Delete stay */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button className="delete-stay-btn" onClick={() => setShowDelete(true)}>
          Delete stay
        </button>
      </div>

      {/* Mark as Paid in Full modal */}
      {showMarkPaid && (
        <div className="dialog-backdrop" onClick={() => setShowMarkPaid(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              Mark {stay.name} as paid in full?
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              Sets deposit paid to ${stay.total_charged.toFixed(2)}.
              {(stay.status === 'Booked' || stay.status === 'Deposit Paid') &&
                ' Status will change to Paid in Full.'}
            </p>
            {markPaidError && (
              <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{markPaidError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowMarkPaid(false)}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleMarkPaid}
                disabled={markingPaid}
              >
                {markingPaid ? 'Saving…' : 'Mark as Paid in Full'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="dialog-backdrop" onClick={() => setShowDelete(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              Delete {stay.name}?
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDelete(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
