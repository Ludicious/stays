'use client';

import { useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ExportButton from './ExportButton';
import type { FuelData } from '@/lib/report-types';

interface Props {
  data: FuelData;
  year: string;
}

const fmtD = (n: number) => `$${n.toFixed(2)}`;

export default function FuelReport({ data, year }: Props) {
  const cardRef   = useRef<HTMLDivElement>(null);
  const tickStyle = { fontSize: 12, fontFamily: 'DM Sans, sans-serif' };

  const avgPerGallon      = data.totalGallons > 0 ? data.totalSpend / data.totalGallons : null;
  const hasMonthlyData    = data.byMonth.some(m => m.spend > 0);
  const maxFuelTypeSpend  = data.byFuelType.length > 0
    ? Math.max(...data.byFuelType.map(r => r.spend))
    : 0;

  return (
    <div className="report-card" ref={cardRef}>
      <div className="report-card-header">
        <h2 className="report-section-title">Fuel</h2>
        <ExportButton targetRef={cardRef} filename={`stays-fuel-${year}`} />
      </div>

      {/* Headline stats */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <div className="stat-number">
            {`$${Math.round(data.totalSpend).toLocaleString()}`}
          </div>
          <div className="stat-label">Total fuel spend</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{data.totalGallons.toFixed(1)}</div>
          <div className="stat-label">Total gallons</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {data.allInCostPerNight != null ? fmtD(data.allInCostPerNight) : '—'}
          </div>
          <div className="stat-label">All-in $/night</div>
          {data.allInCostPerNight != null && (
            <div className="stat-label" style={{ marginTop: 2 }}>fuel + lodging</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-number">{avgPerGallon != null ? fmtD(avgPerGallon) : '—'}</div>
          <div className="stat-label">Avg $/gallon</div>
        </div>
      </div>

      {/* Efficiency */}
      {data.efficiency.hasEnoughData ? (
        <div style={{
          display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'baseline',
          marginBottom: 24, padding: '12px 16px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <span>
            <strong style={{ fontSize: 20, color: 'var(--text)' }}>
              {data.efficiency.avgMpg!.toFixed(1)}
            </strong>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>MPG</span>
          </span>
          <span>
            <strong style={{ fontSize: 20, color: 'var(--text)' }}>
              {fmtD(data.efficiency.avgCostPerMile!)}
            </strong>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>/mile</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {data.efficiency.segmentCount} tracked segment{data.efficiency.segmentCount !== 1 ? 's' : ''}
            {' · '}
            {data.efficiency.totalMilesTracked.toLocaleString()} miles
          </span>
        </div>
      ) : (
        <p style={{
          fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px',
          padding: '10px 14px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          Fuel efficiency not yet available — needs at least two full, odometer-logged Diesel fill-ups.
        </p>
      )}

      {/* By fuel type */}
      {data.byFuelType.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="chart-title" style={{ marginBottom: 10 }}>By fuel type</div>
          {data.byFuelType.map(row => {
            const pct = maxFuelTypeSpend > 0 ? (row.spend / maxFuelTypeSpend) * 100 : 0;
            return (
              <div key={row.fuelType} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{
                  width: 72, fontSize: 12, color: 'var(--text-muted)',
                  textAlign: 'right', flexShrink: 0,
                }}>
                  {row.fuelType}
                </span>
                <div style={{
                  flex: 1, background: 'rgba(0,0,0,0.07)',
                  borderRadius: 4, height: 18, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: '#C9A84C', borderRadius: 4,
                    minWidth: row.spend > 0 ? 3 : 0,
                  }} />
                </div>
                <span style={{ width: 130, fontSize: 12, color: 'var(--text)', flexShrink: 0 }}>
                  {`$${Math.round(row.spend).toLocaleString()}`}
                  {row.gallons > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' · '}{row.gallons.toFixed(1)} gal
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* By state */}
      {data.byState.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="chart-title" style={{ marginBottom: 10 }}>By state</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {(['State', 'Spend', 'Gallons', 'Fills'] as const).map(h => (
                    <th key={h} style={{
                      textAlign: h === 'State' ? 'left' : 'right',
                      padding: '4px 8px', fontWeight: 600,
                      color: 'var(--text-muted)', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byState.map((row, i) => (
                  <tr key={row.stateCode} style={{
                    borderBottom: i < data.byState.length - 1 ? '1px solid var(--border)' : undefined,
                  }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 600 }}>
                      {row.stateCode}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text)', textAlign: 'right' }}>
                      {`$${Math.round(row.spend).toLocaleString()}`}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {row.gallons.toFixed(1)}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {row.fillCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly spend chart */}
      {hasMonthlyData && (
        <div style={{ marginBottom: data.savings.totalDiscountSettled > 0 || data.savings.unsettledCount > 0 ? 20 : 0 }}>
          <div className="chart-panel-header">
            <span className="chart-title">Monthly spend</span>
          </div>
          <div className="chart-bg" style={{ padding: 8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.byMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => `$${v}`}
                  tick={{ ...tickStyle, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spend']} />
                <Bar dataKey="spend" fill="#C9A84C" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Savings / provisional notice */}
      {data.savings.totalDiscountSettled > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>
            ${data.savings.totalDiscountSettled.toFixed(2)}
          </span>
          {' saved via fuel discount program'}
          {data.savings.unsettledCount > 0 && (
            <span style={{ color: 'var(--amber)' }}>
              {' '}({data.savings.unsettledCount} fill-up{data.savings.unsettledCount !== 1 ? 's' : ''} still awaiting settlement)
            </span>
          )}
        </p>
      )}
      {data.savings.totalDiscountSettled === 0 && data.savings.unsettledCount > 0 && (
        <p style={{ fontSize: 13, color: 'var(--amber)', margin: '0 0 4px' }}>
          {data.savings.unsettledCount} fill-up{data.savings.unsettledCount !== 1 ? 's' : ''} awaiting settlement — spend totals may be provisional.
        </p>
      )}
    </div>
  );
}
