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
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { bookingsApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { ChatMessage } from '../../types';

const POLL_INTERVAL = 8000;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bookingId = Number(id);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await bookingsApi.getChat(bookingId);
      setMessages(data);
    } catch {}
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await bookingsApi.sendChat(bookingId, trimmed);
      setText('');
      await fetchMessages();
    } catch {
      Alert.alert('Error', 'Could not send message.');
    }
    setSending(false);
  };

  const isOwnMessage = (msg: ChatMessage) => msg.senderId === user?.id;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const groupedMessages = messages.reduce<{ dateLabel: string; data: ChatMessage[] }[]>((acc, msg) => {
    const label = formatDateHeader(msg.createdAt);
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.dateLabel === label) {
      lastGroup.data.push(msg);
    } else {
      acc.push({ dateLabel: label, data: [msg] });
    }
    return acc;
  }, []);

  const flatData: (string | ChatMessage)[] = [];
  for (const group of groupedMessages) {
    flatData.push(group.dateLabel);
    flatData.push(...group.data);
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={flatData}
          keyExtractor={(item, index) =>
            typeof item === 'string' ? `header-${index}` : String(item.id)
          }
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSub}>Send a message to start the conversation</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (typeof item === 'string') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{item}</Text>
                </View>
              );
            }
            const own = isOwnMessage(item);
            return (
              <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                {!own && <Text style={styles.senderName}>{item.senderName}</Text>}
                <Text style={[styles.bubbleText, own ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                  {item.text}
                </Text>
                <Text style={[styles.bubbleTime, own ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },

  messageList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  dateHeader: { alignItems: 'center', marginVertical: SPACING.md },
  dateHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: SPACING.base,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xs,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextOwn: { color: COLORS.white },
  bubbleTextOther: { color: COLORS.text },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.6)' },
  bubbleTimeOther: { color: COLORS.textTertiary },

  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyChatText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  emptyChatSub: { fontSize: 13, color: COLORS.textTertiary },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.base,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
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
