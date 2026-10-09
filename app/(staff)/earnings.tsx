import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ListSkeleton, StatsSkeleton } from '../../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { BrandBar, Card, EmptyState, ScreenHeader, SectionTitle, StatusBadge, findMe, jobPay, localWeekRange } from '../../components/staff/StaffKit';
import type { Booking, Staff, StaffInvoice } from '../../types';

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
  const [refreshing, setRefreshing] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

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
      }
    } catch {
      showToast('Could not load earnings data', 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

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
    if (weekJobs.length === 0) {
      Alert.alert('Nothing to invoice yet', 'You have no completed jobs this week.');
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
      });
      showToast(`Invoice for £${weekTotal.toFixed(2)} submitted`, 'success');
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
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
          <Text style={styles.heroValue}>{'£'}{weekTotal.toFixed(2)}</Text>
          <Text style={styles.heroSub}>
            {weekJobs.length} {weekJobs.length === 1 ? 'job' : 'jobs'} · {weekHours.toFixed(2)} of your hours
          </Text>
          {staff ? (
            <TouchableOpacity
              style={[styles.heroBtn, (submittingInvoice || weekJobs.length === 0) && { opacity: 0.6 }]}
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
                    {shortDate(j.date)} · {Number(j.yourHours).toFixed(2)}h × {'£'}
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
                      {shortDate(b.date)} · {hours.toFixed(2)}h
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
                      {inv.weekJobCount || 0} jobs{inv.weekTotalHours ? ` · ${Number(inv.weekTotalHours).toFixed(2)}h` : ''}
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
