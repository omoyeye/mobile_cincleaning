import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ListSkeleton, StatsSkeleton } from '../../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { BrandBar, Card, EmptyState, ScreenHeader, SectionTitle, StatusBadge, findMe, jobPay, localWeekRange } from '../../components/staff/StaffKit';
import type { Booking, ClaimableHoliday, ClaimableReferral, Staff, StaffInvoice } from '../../types';
import { holidayRange, pluralDays } from '../../components/staff/HolidayKit';
import { formatHoursMinutes } from '../../utils/duration';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';

type WeekJob = { id: number; date: string; customer: string; staffCount: number; bookedHours: number; yourHours: number; hourlyRate: number; yourShare: number };
type WeekInvoice = { weekStart: string; weekEnd: string; jobs: WeekJob[]; totalShare: number };

function MiniBarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <Card style={{ marginBottom: SPACING.base }}>
      <Text style={chartStyles.title}>Last 6 weeks</Text>
      <View style={chartStyles.chart}>
        {data.map((val, i) => (
          <View key={i} style={chartStyles.barCol}>
            {val > 0 ? <Text style={chartStyles.barValue}>{'£'}{val.toFixed(0)}</Text> : <Text style={chartStyles.barValue}> </Text>}
            <View style={chartStyles.barTrack}>
              <View style={[chartStyles.barFill, { height: `${Math.max((val / max) * 100, 3)}%`, backgroundColor: i === data.length - 1 ? COLORS.secondary : val > 0 ? COLORS.primary : COLORS.border }]} />
            </View>
            <Text style={chartStyles.barLabel}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const shortDate = (ymd: string) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ymd;
};

export default function EarningsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [week, setWeek] = useState<WeekInvoice | null>(null);
  const [invoices, setInvoices] = useState<StaffInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => fetchData());
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  // Approved holiday that has started and not been claimed yet (contracted staff only).
  const [claimable, setClaimable] = useState<ClaimableHoliday[]>([]);
  const [holidayIds, setHolidayIds] = useState<number[]>([]);
  // Referral bonuses that unlocked and are not on an invoice yet.
  const [bonuses, setBonuses] = useState<ClaimableReferral[]>([]);
  const [bonusIds, setBonusIds] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [bks, profiles] = await Promise.all([staffApi.getBookings(), staffApi.getStaffList()]);
      const me = findMe(profiles, user);
      setStaff(me);
      setBookings(bks.filter((b) => b.status === 'Completed').sort((a, b) => b.date.localeCompare(a.date)));
      if (me) {
        const [hist, weekly] = await Promise.all([
          staffApi.getInvoiceHistory(me.id).catch(() => [] as StaffInvoice[]),
          staffApi.getWeeklyInvoice(me.id).catch(() => null),
        ]);
        setInvoices(Array.isArray(hist) ? hist : []);
        setWeek(weekly && Array.isArray(weekly.jobs) ? (weekly as WeekInvoice) : null);
        const ref = await staffApi.getReferralSummary().catch(() => null);
        const claimableBonuses = ref?.claimable ?? [];
        setBonuses(claimableBonuses);
        setBonusIds(claimableBonuses.map((b) => b.id));
        if (me.contractType === 'contracted') {
          const hol = await staffApi.getHolidays(me.id).catch(() => null);
          const list = hol?.claimable ?? [];
          setClaimable(list);
          setHolidayIds(list.map((h) => h.id));
        } else {
          setClaimable([]);
          setHolidayIds([]);
        }
      }
    } catch {
      showToast('Could not load earnings data', 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // Pay is always the cleaner's share: booked hours ÷ people on the job × hourly rate (never the client's price).
  const rate = Number(staff?.hourlyRate) || 0;
  const payOf = (b: Booking) => jobPay(b, rate).pay;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const sumFor = (prefix: string) => bookings.filter((b) => b.date.startsWith(prefix)).reduce((s, b) => s + payOf(b), 0);
  const thisMonthEarnings = sumFor(thisMonth);
  const lastMonthEarnings = sumFor(lastMonth);
  const totalEarnings = bookings.reduce((s, b) => s + payOf(b), 0);

  const weekRange = week ? { start: week.weekStart, end: week.weekEnd } : localWeekRange();
  const weekTotal = week ? Number(week.totalShare || 0) : 0;
  const weekJobs = week?.jobs ?? [];
  const weekHours = weekJobs.reduce((s, j) => s + Number(j.yourHours || 0), 0);
  const isContracted = staff?.contractType === 'contracted';
  const pickedHolidays = claimable.filter((h) => holidayIds.includes(h.id));
  const holidayTotal = pickedHolidays.reduce((s, h) => s + h.amount, 0);
  const holidayHours = pickedHolidays.reduce((s, h) => s + h.hours, 0);
  const pickedBonuses = bonuses.filter((b) => bonusIds.includes(b.id));
  const bonusTotal = pickedBonuses.reduce((s, b) => s + b.amount, 0);
  const extrasTotal = holidayTotal + bonusTotal;
  const canSubmit = weekJobs.length > 0 || pickedHolidays.length > 0 || pickedBonuses.length > 0;
  const toggleBonus = (id: number) =>
    setBonusIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const toggleHoliday = (id: number) =>
    setHolidayIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const chart = (() => {
    const data: number[] = [];
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now);
      ref.setDate(ref.getDate() - i * 7);
      const { start, end } = localWeekRange(ref);
      data.push(bookings.filter((b) => b.date >= start && b.date <= end).reduce((s, b) => s + payOf(b), 0));
      const [, m, d] = start.split('-').map(Number);
      labels.push(`${d}/${m}`);
    }
    return { data, labels };
  })();

  const handleSubmitInvoice = async () => {
    if (!staff) return;
    if (!canSubmit) {
      Alert.alert('Nothing to invoice yet', `You have no completed jobs this week${isContracted ? ', holiday pay' : ''} or referral bonuses to claim.`);
      return;
    }
    if (!staff.bankName || !staff.accountNumber || !staff.sortCode) {
      Alert.alert('Add your bank details', 'We need your bank details before you can submit an invoice.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add bank details', onPress: () => router.push('/bank-details') },
      ]);
      return;
    }
    setSubmittingInvoice(true);
    try {
      await staffApi.submitInvoice(staff.id, {
        totalAmount: weekTotal,
        jobs: weekJobs,
        week: `${weekRange.start} → ${weekRange.end}`,
        bankDetails: { bankName: staff.bankName, accountNumber: staff.accountNumber, sortCode: staff.sortCode },
        weekTotalHours: weekHours,
        weekJobCount: weekJobs.length,
        holidayIds: pickedHolidays.map((h) => h.id),
        referralRewardIds: pickedBonuses.map((b) => b.id),
      });
      showToast(`Invoice for £${(weekTotal + extrasTotal).toFixed(2)} submitted`, 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not submit invoice', 'error');
    }
    setSubmittingInvoice(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandBar />
        <StatsSkeleton />
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <BrandBar />
        <ScreenHeader
          title="Earnings"
          subtitle="Your pay and weekly invoices."
          right={staff ? <Text style={styles.rate}>{'£'}{rate.toFixed(2)}/hr</Text> : null}
        />

        {/* This week */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>
            This week · {shortDate(weekRange.start)} to {shortDate(weekRange.end)}
          </Text>
          <Text style={styles.heroValue}>{'£'}{(weekTotal + extrasTotal).toFixed(2)}</Text>
          <Text style={styles.heroSub}>
            {weekJobs.length} {weekJobs.length === 1 ? 'job' : 'jobs'} · {formatHoursMinutes(weekHours + holidayHours)} of your hours
            {pickedHolidays.length ? ` · includes £${holidayTotal.toFixed(2)} holiday pay` : ''}
            {pickedBonuses.length ? ` · + £${bonusTotal.toFixed(2)} referral bonus` : ''}
          </Text>
          {staff ? (
            <TouchableOpacity
              style={[styles.heroBtn, (submittingInvoice || !canSubmit) && { opacity: 0.6 }]}
              onPress={handleSubmitInvoice}
              disabled={submittingInvoice}
              activeOpacity={0.85}
            >
              {submittingInvoice ? (
                <ActivityIndicator color={COLORS.secondary} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color={COLORS.secondary} />
                  <Text style={styles.heroBtnText}>Submit weekly invoice</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          {[
            { icon: 'calendar-outline' as const, value: thisMonthEarnings, label: now.toLocaleDateString(undefined, { month: 'long' }), color: COLORS.primary },
            { icon: 'time-outline' as const, value: lastMonthEarnings, label: 'Last month', color: '#6366f1' },
            { icon: 'trending-up-outline' as const, value: totalEarnings, label: 'All time', color: COLORS.secondary },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={18} color={s.color} />
              <Text style={styles.statValue}>{'£'}{s.value.toFixed(2)}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {isContracted ? (
          <>
            <SectionTitle
              right={
                <TouchableOpacity onPress={() => router.push('/holiday')} hitSlop={8} style={styles.linkRow}>
                  <Ionicons name="sunny-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.link}>Holiday</Text>
                </TouchableOpacity>
              }
            >
              Holiday pay
            </SectionTitle>
            {claimable.length === 0 ? (
              <Card style={{ marginBottom: SPACING.base }}>
                <Text style={styles.muted}>No holiday pay waiting. It shows here once an approved holiday has started.</Text>
              </Card>
            ) : (
              <Card style={{ paddingVertical: 4, marginBottom: SPACING.base }}>
                {claimable.map((h, i) => {
                  const on = holidayIds.includes(h.id);
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.row, i < claimable.length - 1 && styles.rowBorder]}
                      onPress={() => toggleHoliday(h.id)}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{holidayRange(h)}</Text>
                        <Text style={styles.rowMeta}>
                          {pluralDays(h.days)} · {formatHoursMinutes(h.hours)} × {'£'}{h.hourlyRate.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.rowAmount}>{'£'}{h.amount.toFixed(2)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}
          </>
        ) : null}

        {bonuses.length > 0 ? (
          <>
            <SectionTitle
              right={
                <TouchableOpacity onPress={() => router.push('/referrals')} hitSlop={8} style={styles.linkRow}>
                  <Ionicons name="gift-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.link}>Referrals</Text>
                </TouchableOpacity>
              }
            >
              Referral bonuses
            </SectionTitle>
            <Card style={{ paddingVertical: 4, marginBottom: SPACING.base }}>
              {bonuses.map((b, i) => {
                const on = bonusIds.includes(b.id);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.row, i < bonuses.length - 1 && styles.rowBorder]}
                    onPress={() => toggleBonus(b.id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{b.friendName}</Text>
                      <Text style={styles.rowMeta}>Referral bonus · first clean done</Text>
                    </View>
                    <Text style={styles.rowAmount}>{'£'}{b.amount.toFixed(2)}</Text>
                  </TouchableOpacity>
                );
              })}
            </Card>
          </>
        ) : null}

        {bookings.length > 0 && <MiniBarChart data={chart.data} labels={chart.labels} />}

        <SectionTitle>This week's jobs</SectionTitle>
        {weekJobs.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No completed jobs this week" body="Finished jobs show up here with your pay." />
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {weekJobs.map((j, i) => (
              <View key={j.id} style={[styles.row, i < weekJobs.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {j.customer || 'Client'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {shortDate(j.date)} · {formatHoursMinutes(Number(j.yourHours))} × {'£'}
                    {Number(j.hourlyRate).toFixed(2)}
                    {j.staffCount > 1 ? ` · team of ${j.staffCount}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{'£'}{Number(j.yourShare).toFixed(2)}</Text>
              </View>
            ))}
          </Card>
        )}

        <SectionTitle>Recent completed jobs</SectionTitle>
        {bookings.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No earnings yet" body="Your pay appears here once you complete a job." />
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {bookings.slice(0, 10).map((b, i, arr) => {
              const { hours, pay } = jobPay(b, rate);
              return (
                <View key={b.id} style={[styles.row, i < arr.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {b.contact?.name || String(b.serviceType).replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {shortDate(b.date)} · {formatHoursMinutes(hours)}
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>{'£'}{pay.toFixed(2)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {invoices.length > 0 && (
          <>
            <SectionTitle>Submitted invoices</SectionTitle>
            {invoices.map((inv) => (
              <Card key={inv.id} style={{ marginBottom: SPACING.sm }}>
                <View style={styles.invoiceTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{inv.weekLabel}</Text>
                    <Text style={styles.rowMeta}>
                      {inv.weekJobCount || 0} jobs{inv.weekTotalHours ? ` · ${formatHoursMinutes(Number(inv.weekTotalHours))}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.invoiceAmount}>{'£'}{Number(inv.totalAmount).toFixed(2)}</Text>
                    <StatusBadge status={inv.status} />
                  </View>
                </View>
                {inv.adminNotes ? (
                  <View style={styles.note}>
                    <Text style={styles.noteLabel}>Note from the office</Text>
                    <Text style={styles.noteText}>{inv.adminNotes}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const chartStyles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xs, height: 130 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '62%', height: 84, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: RADIUS.sm },
  barLabel: { fontSize: 10, color: COLORS.textTertiary, marginTop: 4, fontWeight: '600' },
  barValue: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 3 },
});

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  muted: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  rate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.base,
    overflow: 'hidden',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  heroGlow: { position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroValue: { fontSize: 36, fontWeight: '700', color: COLORS.white, marginTop: 4, letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroBtn: {
    marginTop: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
  },
  heroBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.secondary },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.base },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
  },
  statValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: COLORS.secondary },
  invoiceTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  note: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  noteLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  noteText: { fontSize: 14, color: COLORS.text, marginTop: 2 },
});
