import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { staffApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { StatsSkeleton, ListSkeleton } from '../../components/SkeletonLoader';
import { useHaptic } from '../../hooks/useHaptic';
import { AnimatedListItem } from '../../components/AnimatedListItem';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/config';
import { BrandBar, EmptyState, IconAction, JobCard, NextJobCard, ScreenHeader, findMe, jobPay, localYmd } from '../../components/staff/StaffKit';
import type { Booking, Staff } from '../../types';
import { PHOTOS } from '../../components/media';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type DayFilter = 'today' | 'upcoming' | 'past';

export default function StaffSchedule() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [me, setMe] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => fetchBookings());
  const [filter, setFilter] = useState<DayFilter>('today');
  const [week, setWeek] = useState<{ total: number; jobs: number; hours: number } | null>(null);

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const todayStr = localYmd();

  const fetchBookings = useCallback(async () => {
    try {
      const [data, staffList] = await Promise.all([staffApi.getBookings(), staffApi.getStaffList().catch(() => [] as Staff[])]);
      setBookings(data.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
      const mine = findMe(staffList, user);
      setMe(mine);
      // This week's pay for the Earnings card (Earnings has no tab of its own).
      if (mine) {
        staffApi
          .getWeeklyInvoice(mine.id)
          .then((w: any) => {
            const jobs = Array.isArray(w?.jobs) ? w.jobs : [];
            setWeek({ total: Number(w?.totalShare || 0), jobs: jobs.length, hours: jobs.reduce((t: number, j: any) => t + Number(j.yourHours || 0), 0) });
          })
          .catch(() => setWeek(null));
      }
    } catch {
      showToast('Could not load schedule', 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);


  const filtered = bookings.filter((b) => {
    if (b.status === 'Cancelled') return false;
    if (filter === 'today') return b.date === todayStr;
    if (filter === 'upcoming') return b.date > todayStr;
    return b.date < todayStr && b.status === 'Completed';
  });
  const shown = filter === 'past' ? [...filtered].reverse() : filtered;

  const isOpen = (b: Booking) => b.status === 'Pending' || b.status === 'Confirmed';
  const nextJob = bookings.find((b) => isOpen(b) && b.date >= todayStr) ?? null;
  const todayCount = bookings.filter((b) => b.date === todayStr && b.status !== 'Cancelled').length;
  const upcomingCount = bookings.filter((b) => b.date > todayStr && b.status !== 'Cancelled').length;
  const doneCount = bookings.filter((b) => b.status === 'Completed').length;

  const openDirections = (booking: Booking) => {
    const addr = `${booking.address?.line1}, ${booking.address?.postcode}`;
    const url = Platform.OS === 'ios' ? `maps:?daddr=${encodeURIComponent(addr)}` : `geo:0,0?q=${encodeURIComponent(addr)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`);
    });
  };

  const header = (
    <View>
      <BrandBar />
      <View style={styles.greetRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {getGreeting()}, {firstName}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>On duty</Text>
            <Text style={styles.dateSep}>·</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>
      </View>

      <ScreenHeader title="My schedule" subtitle="Your jobs for today and the days ahead." />

      {nextJob ? (
        <View style={{ marginBottom: SPACING.base }}>
          <NextJobCard booking={nextJob} onPress={() => router.push(`/booking/${nextJob.id}`)} />
        </View>
      ) : null}

      <View style={styles.statsRow}>
        {[
          { n: todayCount, label: 'Today', color: COLORS.primary, icon: 'today-outline' as const },
          { n: upcomingCount, label: 'Upcoming', color: '#6d52e8', icon: 'calendar-outline' as const },
          { n: doneCount, label: 'Completed', color: COLORS.secondary, icon: 'checkmark-done-outline' as const },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
            </View>
            <Text style={styles.statNum}>{s.n}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.earnCard}
        activeOpacity={0.85}
        onPress={() => router.push('/(staff)/earnings')}
        accessibilityRole="button"
        accessibilityLabel="Open earnings and weekly invoice"
      >
        <View style={styles.earnIcon}>
          <Ionicons name="wallet" size={20} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.earnLabel}>Earned this week</Text>
          <Text style={styles.earnValue}>{'£'}{(week?.total ?? 0).toFixed(2)}</Text>
          <Text style={styles.earnSub}>
            {week ? `${week.jobs} job${week.jobs === 1 ? '' : 's'} · ${week.hours.toFixed(1)} hrs` : 'Your pay and weekly invoice'}
          </Text>
        </View>
        <View style={styles.earnGo}>
          <Text style={styles.earnGoText}>Earnings</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.secondary} />
        </View>
      </TouchableOpacity>

      <View style={styles.segment}>
        {[
          { key: 'today' as const, label: 'Today' },
          { key: 'upcoming' as const, label: 'Upcoming' },
          { key: 'past' as const, label: 'Past' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.segmentBtn, filter === f.key && styles.segmentBtnActive]}
            onPress={() => {
              haptic.light();
              setFilter(f.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text style={[styles.segmentText, filter === f.key && styles.segmentTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandBar padded />
        <StatsSkeleton />
        <ListSkeleton count={3} type="card" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            photo={filter === 'past' ? PHOTOS.standard : PHOTOS.trolley}
            title={filter === 'today' ? 'Nothing booked today' : filter === 'upcoming' ? 'No upcoming jobs' : 'No past jobs yet'}
            body={filter === 'past' ? 'Completed jobs will appear here.' : 'New jobs appear here as soon as the office assigns them to you.'}
          />
        }
        renderItem={({ item: booking, index }) => (
          <AnimatedListItem index={index}>
            <JobCard
              booking={booking}
              pay={me ? jobPay(booking, me.hourlyRate) : null}
              onPress={() => router.push(`/booking/${booking.id}`)}
              actions={
                booking.status !== 'Completed' ? (
                  <>
                    <IconAction icon="navigate-outline" label="Directions" onPress={() => openDirections(booking)} />
                    {booking.contact?.phone ? (
                      <IconAction icon="call-outline" label="Call client" onPress={() => Linking.openURL(`tel:${booking.contact!.phone}`)} />
                    ) : null}
                  </>
                ) : null
              }
            />
          </AnimatedListItem>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  greeting: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.secondary },
  statusText: { fontSize: 12, fontWeight: '600', color: COLORS.secondary },
  dateSep: { color: COLORS.textTertiary, fontSize: 12 },
  dateText: { fontSize: 12, color: COLORS.textSecondary },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.base },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border + '66',
    ...SHADOW.card,
  },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 1 },

  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    marginBottom: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.secondary + '33',
    ...SHADOW.card,
  },
  earnIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.successLight, alignItems: 'center', justifyContent: 'center' },
  earnLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  earnValue: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4, marginTop: 1 },
  earnSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  earnGo: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.successLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  earnGoText: { fontSize: 12, fontWeight: '800', color: COLORS.secondary },

  segment: { flexDirection: 'row', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.md },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.sm },
  segmentBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  segmentTextActive: { color: COLORS.text },
});
