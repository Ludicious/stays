'use client';

import type { Metadata } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PlacesAutocomplete, { type PlaceSelection } from '@/components/PlacesAutocomplete';
import type { StayType } from '@/lib/types';

// metadata must be in a separate server file when using 'use client',
// but the title is set via the layout template — no action needed here.

const STAY_TYPES: StayType[] = ['Paid', 'Boondocking', 'Harvest Host', 'Free'];

// Add N days to a YYYY-MM-DD string
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Today as YYYY-MM-DD
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function QuickAddPage() {
  const router = useRouter();

  const [campgroundName, setCampgroundName] = useState('');
  const [arrival,        setArrival]        = useState(todayStr());
  const [nights,         setNights]         = useState(1);
  const [stayType,       setStayType]       = useState<StayType>('Paid');
  const [placeData,      setPlaceData]      = useState<PlaceSelection | null>(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const handlePlaceSelect = (place: PlaceSelection) => {
    setCampgroundName(place.name);
    setPlaceData(place);
  };

  const handleNameChange = (val: string) => {
    setCampgroundName(val);
    // Clear place data if user manually edits after selecting
    if (placeData && val !== placeData.name) {
      setPlaceData(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campgroundName.trim()) {
      setError('Campground name is required.');
      return;
    }
    if (!arrival) {
      setError('Arrival date is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const body = {
      name:         campgroundName.trim(),
      arrival,
      departure:    addDays(arrival, Math.max(nights, 1)),
      stay_type:    stayType,
      status:       'Booked',
      // From Places selection (if any)
      full_address: placeData?.address   ?? null,
      lat:          placeData?.lat       ?? null,
      lng:          placeData?.lng       ?? null,
      place_id:     placeData?.place_id  ?? null,
      city:         placeData?.city      ?? null,
      state:        placeData?.state     ?? null,
      phone:        placeData?.phone     ?? null,
      website:      placeData?.website   ?? null,
    };

    try {
      const res = await fetch('/api/stays', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save stay.');
      }
      router.push('/upcoming');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <h1 className="page-title">Quick Add</h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* Campground name + autocomplete */}
        <div className="form-group">
          <label className="form-label" htmlFor="campground-name">
            Campground name
          </label>
          <PlacesAutocomplete
            value={campgroundName}
            onChange={handleNameChange}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Search campground name…"
          />
        </div>

        {/* Arrival date + Nights — side by side */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label" htmlFor="arrival">
              Arrival date
            </label>
            <input
              id="arrival"
              type="date"
              className="form-input"
              value={arrival}
              onChange={e => setArrival(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="nights">
              Nights
            </label>
            <input
              id="nights"
              type="number"
              className="form-input"
              value={nights}
              min={1}
              max={365}
              onChange={e => setNights(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
          </div>
        </div>

        {/* Stay type */}
        <div className="form-group">
          <p className="form-label">Stay type</p>
          <div className="seg-control" role="group" aria-label="Stay type">
            {STAY_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`seg-btn${stayType === t ? ' active' : ''}`}
                onClick={() => setStayType(t)}
                aria-pressed={stayType === t}
              >
                {t === 'Harvest Host' ? 'HH' : t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="submit-row">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Add stay'}
          </button>
        </div>
      </form>

      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        Full edit (confirmation #, gate code, etc.) available from the stay detail page.
      </p>
    </main>
  );
}
