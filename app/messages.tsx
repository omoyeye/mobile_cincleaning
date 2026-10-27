import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { bookingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ListSkeleton } from '../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { EmptyState, friendlyDay, serviceLabel, bookingYmd } from '../components/ClientKit';
import { goBack } from '../utils/navigation';
import type { Booking } from '../types';
import { BrandRefresh } from '../components/BrandRefresh';
import { usePullRefresh } from '../hooks/usePullRefresh';

/** Chat unlocks 10 minutes before the start (the server checks the same rule). */
const OPENS_BEFORE_MS = 10 * 60 * 1000;

function startMs(b: Booking): number {
  const [y, m, d] = bookingYmd(b).split('-').map(Number);
  const [hh, mm] = String(b.time || '00:00').split(':').map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
}

function chatState(b: Booking): { label: string; tone: 'open' | 'soon' | 'closed' } {
  if (b.chatClosedByAdmin) return { label: 'Closed', tone: 'closed' };
  const start = startMs(b);
  if (Number.isFinite(start) && Date.now() < start - OPENS_BEFORE_MS) {
    const opens = new Date(start - OPENS_BEFORE_MS);
    // The row already shows the day, so the badge only needs the time.
    return { label: `Opens ${opens.toTimeString().slice(0, 5)}`, tone: 'soon' };
  }
  return { label: 'Open', tone: 'open' };
}

const hasCleaner = (b: Booking) => !!b.assignedStaffId || (Array.isArray(b.assignedStaffIds) && b.assignedStaffIds.length > 0);

/** Every booking chat in one list (the website's "Chats" section). */
export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => load());

  const load = useCallback(async () => {
    try {
      setBookings(await bookingsApi.getAll());
    } catch {
      /* keep what we have */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const threads = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => b.status !== 'Cancelled' && (isStaff || hasCleaner(b)))
      .sort((a, b) => {
        // Open and upcoming first (soonest first), then past ones (latest first).
        const sa = startMs(a);
        const sb = startMs(b);
        const aPast = sa < now - 6 * 3600000;
        const bPast = sb < now - 6 * 3600000;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? sb - sa : sa - sb;
      });
  }, [bookings, isStaff]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ListSkeleton count={4} type="notification" />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <BrandRefresh
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          ListHeaderComponent={
            <Text style={styles.intro}>
              {isStaff
                ? 'Message the client about a job. Chats open 10 minutes before the start time.'
                : 'Chat with your cleaner about a booking. Chats open 10 minutes before the start time.'}
            </Text>
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No chats yet"
              body={isStaff ? 'Chats appear here for jobs assigned to you.' : 'A chat appears here once a cleaner is assigned to your booking.'}
            />
          }
          renderItem={({ item }) => {
            const state = chatState(item);
            const toneColor = state.tone === 'open' ? COLORS.secondary : state.tone === 'soon' ? COLORS.primary : COLORS.textTertiary;
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => router.push(`/chat/${item.id}`)}>
                <View style={[styles.icon, { backgroundColor: toneColor + '18' }]}>
                  <Ionicons name={state.tone === 'closed' ? 'lock-closed-outline' : 'chatbubbles-outline'} size={20} color={toneColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {isStaff ? item.contact?.name || 'Client' : serviceLabel(item.serviceType)}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {isStaff ? `${serviceLabel(item.serviceType)} · ` : ''}
                    {friendlyDay(bookingYmd(item))} {item.time}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: toneColor + '18' }]}>
                  <Text style={[styles.pillText, { color: toneColor }]} numberOfLines={1}>
                    {state.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, flexGrow: 1 },
  intro: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginVertical: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, maxWidth: 130 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
