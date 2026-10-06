import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ListSkeleton, StatsSkeleton } from '../../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking, Staff, StaffInvoice } from '../../types';

function MiniBarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>Weekly Earnings</Text>
      <View style={chartStyles.chart}>
        {data.map((val, i) => (
          <View key={i} style={chartStyles.barCol}>
            <View style={chartStyles.barTrack}>
              <View
                style={[
                  chartStyles.barFill,
                  {
                    height: `${Math.max((val / max) * 100, 2)}%`,
                    backgroundColor: val > 0 ? COLORS.primary : COLORS.border,
                  },
                ]}
              />
            </View>
            <Text style={chartStyles.barLabel}>{labels[i]}</Text>
            {val > 0 && <Text style={chartStyles.barValue}>{'£'}{val.toFixed(0)}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [invoices, setInvoices] = useState<StaffInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [bks, profiles] = await Promise.all([
        staffApi.getBookings(),
        staffApi.getStaffList(),
      ]);
      const me = profiles.find((s: Staff) => s.email === user?.email);
      setStaff(me || null);
      setBookings(bks.filter((b) => b.status === 'Completed').sort((a, b) => b.date.localeCompare(a.date)));
      if (me) {
        try {
          const hist = await staffApi.getInvoiceHistory(me.id);
          setInvoices(hist);
        } catch {}
      }
    } catch {
      showToast('Could not load earnings data', 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const thisWeekStart = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split('T')[0];
  })();

  const calcEarnings = (datePrefix: string) =>
    bookings
      .filter((b) => b.date.startsWith(datePrefix))
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);

  const getWeeklyChartData = () => {
    const weeks: number[] = [];
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      const weekTotal = bookings
        .filter((b) => b.date >= startStr && b.date <= endStr)
        .reduce((sum, b) => sum + Number(b.totalPrice), 0);
      weeks.push(weekTotal);
      labels.push(`${weekStart.getDate()}/${weekStart.getMonth() + 1}`);
    }
    return { data: weeks, labels };
  };

  const handleSubmitInvoice = async () => {
    if (!staff) return;
    setSubmittingInvoice(true);
    try {
      const weekJobs = bookings.filter((b) => b.date >= thisWeekStart);
      if (weekJobs.length === 0) {
        Alert.alert('No Jobs', 'You have no completed jobs this week to invoice.');
        setSubmittingInvoice(false);
        return;
      }
      const totalHours = weekJobs.reduce((sum, b) => sum + (b.propertyDetails?.duration || 0), 0);
      await staffApi.submitInvoice(staff.id, {
        totalAmount: thisWeekEarnings,
        jobs: weekJobs.map((b) => ({
          bookingId: b.id,
          date: b.date,
          service: b.serviceType,
          amount: b.totalPrice,
        })),
        week: thisWeekStart,
        bankDetails: { bankName: staff.bankName, accountNumber: staff.accountNumber, sortCode: staff.sortCode },
        weekTotalHours: totalHours,
        weekJobCount: weekJobs.length,
      });
      showToast('Weekly invoice submitted', 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not submit invoice', 'error');
    }
    setSubmittingInvoice(false);
  };

  const thisWeekEarnings = bookings
    .filter((b) => b.date >= thisWeekStart)
    .reduce((sum, b) => sum + Number(b.totalPrice), 0);

  const thisMonthEarnings = calcEarnings(thisMonth);
  const lastMonthEarnings = calcEarnings(lastMonth);
  const totalEarnings = bookings.reduce((sum, b) => sum + Number(b.totalPrice), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <StatsSkeleton />
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  const chartData = getWeeklyChartData();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          {staff && <Text style={styles.rate}>{'£'}{staff.hourlyRate}/hr</Text>}
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.mainLabel}>This Month</Text>
          <Text style={styles.mainValue}>{'£'}{thisMonthEarnings.toFixed(2)}</Text>
          <Text style={styles.mainSub}>
            {bookings.filter((b) => b.date.startsWith(thisMonth)).length} completed jobs
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{'£'}{thisWeekEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color="#6366f1" />
            <Text style={styles.statValue}>{'£'}{lastMonthEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Last Month</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={20} color="#22c55e" />
            <Text style={styles.statValue}>{'£'}{totalEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>All Time</Text>
          </View>
        </View>

        {bookings.length > 0 && (
          <MiniBarChart data={chartData.data} labels={chartData.labels} />
        )}

        <Text style={styles.sectionTitle}>Recent Jobs</Text>
        {bookings.slice(0, 10).map((booking) => (
          <View key={booking.id} style={styles.jobCard}>
            <View style={styles.jobLeft}>
              <Text style={styles.jobService}>{booking.serviceType.replace(/_/g, ' ')}</Text>
              <Text style={styles.jobDate}>
                {new Date(booking.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {booking.time}
              </Text>
            </View>
            <Text style={styles.jobAmount}>{'£'}{Number(booking.totalPrice).toFixed(2)}</Text>
          </View>
        ))}

        {bookings.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No earnings yet</Text>
          </View>
        )}

        {staff && (
          <TouchableOpacity
            style={[styles.invoiceBtn, submittingInvoice && styles.invoiceBtnDisabled]}
            onPress={handleSubmitInvoice}
            disabled={submittingInvoice}
          >
            {submittingInvoice ? (
              <Text style={styles.invoiceBtnText}>Submitting...</Text>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
                <Text style={styles.invoiceBtnText}>Submit Weekly Invoice</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {invoices.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Invoice History</Text>
            {invoices.map((inv) => {
              const statusColor = inv.status === 'Paid' ? COLORS.secondary : inv.status === 'Approved' ? COLORS.primary : COLORS.accentGold;
              return (
                <View key={inv.id} style={styles.invoiceCard}>
                  <View style={styles.invoiceLeft}>
                    <Text style={styles.invoiceWeek}>{inv.weekLabel}</Text>
                    <Text style={styles.invoiceMeta}>
                      {inv.weekJobCount || 0} jobs{inv.weekTotalHours ? ` · ${inv.weekTotalHours}h` : ''}
                    </Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={styles.invoiceAmount}>{'£'}{Number(inv.totalAmount).toFixed(2)}</Text>
                    <View style={[styles.invoiceStatusBadge, { backgroundColor: statusColor + '18' }]}>
                      <Text style={[styles.invoiceStatusText, { color: statusColor }]}>{inv.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xs, height: 120 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '70%',
    height: 80,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: RADIUS.sm },
  barLabel: { fontSize: 9, color: COLORS.textTertiary, marginTop: 4, fontWeight: '600' },
  barValue: { fontSize: 8, color: COLORS.primary, fontWeight: '700', marginTop: 1 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  rate: { fontSize: 14, fontWeight: '600', color: COLORS.primary, backgroundColor: COLORS.primary + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  mainCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  mainLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  mainValue: { fontSize: 36, fontWeight: '800', color: COLORS.white, marginVertical: 4 },
  mainSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  jobCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  jobLeft: {},
  jobService: { fontSize: 14, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  jobDate: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  jobAmount: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginTop: SPACING.lg,
  },
  invoiceBtnDisabled: { opacity: 0.6 },
  invoiceBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  invoiceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  invoiceLeft: {},
  invoiceWeek: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  invoiceMeta: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end' },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  invoiceStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm, marginTop: 4 },
  invoiceStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
