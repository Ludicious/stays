import { computeReports } from '@/lib/reports';
import YearFilter    from './components/YearFilter';
import BigPicture    from './components/BigPicture';
import SleepingPattern from './components/SleepingPattern';
import Trends        from './components/Trends';
import Geography     from './components/Geography';
import MembershipROI from './components/MembershipROI';
import StayLength    from './components/StayLength';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ year?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ?? 'all';
  const data = await computeReports(year);

  return (
    <div className="page-wide">
      <div className="reports-header">
        <h1 className="page-title" style={{ margin: 0 }}>Reports</h1>
        <YearFilter year={year} years={data.trends.years} />
      </div>

      <BigPicture     data={data.bigPicture}    year={year} />
      <SleepingPattern data={data.stayTypes}    year={year} />
      <Trends          data={data.trends}        year={year} />
      <Geography       data={data.geography} />
      <MembershipROI   data={data.memberships}   year={year} />
      <StayLength      data={data.lengthBuckets} year={year} />
    </div>
  );
}
