'use client';

import { useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import ExportButton from './ExportButton';
import { STAY_TYPE_COLORS } from '@/lib/report-types';
import type { StayTypeData } from '@/lib/report-types';

interface Props {
  data: StayTypeData;
  year: string;
}

export default function SleepingPattern({ data, year }: Props) {
  const pieRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  return (
    <div className="report-card">
      <h2 className="report-section-title">Where Do We Actually Sleep?</h2>
      <div className="two-chart-grid">

        {/* Pie — nights by type */}
        <div>
          <div className="chart-panel-header">
            <span className="chart-title">Nights by stay type</span>
            <ExportButton targetRef={pieRef} filename={`stays-sleep-pie-${year}`} />
          </div>
          <div ref={pieRef} className="chart-bg" style={{ padding: 8 }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.pie}
                  dataKey="nights"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(props) =>
                    `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine
                  isAnimationActive={false}
                >
                  {data.pie.map(entry => (
                    <Cell
                      key={entry.type}
                      fill={STAY_TYPE_COLORS[entry.type] ?? '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [`${v} nights`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar — avg cost/night by type */}
        <div>
          <div className="chart-panel-header">
            <span className="chart-title">Avg $/night by stay type</span>
            <ExportButton targetRef={barRef} filename={`stays-sleep-bar-${year}`} />
          </div>
          <div ref={barRef} className="chart-bg" style={{ padding: 8 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.avgCostByType} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `$${v}`}
                  tick={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Avg $/night']} />
                <Bar dataKey="avgCost" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {data.avgCostByType.map(entry => (
                    <Cell
                      key={entry.type}
                      fill={STAY_TYPE_COLORS[entry.type] ?? '#94a3b8'}
                    />
                  ))}
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
        </div>

      </div>
    </div>
  );
}
