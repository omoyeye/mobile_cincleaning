import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useUnread } from '../contexts/UnreadContext';
import { ListSkeleton } from './SkeletonLoader';
import { COLORS, SPACING, RADIUS, SHADOW } from '../constants/config';
import { EmptyState, friendlyDay, serviceLabel, bookingYmd } from './ClientKit';
import { BrandRefresh } from './BrandRefresh';
import { LiveBadge } from './LiveBadge';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { liveState } from '../utils/live';
import type { Booking } from '../types';

/** Chat unlocks 10 minutes before the start, or earlier once the job is live (the server checks the same rule). */
const OPENS_BEFORE_MS = 10 * 60 * 1000;

function startMs(b: Booking): number {
  const [y, m, d] = bookingYmd(b).split('-').map(Number);
  const [hh, mm] = String(b.time || '00:00').split(':').map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
}

function chatState(b: Booking): { label: string; tone: 'open' | 'soon' | 'closed' } {
  if (b.chatClosedByAdmin) return { label: 'Closed', tone: 'closed' };
  // Opens early once the cleaner sets off or sends a running-late notice.
  if (b.enRouteAt || b.arrivedAt || (Array.isArray(b.lateNotices) && b.lateNotices.length > 0)) return { label: 'Open', tone: 'open' };
  const start = startMs(b);
  if (Number.isFinite(start) && Date.now() < start - OPENS_BEFORE_MS) {
    const opens = new Date(start - OPENS_BEFORE_MS);
    // The row already shows the day, so the badge only needs the time.
    return { label: `Opens ${opens.toTimeString().slice(0, 5)}`, tone: 'soon' };
  }
  return { label: 'Open', tone: 'open' };
}

const hasCleaner = (b: Booking) => !!b.assignedStaffId || (Array.isArray(b.assignedStaffIds) && b.assignedStaffIds.length > 0);

/** Every booking chat in one list, live and unread ones first. `header` scrolls with the list. */
export function ChatThreadList({ header }: { header?: React.ReactElement }) {
  const router = useRouter();
  const { user } = useAuth();
  const { chatUnreadByRef, refresh: refreshUnread } = useUnread();
  const isStaff = user?.role === 'staff';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBookings(await bookingsApi.getAll());
    } catch {
      /* keep what we have */
    }
    setLoading(false);
  }, []);
  const { refreshing, onRefresh } = usePullRefresh(() => Promise.all([load(), refreshUnread()]));

  useEffect(() => { load(); }, [load]);
  // Coming back from a chat: pick up new messages and cleared badges.
  useFocusEffect(useCallback(() => { refreshUnread(); }, [refreshUnread]));

  const unreadFor = useCallback(
    (b: Booking) => chatUnreadByRef[String(b.bookingId || '').toUpperCase()] || chatUnreadByRef[String(b.id)] || 0,
    [chatUnreadByRef],
  );

  const threads = useMemo(() => {
    const now = Date.now();
    const rank = (b: Booking) => (liveState(b) ? 0 : unreadFor(b) > 0 ? 1 : 2);
    return bookings
      .filter((b) => b.status !== 'Cancelled' && (isStaff || hasCleaner(b)))
      .sort((a, b) => {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        // Then open and upcoming (soonest first), then past ones (latest first).
        const sa = startMs(a);
        const sb = startMs(b);
        const aPast = sa < now - 6 * 3600000;
        const bPast = sb < now - 6 * 3600000;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? sb - sa : sa - sb;
      });
  }, [bookings, isStaff, unreadFor]);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <ListSkeleton count={4} type="notification" />
      </View>
    );
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(b) => String(b.id)}
      contentContainerStyle={styles.list}
      refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {header}
          <Text style={styles.intro}>
            {isStaff
              ? 'Message the client about a job. Chats open 10 minutes before the start, or as soon as you set off.'
              : 'Chat with your cleaner about a booking. Chats open 10 minutes before the start, or as soon as your cleaner sets off.'}
          </Text>
        </>
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
        const live = liveState(item);
        const unread = unreadFor(item);
        const toneColor = state.tone === 'open' ? COLORS.secondary : state.tone === 'soon' ? COLORS.primary : COLORS.textTertiary;
        return (
          <TouchableOpacity style={[styles.row, live && styles.rowLive]} activeOpacity={0.75} onPress={() => router.push(`/chat/${item.id}`)}>
            <View style={[styles.icon, { backgroundColor: toneColor + '18' }]}>
              <Ionicons name={state.tone === 'closed' ? 'lock-closed-outline' : 'chatbubbles-outline'} size={20} color={toneColor} />
              {unread > 0 ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, unread > 0 && { fontWeight: '800' }]} numberOfLines={1}>
                {isStaff ? item.contact?.name || 'Client' : serviceLabel(item.serviceType)}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {isStaff ? `${serviceLabel(item.serviceType)} · ` : ''}
                {friendlyDay(bookingYmd(item))} {item.time}
              </Text>
            </View>
            {live ? (
              <LiveBadge state={live} />
            ) : (
              <View style={[styles.pill, { backgroundColor: toneColor + '18' }]}>
                <Text style={[styles.pillText, { color: toneColor }]} numberOfLines={1}>
                  {state.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
    ...SHADOW.card,
  },
  rowLive: { borderColor: COLORS.secondary + '80', backgroundColor: COLORS.secondary + '08' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  unread: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, maxWidth: 130 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
