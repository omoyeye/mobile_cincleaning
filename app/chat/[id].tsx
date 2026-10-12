import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { bookingsApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { friendlyDay, serviceLabel } from '../../components/ClientKit';
import { goBack } from '../../utils/navigation';
import type { Booking, ChatMessage } from '../../types';

const POLL_INTERVAL = 8000;

const msgTime = (m: ChatMessage) => m.timestamp || m.createdAt || '';

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function clock(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Booking chat between the client and their cleaner. Same rules as the website. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const bookingId = Number(id);
  const isStaff = user?.role === 'staff';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canChatNow, setCanChatNow] = useState(true);
  const [closed, setClosed] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const listRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const thread = await bookingsApi.getChat(bookingId);
      setMessages(thread.messages);
      setCanChatNow(thread.canChatNow);
      setClosed(thread.chatClosedByAdmin);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    bookingsApi.getOne(bookingId).then(setBooking).catch(() => {});
    fetchMessages();
    const poll = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [bookingId, fetchMessages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !canChatNow || closed) return;
    setSending(true);
    try {
      await bookingsApi.sendChat(bookingId, trimmed);
      setText('');
      await fetchMessages();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send message', 'error');
    }
    setSending(false);
  };

  const isOwn = (m: ChatMessage) => String(m.senderId) === String(user?.id);

  const rows: ({ kind: 'day'; label: string; key: string } | { kind: 'msg'; msg: ChatMessage; key: string })[] = [];
  let lastDay = '';
  messages.forEach((m, i) => {
    const label = dayLabel(msgTime(m));
    if (label && label !== lastDay) {
      rows.push({ kind: 'day', label, key: `day-${i}` });
      lastDay = label;
    }
    rows.push({ kind: 'msg', msg: m, key: `m-${m.id}-${i}` });
  });

  const otherParty = isStaff ? booking?.contact?.name || 'Client' : 'Your cleaner';
  const subtitle = booking
    ? `${serviceLabel(booking.serviceType)} · ${friendlyDay(String(booking.date).slice(0, 10))} ${booking.time || ''}`
    : booking === null && !loading
      ? ''
      : 'Loading…';

  const locked = closed || !canChatNow;
  const lockedText = closed
    ? 'This chat was closed by our team after the clean.'
    : 'Chat opens 10 minutes before the start time, once a cleaner is assigned.';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Ionicons name={isStaff ? 'person' : 'sparkles'} size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {otherParty}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {booking ? (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => router.push(isStaff ? `/job/${bookingId}` : `/booking/${bookingId}`)}
            accessibilityLabel={isStaff ? 'Open job' : 'Open booking'}
          >
            <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.emptyTitle}>{loadFailed ? 'Could not load messages' : 'No messages yet'}</Text>
                <Text style={styles.emptySub}>
                  {loadFailed
                    ? 'Check your connection. We will keep trying.'
                    : locked
                      ? lockedText
                      : isStaff
                        ? 'Send the client a quick hello or an update.'
                        : 'Say hello or share anything your cleaner should know.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === 'day') {
                return (
                  <View style={styles.day}>
                    <Text style={styles.dayText}>{item.label}</Text>
                  </View>
                );
              }
              const own = isOwn(item.msg);
              const fromOffice = item.msg.senderRole === 'admin';
              return (
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther, fromOffice && !own && styles.bubbleOffice]}>
                  {!own ? (
                    <Text style={[styles.sender, fromOffice && { color: COLORS.secondary }]}>
                      {fromOffice ? `${item.msg.senderName || 'CiN'} · Office` : item.msg.senderName}
                    </Text>
                  ) : null}
                  <Text style={[styles.bubbleText, own && { color: COLORS.white }]}>{item.msg.text}</Text>
                  <Text style={[styles.bubbleTime, own && { color: 'rgba(255,255,255,0.75)' }]}>{clock(msgTime(item.msg))}</Text>
                </View>
              );
            }}
          />
        )}

        {locked ? (
          <View style={styles.lockedBar}>
            <Ionicons name={closed ? 'lock-closed-outline' : 'time-outline'} size={18} color={COLORS.textSecondary} />
            <Text style={styles.lockedText}>{lockedText}</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnOff]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              accessibilityLabel="Send message"
            >
              {sending ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="send" size={18} color={COLORS.white} />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary + '14', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  headerAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },

  list: { padding: SPACING.base, flexGrow: 1 },
  day: { alignItems: 'center', marginVertical: SPACING.sm },
  dayText: { fontSize: 12, fontWeight: '600', color: COLORS.textTertiary, backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full, overflow: 'hidden' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, marginBottom: 6 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, borderBottomLeftRadius: 6 },
  bubbleOffice: { backgroundColor: COLORS.successLight, borderColor: COLORS.secondary + '33' },
  sender: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: COLORS.text },
  bubbleTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 3, alignSelf: 'flex-end' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xl },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },

  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  lockedText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 19 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.base,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: COLORS.text,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.45 },
});
