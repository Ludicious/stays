import type mysql from 'mysql2/promise';

// Flips stale Booked/Deposit Paid/Paid in Full stays to 'Stayed' once their
// departure date has passed. Run opportunistically on any route that reads stays
// so the status field stays truthful without a cron job.
// Never touches Cancelled rows — cancellation is a manual, intentional status.
export async function sweepStaleStatuses(pool: mysql.Pool): Promise<void> {
  try {
    await pool.query(
      `UPDATE stays
         SET status = 'Stayed'
       WHERE status IN ('Booked', 'Deposit Paid', 'Paid in Full')
         AND departure < CURRENT_DATE()`
    );
  } catch (err) {
    console.error('[sweepStaleStatuses]', err);
    // Non-fatal — never blocks the calling route from rendering
  }
}
