import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { goBack } from '../utils/navigation';
import { staffApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useHaptic } from '../hooks/useHaptic';
import { BrandRefresh } from '../components/BrandRefresh';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { EmptyState, findMe } from '../components/staff/StaffKit';
import { RangeCalendar, countHolidayDays, holidayRange, pluralDays } from '../components/staff/HolidayKit';
import { formatHoursMinutes } from '../utils/duration';
import type { StaffHoliday, StaffHolidayYear } from '../types';

type FormState = { id: number | null; startDate: string; endDate: string; halfDay: boolean; note: string };

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  Pending: { label: 'Pending', fg: '#b45309', bg: COLORS.warningLight },
  Confirmed: { label: 'Confirmed', fg: COLORS.success, bg: COLORS.successLight },
  Taken: { label: 'Taken', fg: COLORS.textSecondary, bg: COLORS.surfaceAlt },
  Rejected: { label: 'Not approved', fg: COLORS.error, bg: COLORS.errorLight },
};

/** The native confirm dialog does not exist in the web build, so fall back to the browser's. */
function confirmAsync(title: string, message: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Keep it', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function HolidayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const [staffId, setStaffId] = useState<number | null>(null);
  const [data, setData] = useState<StaffHolidayYear | null>(null);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      let id = staffId;
      if (!id) {
        const me = findMe(await staffApi.getStaffList(), user);
        id = me?.id ?? null;
        setStaffId(id);
      }
      if (!id) throw new Error('Staff profile not found');
      setData(await staffApi.getHolidays(id, year));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [staffId, user, year]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = usePullRefresh(() => load());

  const sorted = useMemo(
    () => [...(data?.holidays ?? [])].filter((h) => h.status !== 'Cancelled').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [data],
  );

  const formEnd = form ? form.endDate || form.startDate : '';
  const formDays = form ? countHolidayDays(form.startDate, formEnd, form.halfDay) : 0;
  const editingDays = form?.id ? data?.holidays.find((h) => h.id === form.id)?.days ?? 0 : 0;
  const availableForForm = data ? data.balance.remaining + editingDays : 0;
  const singleDay = !!form?.startDate && form.startDate === formEnd;

  const openNew = () => {
    if (!data) return;
    setError('');
    setForm({ id: null, startDate: '', endDate: '', halfDay: false, note: '' });
  };

  const openEdit = (h: StaffHoliday) => {
    setError('');
    setForm({ id: h.id, startDate: h.startDate, endDate: h.endDate, halfDay: h.halfDay, note: h.note || '' });
  };

  const save = async () => {
    if (!form || !staffId) return;
    setError('');
    if (!form.startDate) return setError('Tap the first day of your holiday on the calendar.');
    if (formDays <= 0) return setError('Those dates are only weekends. Choose at least one weekday.');
    if (formDays > availableForForm) return setError(`That is ${pluralDays(formDays)}, but you have ${pluralDays(availableForForm)} left.`);
    setSaving(true);
    try {
      const body = { startDate: form.startDate, endDate: formEnd, halfDay: form.halfDay && singleDay, note: form.note.trim() };
      if (form.id) await staffApi.updateHoliday(form.id, body);
      else await staffApi.createHoliday(staffId, body);
      haptic.success();
      showToast(form.id ? 'Holiday request updated' : 'Holiday requested. The office will confirm it soon.', 'success');
      setForm(null);
      await load();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Could not save your holiday.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (h: StaffHoliday) => {
    const ok = await confirmAsync('Cancel holiday request', `Cancel your request for ${holidayRange(h)}?`, 'Cancel request');
    if (!ok) return;
    try {
      await staffApi.cancelHoliday(h.id);
      showToast('Holiday request cancelled', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not cancel', 'error');
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => goBack(router, '/(staff)/rota')} style={styles.backBtn} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Holiday</Text>
      <View style={{ width: 36 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (failed || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={styles.pad}>
          <EmptyState icon="cloud-offline-outline" title="Could not load your holiday" body="Check your connection and pull down to try again." />
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data.staff.contracted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={styles.pad}>
          <EmptyState
            icon="sunny-outline"
            title="Holiday booking is for contracted staff"
            body="You are set up as self-employed, so paid holiday does not apply. If you think this is wrong, message the office."
          />
        </View>
      </SafeAreaView>
    );
  }

  const b = data.balance;
  const used = b.taken + b.confirmed + b.pending;
  const pct = (n: number) => (b.allowance ? `${Math.min(100, (n / b.allowance) * 100)}%` : '0%') as `${number}%`;
  const minDate = data.today > data.yearStart ? data.today : data.yearStart;
  const claimDays = data.claimable.reduce((s, c) => s + c.days, 0);
  const claimTotal = data.claimable.reduce((s, c) => s + c.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Allowance */}
        <Animated.View entering={FadeInDown.duration(320)}>
          <LinearGradient colors={['#0284c7', '#4f46e5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroEyebrow}>Holiday year · {data.yearLabel}</Text>
              <View style={styles.yearToggle}>
                {[data.currentYear, data.currentYear + 1].map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => { if (y !== data.year) { setYear(y); setLoading(true); } }}
                    style={[styles.yearBtn, data.year === y && styles.yearBtnOn]}
                  >
                    <Text style={[styles.yearText, data.year === y && styles.yearTextOn]}>{y === data.currentYear ? 'This year' : 'Next year'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={styles.heroValue}>
              {b.remaining}
              <Text style={styles.heroOf}>  of {b.allowance} days left</Text>
            </Text>
            <View style={styles.bar}>
              <View style={[styles.barSeg, { width: pct(b.taken), backgroundColor: '#ffffff' }]} />
              <View style={[styles.barSeg, { width: pct(b.confirmed), backgroundColor: '#6ee7b7' }]} />
              <View style={[styles.barSeg, { width: pct(b.pending), backgroundColor: '#fcd34d' }]} />
            </View>
            <Text style={styles.heroSub}>
              {pluralDays(used)} booked · holiday pay £{data.staff.dailyPay.toFixed(2)} a day ({formatHoursMinutes(data.staff.hoursPerDay)} × £{data.staff.hourlyRate.toFixed(2)})
            </Text>
            <TouchableOpacity
              style={[styles.heroBtn, b.remaining <= 0 && { opacity: 0.6 }]}
              onPress={openNew}
              disabled={b.remaining <= 0}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#4338ca" />
              <Text style={styles.heroBtnText}>{b.remaining <= 0 ? 'No holiday left this year' : 'Book holiday'}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Breakdown */}
        <View style={styles.tiles}>
          {[
            { label: 'Taken', value: b.taken, icon: 'checkmark-done-outline' as const, color: COLORS.textSecondary },
            { label: 'Confirmed', value: b.confirmed, icon: 'calendar-outline' as const, color: COLORS.success },
            { label: 'Pending', value: b.pending, icon: 'hourglass-outline' as const, color: '#b45309' },
            { label: 'Left', value: b.remaining, icon: 'sunny-outline' as const, color: COLORS.primary },
          ].map((t) => (
            <View key={t.label} style={styles.tile}>
              <Ionicons name={t.icon} size={18} color={t.color} />
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {data.claimable.length > 0 ? (
          <TouchableOpacity style={styles.claim} onPress={() => router.push('/(staff)/earnings')} activeOpacity={0.85}>
            <Ionicons name="cash-outline" size={20} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.claimTitle}>Holiday pay ready: £{claimTotal.toFixed(2)}</Text>
              <Text style={styles.claimBody}>{pluralDays(claimDays)} to claim. Add it to your weekly invoice in Earnings.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.success} />
          </TouchableOpacity>
        ) : null}

        {/* Requests */}
        <Text style={styles.section}>Your holiday</Text>
        {sorted.length === 0 ? (
          <EmptyState icon="sunny-outline" title="No holiday booked yet" body="Tap Book holiday to request time off. The office confirms it." />
        ) : (
          sorted.map((h, i) => {
            const past = h.endDate < data.today;
            const key = h.status === 'Approved' ? (past ? 'Taken' : 'Confirmed') : h.status;
            const tone = STATUS[key] || STATUS.Pending;
            const editable = h.status === 'Pending' || h.status === 'Rejected';
            return (
              <Animated.View key={h.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(280)} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemRange}>{holidayRange(h)}</Text>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.itemSub}>
                  {h.halfDay ? 'Half day' : pluralDays(h.days)}
                  {h.payStatus === 'paid' ? ' · paid' : h.payStatus === 'claimed' ? ' · on an invoice' : ''}
                  {h.note ? ` · ${h.note}` : ''}
                </Text>
                {h.adminNote ? <Text style={styles.office}>Office: {h.adminNote}</Text> : null}
                {h.status === 'Rejected' ? <Text style={styles.hint}>Change the dates to send it again.</Text> : null}
                {editable ? (
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actBtn} onPress={() => openEdit(h)}>
                      <Ionicons name="create-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.actText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actBtn} onPress={() => cancel(h)}>
                      <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                      <Text style={[styles.actText, { color: COLORS.error }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : h.status === 'Approved' && !past ? (
                  <Text style={styles.hint}>To change confirmed holiday, message the office.</Text>
                ) : null}
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Book / change sheet */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setForm(null)} />
          {form ? (
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.base) }]}>
              <View style={styles.grabber} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{form.id ? 'Change holiday request' : 'Book holiday'}</Text>
                    <Text style={styles.sheetSub}>Tap your first day, then your last day. Weekends are free.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setForm(null)} hitSlop={10} accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <RangeCalendar
                  start={form.startDate}
                  end={form.endDate}
                  min={minDate}
                  max={data.yearEnd}
                  onChange={({ start, end }) => {
                    setError('');
                    setForm((f) => f && { ...f, startDate: start, endDate: end, halfDay: start === end ? f.halfDay : false });
                  }}
                />

                {singleDay ? (
                  <View style={styles.halfRow}>
                    <Text style={styles.halfText}>Half day only</Text>
                    <Switch
                      value={form.halfDay}
                      onValueChange={(v) => setForm((f) => f && { ...f, halfDay: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
                      thumbColor={form.halfDay ? COLORS.primary : '#f4f4f5'}
                    />
                  </View>
                ) : null}

                <Text style={styles.noteLabel}>Note for the office (optional)</Text>
                <TextInput
                  style={styles.note}
                  value={form.note}
                  onChangeText={(v) => setForm((f) => f && { ...f, note: v })}
                  placeholder="e.g. Family wedding"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                />

                <View style={[styles.summary, formDays > availableForForm && styles.summaryBad]}>
                  {formDays > 0 ? (
                    <Text style={[styles.summaryText, formDays > availableForForm && { color: '#9b1c14' }]}>
                      <Text style={styles.bold}>{holidayRange({ startDate: form.startDate, endDate: formEnd })}</Text>
                      {'\n'}
                      {form.halfDay && singleDay ? 'Half day' : pluralDays(formDays)} · {pluralDays(Math.max(0, availableForForm - formDays))} left after this · holiday pay about £{(formDays * data.staff.dailyPay).toFixed(2)}
                    </Text>
                  ) : (
                    <Text style={styles.summaryText}>
                      {form.startDate ? 'Those dates are only weekends.' : 'Pick your dates to see how many days this uses.'}
                    </Text>
                  )}
                </View>

                {error ? (
                  <View style={styles.error}>
                    <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.sendBtn, (saving || formDays <= 0) && { opacity: 0.6 }]}
                  onPress={save}
                  disabled={saving || formDays <= 0}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.sendText}>{form.id ? 'Save changes' : 'Send request'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: SPACING.lg },
  retryBtn: { alignSelf: 'center', marginTop: SPACING.base, paddingHorizontal: SPACING.xl, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  retryText: { color: COLORS.white, fontWeight: '700' },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },

  hero: { borderRadius: RADIUS.xl, padding: SPACING.lg, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, flexWrap: 'wrap' },
  heroEyebrow: { color: '#e0f2fe', fontSize: 13, fontWeight: '600' },
  yearToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: 3 },
  yearBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  yearBtnOn: { backgroundColor: COLORS.white },
  yearText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  yearTextOn: { color: '#0369a1' },
  heroValue: { color: COLORS.white, fontSize: 40, fontWeight: '800', marginTop: SPACING.sm, letterSpacing: -0.5 },
  heroOf: { fontSize: 16, fontWeight: '600', color: '#e0f2fe' },
  bar: { flexDirection: 'row', height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.22)', marginTop: SPACING.md },
  barSeg: { height: '100%' },
  heroSub: { color: '#e0f2fe', fontSize: 12, marginTop: SPACING.sm, lineHeight: 17 },
  heroBtn: {
    marginTop: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
  },
  heroBtnText: { color: '#4338ca', fontWeight: '800', fontSize: 15 },

  tiles: { flexDirection: 'row', gap: SPACING.sm },
  tile: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, paddingVertical: SPACING.md, alignItems: 'center', gap: 2 },
  tileValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  tileLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary },

  claim: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.successLight, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#a7f3d0' },
  claimTitle: { fontSize: 14, fontWeight: '800', color: '#065f46' },
  claimBody: { fontSize: 12.5, color: '#047857', marginTop: 2 },

  section: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.sm },
  item: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.base },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  itemRange: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  itemSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  office: { fontSize: 13, color: COLORS.text, marginTop: 6 },
  hint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 6 },
  itemActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  actText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,31,51,0.45)' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, maxHeight: '92%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.md },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  halfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.borderLight },
  halfText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  noteLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.base, marginBottom: 6 },
  note: { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 64, fontSize: 15, color: COLORS.text, textAlignVertical: 'top' },
  summary: { marginTop: SPACING.md, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md },
  summaryBad: { backgroundColor: COLORS.errorLight },
  summaryText: { fontSize: 13.5, color: COLORS.text, lineHeight: 20 },
  bold: { fontWeight: '800' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.error },
  sendBtn: { marginTop: SPACING.base, marginBottom: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center' },
  sendText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
