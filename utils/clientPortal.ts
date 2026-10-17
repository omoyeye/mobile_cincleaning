import { Linking, Platform } from 'react-native';
import type { Booking } from '../types';

/**
 * Client portal helpers shared with the website (frontend/src/prepChecklists.ts,
 * bookingNeedsPaymentProofBanner and downloadBookingIcs in CustomerPortal / bookingHelpers).
 */

const DEFAULT_PREP: string[] = [
  'Clear surfaces of fragile or valuable items where possible.',
  'Ensure we can access water and power if your service needs them.',
  'Secure pets in a safe area if they may be stressed by visitors.',
];

const DEEP_PREP: string[] = [
  'Declutter floors and surfaces so we can reach edges and corners.',
  'Note any areas needing extra care (grout, ovens, inside cupboards).',
  ...DEFAULT_PREP.slice(0, 2),
];

const TENANCY_PREP: string[] = [
  'Remove all personal belongings before the end-of-tenancy clean.',
  'Fridge/freezer: empty or tell us if you need inside appliances done.',
  'Carpets: mention stains so we can plan spot treatment.',
  ...DEFAULT_PREP.slice(0, 1),
];

const AIRBNB_PREP: string[] = [
  'Leave linens ready or note if linen change is included.',
  'Highlight any damage or maintenance issues for your checklist.',
  'Access codes / key safe: confirm details are up to date.',
];

const COMMERCIAL_PREP: string[] = [
  'Confirm after-hours access and alarm codes if applicable.',
  'Point out restricted zones or confidential areas.',
  ...DEFAULT_PREP.slice(0, 2),
];

/** "Before we arrive" tips for a service, matched by name like the website. */
export function prepChecklistFor(serviceType: string): string[] {
  const t = (serviceType || '').toLowerCase();
  if (t.includes('deep')) return DEEP_PREP;
  if (t.includes('tenancy') || t.includes('move')) return TENANCY_PREP;
  if (t.includes('airbnb') || t.includes('bnb')) return AIRBNB_PREP;
  if (t.includes('commercial') || t.includes('office')) return COMMERCIAL_PREP;
  if (t.includes('jet') || t.includes('wash')) {
    return ['Clear the area of vehicles and loose debris.', 'Ensure outdoor water access if required.', ...DEFAULT_PREP.slice(1)];
  }
  return DEFAULT_PREP;
}

/** Clients who agreed to the deposit or a short-notice fee still owe proof of payment until they upload it. */
export function paymentProofNeeded(b: Booking): { show: boolean; message: string } {
  const items = b.paymentFeeEvidence?.items ?? [];
  const needsDeposit = !!b.depositTermsAcceptedAt && !b.invoicePaid && !items.some((it) => it.kind === 'deposit');
  const needsFee = b.status === 'Cancelled' && !!b.shortNoticeCancelFeeConsentedAt && !items.some((it) => it.kind === 'cancellation_fee');
  if (needsDeposit && needsFee) return { show: true, message: 'Upload proof of your deposit and cancellation fee payments' };
  if (needsFee) return { show: true, message: 'Cancellation fee agreed: upload proof of payment' };
  if (needsDeposit && b.status !== 'Cancelled' && b.status !== 'Completed') {
    return { show: true, message: 'Paid your deposit by bank transfer? Upload the proof' };
  }
  return { show: false, message: '' };
}

const pad = (n: number) => String(n).padStart(2, '0');

function startEnd(b: Booking): { start: Date; end: Date } | null {
  const [y, m, d] = String(b.date || '').slice(0, 10).split('-').map(Number);
  const [hh, mm] = String(b.time || '09:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d, hh || 0, mm || 0);
  const hours = Number(b.propertyDetails?.duration) || 2;
  return { start, end: new Date(start.getTime() + hours * 3600000) };
}

/** Floating local time (no Z), so the event shows at the booked UK time. */
const icsStamp = (dt: Date) =>
  `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;

/**
 * Adds the booking to the client's calendar: an .ics download on the web (same as the website),
 * and a pre-filled Google Calendar event on phones.
 */
export async function addBookingToCalendar(b: Booking, companyName = 'CiN Cleaning'): Promise<void> {
  const times = startEnd(b);
  if (!times) throw new Error('This booking has no date yet.');
  const ref = String(b.bookingId ?? b.id);
  const title = `${companyName}: ${b.serviceType}`;
  const location = [b.address?.line1, b.address?.city, b.address?.postcode].filter(Boolean).join(', ');
  const details = `Booking ${ref}. Manage it in the ${companyName} app.`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CiN Cleaning//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ref.replace(/[^a-zA-Z0-9]/g, '')}@cleanitneatly`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(times.start)}`,
      `DTEND:${icsStamp(times.end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      location ? `LOCATION:${location}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${ref}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsStamp(times.start)}/${icsStamp(times.end)}`,
    details,
    location,
    ctz: 'Europe/London',
  });
  await Linking.openURL(`https://calendar.google.com/calendar/render?${q.toString()}`);
}

export type PaymentState = {
  choice: 'deposit' | 'full';
  total: number;
  depositAmount: number;
  amountPaid: number;
  balanceDue: number;
  stage: 'unpaid' | 'deposit_paid' | 'paid';
  payNowAmount: number;
  payNowLabel: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deposit or full, paid so far and the balance: same wording as the website (frontend/src/utils/bookingPayment.ts). */
export function paymentState(b: Booking, depositPercent: number): PaymentState {
  const total = round2(Number(b.totalPrice) || 0);
  const depositAmount = round2(Number(b.depositAmount) || (total * depositPercent) / 100);
  const choice = b.paymentChoice === 'full' ? 'full' : 'deposit';
  let stage: PaymentState['stage'];
  let amountPaid: number;
  if (b.paymentStage) {
    stage = b.paymentStage;
    amountPaid = round2(Number(b.amountPaid) || 0);
  } else if (b.paidInFullAt) {
    stage = 'paid';
    amountPaid = total;
  } else if (b.invoicePaid) {
    stage = 'deposit_paid';
    amountPaid = depositAmount;
  } else {
    stage = 'unpaid';
    amountPaid = 0;
  }
  const balanceDue = b.paymentStage && b.balanceDue != null ? round2(Number(b.balanceDue)) : round2(Math.max(0, total - amountPaid));
  if (stage === 'deposit_paid' && balanceDue < 0.01) stage = 'paid';
  const money = (n: number) => `£${n.toFixed(2)}`;
  let payNowAmount = 0;
  let payNowLabel = '';
  if (stage === 'unpaid') {
    payNowAmount = choice === 'full' ? total : depositAmount;
    payNowLabel = choice === 'full' ? `Pay in full ${money(total)}` : `Pay deposit ${money(depositAmount)}`;
  } else if (stage === 'deposit_paid') {
    payNowAmount = balanceDue;
    payNowLabel = `Pay balance ${money(balanceDue)}`;
  }
  return { choice, total, depositAmount, amountPaid, balanceDue, stage, payNowAmount, payNowLabel };
}
