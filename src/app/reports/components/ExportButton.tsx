'use client';

import { type RefObject, useState } from 'react';

interface Props {
  targetRef: RefObject<HTMLDivElement | null>;
  filename:  string;   // e.g. "stays-big-picture-2025"  (no timestamp, no extension)
}

export default function ExportButton({ targetRef, filename }: Props) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current || busy) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const ts = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '');
      const dataUrl = await toPng(targetRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href     = dataUrl;
      a.download = `${filename}-${ts}.png`;
      a.click();
    } catch (err) {
      console.error('[ExportButton]', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn-export" onClick={handleExport} disabled={busy}>
      {busy ? '…' : '↓ PNG'}
    </button>
  );
}
