'use client';

import { useRef } from 'react';
import Link from 'next/link';
import ExportButton from './ExportButton';
import type { BigPictureData } from '@/lib/report-types';

const fmt   = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD  = (n: number) => `$${n.toFixed(2)}`;
const fmtDN = (n: number) => `${fmtD(n)}/nt`;

interface Props {
  data: BigPictureData;
  year: string;
}

interface Card {
  label:      string;
  value:      string;
  sub:        string | null;
  link:       string | null;
  valueColor: string | undefined;
}

export default function BigPicture({ data, year }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const slug    = `stays-big-picture-${year}`;

  const cards: Card[] = [
    {
      label:      'Total nights',
      value:      data.totalNights.toLocaleString(),
      sub:        null,
      link:       null,
      valueColor: undefined,
    },
    {
      label:      'Total spend',
      value:      fmt(data.totalSpend),
      sub:        null,
      link:       null,
      valueColor: undefined,
    },
    {
      label:      'Avg $/night — paid stays',
      value:      fmtD(data.avgCostPaidOnly),
      sub:        'excludes $0 nights',
      link:       null,
      valueColor: undefined,
    },
    {
      label:      'Avg $/night — all stays',
      value:      fmtD(data.avgCostAllStays),
      sub:        'incl. free nights',
      link:       null,
      valueColor: undefined,
    },
    {
      label:      'Free nights',
      value:      `${data.freeNightsPercent.toFixed(1)}%`,
      sub:        null,
      link:       null,
      valueColor: undefined,
    },
    {
      label:      'Most expensive stay',
      value:      data.mostExpensiveStay ? fmt(data.mostExpensiveStay.totalCharged) : '—',
      sub:        data.mostExpensiveStay?.name ?? null,
      link:       data.mostExpensiveStay ? `/stays/${data.mostExpensiveStay.id}` : null,
      valueColor: undefined,
    },
    {
      label:      'Most expensive (per night)',
      value:      data.mostExpensivePerNight ? fmtDN(data.mostExpensivePerNight.perNight) : '—',
      sub:        data.mostExpensivePerNight?.name ?? null,
      link:       data.mostExpensivePerNight ? `/stays/${data.mostExpensivePerNight.id}` : null,
      valueColor: undefined,
    },
    {
      label:      'Best deal (per night)',
      value:      data.cheapestPaidPerNight ? fmtDN(data.cheapestPaidPerNight.perNight) : '—',
      sub:        data.cheapestPaidPerNight?.name ?? null,
      link:       data.cheapestPaidPerNight ? `/stays/${data.cheapestPaidPerNight.id}` : null,
      valueColor: 'var(--green)',
    },
    {
      label:      'Outstanding balance',
      value:      fmt(data.outstandingBalance),
      sub:        'live · upcoming stays only',
      link:       null,
      valueColor: data.outstandingBalance > 0 ? 'var(--amber)' : undefined,
    },
  ];

  return (
    <div className="report-card" ref={cardRef}>
      <div className="report-card-header">
        <h2 className="report-section-title">Big Picture</h2>
        <ExportButton targetRef={cardRef} filename={slug} />
      </div>
      <div className="stat-cards-grid">
        {cards.map(card => (
          <div className="stat-card" key={card.label}>
            <div
              className="stat-number"
              style={card.valueColor ? { color: card.valueColor } : undefined}
            >
              {card.link
                ? <Link href={card.link} className="stat-link">{card.value}</Link>
                : card.value
              }
            </div>
            <div className="stat-label">{card.label}</div>
            {card.sub && (
              <div className="stat-label" style={{ marginTop: 2 }}>{card.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
