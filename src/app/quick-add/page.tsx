'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PlacesAutocomplete, { type PlaceSelection } from '@/components/PlacesAutocomplete';
import type { StayType, Membership } from '@/lib/types';

const NEW_STAY_TYPES: StayType[] = ['Paid', 'Free', 'Membership', 'Storage'];

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

// Membership scoping — same rule as StayDetailClient, driven by savings_method
function filterMemberships(memberships: Membership[], stayType: StayType): Membership[] {
  if (stayType === 'Membership') {
    return memberships.filter(m => m.savings_method === 'free_vs_avg' || m.savings_method === 'per_stay_value');
  }
  if (stayType === 'Paid') {
    return memberships.filter(m => m.savings_method === 'percent_off');
  }
  return [];
}

export default function QuickAddPage() {
  const router = useRouter();

  const [campgroundName, setCampgroundName] = useState('');
  const [arrival,        setArrival]        = useState(todayStr());
  const [nights,         setNights]         = useState(1);
  const [nightsInput,    setNightsInput]    = useState('1');
  const [stayType,       setStayType]       = useState<StayType>('Paid');
  const [placeData,      setPlaceData]      = useState<PlaceSelection | null>(null);
  const [membershipId,   setMembershipId]   = useState<number | null>(null);
  const [memberships,    setMemberships]    = useState<Membership[]>([]);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/memberships?active=true')
      .then(r => r.json())
      .then((data: Membership[]) => setMemberships(data))
      .catch(() => {/* non-critical */});
  }, []);

  // Clear membership_id when stay type changes to incompatible scope
  const handleStayTypeChange = (t: StayType) => {
    setStayType(t);
    if (t === 'Free' || t === 'Storage') {
      setMembershipId(null);
    } else if (membershipId != null) {
      // Clear if current selection is out of scope for the new type
      const curMem = memberships.find(m => m.id === membershipId);
      if (curMem) {
        const isFreeBased = curMem.savings_method === 'free_vs_avg' || curMem.savings_method === 'per_stay_value';
        if (t === 'Paid' && isFreeBased) setMembershipId(null);
        if (t === 'Membership' && !isFreeBased) setMembershipId(null);
      }
    }
  };

  const handlePlaceSelect = (place: PlaceSelection) => {
    setCampgroundName(place.name);
    setPlaceData(place);
  };

  const handleNameChange = (val: string) => {
    setCampgroundName(val);
    if (placeData && val !== placeData.name) setPlaceData(null);
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
    if (stayType === 'Membership' && !membershipId) {
      setError('A membership program is required for Membership stays.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const body = {
      name:          campgroundName.trim(),
      arrival,
      departure:     addDays(arrival, Math.max(nights, 1)),
      stay_type:     stayType,
      status:        'Booked',
      membership_id: membershipId ?? null,
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

  const scopedMemberships = filterMemberships(memberships, stayType);
  const showMembershipField = stayType === 'Membership' || stayType === 'Paid';

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
              value={nightsInput}
              min={1}
              max={365}
              onChange={e => {
                const raw = e.target.value;
                setNightsInput(raw);
                const parsed = parseInt(raw, 10);
                if (!isNaN(parsed)) setNights(parsed);
              }}
              onBlur={() => {
                const clamped = Math.min(365, Math.max(1, parseInt(nightsInput, 10) || 1));
                setNights(clamped);
                setNightsInput(String(clamped));
              }}
              required
            />
          </div>
        </div>

        {/* Stay type */}
        <div className="form-group">
          <p className="form-label">Stay type</p>
          <div className="seg-control" role="group" aria-label="Stay type">
            {NEW_STAY_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`seg-btn${stayType === t ? ' active' : ''}`}
                onClick={() => handleStayTypeChange(t)}
                aria-pressed={stayType === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Membership — scoped by stay type via savings_method */}
        {showMembershipField && (
          <div className="form-group">
            <label className="form-label" htmlFor="membership">
              Membership program{stayType === 'Membership' ? ' *' : ''}
            </label>
            <select
              id="membership"
              className="form-input"
              value={membershipId ?? ''}
              onChange={e => setMembershipId(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">— {stayType === 'Membership' ? 'Select one' : 'None'} —</option>
              {scopedMemberships.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

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
        Full edit (confirmation #, gate code, hookup type, etc.) available from the stay detail page.
      </p>
    </main>
  );
}
