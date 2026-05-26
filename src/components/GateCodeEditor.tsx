'use client';

import { useState } from 'react';
import CopyButton from './CopyButton';

interface Props {
  stayId: number;
  initialCode: string | null;
}

export default function GateCodeEditor({ stayId, initialCode }: Props) {
  const [code,    setCode]    = useState(initialCode);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(initialCode ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const openEdit = () => {
    setDraft(code ?? '');
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stays/${stayId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gate_code: draft.trim() || null }),
      });
      if (!res.ok) throw new Error('Save failed');
      setCode(draft.trim() || null);
      setEditing(false);
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className="gate-code-edit-row">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="gate-code-input"
          placeholder="e.g. A1234#"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter')  handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={handleCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </span>
    );
  }

  if (code) {
    return (
      <span className="gate-code-row">
        <span className="gate-code">{code}</span>
        <CopyButton text={code} />
        <button onClick={openEdit} className="edit-btn">Edit</button>
      </span>
    );
  }

  return (
    <button onClick={openEdit} className="add-field-btn">
      + Add gate code
    </button>
  );
}
