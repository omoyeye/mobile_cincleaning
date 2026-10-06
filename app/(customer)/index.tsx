import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking } from '../../types';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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

function formatDate(raw: string) {
  const d = new Date(raw);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CustomerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const fetchBookings = useCallback(async () => {
    try {
      const data = await customerApi.getBookings();
      setBookings(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const upcomingBookings = bookings
    .filter((b) => b.status !== 'Completed' && b.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));

  const recentCompleted = bookings
    .filter((b) => b.status === 'Completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/brand-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="CiN Cleaning logo"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
            <Text style={styles.subGreeting}>
              {upcomingBookings.length > 0
                ? `You have ${upcomingBookings.length} upcoming clean${upcomingBookings.length > 1 ? 's' : ''}`
                : 'No upcoming cleans scheduled'}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Loyalty Points */}
        {user?.loyaltyPoints != null && user.loyaltyPoints > 0 && (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyLeft}>
              <Ionicons name="diamond-outline" size={22} color={COLORS.accentGold} />
              <View>
                <Text style={styles.loyaltyLabel}>Loyalty Points</Text>
                <Text style={styles.loyaltyValue}>{user.loyaltyPoints} pts</Text>
              </View>
            </View>
            <View style={styles.loyaltyBadge}>
              <Text style={styles.loyaltyBadgeText}>
                {'£'}{(user.loyaltyPoints / 100).toFixed(2)} value
              </Text>
            </View>
          </View>
        )}

        {/* Quick Book */}
        <TouchableOpacity
          style={styles.bookCard}
          activeOpacity={0.85}
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          accessibilityLabel="Book a clean"
        >
          <View style={styles.bookCardContent}>
            <Ionicons name="sparkles" size={24} color={COLORS.white} />
            <View style={styles.bookCardText}>
              <Text style={styles.bookCardTitle}>Book a Clean</Text>
              <Text style={styles.bookCardSub}>Choose your service and schedule</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Upcoming */}
        {upcomingBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcomingBookings.map((booking) => {
              const sc = getStatusColor(booking.status);
              return (
                <TouchableOpacity
                  key={booking.id}
                  style={styles.bookingCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/booking/${booking.id}`)}
                >
                  <View style={styles.bookingCardTop}>
                    <View>
                      <Text style={styles.bookingService}>{booking.serviceType.replace(/_/g, ' ')}</Text>
                      <Text style={styles.bookingDate}>
                        {formatDate(booking.date)} at {booking.time}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{booking.status}</Text>
                    </View>
                  </View>
                  <View style={styles.bookingCardBottom}>
                    <View style={styles.bookingDetail}>
                      <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
                      <Text style={styles.bookingDetailText} numberOfLines={1}>
                        {booking.address?.line1}, {booking.address?.postcode}
                      </Text>
                    </View>
                    <Text style={styles.bookingPrice}>
                      {'£'}{Number(booking.totalPrice).toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent */}
        {recentCompleted.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently Completed</Text>
            {recentCompleted.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.bookingCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/(customer)/bookings?id=${booking.id}`)}
              >
                <View style={styles.bookingCardTop}>
                  <View>
                    <Text style={styles.bookingService}>{booking.serviceType.replace(/_/g, ' ')}</Text>
                    <Text style={styles.bookingDate}>{formatDate(booking.date)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: COLORS.status.completedBg }]}>
                    <Text style={[styles.statusText, { color: COLORS.status.completed }]}>Completed</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {bookings.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>Book your first clean to get started</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm },
  headerLogo: { width: 140, height: 45 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subGreeting: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  loyaltyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accentGold + '08',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accentGold + '30',
  },
  loyaltyLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  loyaltyLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase' },
  loyaltyValue: { fontSize: 18, fontWeight: '800', color: COLORS.accentGold },
  loyaltyBadge: {
    backgroundColor: COLORS.accentGold + '18',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  loyaltyBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.accentGold },

  bookCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  bookCardContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  bookCardText: {},
  bookCardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  bookCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  bookingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  bookingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingService: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  bookingDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  bookingCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  bookingDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  bookingDetailText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  bookingPrice: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
