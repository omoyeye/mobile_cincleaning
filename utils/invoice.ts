import type { Booking, Extra, ServiceConfig } from '../types';
import { paymentState, type PaymentState } from './clientPortal';
import { formatHoursMinutes } from './duration';

/**
 * The client invoice, built with the same rules as the website's InvoiceView
 * (frontend/components/InvoiceView.tsx and frontend/src/utils/bookingHelpers.ts),
 * so the app and the website always show the same lines and totals.
 */

const DEEP_EOT_CALL_OUT_GBP = 30;

const roundHours = (n: number) => Math.round(n * 100) / 100;

/** Human-readable hours, e.g. 12, 11.5, 0.5 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '-';
  const r = roundHours(hours);
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
}

type Trigger = 'standard' | 'deep' | 'end_of_tenancy' | 'airbnb' | 'commercial' | 'jet_washing' | 'custom';

function serviceTrigger(svc: ServiceConfig | null | undefined, name?: string): Trigger {
  const explicit = svc?.bookingFlow?.trigger;
  if (explicit) return explicit as Trigger;
  const sId = String(svc?.id ?? '').toLowerCase();
  const sName = String(svc?.name ?? name ?? '').toLowerCase();
  if (sId === 'airbnb' || sName.includes('airbnb')) return 'airbnb';
  if (sId === 'commercial' || sName.includes('commercial')) return 'commercial';
  if (sId === 'jet_washing' || sName.includes('jet')) return 'jet_washing';
  if (sId === 'end_of_tenancy' || sName.includes('end of tenancy')) return 'end_of_tenancy';
  if (sId === 'deep' || (sName.includes('deep') && !sName.includes('airbnb'))) return 'deep';
  return 'standard';
}

/** Consistent label for known extras (same as the website). */
export function extraLabel(name: string): string {
  const raw = String(name || '').trim();
  const lower = raw.toLowerCase();
  const cloakroom =
    (lower.includes('cloakroom') || /cloak\s*room/.test(lower) || lower.includes('clockroom') || /clock\s*room/.test(lower)) &&
    (lower.includes('toilet') || /\bwc\b/.test(lower));
  return cloakroom ? 'Cloakroom Toilet (£15/30min each)' : raw;
}

function extraMinutes(ex: Extra): number {
  const n = String(ex?.name ?? '').toLowerCase();
  if (n.includes('bedroom') || n.includes('bathroom')) return 60;
  if (n.includes('cloakroom') || /cloak\s*room/.test(n) || n.includes('clockroom') || n.includes('clock room') || n.includes('toilet') || /\bwc\b/.test(n)) return 30;
  if (n.includes('reception') || n.includes('kitchen') || n.includes('carpet')) return 60;
  if (n.includes('utility')) return 30;
  if (ex.duration != null && Number.isFinite(ex.duration) && ex.duration >= 0) return ex.duration;
  return 30;
}

function isHourlyStyle(svc: ServiceConfig, serviceType?: string): boolean {
  const sId = String(svc.id);
  const sName = (svc.name || '').toLowerCase();
  const hint = String(serviceType || '').toLowerCase();
  return ['general', 'airbnb', 'commercial', 'hourly'].some((t) => sId === t || sName.includes(t) || hint.includes(t));
}

function bookedDuration(b: Booking): number {
  return Number((b as any).duration ?? b.propertyDetails?.duration);
}

export type TimeLine = { extraId: string; label: string; quantity: number; hoursPerUnit: number; lineHours: number };
export type TimeBreakdown = { model: 'hourly' | 'itemized'; baseLabel: string; baseHours: number; lines: TimeLine[]; totalHours: number };

export function timeBreakdown(b: Booking, svc: ServiceConfig | null | undefined, extras: Extra[]): TimeBreakdown {
  if (!svc) {
    const t = Number.isFinite(bookedDuration(b)) && bookedDuration(b) > 0 ? roundHours(bookedDuration(b)) : 2;
    return { model: 'hourly', baseLabel: 'Booked duration', baseHours: t, lines: [], totalHours: t };
  }
  if (isHourlyStyle(svc, b.serviceType)) {
    const d = bookedDuration(b);
    const hours = roundHours(Number.isFinite(d) && d > 0 ? d : Number(svc.minDuration) > 0 ? Number(svc.minDuration) : 2);
    return { model: 'hourly', baseLabel: 'Scheduled clean time', baseHours: hours, lines: [], totalHours: hours };
  }
  const baseHours = roundHours(Number(svc.minDuration) > 0 ? Number(svc.minDuration) : 1);
  const lines: TimeLine[] = (b.extras ?? []).map((item) => {
    const ex = extras.find((e) => String(e.id) === String(item.id));
    if (!ex) return { extraId: String(item.id), label: String(item.id), quantity: item.quantity, hoursPerUnit: 0, lineHours: 0 };
    const per = roundHours(extraMinutes(ex) / 60);
    return { extraId: String(item.id), label: extraLabel(ex.name), quantity: item.quantity, hoursPerUnit: per, lineHours: roundHours(per * item.quantity) };
  });
  return { model: 'itemized', baseLabel: 'Base visit (minimum)', baseHours, lines, totalHours: roundHours(baseHours + lines.reduce((s, l) => s + l.lineHours, 0)) };
}

