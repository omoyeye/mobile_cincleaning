import { useState, useEffect, useCallback } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customerApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomerLayout() {
  const { user, loading } = useAuth();
  // The phone's own bottom area (gesture bar or 3-button nav) varies by model, so size the tab bar from it.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const notifs = await customerApi.getNotifications();
      setUnread(notifs.filter((n) => !n.isRead).length);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);
  // Signed out (or the session expired): back to the shared welcome page.
  if (!loading && !user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderLight,
          paddingBottom: bottomPad,
          paddingTop: 8,
          height: 56 + bottomPad,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.accent, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
