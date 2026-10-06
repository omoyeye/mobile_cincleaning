import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/config';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch {}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    (async () => {
      if (!Notifications) { setPermitted(false); return; }
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermitted(status === 'granted');
      } catch { setPermitted(false); }
    })();
  }, []);

  const handleToggle = async () => {
    if (permitted) {
      Alert.alert(
        'Disable Notifications',
        'To turn off notifications, go to your device settings for this app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      if (!Notifications) {
        Alert.alert('Not Available', 'Push notifications are not available in this environment.');
        return;
      }
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          setPermitted(true);
        } else {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
      } catch {
        Alert.alert('Not Available', 'Push notifications are not available in this environment.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="notifications-outline" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Push Notifications</Text>
          <Text style={styles.cardSub}>
            Receive updates about your bookings and messages
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow Notifications</Text>
            {permitted !== null && (
              <Switch
                value={permitted}
                onValueChange={handleToggle}
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary + '60' }}
                thumbColor={permitted ? COLORS.primary : COLORS.textTertiary}
              />
            )}
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: permitted ? COLORS.secondary : COLORS.textTertiary }]} />
            <Text style={styles.statusText}>
              {permitted === null ? 'Checking...' : permitted ? 'Notifications enabled' : 'Notifications disabled'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Service Notifications</Text>
        <Text style={styles.sectionSub}>These are essential for your bookings and cannot be turned off separately.</Text>

        {[
          { icon: 'calendar-outline' as const, label: 'Booking confirmations & reminders' },
          { icon: 'chatbubble-outline' as const, label: 'New chat messages' },
          { icon: 'cash-outline' as const, label: 'Payment updates' },
          { icon: 'star-outline' as const, label: 'Review requests' },
        ].map((item, i) => (
          <View key={i} style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.infoLabel}>{item.label}</Text>
          </View>
        ))}

        <View style={styles.marketingCard}>
          <Text style={styles.sectionTitle}>Marketing Communications</Text>
          <Text style={styles.sectionSub}>
            Opt in to receive promotions, offers, and news. You can withdraw consent at any time.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Promotions & Offers</Text>
            <Switch
              value={marketingConsent}
              onValueChange={setMarketingConsent}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary + '60' }}
              thumbColor={marketingConsent ? COLORS.primary : COLORS.textTertiary}
              accessibilityLabel="Toggle marketing communications consent"
            />
          </View>
          <Text style={styles.consentNote}>
            By enabling this, you consent to receive marketing emails and push notifications. You can withdraw consent at any time by turning this off. See our Privacy Policy for details.
          </Text>
        </View>

        <TouchableOpacity style={styles.settingsLink} onPress={() => Linking.openSettings()}>
          <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
          <Text style={styles.settingsLinkText}>Open Device Settings</Text>
          <Ionicons name="open-outline" size={14} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: COLORS.textTertiary },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.base,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },

  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    marginTop: SPACING.lg,
  },
  settingsLinkText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  sectionSub: { fontSize: 12, color: COLORS.textTertiary, marginBottom: SPACING.sm },
  marketingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  consentNote: {
    fontSize: 11,
    color: COLORS.textTertiary,
    lineHeight: 16,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
});
