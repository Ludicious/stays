'use client';

import { useState } from 'react';

export default function DetailsToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="details-toggle-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{open ? '▲' : '▼'}</span>
        {open ? 'Hide details' : 'More details'}
      </button>
      {open && <div className="details-panel">{children}</div>}
    </>
  );
}
