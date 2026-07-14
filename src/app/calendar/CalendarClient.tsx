'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { Stay } from '@/lib/types';
import { STAY_TYPE_COLORS } from '@/lib/report-types';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

interface CalEvent {
  id:       number;
  title:    string;
  start:    Date;
  end:      Date;
  allDay:   true;
  resource: Stay;
}

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function stayToEvent(stay: Stay): CalEvent {
  const start = toDate(stay.arrival);
  const end   = new Date(start);
  end.setDate(end.getDate() + stay.nights);
  return { id: stay.id, title: stay.name, start, end, allDay: true, resource: stay };
}

export default function CalendarClient({ stays }: { stays: Stay[] }) {
  const router = useRouter();
  const events = useMemo(() => stays.map(stayToEvent), [stays]);

  return (
    <main className="page page-wide">
      <h1 className="page-title">Calendar</h1>
      <div style={{ height: 'min(700px, calc(100dvh - 160px))' }}>
        <Calendar<CalEvent>
          localizer={localizer}
          events={events}
          defaultView={Views.MONTH}
          views={[Views.MONTH, Views.AGENDA]}
          defaultDate={new Date()}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: STAY_TYPE_COLORS[event.resource.stay_type] ?? '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              fontSize: 12,
              cursor: 'pointer',
            },
          })}
          onSelectEvent={(event) => router.push(`/stays/${event.id}`)}
        />
      </div>
    </main>
  );
}
