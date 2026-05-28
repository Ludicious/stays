'use client';

import { useRef } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import ExportButton from './ExportButton';
import { YEAR_COLORS } from '@/lib/report-types';
import type { TrendsData } from '@/lib/report-types';

interface Props {
  data: TrendsData;
  year: string;
}

export default function Trends({ data, year }: Props) {
  const yearBarRef    = useRef<HTMLDivElement>(null);
  const monthLineRef  = useRef<HTMLDivElement>(null);
  const monthBarRef   = useRef<HTMLDivElement>(null);

  const tickStyle = { fontSize: 12, fontFamily: 'DM Sans, sans-serif' };

  /* ── Specific year — single monthly bar ─────────────────────── */
  if (year !== 'all') {
    const hasData = data.monthlyForYear.some(m => m.spend > 0);
    return (
      <div className="report-card">
        <h2 className="report-section-title">Trends — {year}</h2>
        <div className="chart-panel-header">
          <span className="chart-title">Monthly spend</span>
          <ExportButton targetRef={monthBarRef} filename={`stays-trends-monthly-${year}`} />
        </div>
        <div ref={monthBarRef} className="chart-bg" style={{ padding: 8 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthlyForYear} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => `$${v}`}
                  tick={{ ...tickStyle, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spend']} />
                <Bar dataKey="spend" fill={YEAR_COLORS[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 32 }}>No stays recorded for {year}</div>
          )}
        </div>
      </div>
    );
  }

  /* ── All time — two charts ───────────────────────────────────── */
  return (
    <div className="report-card">
      <h2 className="report-section-title">Trends Over Time</h2>

      {/* Year-over-year bar */}
      <div style={{ marginBottom: 32 }}>
        <div className="chart-panel-header">
          <span className="chart-title">Annual spend by year</span>
          <ExportButton targetRef={yearBarRef} filename={`stays-trends-years-${year}`} />
        </div>
        <div ref={yearBarRef} className="chart-bg" style={{ padding: 8 }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.yearTotals} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `$${v}`}
                tick={{ ...tickStyle, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spend']} />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.yearTotals.map((entry, i) => (
                  <Cell key={entry.year} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly by year line chart */}
      <div>
        <div className="chart-panel-header">
          <span className="chart-title">Monthly spend by year</span>
          <ExportButton targetRef={monthLineRef} filename={`stays-trends-monthly-all`} />
        </div>
        <div ref={monthLineRef} className="chart-bg" style={{ padding: 8 }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthlyByYear} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `$${v}`}
                tick={{ ...tickStyle, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip formatter={(v, name) => [`$${Number(v).toLocaleString()}`, String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif' }} />
              {data.years.map((yr, i) => (
                <Line
                  key={yr}
                  type="monotone"
                  dataKey={yr}
                  stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
