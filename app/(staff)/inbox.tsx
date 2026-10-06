import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Notification, DirectMessage } from '../../types';

type InboxTab = 'alerts' | 'admin';

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

function getTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'booking_update': return 'calendar-outline';
    case 'booking_assigned': return 'calendar-outline';
    case 'booking_cancelled': return 'close-circle-outline';
    case 'system': return 'information-circle-outline';
    case 'invoice': return 'document-text-outline';
    case 'chat_message': return 'chatbubble-outline';
    case 'promo': return 'gift-outline';
    case 'payment': return 'card-outline';
    default: return 'notifications-outline';
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'booking_update': return COLORS.primary;
    case 'booking_assigned': return COLORS.primary;
    case 'booking_cancelled': return '#ef4444';
    case 'system': return '#6366f1';
    case 'invoice': return '#0891b2';
    case 'chat_message': return '#6366f1';
    case 'promo': return '#f59e0b';
    case 'payment': return '#22c55e';
    default: return COLORS.textSecondary;
  }
}

export default function InboxScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<InboxTab>('alerts');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [adminMessages, setAdminMessages] = useState<DirectMessage[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminSending, setAdminSending] = useState(false);
  const adminRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await staffApi.getNotifications();
      setNotifications(data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch {}
    setLoading(false);
  }, []);

  const fetchAdminMessages = useCallback(async () => {
    try {
      const msgs = await staffApi.getDirectMessages();
      setAdminMessages(Array.isArray(msgs) ? msgs : []);
      await staffApi.markDirectMessagesRead().catch(() => {});
    } catch {
      setAdminMessages([]);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (tab === 'admin') {
      setAdminLoading(true);
      fetchAdminMessages().finally(() => setAdminLoading(false));
      adminRefreshRef.current = setInterval(fetchAdminMessages, 15000);
    }
    return () => {
      if (adminRefreshRef.current) {
        clearInterval(adminRefreshRef.current);
        adminRefreshRef.current = null;
      }
    };
  }, [tab, fetchAdminMessages]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'alerts') {
      await fetchNotifications();
    } else {
      await fetchAdminMessages();
    }
    setRefreshing(false);
  };

  const markRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try { await staffApi.markNotificationRead(id); } catch {}
  };

  const handleDelete = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try { await staffApi.deleteNotification(id); } catch {}
  };

  const sendAdminMessage = async () => {
    const text = adminInput.trim();
    if (!text || adminSending) return;
    setAdminSending(true);
    try {
      await staffApi.sendDirectMessage(text);
      setAdminInput('');
      await fetchAdminMessages();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {}
    setAdminSending(false);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const adminUnread = adminMessages.filter((m) => m.senderRole === 'admin' && !m.isRead).length;
  const displayMessages = [...adminMessages].reverse();

  if (loading && tab === 'alerts') {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.logoRow}>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'alerts' && styles.tabBtnActive]}
          onPress={() => setTab('alerts')}
        >
          <Ionicons name="notifications-outline" size={16} color={tab === 'alerts' ? COLORS.primary : COLORS.textTertiary} />
          <Text style={[styles.tabText, tab === 'alerts' && styles.tabTextActive]}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unreadCount}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'admin' && styles.tabBtnActive]}
          onPress={() => setTab('admin')}
        >
          <Ionicons name="chatbubbles-outline" size={16} color={tab === 'admin' ? COLORS.primary : COLORS.textTertiary} />
          <Text style={[styles.tabText, tab === 'admin' && styles.tabTextActive]}>Admin Chat</Text>
          {adminUnread > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: COLORS.secondary }]}>
              <Text style={styles.tabBadgeText}>{adminUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {tab === 'alerts' ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Your inbox is clear</Text>
            </View>
          }
          renderItem={({ item }) => {
            const iconColor = getTypeColor(item.type);
            return (
              <TouchableOpacity
                style={[styles.card, !item.isRead && styles.cardUnread]}
                activeOpacity={0.7}
                onPress={() => markRead(item.id)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
                      <Ionicons name={getTypeIcon(item.type)} size={16} color={iconColor} />
                    </View>
                    <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleBold]} numberOfLines={1}>
                      {item.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                  </View>
                  <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardMsg} numberOfLines={2}>{item.message}</Text>
                <View style={styles.cardActions}>
                  <View />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          {adminLoading && adminMessages.length === 0 ? (
            <View style={styles.chatLoader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={displayMessages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textTertiary} />
                  <Text style={styles.emptyText}>No messages yet</Text>
                  <Text style={styles.emptySubText}>Send a message to the admin team</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMe = item.senderRole === 'staff';
                return (
                  <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                      {!isMe && <Text style={styles.msgSender}>{item.senderName} (Admin)</Text>}
                      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
                      <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              value={adminInput}
              onChangeText={setAdminInput}
              placeholder="Message admin..."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !adminInput.trim() && styles.sendBtnDisabled]}
              onPress={sendAdminMessage}
              disabled={!adminInput.trim() || adminSending}
            >
              {adminSending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="send" size={18} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary + '30',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textTertiary },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#ef4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, paddingTop: SPACING.sm },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardUnread: { backgroundColor: COLORS.primary + '06', borderColor: COLORS.primary + '20' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: SPACING.sm },
  iconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center' as const, alignItems: 'center' as const },
  cardTitle: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 1 },
  cardTitleBold: { fontWeight: '700' },
  cardTime: { fontSize: 11, color: COLORS.textTertiary },
  cardMsg: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: { padding: 4 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  emptySubText: { fontSize: 12, color: COLORS.textTertiary },

  chatContainer: { flex: 1 },
  chatLoader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  msgRow: { marginBottom: SPACING.sm, alignItems: 'flex-start' },
  msgRowMe: { alignItems: 'flex-end' },
  msgBubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.lg,
  },
  msgBubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleThem: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderBottomLeftRadius: 4,
  },
  msgSender: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  msgText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  msgTextMe: { color: COLORS.white },
  msgTime: { fontSize: 10, color: COLORS.textTertiary, marginTop: 4 },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.base,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
