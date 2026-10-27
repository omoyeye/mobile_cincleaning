import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
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
import { ScreenHeader, BookingCard, FilterPills, EmptyState, isUpcoming } from '../../components/ClientKit';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';

type Filter = 'upcoming' | 'past' | 'cancelled' | 'all';

const stamp = (b: Booking) => `${b.date} ${b.time}`;

export default function BookingsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => fetchBookings());
  const [filter, setFilter] = useState<Filter>('upcoming');

  const fetchBookings = useCallback(async () => {
    try {
      setBookings(await customerApi.getBookings());
    } catch {
      showToast('Could not load bookings', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);


  const groups = useMemo(() => {
    const upcoming = bookings.filter(isUpcoming).sort((a, b) => stamp(a).localeCompare(stamp(b)));
    const cancelled = bookings.filter((b) => b.status === 'Cancelled').sort((a, b) => stamp(b).localeCompare(stamp(a)));
    const past = bookings
      .filter((b) => !isUpcoming(b) && b.status !== 'Cancelled')
      .sort((a, b) => stamp(b).localeCompare(stamp(a)));
    const all = [...bookings].sort((a, b) => stamp(b).localeCompare(stamp(a)));
    return { upcoming, past, cancelled, all };
  }, [bookings]);

  const list = groups[filter];
  const empty: Record<Filter, { title: string; body: string }> = {
    upcoming: { title: 'Nothing booked yet', body: 'Book a clean and it will show here with live updates on the day.' },
    past: { title: 'No past cleans', body: 'Completed cleans will appear here.' },
    cancelled: { title: 'No cancelled bookings', body: 'Good news, nothing has been cancelled.' },
    all: { title: 'No bookings yet', body: 'Your bookings will appear here.' },
  };

  const header = (
    <View style={styles.headerWrap}>
      <ScreenHeader
        title="My bookings"
        subtitle={groups.upcoming.length ? `${groups.upcoming.length} coming up` : 'All your cleans in one place'}
        right={
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/book')} accessibilityLabel="Book a clean">
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={styles.newBtnText}>Book</Text>
          </TouchableOpacity>
        }
      />
      <FilterPills<Filter>
        value={filter}
        onChange={(k) => {
          haptic.light();
          setFilter(k);
        }}
        options={[
          { key: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
          { key: 'past', label: 'Past' },
          { key: 'cancelled', label: 'Cancelled' },
          { key: 'all', label: 'All' },
        ]}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <ListSkeleton count={4} type="card" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="calendar-outline" title={empty[filter].title} body={empty[filter].body} />}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <BookingCard booking={item} onPress={() => router.push(`/booking/${item.id}`)} />
          </AnimatedListItem>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    marginBottom: 4,
  },
  newBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, flexGrow: 1 },
});
