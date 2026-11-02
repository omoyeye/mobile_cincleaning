import type { Booking } from '../types';

export type LiveState = 'on_the_way' | 'cleaning' | null;

/**
 * A clean is live from the moment the cleaner sets off until they finish. Only counts on the day
 * of the clean, so a job that was never closed off does not stay lit up.
 */
export function liveState(b: Pick<Booking, 'status' | 'date' | 'time' | 'enRouteAt' | 'arrivedAt'>): LiveState {
  if (b.status === 'Completed' || b.status === 'Cancelled') return null;
  const [y, m, d] = String(b.date || '').slice(0, 10).split('-').map(Number);
  const [hh, mm] = String(b.time || '00:00').split(':').map(Number);
  if (y && m && d) {
    const start = new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
    if (Math.abs(Date.now() - start) > 18 * 3600000) return null;
  }
  if (b.arrivedAt || b.status === 'In Progress') return 'cleaning';
  if (b.enRouteAt) return 'on_the_way';
  return null;
}

export const LIVE_LABEL: Record<Exclude<LiveState, null>, string> = {
  on_the_way: 'On the way',
  cleaning: 'Cleaning now',
};
