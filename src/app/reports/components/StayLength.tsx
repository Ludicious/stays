'use client';

import { useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from 'recharts';
import ExportButton from './ExportButton';
import type { LengthBucket } from '@/lib/report-types';

interface Props {
  data: LengthBucket[];
  year: string;
}

export default function StayLength({ data, year }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter out buckets with no stays for cleaner rendering
  const chartData = data
    .filter(b => b.count > 0 && b.avgCostPerNight != null)
    .map(b => ({ bucket: b.bucket, avgCost: b.avgCostPerNight!, count: b.count }));

  const tickStyle = { fontSize: 12, fontFamily: 'DM Sans, sans-serif' };

  return (
    <div className="report-card" ref={cardRef}>
      <div className="report-card-header">
        <h2 className="report-section-title">Does Staying Longer Save Money?</h2>
        <ExportButton targetRef={cardRef} filename={`stays-length-${year}`} />
      </div>

      {chartData.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          No paid stays to analyze for this period.
        </div>
      ) : (
        <div className="chart-bg" style={{ padding: 8 }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `$${v}`}
                tick={{ ...tickStyle, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(v, _name, props) => [
                  `$${Number(v).toFixed(2)}/night (${(props as { payload?: { count?: number } }).payload?.count ?? 0} stays)`,
                  'Avg $/night',
                ]}
              />
              <Bar dataKey="avgCost" fill="#C9A84C" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="avgCost"
                  position="top"
                  formatter={(v) => `$${Number(v).toFixed(0)}`}
                  style={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif', fill: '#3D4F5E' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="report-footnote">
        Boondocking, free, and Harvest Host stays excluded. Only paid campground stays included — this chart
        shows whether longer paid stays unlock better nightly rates.
        <br />
        Short transit stays and medium-length destination stays cost about the same; only stays of a week
        or more meaningfully lower the nightly rate.
      </p>
    </div>
  );
}
