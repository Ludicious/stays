'use client';

import { useRouter } from 'next/navigation';

interface Props {
  year:  string;
  years: string[];
}

export default function YearFilter({ year, years }: Props) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'all') {
      router.push('/reports');
    } else {
      router.push(`/reports?year=${val}`);
    }
  };

  return (
    <select
      className="year-filter-select"
      value={year}
      onChange={handleChange}
      aria-label="Filter by year"
    >
      <option value="all">All time</option>
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
