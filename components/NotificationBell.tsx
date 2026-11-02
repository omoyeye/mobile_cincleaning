import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/config';
import { useUnread } from '../contexts/UnreadContext';

/** Bell in the top right corner of every tab; opens the alerts list. Chats have their own tab. */
export function NotificationBell() {
  const router = useRouter();
  const { alerts } = useUnread();
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={alerts > 0 ? `Notifications, ${alerts} unread` : 'Notifications'}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
      {alerts > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{alerts > 99 ? '99+' : alerts}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
});
