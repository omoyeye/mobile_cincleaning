import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { StaffHoliday } from '../../types';

/** Weekdays between two dates inclusive (matches the server); a single-day half day is 0.5. */
export function countHolidayDays(start: string, end: string, halfDay: boolean): number {
  if (!start || !end || end < start) return 0;
  let days = 0;
  const d = new Date(`${start}T12:00:00Z`);
  const e = new Date(`${end}T12:00:00Z`);
  for (; d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return halfDay && start === end && days === 1 ? 0.5 : days;
}

export const fmtHolidayDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const holidayRange = (h: { startDate: string; endDate: string }) =>
  h.startDate === h.endDate ? fmtHolidayDay(h.startDate) : `${fmtHolidayDay(h.startDate)} to ${fmtHolidayDay(h.endDate)}`;

export const pluralDays = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** The approved or pending holiday covering a date, if any (cancelled and rejected ones don't count). */
export function holidayOn(ymd: string, holidays: StaffHoliday[] | undefined): StaffHoliday | null {
  return (holidays || []).find((h) => (h.status === 'Approved' || h.status === 'Pending') && ymd >= h.startDate && ymd <= h.endDate) ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Month calendar for picking a holiday: tap the first day, then the last day.
 * Tapping before the first day starts again from there. Weekends are shown lighter (they are free).
 */
export function RangeCalendar({
  start,
  end,
  min,
  max,
  onChange,
}: {
  start: string;
  end: string;
  min: string;
  max: string;
  onChange: (range: { start: string; end: string }) => void;
}) {
  const seed = start || min;
  const [view, setView] = useState(() => ({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) - 1 }));

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const count = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) out.push(ymdOf(view.y, view.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const monthStart = ymdOf(view.y, view.m, 1);
  const monthEnd = ymdOf(view.y, view.m, new Date(view.y, view.m + 1, 0).getDate());
  const canPrev = monthStart > min;
  const canNext = monthEnd < max;
  const shift = (by: number) => setView((v) => {
    const d = new Date(v.y, v.m + by, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const pick = (day: string) => {
    // A finished range (or nothing yet) starts a new one; otherwise this closes the range.
    if (!start || (start && end && end !== start) || day < start) onChange({ start: day, end: day });
    else onChange({ start, end: day });
  };

  const title = new Date(view.y, view.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const last = end || start;

  return (
    <View style={cal.wrap}>
      <View style={cal.head}>
        <Pressable onPress={() => canPrev && shift(-1)} hitSlop={10} style={[cal.nav, !canPrev && cal.navOff]} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={18} color={canPrev ? COLORS.text : COLORS.textTertiary} />
        </Pressable>
        <Text style={cal.title}>{title}</Text>
        <Pressable onPress={() => canNext && shift(1)} hitSlop={10} style={[cal.nav, !canNext && cal.navOff]} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={18} color={canNext ? COLORS.text : COLORS.textTertiary} />
        </Pressable>
      </View>
      <View style={cal.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[cal.dow, i > 4 && cal.weekendText]}>{d}</Text>
        ))}
      </View>
      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={cal.cell} />;
          const disabled = day < min || day > max;
          const isEdge = day === start || day === last;
          const inRange = !!start && day > start && day < last;
          const weekend = i % 7 > 4;
          return (
            <Pressable
              key={day}
              disabled={disabled}
              onPress={() => pick(day)}
              style={[cal.cell, inRange && cal.inRange, day === start && last > start && cal.rangeStart, day === last && last > start && cal.rangeEnd]}
              accessibilityLabel={fmtHolidayDay(day)}
              accessibilityState={{ selected: isEdge || inRange, disabled }}
            >
              <View style={[cal.dayBubble, isEdge && cal.dayBubbleOn]}>
                <Text style={[cal.dayText, weekend && cal.weekendText, disabled && cal.dayOff, isEdge && cal.dayTextOn]}>
                  {Number(day.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  wrap: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  nav: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  navOff: { opacity: 0.4 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  inRange: { backgroundColor: COLORS.primary + '18' },
  rangeStart: { backgroundColor: COLORS.primary + '18', borderTopLeftRadius: 21, borderBottomLeftRadius: 21 },
  rangeEnd: { backgroundColor: COLORS.primary + '18', borderTopRightRadius: 21, borderBottomRightRadius: 21 },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayBubbleOn: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dayTextOn: { color: COLORS.white, fontWeight: '800' },
  weekendText: { color: COLORS.textTertiary },
  dayOff: { color: COLORS.border },
});
