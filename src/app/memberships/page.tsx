'use client';

import { useState, useEffect } from 'react';
import type { Membership, SavingsMethod } from '@/lib/types';

const METHOD_LABELS: Record<SavingsMethod, string> = {
  percent_off:    'Percent off (e.g. 10% discount on stays)',
  free_vs_avg:    'Free nights vs. avg paid rate',
  per_stay_value: 'Fixed value per stay',
  none:           'No ROI estimate',
};

type FormState = {
  name:             string;
  annual_fee:       string;
  savings_method:   SavingsMethod;
  discount_percent: string;
  per_stay_value:   string;
  discount_desc:    string;
  affiliate_url:    string;
  active:           boolean;
  notes:            string;
};

const BLANK: FormState = {
  name:             '',
  annual_fee:       '',
  savings_method:   'none',
  discount_percent: '',
  per_stay_value:   '',
  discount_desc:    '',
  affiliate_url:    '',
  active:           true,
  notes:            '',
};

function membershipToForm(m: Membership): FormState {
  return {
    name:             m.name,
    annual_fee:       String(m.annual_fee),
    savings_method:   m.savings_method,
    discount_percent: m.discount_percent != null ? String(m.discount_percent) : '',
    per_stay_value:   m.per_stay_value   != null ? String(m.per_stay_value)   : '',
    discount_desc:    m.discount_desc    ?? '',
    affiliate_url:    m.affiliate_url    ?? '',
    active:           m.active,
    notes:            m.notes            ?? '',
  };
}

function buildBody(form: FormState) {
  return {
    name:             form.name.trim(),
    annual_fee:       parseFloat(form.annual_fee) || 0,
    savings_method:   form.savings_method,
    discount_percent: form.savings_method === 'percent_off' && form.discount_percent
      ? parseFloat(form.discount_percent) : null,
    per_stay_value:   form.savings_method === 'per_stay_value' && form.per_stay_value
      ? parseFloat(form.per_stay_value) : null,
    discount_desc:    form.discount_desc.trim()   || null,
    affiliate_url:    form.affiliate_url.trim()   || null,
    active:           form.active,
    notes:            form.notes.trim()           || null,
  };
}

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editingId,   setEditingId]   = useState<number | 'new' | null>(null);
  const [form,        setForm]        = useState<FormState>(BLANK);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const refresh = () =>
    fetch('/api/memberships')
      .then(r => r.json())
      .then((data: Membership[]) => setMemberships(data));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = () => { setEditingId('new'); setForm(BLANK); setError(null); };
  const startEdit = (m: Membership) => { setEditingId(m.id); setForm(membershipToForm(m)); setError(null); };
  const cancel    = () => { setEditingId(null); setError(null); };

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError(null);
    try {
      const isNew  = editingId === 'new';
      const url    = isNew ? '/api/memberships' : `/api/memberships/${editingId}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildBody(form)),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Save failed');
      await refresh();
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const toggleActive = async (m: Membership) => {
    setSaving(true);
    try {
      await fetch(`/api/memberships/${m.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: !m.active }),
      });
      await refresh();
    } finally { setSaving(false); }
  };

  const active   = memberships.filter(m =>  m.active);
  const inactive = memberships.filter(m => !m.active);

  return (
    <main className="page-wide">
      <div className="membership-page-header">
        <h1 className="page-title" style={{ margin: 0 }}>Memberships</h1>
        {editingId === null && (
          <button className="btn btn-primary btn-sm" onClick={startNew}>+ Add</button>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Loading…</p>}

      {editingId !== null && (
        <div className="membership-form-wrap">
          <h2 className="membership-form-title">
            {editingId === 'new' ? 'New membership' : 'Edit membership'}
          </h2>

          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={set('name')} />
          </div>

          <div className="form-group">
            <label className="form-label">Annual fee ($)</label>
            <input className="form-input" type="number" step="0.01" min="0"
              value={form.annual_fee} onChange={set('annual_fee')} />
          </div>

          <div className="form-group">
            <label className="form-label">Savings method</label>
            <select className="form-input" value={form.savings_method}
              onChange={e => setForm(f => ({ ...f, savings_method: e.target.value as SavingsMethod }))}>
              {(Object.entries(METHOD_LABELS) as [SavingsMethod, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {form.savings_method === 'percent_off' && (
            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input className="form-input" type="number" step="0.1" min="0" max="100"
                value={form.discount_percent} onChange={set('discount_percent')} placeholder="e.g. 10" />
            </div>
          )}

          {form.savings_method === 'per_stay_value' && (
            <div className="form-group">
              <label className="form-label">Value per stay ($)</label>
              <input className="form-input" type="number" step="0.01" min="0"
                value={form.per_stay_value} onChange={set('per_stay_value')} placeholder="e.g. 35.00" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Discount description</label>
            <input className="form-input" value={form.discount_desc} onChange={set('discount_desc')}
              placeholder="e.g. 10% off stays" />
          </div>

          <div className="form-group">
            <label className="form-label">Affiliate URL</label>
            <input className="form-input" type="url" value={form.affiliate_url}
              onChange={set('affiliate_url')} placeholder="https://…" />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} value={form.notes} onChange={set('notes')} />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="m-active" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="m-active" className="form-label" style={{ margin: 0 }}>Active</label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {!loading && active.length === 0 && editingId === null && (
        <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
          No active memberships. Add one above.
        </p>
      )}

      {active.length > 0 && (
        <div className="membership-list">
          {active.map(m => editingId === m.id ? null : (
            <MembershipCard key={m.id} m={m} onEdit={startEdit} onToggle={toggleActive} />
          ))}
        </div>
      )}

      {inactive.length > 0 && editingId === null && (
        <>
          <p className="section-label" style={{ marginTop: 32 }}>Inactive</p>
          <div className="membership-list">
            {inactive.map(m => (
              <MembershipCard key={m.id} m={m} onEdit={startEdit} onToggle={toggleActive} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function MembershipCard({
  m, onEdit, onToggle,
}: {
  m: Membership;
  onEdit:   (m: Membership) => void;
  onToggle: (m: Membership) => void;
}) {
  return (
    <div className={`membership-card${m.active ? '' : ' inactive'}`}>
      <div className="membership-card-header">
        <span className="membership-name">{m.name}</span>
        <span className="membership-fee">${(m.annual_fee ?? 0).toFixed(2)}/yr</span>
      </div>
      {m.discount_desc && (
        <p className="membership-meta">{m.discount_desc}</p>
      )}
      <p className="membership-method">
        {METHOD_LABELS[m.savings_method] ?? m.savings_method}
        {m.savings_method === 'percent_off' && m.discount_percent != null
          ? ` · ${m.discount_percent}%` : ''}
        {m.savings_method === 'per_stay_value' && m.per_stay_value != null
          ? ` · $${(m.per_stay_value).toFixed(2)}/stay` : ''}
      </p>
      {m.affiliate_url && (
        <a className="membership-link" href={m.affiliate_url} target="_blank" rel="noopener noreferrer">
          {m.affiliate_url.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      )}
      <div className="membership-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onToggle(m)}>
          {m.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  );
}
