import { NextRequest, NextResponse } from 'next/server';
import { computeReports } from '@/lib/reports';

export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get('year') ?? 'all';
    const data = await computeReports(year);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/reports]', err);
    return NextResponse.json({ error: 'Failed to compute reports' }, { status: 500 });
  }
}
