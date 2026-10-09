import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking, DayAvailability, Staff } from '../../types';

/* ───────────── Shared rules (same as the website and the server) ───────────── */

/** Local calendar date as YYYY-MM-DD (toISOString() is UTC and shows the wrong day around midnight). */
export function localYmd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday to Sunday of the week containing `ref`, as local YYYY-MM-DD. */
export function localWeekRange(ref: Date = new Date()): { start: string; end: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { start: localYmd(d), end: localYmd(end) };
}

export function bookedHours(b: Pick<Booking, 'propertyDetails'> & { duration?: number }): number {
  const raw = Number(b.duration ?? b.propertyDetails?.duration);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

/** People on the job (minimum 1). */
export function teamSize(b: Pick<Booking, 'assignedStaffIds' | 'assignedStaffId'>): number {
  const ids = Array.isArray(b.assignedStaffIds) ? b.assignedStaffIds.length : 0;
  return Math.max(1, ids || (b.assignedStaffId ? 1 : 0));
}

/** Cleaner pay for one job: booked hours ÷ people on the job × hourly rate (same as invoices). */
export function jobPay(b: Booking, hourlyRate: number | string | null | undefined): { hours: number; pay: number } {
  const hours = bookedHours(b) / teamSize(b);
  return { hours, pay: hours * (Number(hourlyRate) || 0) };
}

export function endTime(start: string, hours: number): string {
  const [h, m] = String(start || '').split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const total = Math.round((h * 60 + (m || 0) + hours * 60) % (24 * 60));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function friendlyDay(ymd: string): string {
  if (ymd === localYmd()) return 'Today';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (ymd === localYmd(t)) return 'Tomorrow';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type WeeklySlot = { active: boolean; start: string; end: string };

/**
 * Availability is stored as { Mon: { active, start, end }, ... } (what the website, admin rota and
 * Job Assignment read). Older app versions saved a list; accept both and always work with a list here.
 */
export function availabilityToList(raw: unknown): DayAvailability[] {
  if (Array.isArray(raw) && raw.length) {
    return FULL_DAYS.map((day, i) => {
      const hit = (raw as DayAvailability[]).find((d) => d.day === day || d.day === SHORT_DAYS[i]);
      return hit ? { day, isOpen: !!hit.isOpen, start: hit.start || '08:00', end: hit.end || '18:00' } : { day, isOpen: false, start: '08:00', end: '18:00' };
    });
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, WeeklySlot | undefined>;
    return FULL_DAYS.map((day, i) => {
      const slot = obj[SHORT_DAYS[i]] ?? obj[day];
      return { day, isOpen: !!slot?.active, start: slot?.start || '08:00', end: slot?.end || '18:00' };
    });
  }
  return FULL_DAYS.map((day) => ({ day, isOpen: day !== 'Sunday', start: '08:00', end: '18:00' }));
}

export function listToWeeklyAvailability(list: DayAvailability[]): Record<string, WeeklySlot> {
  const out: Record<string, WeeklySlot> = {};
  FULL_DAYS.forEach((day, i) => {
    const d = list.find((x) => x.day === day);
    out[SHORT_DAYS[i]] = { active: !!d?.isOpen, start: d?.start || '08:00', end: d?.end || '18:00' };
  });
  return out;
}

/** The signed-in cleaner's own staff record (by login id, then email). */
export function findMe(list: Staff[], user: { id?: number; email?: string } | null | undefined): Staff | null {
  if (!user) return null;
  return (
    list.find((s) => Number(s.userId) === Number(user.id)) ??
    list.find((s) => String(s.email || '').toLowerCase() === String(user.email || '').toLowerCase()) ??
    null
  );
}

/* ───────────── UI ───────────── */

export function ScreenHeader({ title, subtitle, right, eyebrow }: { title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string }) {
  return (
    <View style={kit.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={kit.eyebrow}>{eyebrow}</Text> : null}
        <Text style={kit.title}>{title}</Text>
        {subtitle ? <Text style={kit.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function BrandBar() {
  return (
    <View style={kit.brandBar}>
      <Image source={require('../../assets/brand-logo.png')} style={kit.brandLogo} resizeMode="contain" />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[kit.card, style]}>{children}</View>;
}

const STATUS_TONES: Record<string, { fg: string; bg: string }> = {
  Completed: { fg: COLORS.status.completed, bg: COLORS.status.completedBg },
  Cancelled: { fg: COLORS.status.cancelled, bg: COLORS.status.cancelledBg },
  Pending: { fg: '#a16207', bg: COLORS.status.pendingBg },
  Confirmed: { fg: COLORS.status.confirmed, bg: COLORS.status.confirmedBg },
  'In Progress': { fg: COLORS.status.inProgress, bg: COLORS.status.inProgressBg },
  Approved: { fg: COLORS.status.completed, bg: COLORS.status.completedBg },
  Paid: { fg: COLORS.status.completed, bg: COLORS.status.completedBg },
  Rejected: { fg: COLORS.status.cancelled, bg: COLORS.status.cancelledBg },
};

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = STATUS_TONES[String(status)] ?? { fg: COLORS.textSecondary, bg: COLORS.surfaceAlt };
  return (
    <View style={[kit.badge, { backgroundColor: tone.bg }]}>
      <View style={[kit.badgeDot, { backgroundColor: tone.fg }]} />
      <Text style={[kit.badgeText, { color: tone.fg }]}>{status || 'Pending'}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string }) {
  return (
    <View style={kit.empty}>
      <View style={kit.emptyIcon}>
        <Ionicons name={icon} size={26} color={COLORS.textTertiary} />
      </View>
      <Text style={kit.emptyTitle}>{title}</Text>
      {body ? <Text style={kit.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={kit.sectionRow}>
      <Text style={kit.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

/** Step progress used on the job screen. */
export function StepTracker({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={kit.steps}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={kit.step}>
            <View style={[kit.stepBar, (done || active) && kit.stepBarOn]} />
            <Text style={[kit.stepLabel, active && kit.stepLabelActive, done && kit.stepLabelDone]} numberOfLines={1}>
              {done ? '✓ ' : ''}
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Job card with a time column on the left, like the website. */
export function JobCard({
  booking,
  pay,
  onPress,
  actions,
}: {
  booking: Booking;
  pay?: { hours: number; pay: number } | null;
  onPress: () => void;
  actions?: React.ReactNode;
}) {
  const hours = bookedHours(booking);
  const completed = booking.status === 'Completed';
  return (
    <TouchableOpacity style={kit.job} activeOpacity={0.75} onPress={onPress}>
      <View style={[kit.jobTime, completed && kit.jobTimeDone]}>
        <Text style={[kit.jobTimeStart, completed && { color: COLORS.status.completed }]}>{booking.time || '--:--'}</Text>
        <Text style={kit.jobTimeEnd}>to {endTime(booking.time, hours)}</Text>
        <Text style={kit.jobTimeHours}>{hours}h</Text>
      </View>
      <View style={kit.jobBody}>
        <View style={kit.jobTop}>
          <Text style={kit.jobName} numberOfLines={1}>
            {booking.contact?.name || 'Client'}
          </Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text style={kit.jobService} numberOfLines={1}>
          {String(booking.serviceType || '').replace(/_/g, ' ')}
        </Text>
        <View style={kit.jobRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
          <Text style={kit.jobMeta} numberOfLines={1}>
            {[booking.address?.line1, booking.address?.postcode].filter(Boolean).join(', ') || 'Address not available'}
          </Text>
        </View>
        <View style={kit.jobFooter}>
          <Text style={kit.jobDay}>{friendlyDay(String(booking.date).slice(0, 10))}</Text>
          {pay && pay.pay > 0 ? <Text style={kit.jobPay}>{'£'}{pay.pay.toFixed(2)} your pay</Text> : null}
          {actions ? <View style={kit.jobActions}>{actions}</View> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function IconAction({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity style={kit.iconAction} onPress={onPress} accessibilityLabel={label} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

export function NextJobCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <TouchableOpacity style={kit.next} activeOpacity={0.85} onPress={onPress}>
      <View style={kit.nextGlow} />
      <Text style={kit.nextEyebrow}>Next job · {friendlyDay(String(booking.date).slice(0, 10))}</Text>
      <Text style={kit.nextTime}>{booking.time || '--:--'}</Text>
      <Text style={kit.nextName} numberOfLines={1}>
        {booking.contact?.name || 'Client'}
      </Text>
      <View style={kit.jobRow}>
        <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.9)" />
        <Text style={kit.nextAddress} numberOfLines={1}>
          {[booking.address?.line1, booking.address?.postcode].filter(Boolean).join(', ') || 'Address not available'}
        </Text>
      </View>
      <View style={kit.nextOpen}>
        <Text style={kit.nextOpenText}>Open job</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.white} />
      </View>
    </TouchableOpacity>
  );
}

export const kit = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.base },
  eyebrow: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  brandBar: { alignItems: 'center', paddingTop: SPACING.xs },
  brandLogo: { width: 110, height: 34 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface + 'aa',
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptyBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 280 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  steps: { flexDirection: 'row', gap: 6, marginTop: SPACING.md },
  step: { flex: 1 },
  stepBar: { height: 5, borderRadius: 3, backgroundColor: COLORS.border },
  stepBarOn: { backgroundColor: COLORS.primary },
  stepLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textTertiary, marginTop: 5 },
  stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
  stepLabelDone: { color: COLORS.textSecondary },

  job: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  jobTime: { width: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, backgroundColor: COLORS.primary + '0d', borderRightWidth: 1, borderRightColor: COLORS.primary + '1a' },
  jobTimeDone: { backgroundColor: COLORS.status.completedBg, borderRightColor: COLORS.status.completed + '22' },
  jobTimeStart: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  jobTimeEnd: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  jobTimeHours: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  jobBody: { flex: 1, padding: SPACING.md },
  jobTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  jobName: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.text },
  jobService: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  jobMeta: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  jobFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  jobDay: { fontSize: 12, color: COLORS.textTertiary },
  jobPay: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  jobActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  iconAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },

  next: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  nextGlow: { position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  nextEyebrow: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  nextTime: { fontSize: 32, fontWeight: '700', color: COLORS.white, marginTop: 2, letterSpacing: -0.5 },
  nextName: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginTop: 2 },
  nextAddress: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  nextOpen: {
    position: 'absolute',
    right: SPACING.lg,
    top: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  nextOpenText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});
