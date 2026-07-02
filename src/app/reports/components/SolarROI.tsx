'use client';

import { useRef } from 'react';
import type { SolarData } from '@/lib/report-types';
import { solarSystemTotal } from '@/lib/solar';
import ExportButton from './ExportButton';

interface Props {
  data: SolarData;
  year: string;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function SolarROI({ data, year }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    buckets, pctDryRecorded, lifetimeDryNights,
    avgPaidPerNight, staysWithHookup, totalStaysSolar,
  } = data;

  const systemCost    = solarSystemTotal();
  const offsetRate    = avgPaidPerNight || 50;
  const offsetDollars = Math.round(lifetimeDryNights * offsetRate);
  const paybackPct    = systemCost > 0 ? (offsetDollars / systemCost) * 100 : 0;
  const yearLabel     = year === 'all' ? '' : ` in ${year}`;

  const totalBarNights =
    buckets.fullNights + buckets.electricNights + buckets.dryNights + buckets.nullNights;

  const bars = [
    { label: 'Full hookup',    nights: buckets.fullNights,     color: '#475569', hero: false, muted: false },
    { label: 'Electric',       nights: buckets.electricNights, color: '#64748b', hero: false, muted: false },
    { label: 'Dry (off-grid)', nights: buckets.dryNights,      color: '#C9A84C', hero: true,  muted: false },
    { label: 'Not recorded',   nights: buckets.nullNights,     color: '#94a3b8', hero: false, muted: true  },
  ];

  return (
    <div className="report-card" ref={cardRef}>
      <div className="report-card-header">
        <h2 className="report-section-title">Solar ROI</h2>
        <ExportButton targetRef={cardRef} filename={`stays-solar-${year}`} />
      </div>

      {/* Headline stats — year-filtered left pair, lifetime right pair */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 32px', marginBottom: 28 }}>
        <Stat value={buckets.dryNights.toLocaleString()} label={`Dry nights${yearLabel}`} />
        <Stat
          value={`${pctDryRecorded.toFixed(1)}%`}
          label={`of recorded nights${yearLabel}`}
        />
        <Stat
          value={`$${offsetDollars.toLocaleString()}`}
          label="Est. cost offset (lifetime)"
        />
        <Stat
          value={`${paybackPct.toFixed(0)}%`}
          label={`toward $${systemCost.toLocaleString()} system`}
        />
      </div>

      {/* Horizontal bar chart */}
      <div style={{ marginBottom: 12 }}>
        {bars.map(({ label, nights, color, hero, muted }) => {
          const pct = totalBarNights > 0 ? (nights / totalBarNights) * 100 : 0;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{
                width: 112,
                fontSize: 12,
                color: hero ? 'var(--text)' : 'var(--text-muted)',
                textAlign: 'right',
                flexShrink: 0,
                fontWeight: hero ? 600 : 400,
              }}>
                {label}
              </span>
              <div style={{
                flex: 1,
                background: 'rgba(0,0,0,0.07)',
                borderRadius: 4,
                height: hero ? 26 : 18,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 4,
                  minWidth: nights > 0 ? 3 : 0,
                }} />
              </div>
              <span style={{
                width: 76,
                fontSize: 12,
                color: muted ? 'var(--text-muted)' : 'var(--text)',
                fontWeight: hero ? 700 : 400,
                flexShrink: 0,
              }}>
                {nights.toLocaleString()} nights
              </span>
            </div>
          );
        })}
      </div>

      {/* Coverage note */}
      {totalStaysSolar > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0' }}>
          {staysWithHookup} of {totalStaysSolar} stays have hookup recorded{yearLabel}
          {buckets.nullNights > 0 && (
            <>
              {' · '}
              <a href="/stays?hookup=none" style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                View unrecorded
              </a>
            </>
          )}
        </p>
      )}

      <p className="report-footnote">
        Offset estimated at ${offsetRate.toFixed(2)}/night
        {avgPaidPerNight === 0
          ? ' (fallback — no paid stays in selected period)'
          : ' (avg paid rate for selected period)'}.{' '}
        Lifetime dry nights counted from system install date onward.
        Storage (N/A hookup) stays excluded from all hookup data.
      </p>
    </div>
  );
}
