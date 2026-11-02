import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../../services/api';
import { useUnread } from '../../contexts/UnreadContext';
import { ChatThreadList } from '../../components/ChatThreads';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { BrandBar, ScreenHeader } from '../../components/staff/StaffKit';
import type { DirectMessage } from '../../types';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

type InboxTab = 'clients' | 'office';

/** Messages tab: client chats for each job and the office chat. Alerts ring the bell in the top bar. */
export default function InboxScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<InboxTab>(params.tab === 'office' ? 'office' : 'clients');
  const { chatUnreadByRef, markOfficeRead } = useUnread();
  const { refreshing, onRefresh } = usePullRefresh(() => fetchAdminMessages());

  useEffect(() => {
    if (params.tab === 'office') setTab('office');
  }, [params.tab]);

  const [adminMessages, setAdminMessages] = useState<DirectMessage[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminSending, setAdminSending] = useState(false);
  const adminRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchAdminMessages = useCallback(async () => {
    try {
      const msgs = await staffApi.getDirectMessages();
      setAdminMessages(Array.isArray(msgs) ? msgs : []);
      await staffApi.markDirectMessagesRead().catch(() => {});
    } catch {
      setAdminMessages([]);
    }
  }, []);

  // Office unread count for the tab badge, before the office chat is opened.
  const [officeUnread, setOfficeUnread] = useState(0);
  useEffect(() => {
    staffApi
      .getDirectMessages()
      .then((msgs) => setOfficeUnread((Array.isArray(msgs) ? msgs : []).filter((m) => m.senderRole === 'admin' && !m.isRead).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'office') {
      setAdminLoading(true);
      setOfficeUnread(0);
      markOfficeRead();
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

  const clientUnread = Object.values(chatUnreadByRef).reduce((a, n) => a + n, 0);
  const displayMessages = [...adminMessages].reverse();

  const tabs = (
    <View style={styles.tabRow}>
      <TouchableOpacity
        style={[styles.tabBtn, tab === 'clients' && styles.tabBtnActive]}
        onPress={() => setTab('clients')}
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === 'clients' }}
      >
        <Ionicons name="people-outline" size={16} color={tab === 'clients' ? COLORS.primary : COLORS.textTertiary} />
        <Text style={[styles.tabText, tab === 'clients' && styles.tabTextActive]}>Clients</Text>
        {clientUnread > 0 && (
          <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{clientUnread}</Text></View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, tab === 'office' && styles.tabBtnActive]}
        onPress={() => setTab('office')}
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === 'office' }}
      >
        <Ionicons name="chatbubbles-outline" size={16} color={tab === 'office' ? COLORS.primary : COLORS.textTertiary} />
        <Text style={[styles.tabText, tab === 'office' && styles.tabTextActive]}>Office</Text>
        {officeUnread > 0 && (
          <View style={[styles.tabBadge, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.tabBadgeText}>{officeUnread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BrandBar padded />
      <View style={{ paddingHorizontal: SPACING.lg }}>
        <ScreenHeader title="Messages" subtitle="Chat with your clients and the office." />
      </View>
      {tabs}

      {tab === 'clients' ? (
        <ChatThreadList />
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior="padding"
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
              refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
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
