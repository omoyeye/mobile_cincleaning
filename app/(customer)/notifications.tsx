import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { customerApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { useHaptic } from '../../hooks/useHaptic';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Notification } from '../../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getAlertIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'booking_update': return 'calendar-outline';
    case 'booking_cancelled': return 'close-circle-outline';
    case 'system': return 'information-circle-outline';
    case 'invoice': return 'document-text-outline';
    case 'chat_message': return 'chatbubble-outline';
    case 'promo': return 'gift-outline';
    case 'payment': return 'card-outline';
    default: return 'notifications-outline';
  }
}

function getAlertColor(type: string) {
  switch (type) {
    case 'booking_update': return COLORS.primary;
    case 'booking_cancelled': return '#ef4444';
    case 'system': return '#6366f1';
    case 'invoice': return '#0891b2';
    case 'chat_message': return '#6366f1';
    case 'promo': return '#f59e0b';
    case 'payment': return COLORS.status.confirmed;
    default: return COLORS.textSecondary;
  }
}

function getNavigationTarget(notification: Notification): { route: string; params?: object } | null {
  const msg = notification.message || '';
  const bookingIdMatch = msg.match(/booking\s*#?(\d+)/i) || msg.match(/#(\d+)/);

  switch (notification.type) {
    case 'booking_update':
    case 'booking_cancelled':
    case 'invoice':
    case 'payment':
      if (bookingIdMatch) return { route: `/booking/${bookingIdMatch[1]}` };
      return null;
    case 'chat_message':
      if (bookingIdMatch) return { route: `/chat/${bookingIdMatch[1]}` };
      return null;
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const haptic = useHaptic();
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await customerApi.getNotifications();
      setAlerts(data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch {
      showToast('Could not load notifications', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const markRead = async (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    try { await customerApi.markNotificationRead(id); } catch {}
  };

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.isRead);
    if (unread.length === 0) return;
    haptic.success();
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    try {
      await Promise.all(unread.map((a) => customerApi.markNotificationRead(a.id)));
      showToast('All notifications marked as read', 'success');
    } catch {
      showToast('Could not mark all as read', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await customerApi.deleteNotification(id);
    } catch {
      showToast('Could not delete notification', 'error');
    }
  };

  const handlePress = (item: Notification) => {
    if (!item.isRead) markRead(item.id);
    const target = getNavigationTarget(item);
    if (target) {
      router.push(target.route as any);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <ListSkeleton count={5} type="notification" />
      </SafeAreaView>
    );
  }

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} activeOpacity={0.7}>
          <Ionicons name="checkmark-done-outline" size={16} color={COLORS.primary} />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconColor = getAlertColor(item.type);
          const target = getNavigationTarget(item);
          return (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.cardUnread]}
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={getAlertIcon(item.type)} size={20} color={iconColor} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                    {item.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardMsg} numberOfLines={2}>{item.message}</Text>
                {target && (
                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap to view</Text>
                    <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
                  </View>
                )}
              </View>
              {!item.isRead && <View style={styles.dot} />}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  headerLogo: { width: 140, height: 45 },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginRight: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary + '10',
  },
  markAllText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, paddingTop: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  cardUnread: { backgroundColor: COLORS.primary + '06', borderColor: COLORS.primary + '20' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  cardTitleUnread: { fontWeight: '700' },
  cardTime: { fontSize: 11, color: COLORS.textTertiary },
  cardMsg: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  tapHintText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 2,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
