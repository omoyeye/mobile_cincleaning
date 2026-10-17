import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { StatusBadge, localYmd, friendlyDay } from './staff/StaffKit';
import type { Booking } from '../types';
import { Image as Photo } from 'expo-image';
import { PhotoBackdrop, PressableScale, PulseDot, Shine } from './Motion';
import { servicePhoto } from './media';
import { paymentProofNeeded } from '../utils/clientPortal';

/**
 * Client-side building blocks. Same look as the staff screens (StaffKit) so the whole app feels
 * like one product: white cards, soft borders, one blue for actions.
 */
export { ScreenHeader, Card, StatusBadge, EmptyState, SectionTitle, friendlyDay, localYmd } from './staff/StaffKit';

/* ───────────── Booking helpers ───────────── */

export function serviceLabel(raw?: string | null): string {
  const s = String(raw || 'Cleaning').replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bookingYmd(b: Pick<Booking, 'date'>): string {
  return String(b.date || '').slice(0, 10);
}

/** Still to happen: open status and today or later. */
export function isUpcoming(b: Booking): boolean {
  if (b.status === 'Completed' || b.status === 'Cancelled') return false;
  return bookingYmd(b) >= localYmd();
}

/** Open status but the date has passed (waiting for the office to close it off). */
export function isAwaitingUpdate(b: Booking): boolean {
  if (b.status === 'Completed' || b.status === 'Cancelled') return false;
  return bookingYmd(b) < localYmd();
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n);
  return `£${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
}

function dateParts(ymd: string): { day: string; month: string; weekday: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return { day: '--', month: '', weekday: '' };
  const dt = new Date(y, m - 1, d);
  return {
    day: String(d),
    month: dt.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

/* ───────────── UI ───────────── */

/** Logo on the left, optional action on the right. Used at the top of each tab. */
export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <View style={ck.topBar}>
      <Image source={require('../assets/brand-logo.png')} style={ck.topLogo} resizeMode="contain" accessibilityLabel="CiN Cleaning" />
      {right}
    </View>
  );
}

export function Avatar({ name, size = 40, onPress }: { name?: string | null; size?: number; onPress?: () => void }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const body = (
    <View style={[ck.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[ck.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} accessibilityLabel="Your account" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
}

/** Booking row with a date tile on the left, like the staff job cards. */
export function BookingCard({ booking, onPress, style }: { booking: Booking; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const ymd = bookingYmd(booking);
  const parts = dateParts(ymd);
  const done = booking.status === 'Completed';
  const cancelled = booking.status === 'Cancelled';
  const where = [booking.address?.line1, booking.address?.postcode].filter(Boolean).join(', ');
  const proof = paymentProofNeeded(booking);
  return (
    <PressableScale style={[ck.booking, style]} onPress={onPress} accessibilityRole="button">
      <View style={[ck.dateTile, done && ck.dateTileDone, cancelled && ck.dateTileCancelled]}>
        <Text style={[ck.dateMonth, done && { color: COLORS.status.completed }, cancelled && { color: COLORS.textTertiary }]}>{parts.month}</Text>
        <Text style={[ck.dateDay, done && { color: COLORS.status.completed }, cancelled && { color: COLORS.textTertiary }]}>{parts.day}</Text>
        <Text style={ck.dateWeekday}>{parts.weekday}</Text>
      </View>
      <View style={ck.bookingBody}>
        <Photo
          source={servicePhoto(booking.serviceType)}
          style={[ck.bookingThumb, cancelled && { opacity: 0.45 }]}
          contentFit="cover"
          transition={250}
          accessibilityIgnoresInvertColors
        />
        <Text style={[ck.bookingTitle, cancelled && ck.strike]} numberOfLines={2}>
          {serviceLabel(booking.serviceType)}
        </Text>
        <View style={ck.metaRow}>
          <Ionicons name="time-outline" size={14} color={COLORS.textTertiary} />
          <Text style={ck.meta}>
            {friendlyDay(ymd)} · {booking.time || '--:--'}
          </Text>
        </View>
        {where ? (
          <View style={ck.metaRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
            <Text style={ck.meta} numberOfLines={1}>
              {where}
            </Text>
          </View>
        ) : null}
        <View style={ck.bookingFooter}>
          <StatusBadge status={booking.status} />
          <Text style={ck.price}>{money(booking.totalPrice)}</Text>
        </View>
        {proof.show ? (
          <View style={ck.proofHint}>
            <Ionicons name="cloud-upload-outline" size={14} color={COLORS.secondary} />
            <Text style={ck.proofHintText} numberOfLines={2}>{proof.message}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** Big blue card for the next clean on the home tab. */
export function NextCleanCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const ymd = bookingYmd(booking);
  const onTheWay = !!booking.enRouteAt && booking.status !== 'Completed';
  return (
    <PressableScale style={ck.nextShadow} onPress={onPress} accessibilityRole="button" scaleTo={0.98}>
     <PhotoBackdrop
      source={servicePhoto(booking.serviceType)}
      style={ck.next}
      colors={['rgba(12,135,214,0.35)', 'rgba(10,106,171,0.86)', 'rgba(8,62,104,0.96)']}
      locations={[0, 0.5, 1]}
     >
      <Shine />
      <View style={ck.nextHead}>
        <Text style={ck.nextEyebrow}>Your next clean</Text>
        {onTheWay ? (
          <View style={ck.livePill}>
            <PulseDot color={COLORS.secondary} />
            <Text style={ck.livePillText}>Cleaner on the way</Text>
          </View>
        ) : (
          <View style={ck.nextStatus}>
            <Text style={ck.nextStatusText}>{booking.status}</Text>
          </View>
        )}
      </View>
      <Text style={ck.nextWhen}>
        {friendlyDay(ymd)} · {booking.time || '--:--'}
      </Text>
      <Text style={ck.nextService} numberOfLines={1}>
        {serviceLabel(booking.serviceType)}
      </Text>
      <View style={ck.nextRow}>
        <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.9)" />
        <Text style={ck.nextAddress} numberOfLines={1}>
          {[booking.address?.line1, booking.address?.postcode].filter(Boolean).join(', ') || 'Address to confirm'}
        </Text>
      </View>
      <View style={ck.nextFoot}>
        <Text style={ck.nextPrice}>{money(booking.totalPrice)}</Text>
        <View style={ck.nextOpen}>
          <Text style={ck.nextOpenText}>{onTheWay ? 'Track' : 'View details'}</Text>
          <Ionicons name="chevron-forward" size={15} color={COLORS.primary} />
        </View>
      </View>
     </PhotoBackdrop>
    </PressableScale>
  );
}

export function QuickAction({
  icon,
  label,
  onPress,
  tint = COLORS.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <PressableScale style={ck.quick} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.94}>
      <View style={[ck.quickIcon, { backgroundColor: tint + '14' }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={ck.quickLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Settings-style row: icon, title, optional subtitle, chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  tint = COLORS.primary,
  danger,
  last,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  tint?: string;
  danger?: boolean;
  last?: boolean;
  right?: React.ReactNode;
}) {
  const color = danger ? COLORS.error : tint;
  return (
    <TouchableOpacity
      style={[ck.row, !last && ck.rowDivider]}
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[ck.rowIcon, { backgroundColor: color + '14' }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ck.rowTitle, danger && { color: COLORS.error }]}>{title}</Text>
        {subtitle ? <Text style={ck.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} /> : null)}
    </TouchableOpacity>
  );
}

/** Group of ListRows in one rounded card with a small heading. */
export function RowGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={ck.group}>
      {title ? <Text style={ck.groupTitle}>{title}</Text> : null}
      <View style={ck.groupCard}>{children}</View>
    </View>
  );
}

/** Pill tabs for filtering lists. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={ck.pills}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[ck.pill, active && ck.pillActive]}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[ck.pillText, active && ck.pillTextActive]}>{o.label}</Text>
            {o.count ? (
              <View style={[ck.pillCount, active && ck.pillCountActive]}>
                <Text style={[ck.pillCountText, active && { color: COLORS.primary }]}>{o.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  tone = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'primary' ? COLORS.primary : tone === 'danger' ? COLORS.errorLight : COLORS.surface;
  const fg = tone === 'primary' ? COLORS.white : tone === 'danger' ? COLORS.error : COLORS.primary;
  return (
    <TouchableOpacity
      style={[ck.btn, { backgroundColor: bg }, tone === 'secondary' && ck.btnOutline, (disabled || loading) && { opacity: 0.55 }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[ck.btnText, { color: fg }]}>{loading ? 'Please wait…' : label}</Text>
    </TouchableOpacity>
  );
}

const shadow = {
  shadowColor: '#0c1f33',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 1,
} as const;

export const ck = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.xs, minHeight: 44 },
  topLogo: { width: 112, height: 40 },
  avatar: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '700' },

  booking: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...shadow,
  },
  dateTile: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary + '0d',
    borderRightWidth: 1,
    borderRightColor: COLORS.primary + '1a',
  },
  dateTileDone: { backgroundColor: COLORS.status.completedBg, borderRightColor: COLORS.status.completed + '22' },
  dateTileCancelled: { backgroundColor: COLORS.surfaceAlt, borderRightColor: COLORS.border },
  dateMonth: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.6 },
  dateDay: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginTop: -1 },
  dateWeekday: { fontSize: 11, color: COLORS.textSecondary },
  bookingBody: { flex: 1, padding: SPACING.md },
  bookingTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bookingTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, lineHeight: 20, paddingRight: 56 },
  bookingThumb: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.surfaceAlt },
  strike: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  meta: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  bookingFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  ref: { fontSize: 11, color: COLORS.textTertiary, letterSpacing: 0.3 },
  price: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  proofHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.successLight,
  },
  proofHintText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.secondary },

  nextShadow: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  next: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    minHeight: 200,
  },
  nextGlow: { position: 'absolute', right: -50, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.12)' },
  nextGlow2: { position: 'absolute', left: -40, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.07)' },
  nextHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextEyebrow: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.88)' },
  nextStatus: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  nextStatusText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary },
  livePillText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  nextWhen: { fontSize: 26, fontWeight: '800', color: COLORS.white, marginTop: SPACING.sm, letterSpacing: -0.4 },
  nextService: { fontSize: 16, fontWeight: '600', color: COLORS.white, marginTop: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm },
  nextAddress: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  nextFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.base },
  nextPrice: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  nextOpen: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md },
  nextOpenText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  quick: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    paddingVertical: SPACING.md,
    paddingHorizontal: 4,
    ...shadow,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  group: { marginTop: SPACING.lg },
  groupTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm, marginLeft: 4 },
  groupCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border + '80', overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.base, paddingVertical: 13, minHeight: 56 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },

  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 36,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.white },
  pillCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pillCountActive: { backgroundColor: COLORS.white },
  pillCountText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg },
  btnOutline: { borderWidth: 1.5, borderColor: COLORS.primary + '55' },
  btnText: { fontSize: 16, fontWeight: '700' },
});
