'use client';

import { useRef } from 'react';
import ExportButton from './ExportButton';
import type { MembershipData } from '@/lib/report-types';

interface Props {
  data: MembershipData;
  year: string;
}

const fmt  = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD = (n: number) => `$${n.toFixed(2)}`;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function MembershipROI({ data, year }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { rows, avgPaidPerNight } = data;

  // Rows with a capital investment payback panel
  const capitalRows = rows.filter(r => r.acquisitionCost != null);

  return (
    <div className="report-card" ref={cardRef}>
      <div className="report-card-header">
        <h2 className="report-section-title">Membership ROI</h2>
        <ExportButton targetRef={cardRef} filename={`stays-membership-${year}`} />
      </div>

      <div className="stays-table-wrap">
        <table className="stays-table">
          <thead>
            <tr>
              <th>Membership</th>
              <th className="td-num" style={{ textAlign: 'right' }}>Annual Fee</th>
              <th className="td-num" style={{ textAlign: 'right' }}>Fee (period)</th>
              <th className="td-num" style={{ textAlign: 'right' }}>Nights Used</th>
              <th className="td-num" style={{ textAlign: 'right' }}>Effective $/Night</th>
              <th className="td-num" style={{ textAlign: 'right' }}>Est. Savings</th>
              <th style={{ textAlign: 'center' }}>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name} style={{ cursor: 'default' }}>
                <td className="td-name">{row.name}</td>
                <td className="td-num">{fmt(row.annualFee)}</td>
                <td className="td-num">
                  {fmt(row.proratedFee)}
                  {row.monthsCovered > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      ({row.monthsCovered} mo)
                    </span>
                  )}
                </td>
                <td className="td-num">{row.nightsUsed}</td>
                <td className="td-num">
                  {row.effectivePerNight != null ? fmtD(row.effectivePerNight) : '—'}
                </td>
                <td
                  className="td-num"
                  style={{ color: row.estSavings >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}
                >
                  {row.estSavings >= 0 ? '+' : ''}{fmt(row.estSavings)}
                </td>
                <td style={{ textAlign: 'center', fontSize: 16 }}>
                  {row.nightsUsed === 0
                    ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                    : row.worthIt
                      ? <span style={{ color: 'var(--green)' }}>✓</span>
                      : <span style={{ color: 'var(--red)' }}>✗</span>
                  }
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  No memberships found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Capital payback panels — one per membership with acquisition_cost */}
      {capitalRows.map(row => (
        <div
          key={`payback-${row.name}`}
          style={{
            marginTop: 20,
            padding: '16px 20px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 14 }}>
            {row.name} — Capital payback
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 32px' }}>
            <Stat
              value={fmt(row.acquisitionCost!)}
              label="Invested (purchase + transfer)"
            />
            <Stat
              value={row.cumulativeNetSavings != null ? fmt(Math.max(0, row.cumulativeNetSavings)) : '—'}
              label="Recovered (lifetime net savings)"
            />
            <Stat
              value={row.acquisitionRemaining != null
                ? row.acquisitionRemaining === 0 ? 'Paid off' : fmt(row.acquisitionRemaining)
                : '—'}
              label="Remaining to recover"
            />
            <Stat
              value={
                row.acquisitionRemaining === 0
                  ? 'Complete'
                  : row.projectedPaybackDate ?? (row.cumulativeNetSavings != null && row.cumulativeNetSavings <= 0
                    ? 'Net negative'
                    : '—')
              }
              label="Projected payback (YYYY-MM)"
            />
          </div>

          {/* Upcoming-stays projection — secondary, only when booked stays exist */}
          {row.projectedNightsUpcoming != null && row.projectedNightsUpcoming > 0 && (
            <div style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                If upcoming stays complete as planned
              </span>
              {' '}({row.projectedNightsUpcoming} booked nights):{' '}
              {row.projectedCumulativeIfBooked != null && (
                <>
                  {fmt(Math.max(0, row.projectedCumulativeIfBooked))} recovered
                  {' · '}
                  {row.projectedRemainingIfBooked === 0
                    ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                        paid off by {row.projectedPaybackDateIfBooked ?? '—'}
                      </span>
                    : <>{fmt(row.projectedRemainingIfBooked!)} remaining</>
                  }
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="report-footnote">
        Avg paid $/night used for Thousand Trails calculation:{' '}
        <strong>{fmtD(avgPaidPerNight)}</strong>.{' '}
        Unlimited-night memberships (Thousand Trails): savings = nights × avg paid rate − prorated dues.{' '}
        Discount memberships (KOA, Good Sam): savings = discount % of pre-discount spend − prorated dues.{' '}
        <em>Fee (period) is prorated to the selected filter window by calendar month; partial months count as whole.</em>
        {capitalRows.length > 0 && (
          <>
            {' '}Renewal verdict reflects the selected period.{' '}
            Payback figures are lifetime and ignore the year filter.
          </>
        )}
      </p>
    </div>
  );
}