export type InvoiceLine = { title: string; note: string; time?: string; amount: string };

export type InvoiceModel = {
  number: string;
  issueDate: string;
  billedTo: { name: string; email: string; line1: string; cityPostcode: string };
  details: { label: string; value: string }[];
  breakdown: TimeBreakdown;
  property: { label: string; value: string }[] | null;
  lines: InvoiceLine[];
  itemized: boolean;
  total: number;
  depositPercent: number;
  deposit: number;
  depositMessage: string;
  paid: boolean;
  termsAcceptedAt: string | null;
  payment: PaymentState;
};

const gbp = (n: number) => `£${(Number(n) || 0).toFixed(2)}`;

export function buildInvoice(
  b: Booking,
  svc: ServiceConfig | null | undefined,
  extras: Extra[],
  policy: { depositPercent: number; depositMessage: string }
): InvoiceModel {
  const breakdown = timeBreakdown(b, svc, extras);
  const itemized = breakdown.model === 'itemized';
  const total = Number(b.totalPrice) || 0;
  const trig = serviceTrigger(svc, b.serviceType);
  const pd = (b.propertyDetails || {}) as Record<string, any>;

  let callOut = 0;
  if (trig === 'deep' || trig === 'end_of_tenancy') {
    const stored = Number(pd.callOutCharge);
    const fromService = svc?.callOutCharge != null && Number.isFinite(Number(svc.callOutCharge)) ? Number(svc.callOutCharge) : DEEP_EOT_CALL_OUT_GBP;
    callOut = pd.callOutCharge != null && Number.isFinite(stored) ? stored : fromService;
  }

  // Rate stored on the booking when it was made (London or standard); older bookings use the service rate.
  const storedRate = Number(b.hourlyRate);
  const rate = Number.isFinite(storedRate) && storedRate > 0 ? storedRate : Number(svc?.baseRate || 0);

  const lines: InvoiceLine[] = [];
  if (callOut > 0) {
    lines.push({ title: 'Call-out charge', note: 'Fixed fee payable by the client (per booking)', time: itemized ? '-' : undefined, amount: gbp(callOut) });
  }
  lines.push({
    title: svc?.name || b.serviceType,
    note: itemized
      ? `Minimum duration guidance - ${formatHoursMinutes(breakdown.baseHours)} (instruction only, not charged)`
      : `Booked duration - ${formatHoursMinutes(breakdown.totalHours)} at ${gbp(rate)} per hour`,
    time: itemized ? `${formatHoursMinutes(breakdown.baseHours)}` : undefined,
    amount: itemized ? gbp(0) : `${gbp(rate)}/hr`,
  });
  for (const item of b.extras ?? []) {
    const ex = extras.find((e) => String(e.id) === String(item.id));
    const tl = breakdown.lines.find((l) => l.extraId === String(item.id));
    lines.push({
      title: `${extraLabel(ex?.name || String(item.id))} x ${item.quantity}`,
      note: itemized ? 'Scope / add-on (own price & est. time)' : 'Extra Service Add-on',
      time: itemized ? (tl ? `${formatHoursMinutes(tl.lineHours)}` : '-') : undefined,
      amount: gbp(Number(ex?.price || 0) * item.quantity),
    });
  }
  const mat = pd.cleaningMaterials;
  if (mat && mat !== 'none') {
    lines.push({
      title: mat === 'hoover_and_materials' ? 'Hoover + cleaning materials' : 'Hoover only',
      note: 'Cleaning equipment add-on',
      time: itemized ? '-' : undefined,
      amount: mat === 'hoover_and_materials' ? '£6.00' : '£3.00',
    });
  }

  const credit = Number(b.referralCreditUsed) || 0;
  if (credit > 0) {
    lines.push({
      title: 'Referral credit',
      note: 'Cleaning credit from referring a friend (no cash value)',
      time: itemized ? '-' : undefined,
      amount: `-${gbp(credit)}`,
    });
  }

  const depositPercent = Math.min(100, Math.max(0, Number(policy.depositPercent) || 0));
  const property = b.propertyDetails
    ? [
        { label: 'Bedrooms', value: String(pd.bedrooms ?? 0) },
        { label: 'Bathrooms', value: String(pd.bathrooms ?? 0) },
        { label: 'Clockroom Toilets', value: String(pd.clockRoomToilets ?? pd.toilets ?? 0) },
        { label: 'Living Rooms', value: String(pd.livingRooms ?? 0) },
      ]
    : null;

  return {
    number: `INV-${b.bookingId || b.id}`,
    issueDate: new Date().toLocaleDateString('en-GB'),
    billedTo: {
      name: b.contact?.name || 'Guest Customer',
      email: b.contact?.email || '',
      line1: b.address?.line1 || '',
      cityPostcode: [b.address?.city, b.address?.postcode].filter(Boolean).join(', '),
    },
    details: [
      { label: 'Service Date', value: String(b.date || '').slice(0, 10) },
      { label: 'Time', value: b.time || '-' },
      { label: 'Total hours (booked)', value: `${formatHours(breakdown.totalHours)} hrs` },
      { label: 'Frequency', value: b.frequency || '-' },
    ],
    breakdown,
    property,
    lines,
    itemized,
    total,
    depositPercent,
    deposit: (total * depositPercent) / 100,
    depositMessage:
      policy.depositMessage ||
      `To reserve your preferred slot and lock in your cleaner team, we require a ${depositPercent}% deposit before attendance.`,
    paid: paymentState(b, depositPercent).stage === 'paid',
    termsAcceptedAt: b.depositTermsAcceptedAt || null,
    payment: paymentState(b, depositPercent),
  };
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Payment Details lines: deposit or full before paying, paid so far and balance after a deposit. */
function paymentHtml(inv: InvoiceModel): string {
  const p = inv.payment;
  if (p.stage === 'paid') return `<div style="margin-top:8px;font-weight:800;color:#047857">Paid in full: £${p.total.toFixed(2)}. Thank you!</div>`;
  if (p.stage === 'deposit_paid') {
    return `<div style="margin-top:8px;font-weight:700">Paid so far: £${p.amountPaid.toFixed(2)}</div><div style="margin-top:4px;font-weight:900;font-size:15px">Balance due after your clean: £${p.balanceDue.toFixed(2)}</div>`;
  }
  if (p.choice === 'full') {
    return `<div style="margin-top:8px;font-weight:800">Paying in full: £${p.total.toFixed(2)}. Nothing more to pay after your clean.</div><div style="margin-top:8px">A secure payment link will be sent to your email once your booking is confirmed by our team.</div>`;
  }
  return `<div style="margin-top:4px">${esc(inv.depositMessage)}</div>
<div style="margin-top:8px;font-weight:800">Deposit required now: £${inv.deposit.toFixed(2)} (${inv.depositPercent}% of £${inv.total.toFixed(2)})</div>
<div style="margin-top:4px">Balance of £${(inv.total - inv.deposit).toFixed(2)} due after your clean. You can choose to pay in full instead.</div>
<div style="margin-top:8px">A secure payment link will be sent to your email once your booking is confirmed by our team.</div>`;
}

/** Printable HTML of the same invoice, for Print and Download PDF. */
export function invoiceHtml(
  inv: InvoiceModel,
  brand: { name: string; address: string; email: string; phone: string; logoDataUrl?: string }
): string {
  const contact = [brand.email, brand.phone].filter(Boolean).join(' · ');
  const timeCol = inv.itemized;
  const rows = inv.lines
    .map(
      (l) => `<tr><td><b>${esc(l.title)}</b><div class="note">${esc(l.note)}</div></td>${timeCol ? `<td class="r muted">${esc(l.time || '-')}</td>` : ''}<td class="r"><b>${esc(l.amount)}</b></td></tr>`
    )
    .join('');
  const tl = inv.breakdown;
  const timeRows = tl.lines.length
    ? `<tr><td>${esc(tl.baseLabel)}</td><td class="r"><b>${formatHoursMinutes(tl.baseHours)}</b></td></tr>` +
      tl.lines.map((l) => `<tr><td>${esc(l.label)} ×${l.quantity}</td><td class="r"><b>${formatHoursMinutes(l.lineHours)}</b></td></tr>`).join('') +
      `<tr class="tot"><td>TOTAL BOOKED</td><td class="r blue">${formatHoursMinutes(tl.totalHours)}</td></tr>`
    : `<tr><td>${tl.model === 'itemized' ? esc(tl.baseLabel) : 'Booked clean duration'}</td><td class="r blue"><b>${formatHoursMinutes(tl.totalHours)}</b></td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(inv.number)}</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:28px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:20px;margin-bottom:20px}
h1{font-size:28px;margin:0 0 6px;font-weight:900;letter-spacing:-.5px}.muted{color:#94a3b8}.small{font-size:12px}
.brand{text-align:right}.brand img{height:64px;max-width:240px;object-fit:contain}.bname{font-size:18px;font-weight:900;color:#2563eb}
.cols{display:flex;justify-content:space-between;gap:24px;margin-bottom:20px}.lab{font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:16px}
.grid4{display:flex;gap:12px;background:#f8fafc;border-radius:14px;padding:14px;margin-bottom:16px}.grid4 div{flex:1}
table{width:100%;border-collapse:collapse}th{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;text-align:left;padding:10px 0;border-bottom:1px solid #e2e8f0}
td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}.r{text-align:right}.note{font-size:11px;color:#94a3b8;margin-top:3px}
.blue{color:#2563eb}.total td{border:none;border-top:1px solid #e2e8f0;padding-top:16px;font-weight:900;font-size:16px}.total .amt{font-size:22px;color:#2563eb}
.tot td{border-top:2px solid #cbd5e1;font-weight:900;font-size:12px}
.pay{background:#eff6ff;border:1px solid #dbeafe;border-radius:14px;padding:16px;margin:16px 0;color:#1e3a8a;font-size:13px}
.foot{background:#f8fafc;border-radius:14px;padding:14px;display:flex;justify-content:space-between;font-size:12px}
.paid{color:#047857;font-weight:900;letter-spacing:1.5px}.pending{color:#d97706;font-weight:900;letter-spacing:1.5px}
@page{margin:14mm}@media print{body{padding:0}}
@media (max-width:560px){body{padding:18px}.cols{flex-direction:column;gap:14px}.cols>div:last-child{text-align:left!important}.grid4{flex-wrap:wrap}.grid4 div{flex:0 0 45%}.brand img{height:48px}}
</style></head><body>
<div class="head"><div><h1>INVOICE</h1><div class="muted small" style="font-weight:700;letter-spacing:1.5px">${esc(inv.number)}</div></div>
<div class="brand">${brand.logoDataUrl ? `<img src="${brand.logoDataUrl}" alt="">` : ''}<div class="bname">${esc(brand.name)}</div>
<div class="muted small" style="font-weight:700">Professional Cleaning Services</div>${brand.address ? `<div class="small" style="color:#64748b;margin-top:6px">${esc(brand.address)}</div>` : ''}${contact ? `<div class="small" style="color:#64748b">${esc(contact)}</div>` : ''}</div></div>
<div class="cols"><div><div class="lab">Billed To</div><div style="font-weight:800;font-size:17px">${esc(inv.billedTo.name)}</div>
<div class="small" style="color:#64748b">${esc(inv.billedTo.email)}</div><div class="small" style="color:#64748b;margin-top:6px">${esc(inv.billedTo.line1)}</div><div class="small" style="color:#64748b">${esc(inv.billedTo.cityPostcode)}</div></div>
<div style="text-align:right"><div class="lab">Booking Details</div>${inv.details.map((d) => `<div style="font-weight:700"><span class="muted small">${esc(d.label)}:</span> ${esc(d.value)}</div>`).join('')}
<div style="font-weight:700;margin-top:6px"><span class="muted small">Issue Date:</span> ${esc(inv.issueDate)}</div></div></div>
<div class="box"><div class="lab">Time allocation (transparency)</div><table>${timeRows}</table></div>
${inv.property ? `<div class="grid4">${inv.property.map((p) => `<div><div class="lab" style="margin:0">${esc(p.label)}</div><b>${esc(p.value)}</b></div>`).join('')}</div>` : ''}
<table><thead><tr><th>Description</th>${timeCol ? '<th class="r">Est. time</th>' : ''}<th class="r">Amount</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr class="total"><td ${timeCol ? 'colspan="2"' : ''} class="r">Total Due</td><td class="r amt">£${inv.total.toFixed(2)}</td></tr></tfoot></table>
<div class="pay"><b>Payment Details</b>${paymentHtml(inv)}
${inv.termsAcceptedAt ? `<div style="margin-top:8px;color:#065f46;font-weight:700">Deposit and cancellation terms acknowledged on ${esc(new Date(inv.termsAcceptedAt).toLocaleString('en-GB'))}.</div>` : ''}</div>
<div class="foot"><span class="${inv.paid ? 'paid' : 'pending'}">${inv.paid ? 'PAID' : inv.payment.stage === 'deposit_paid' ? `DEPOSIT PAID · £${inv.payment.balanceDue.toFixed(2)} BALANCE DUE` : 'PAYMENT PENDING'}</span><span class="muted">Thank you for choosing ${esc(brand.name)}.</span></div>
</body></html>`;
}
