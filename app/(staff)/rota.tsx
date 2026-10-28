import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Linking,
  Platform,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useHaptic } from '../../hooks/useHaptic';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import {
  BrandBar,
  EmptyState,
  IconAction,
  JobCard,
  ScreenHeader,
  availabilityToList,
  bookedHours,
  findMe,
  jobPay,
  localYmd,
  listToWeeklyAvailability,
  teamSize,
} from '../../components/staff/StaffKit';
import { holidayOn, holidayRange, pluralDays } from '../../components/staff/HolidayKit';
import { formatHoursMinutes } from '../../utils/duration';
import type { Booking, Staff, DayAvailability, StaffHolidayYear } from '../../types';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePickerModal({
  visible,
  value,
  label,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  label: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const [hour, setHour] = useState(value.split(':')[0]);
  const [minute, setMinute] = useState(value.split(':')[1] || '00');

  useEffect(() => {
    if (visible) {
      setHour(value.split(':')[0]);
      const m = value.split(':')[1] || '00';
      const closest = MINUTES.reduce((prev, curr) =>
        Math.abs(parseInt(curr) - parseInt(m)) < Math.abs(parseInt(prev) - parseInt(m)) ? curr : prev
      );
      setMinute(closest);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
          <Text style={styles.modalTitle}>{label}</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, hour === h && styles.pickerItemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.pickerItemText, hour === h && styles.pickerItemTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.pickerColon}>:</Text>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Min</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.pickerItemText, minute === m && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => { onSelect(`${hour}:${minute}`); onClose(); }}
            >
              <Text style={styles.modalConfirmText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday of the week containing `ymd` (local calendar). */
function mondayOf(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return localYmd(new Date(y, m - 1, d + n));
}

const dateOf = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const longDay = (ymd: string) => dateOf(ymd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** "Today" / "Tomorrow" / "Yesterday", otherwise the weekday name; the date goes underneath. */
function dayHeading(ymd: string, today: string): { title: string; sub: string } {
  const sub = dateOf(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: ymd.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
  const near: Record<string, string> = { [today]: 'Today', [addDays(today, 1)]: 'Tomorrow', [addDays(today, -1)]: 'Yesterday' };
  const weekday = dateOf(ymd).toLocaleDateString('en-GB', { weekday: 'long' });
  return near[ymd] ? { title: near[ymd], sub: `${weekday} ${sub}` } : { title: weekday, sub };
}

function openDirections(booking: Booking) {
  const addr = `${booking.address?.line1}, ${booking.address?.postcode}`;
  const url = Platform.OS === 'ios' ? `maps:?daddr=${encodeURIComponent(addr)}` : `geo:0,0?q=${encodeURIComponent(addr)}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`);
  });
}

export default function RotaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const today = localYmd();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [holidayYear, setHolidayYear] = useState<StaffHolidayYear | null>(null);
  const [selected, setSelected] = useState(today);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timePicker, setTimePicker] = useState<{ day: string; field: 'start' | 'end'; value: string } | null>(null);
  const swipeX = useRef<number | null>(null);

  const isContracted = staff?.contractType === 'contracted';

  const fetchAll = useCallback(async () => {
    try {
      const [profiles, bookings] = await Promise.all([staffApi.getStaffList(), staffApi.getBookings()]);
      const me = findMe(profiles, user);
      setJobs(bookings.filter((b) => b.status !== 'Cancelled'));
      if (me) {
        setStaff(me);
        // Reads both the shared weekly format and the list older app versions saved.
        if (!editing) setAvailability(availabilityToList(me.availability));
        if (me.contractType === 'contracted') {
          staffApi.getHolidays(me.id).then(setHolidayYear).catch(() => setHolidayYear(null));
        }
      }
    } catch {
      showToast('Could not load your rota', 'error');
    }
    setLoading(false);
  }, [user, editing]);

  useEffect(() => { fetchAll(); }, [user]);
  const { refreshing, onRefresh } = usePullRefresh(() => fetchAll());

  // ─── Rota ───
  const weekStart = useMemo(() => localYmd(mondayOf(selected)), [selected]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const jobsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const j of jobs) map.set(j.date, [...(map.get(j.date) || []), j]);
    map.forEach((list) => list.sort((a, b) => String(a.time).localeCompare(String(b.time))));
    return map;
  }, [jobs]);

  const dayJobs = jobsByDay.get(selected) || [];
  const dayHours = dayJobs.reduce((s, j) => s + bookedHours(j) / teamSize(j), 0);
  const dayPay = staff ? dayJobs.reduce((s, j) => s + jobPay(j, staff.hourlyRate).pay, 0) : 0;
  const weekJobCount = weekDays.reduce((s, d) => s + (jobsByDay.get(d)?.length || 0), 0);
  const onHoliday = holidayOn(selected, holidayYear?.holidays);

  const select = (ymd: string) => {
    haptic.light();
    setSelected(ymd);
  };
  const shiftWeek = (by: number) => select(addDays(selected, by * 7));

  const onSwipeStart = (e: GestureResponderEvent) => { swipeX.current = e.nativeEvent.pageX; };
  const onSwipeEnd = (e: GestureResponderEvent) => {
    if (swipeX.current == null) return;
    const dx = e.nativeEvent.pageX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) > 50) shiftWeek(dx < 0 ? 1 : -1);
  };

  const monthLabel = (() => {
    const [y, m] = weekStart.split('-').map(Number);
    const endMonth = Number(weekDays[6].slice(5, 7));
    const a = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
    const b = new Date(Number(weekDays[6].slice(0, 4)), endMonth - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    return endMonth === m ? new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : `${a} to ${b}`;
  })();

  // ─── Availability ───
  const toggleDay = (day: string) => {
    setAvailability((prev) => prev.map((a) => (a.day === day ? { ...a, isOpen: !a.isOpen } : a)));
  };

  const updateTime = (day: string, field: 'start' | 'end', time: string) => {
    setAvailability((prev) =>
      prev.map((a) => {
        if (a.day !== day) return a;
        const updated = { ...a, [field]: time };
        if (field === 'start' && time >= a.end) {
          const h = parseInt(time.split(':')[0]);
          updated.end = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`;
        }
        if (field === 'end' && time <= a.start) {
          const h = parseInt(time.split(':')[0]);
          updated.start = `${String(Math.max(h - 1, 0)).padStart(2, '0')}:00`;
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (!staff) return;
    setSaving(true);
    try {
      // Saved in the shared weekly format so the website, admin rota and Job Assignment can read it.
      await staffApi.updateProfile(staff.id, { availability: listToWeeklyAvailability(availability) });
      showToast('Availability updated', 'success');
      haptic.success();
      setEditing(false);
    } catch {
      showToast('Could not save availability', 'error');
    }
    setSaving(false);
  };

  const cancelEdit = () => {
    setAvailability(availabilityToList(staff?.availability));
    setEditing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandBar />
        <ListSkeleton count={6} />
      </SafeAreaView>
    );
  }

  const openDays = availability.filter((a) => a.isOpen).length;
  const totalHours = availability
    .filter((a) => a.isOpen)
    .reduce((sum, a) => {
      const s = parseInt(a.start.split(':')[0]) + parseInt(a.start.split(':')[1] || '0') / 60;
      const e = parseInt(a.end.split(':')[0]) + parseInt(a.end.split(':')[1] || '0') / 60;
      return sum + Math.max(0, e - s);
    }, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <BrandBar />
        <ScreenHeader
          title="My rota"
          subtitle={weekJobCount ? `${weekJobCount} ${weekJobCount === 1 ? 'job' : 'jobs'} this week` : 'Jobs on any day, plus the hours you are free'}
          right={
            selected !== today ? (
              <TouchableOpacity style={styles.todayChip} onPress={() => select(today)} accessibilityLabel="Jump to today">
                <Ionicons name="today-outline" size={15} color={COLORS.primary} />
                <Text style={styles.todayChipText}>Today</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {/* Week strip */}
        <View style={styles.week} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <View style={styles.weekHead}>
            <TouchableOpacity onPress={() => shiftWeek(-1)} hitSlop={10} style={styles.weekNav} accessibilityLabel="Previous week">
              <Ionicons name="chevron-back" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.weekTitle}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => shiftWeek(1)} hitSlop={10} style={styles.weekNav} accessibilityLabel="Next week">
              <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((d, i) => {
              const on = d === selected;
              const count = jobsByDay.get(d)?.length || 0;
              const hol = holidayOn(d, holidayYear?.holidays);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayPill, on && styles.dayPillOn, d === today && !on && styles.dayPillToday]}
                  onPress={() => select(d)}
                  accessibilityLabel={`${longDay(d)}, ${count} ${count === 1 ? 'job' : 'jobs'}${hol ? ', holiday' : ''}`}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.dayPillDow, on && styles.dayPillTextOn]}>{DOW[i].charAt(0)}</Text>
                  <Text style={[styles.dayPillNum, on && styles.dayPillTextOn]}>{Number(d.slice(8))}</Text>
                  <View style={styles.dayPillMark}>
                    {hol ? (
                      <Ionicons name="sunny" size={10} color={on ? COLORS.white : '#f59e0b'} />
                    ) : count ? (
                      <View style={styles.dots}>
                        {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                          <View key={k} style={[styles.dot, on && styles.dotOn]} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day */}
        <Animated.View key={selected} entering={FadeIn.duration(220)}>
          <View style={styles.dayHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayTitle}>{dayHeading(selected, today).title}</Text>
              <Text style={styles.daySub}>{dayHeading(selected, today).sub}</Text>
            </View>
            {dayJobs.length ? (
              <View style={styles.dayStats}>
                <Text style={styles.dayStatMain}>{dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}</Text>
                <Text style={styles.dayStatSub}>
                  {formatHoursMinutes(dayHours)}{dayPay > 0 ? ` · £${dayPay.toFixed(2)}` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {onHoliday ? (
            <View style={styles.holidayNote}>
              <Ionicons name="sunny" size={18} color="#b45309" />
              <Text style={styles.holidayNoteText}>
                {onHoliday.status === 'Approved' ? 'You are on holiday' : 'Holiday requested (waiting for the office)'} · {holidayRange(onHoliday)}
              </Text>
            </View>
          ) : null}

          {dayJobs.length ? (
            dayJobs.map((job, i) => (
              <Animated.View key={job.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(260)}>
                <JobCard
                  booking={job}
                  pay={staff ? jobPay(job, staff.hourlyRate) : null}
                  onPress={() => router.push(`/booking/${job.id}`)}
                  actions={
                    job.status !== 'Completed' && selected >= today ? (
                      <IconAction icon="navigate-outline" label="Directions" onPress={() => openDirections(job)} />
                    ) : null
                  }
                />
              </Animated.View>
            ))
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title={onHoliday?.status === 'Approved' ? 'Enjoy your time off' : 'No jobs on this day'}
              body={
                onHoliday
                  ? onHoliday.status === 'Approved'
                    ? 'Nothing is booked for you while you are away.'
                    : 'Your holiday request for this day is waiting for the office.'
                  : selected < today
                    ? 'You had nothing assigned on this day.'
                    : 'New jobs appear here as soon as the office assigns them to you.'
              }
            />
          )}
        </Animated.View>

        {/* Holiday (contracted staff) */}
        {isContracted ? (
          <TouchableOpacity style={styles.holidayCard} onPress={() => router.push('/holiday')} activeOpacity={0.85}>
            <View style={styles.holidayIcon}>
              <Ionicons name="sunny-outline" size={22} color="#4338ca" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.holidayTitle}>Holiday</Text>
              <Text style={styles.holidaySub}>
                {holidayYear
                  ? `${pluralDays(holidayYear.balance.remaining)} left of ${holidayYear.balance.allowance}${holidayYear.balance.pending ? ` · ${pluralDays(holidayYear.balance.pending)} pending` : ''}`
                  : 'Book paid holiday and see what you have left'}
              </Text>
            </View>
            <View style={styles.holidayBtn}>
              <Text style={styles.holidayBtnText}>Book</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Availability */}
        <View style={styles.availCard}>
          <View style={styles.availHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.availTitle}>Weekly availability</Text>
              <Text style={styles.availSub}>
                {openDays} of 7 days · {Math.round(totalHours)} hrs a week · the office uses this when assigning jobs
              </Text>
            </View>
            {!editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)} accessibilityLabel="Edit availability">
                <Ionicons name="create-outline" size={15} color={COLORS.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!editing ? (
            <View style={styles.availList}>
              {availability.map((day) => (
                <View key={day.day} style={styles.availRow}>
                  <Text style={[styles.availDay, !day.isOpen && styles.dayNameOff]}>{day.day.slice(0, 3)}</Text>
                  {day.isOpen ? (
                    <View style={styles.availChip}>
                      <Text style={styles.availChipText}>{day.start} to {day.end}</Text>
                    </View>
                  ) : (
                    <Text style={styles.availOff}>Off</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: SPACING.md }}>
              {availability.map((day) => (
                <View key={day.day} style={[styles.dayCard, !day.isOpen && styles.dayCardOff]}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayLeft}>
                      <View style={[styles.dayDot, day.isOpen ? styles.dayDotOn : styles.dayDotOff]} />
                      <Text style={[styles.dayName, !day.isOpen && styles.dayNameOff]}>{day.day}</Text>
                    </View>
                    <Switch
                      value={day.isOpen}
                      onValueChange={() => toggleDay(day.day)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                      thumbColor={day.isOpen ? COLORS.primary : COLORS.textTertiary}
                    />
                  </View>
                  {day.isOpen && (
                    <View style={styles.dayTimes}>
                      <TouchableOpacity
                        style={styles.timeBlock}
                        onPress={() => setTimePicker({ day: day.day, field: 'start', value: day.start })}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.timeLabel}>Start</Text>
                        <View style={styles.timeValueRow}>
                          <Text style={styles.timeValue}>{day.start}</Text>
                          <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
                        </View>
                      </TouchableOpacity>
                      <Ionicons name="arrow-forward" size={14} color={COLORS.textTertiary} />
                      <TouchableOpacity
                        style={styles.timeBlock}
                        onPress={() => setTimePicker({ day: day.day, field: 'end', value: day.end })}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.timeLabel}>End</Text>
                        <View style={styles.timeValueRow}>
                          <Text style={styles.timeValue}>{day.end}</Text>
                          <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save availability'}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {timePicker && (
        <TimePickerModal
          visible
          value={timePicker.value}
          label={`${timePicker.day} - ${timePicker.field === 'start' ? 'Start' : 'End'} Time`}
          onSelect={(time) => updateTime(timePicker.day, timePicker.field, time)}
          onClose={() => setTimePicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  todayChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.primary + '12' },
  todayChipText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  week: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.md, marginBottom: SPACING.lg },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  weekNav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  weekTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14 },
  dayPillOn: { backgroundColor: COLORS.primary },
  dayPillToday: { backgroundColor: COLORS.primary + '12' },
  dayPillDow: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary },
  dayPillNum: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  dayPillTextOn: { color: COLORS.white },
  dayPillMark: { height: 10, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  dotOn: { backgroundColor: COLORS.white },

  dayHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: SPACING.md },
  dayTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  daySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dayStats: { alignItems: 'flex-end' },
  dayStatMain: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  dayStatSub: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginTop: 2 },
  holidayNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  holidayNoteText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400e' },

  holidayCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#eef2ff', borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg, borderWidth: 1, borderColor: '#e0e7ff' },
  holidayIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  holidayTitle: { fontSize: 15, fontWeight: '800', color: '#312e81' },
  holidaySub: { fontSize: 12.5, color: '#4338ca', marginTop: 2 },
  holidayBtn: { backgroundColor: '#4f46e5', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  holidayBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },

  availCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.base, marginTop: SPACING.lg },
  availHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  availTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  availSub: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3, lineHeight: 17 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  availList: { marginTop: SPACING.md },
  availRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  availDay: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  availChip: { backgroundColor: COLORS.successLight, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  availChipText: { fontSize: 12.5, fontWeight: '700', color: '#065f46' },
  availOff: { fontSize: 13, fontWeight: '600', color: COLORS.textTertiary },
  editActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: { flex: 1, paddingVertical: 15, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  header: { paddingTop: SPACING.lg, marginBottom: SPACING.lg },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 4,
  },
  summaryNum: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary },
  dayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dayCardOff: { opacity: 0.6 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayDotOn: { backgroundColor: '#22c55e' },
  dayDotOff: { backgroundColor: COLORS.textTertiary },
  dayName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  dayNameOff: { color: COLORS.textTertiary },
  dayTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  timeBlock: { alignItems: 'center' },
  timeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase' },
  timeValue: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  timeValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.lg },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  pickerCol: { alignItems: 'center', flex: 1 },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', marginBottom: SPACING.sm },
  pickerScroll: { maxHeight: 200 },
  pickerScrollContent: { paddingVertical: SPACING.xs },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: 4,
    alignItems: 'center',
  },
  pickerItemActive: { backgroundColor: COLORS.primary },
  pickerItemText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  pickerItemTextActive: { color: COLORS.white },
  pickerColon: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginTop: SPACING.lg },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
