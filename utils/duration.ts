/** Hours as "1h 30min", "45min" or "2h" for display. */
export function formatHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours)) return '-';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}
