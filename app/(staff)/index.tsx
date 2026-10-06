import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { staffApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { StatsSkeleton, ListSkeleton } from '../../components/SkeletonLoader';
import { useHaptic } from '../../hooks/useHaptic';
import { AnimatedListItem } from '../../components/AnimatedListItem';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking } from '../../types';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<DayFilter>('today');

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchBookings = useCallback(async () => {
    try {
      const data = await staffApi.getBookings();
      setBookings(data.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    } catch {
      showToast('Could not load schedule', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const filtered = bookings.filter((b) => {
    if (b.status === 'Cancelled') return false;
    if (filter === 'today') return b.date === todayStr;
    if (filter === 'upcoming') return b.date > todayStr;
    return b.date < todayStr && b.status === 'Completed';
  });

  const todayCount = bookings.filter((b) => b.date === todayStr && b.status !== 'Cancelled').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <StatsSkeleton />
        <ListSkeleton count={3} type="card" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.logoRow}>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>On Duty</Text>
              <Text style={styles.dateSep}>{'·'}</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{todayCount}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {bookings.filter((b) => b.date > todayStr && b.status !== 'Cancelled').length}
          </Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {bookings.filter((b) => b.status === 'Completed').length}
          </Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {([
          { key: 'today' as const, label: 'Today' },
          { key: 'upcoming' as const, label: 'Upcoming' },
          { key: 'past' as const, label: 'Past' },
        ]).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => { haptic.light(); setFilter(f.key); }}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>
              {filter === 'today' ? 'No jobs today' : filter === 'upcoming' ? 'No upcoming jobs' : 'No past jobs'}
            </Text>
          </View>
        }
        renderItem={({ item: booking, index }) => (
          <AnimatedListItem index={index}>
          <TouchableOpacity style={styles.jobCard} activeOpacity={0.7} onPress={() => router.push(`/booking/${booking.id}`)}>
            <View style={styles.jobHeader}>
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                <Text style={styles.timeText}>{booking.time}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: booking.status === 'Completed' ? COLORS.status.completedBg : COLORS.status.confirmedBg }]}>
                <Text style={[styles.statusBadgeText, { color: booking.status === 'Completed' ? COLORS.status.completed : COLORS.status.confirmed }]}>
                  {booking.status}
                </Text>
              </View>
            </View>

            <Text style={styles.jobService}>{booking.serviceType.replace(/_/g, ' ')}</Text>

            <View style={styles.jobDetails}>
              <View style={styles.jobDetail}>
                <Ionicons name="person-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.jobDetailText}>{booking.contact?.name}</Text>
              </View>
              <View style={styles.jobDetail}>
                <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.jobDetailText} numberOfLines={1}>
                  {booking.address?.line1}, {booking.address?.postcode}
                </Text>
              </View>
            </View>

            <View style={styles.jobFooter}>
              <Text style={styles.jobPrice}>{'£'}{Number(booking.totalPrice).toFixed(2)}</Text>
              <View style={styles.jobActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    const addr = `${booking.address?.line1}, ${booking.address?.postcode}`;
                    const url = Platform.OS === 'ios'
                      ? `maps:?daddr=${encodeURIComponent(addr)}`
                      : `geo:0,0?q=${encodeURIComponent(addr)}`;
                    Linking.openURL(url).catch(() => {
                      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`);
                    });
                  }}
                >
                  <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                {booking.contact?.phone && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${booking.contact!.phone}`)}
                  >
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
          </AnimatedListItem>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  greeting: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  dateSep: { color: COLORS.textTertiary, fontSize: 12 },
  dateText: { fontSize: 12, color: COLORS.textTertiary },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  timeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  jobService: { fontSize: 16, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize', marginBottom: SPACING.sm },
  jobDetails: { gap: 6, marginBottom: SPACING.sm },
  jobDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobDetailText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  jobPrice: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  jobActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
