import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { pushApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {}

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current || !Notifications) return;

    (async () => {
      if (!Device.isDevice) return;

      try {
        const { status: existing } = await Notifications!.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications!.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications!.getExpoPushTokenAsync();
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await pushApi.registerToken(tokenData.data, platform as 'ios' | 'android');
        registered.current = true;
      } catch {}
    })();
  }, [user]);

  useEffect(() => {
    if (!Notifications) return;

    const sub = Notifications!.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (!data) return;

      const isStaff = user?.role === 'staff';
      const jobTypes = ['job_prompt', 'job_assigned', 'job_update'];
      if (data.type === 'chat_message' && data.bookingId) {
        router.push(`/chat/${data.bookingId}`);
      } else if (data.bookingId && (jobTypes.includes(String(data.type)) || isStaff)) {
        router.push(`/job/${data.bookingId}`);
      } else if (data.bookingId) {
        router.push(`/booking/${data.bookingId}`);
      } else if (data.type === 'invoice') {
        router.push(isStaff ? '/(staff)/earnings' : '/(customer)/bookings');
      } else {
        const role = user?.role;
        if (role === 'staff') router.push('/(staff)');
        else router.push('/(customer)/notifications');
      }
    });

    return () => sub.remove();
  }, [user]);
}
