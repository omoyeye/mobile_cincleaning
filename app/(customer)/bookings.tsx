import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { customerApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { useHaptic } from '../../hooks/useHaptic';
import { AnimatedListItem } from '../../components/AnimatedListItem';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking } from '../../types';

function getStatusColor(status: string) {
  switch (status) {
    case 'Pending': return { bg: COLORS.status.pendingBg, text: COLORS.status.pending };
    case 'Confirmed': return { bg: COLORS.status.confirmedBg, text: COLORS.status.confirmed };
    case 'In Progress': return { bg: COLORS.status.inProgressBg, text: COLORS.status.inProgress };
    case 'Completed': return { bg: COLORS.status.completedBg, text: COLORS.status.completed };
    case 'Cancelled': return { bg: COLORS.status.cancelledBg, text: COLORS.status.cancelled };
    default: return { bg: COLORS.surfaceAlt, text: COLORS.textSecondary };
  }
}

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

export default function BookingsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchBookings = useCallback(async () => {
    try {
      const data = await customerApi.getBookings();
      setBookings(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      showToast('Could not load bookings', 'error');
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
    if (filter === 'upcoming') return b.status === 'Pending' || b.status === 'Confirmed';
    if (filter === 'completed') return b.status === 'Completed';
    if (filter === 'cancelled') return b.status === 'Cancelled';
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Done' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <ListSkeleton count={4} type="card" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => { haptic.light(); setFilter(f.key); }}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No bookings found</Text>
          </View>
        }
        renderItem={({ item: booking, index }) => {
          const sc = getStatusColor(booking.status);
          return (
            <AnimatedListItem index={index}>
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push(`/booking/${booking.id}`)}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardService}>{booking.serviceType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.cardRef}>
                    {booking.bookingId || `#${booking.id}`}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.text }]}>{booking.status}</Text>
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.detailText}>
                    {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.detailText}>{booking.time}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {booking.address?.postcode}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>{'£'}{Number(booking.totalPrice).toFixed(2)}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
            </AnimatedListItem>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  headerLogo: { width: 140, height: 45 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardService: { fontSize: 15, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  cardRef: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexWrap: 'wrap',
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: COLORS.textSecondary },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  cardPrice: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
