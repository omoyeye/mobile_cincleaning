import type { Booking, Notification } from '../types';

/**
 * Where a tapped alert should go. Messages name bookings by reference (e.g. CIN-AB12), so match
 * that against the user's bookings. Cleaners land on the job screen, clients on the booking.
 */
export function alertTarget(notification: Notification, bookings: Booking[], role?: string): string | null {
  const staff = role === 'staff';
  const msg = notification.message || '';
  const ref = msg.match(/\bCIN-[A-Z0-9-]+\b/i)?.[0]?.toUpperCase();
  const byRef = ref ? bookings.find((b) => String(b.bookingId || '').toUpperCase() === ref) : undefined;
  const numeric = msg.match(/booking\s*#?(\d+)/i)?.[1];
  const id = byRef?.id ?? (numeric ? Number(numeric) : undefined);
  const lower = `${notification.type} ${msg}`.toLowerCase();

  if (notification.type === 'chat_message' || lower.startsWith('chat ') || lower.includes('message from')) {
    return id ? `/chat/${id}` : '/messages';
  }
  if (notification.type === 'invoice' || notification.type === 'payment' || lower.includes('invoice')) {
    if (staff) return '/(staff)/earnings';
    return id && !lower.includes('invoice') ? `/booking/${id}` : '/invoices';
  }
  if (id) return staff ? `/job/${id}` : `/booking/${id}`;
  if (notification.type.startsWith('booking')) return staff ? '/(staff)' : '/(customer)/bookings';
  return null;
}
