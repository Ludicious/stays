'use client';

import { useRef } from 'react';
import Link from 'next/link';
import ExportButton from './ExportButton';
import type { BigPictureData } from '@/lib/report-types';

const fmt  = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD = (n: number) => `$${n.toFixed(2)}`;

interface Props {
  data: BigPictureData;
  year: string;
}

export default function BigPicture({ data, year }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const slug    = `stays-big-picture-${year}`;

  const cards = [
    {
      label:   'Total nights',
      value:   data.totalNights.toLocaleString(),
      sub:     null,
      link:    null,
    },
    {
      label:   'Total spend',
      value:   fmt(data.totalSpend),
      sub:     null,
      link:    null,
    },
    {
      label:   'Avg $/night — paid stays',
      value:   fmtD(data.avgCostPaidOnly),
      sub:     'excludes $0 nights',
      link:    null,
    },
    {
      label:   'Avg $/night — all stays',
      value:   fmtD(data.avgCostAllStays),
      sub:     'incl. free nights',
      link:    null,
    },
    {
      label:   'Free nights',
      value:   `${data.freeNightsPercent.toFixed(1)}%`,
      sub:     null,
      link:    null,
    },
    {
      label:   'Most expensive stay',
      value:   data.mostExpensiveStay ? fmt(data.mostExpensiveStay.totalCharged) : '—',
      sub:     data.mostExpensiveStay?.name ?? null,
      link:    data.mostExpensiveStay ? `/stays/${data.mostExpensiveStay.id}` : null,
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
            <div className="stat-number">
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
