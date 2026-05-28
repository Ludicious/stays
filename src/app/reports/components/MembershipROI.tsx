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

export default function MembershipROI({ data, year }: Props) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const { rows, avgPaidPerNight, yearsCount } = data;
  const periodLabel = yearsCount === 1 ? '1 year' : `${yearsCount} years`;

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
              <th className="td-num" style={{ textAlign: 'right' }}>Fee ({periodLabel})</th>
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
                <td className="td-num">{fmt(row.effectiveAnnualFee)}</td>
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

      <p className="report-footnote">
        Avg paid $/night used for Thousand Trails calculation:{' '}
        <strong>{fmtD(avgPaidPerNight)}</strong>.{' '}
        Unlimited-night memberships (Thousand Trails): savings = nights × avg paid rate − total fees.{' '}
        Discount memberships (KOA, Good Sam): savings = 10% of pre-discount spend − total fees.
        Fees multiplied by {periodLabel} of data.
        <br />
        <em>Spend reflects post-discount amounts. Discount savings are reverse-calculated from the pre-discount equivalent.</em>
      </p>
    </div>
  );
}
