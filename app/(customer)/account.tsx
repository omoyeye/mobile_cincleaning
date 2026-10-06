import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
}

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const firstName = (user?.name || '').split(' ')[0] || 'User';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'All your bookings, messages, and personal data will be permanently erased within 30 days as required by UK GDPR. Type your email to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Deletion',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (user?.id) {
                        await authApi.deleteAccount(user.id);
                      }
                      Alert.alert(
                        'Account Deletion Requested',
                        'Your account has been scheduled for deletion. You will receive a confirmation email. All data will be erased within 30 days.',
                      );
                      await logout();
                    } catch {
                      Alert.alert('Error', 'Could not process your request. Please email info@cleanitneatly.com to request account deletion.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleDownloadData = async () => {
    if (!user?.id) return;
    Alert.alert(
      'Download Your Data',
      'We will email a copy of all your personal data to your registered email address within 30 days, as required by UK GDPR (Subject Access Request).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request My Data',
          onPress: async () => {
            try {
              await authApi.requestDataExport(user.id);
              Alert.alert('Request Submitted', 'You will receive your data export via email within 30 days.');
            } catch {
              Alert.alert('Error', 'Could not process your request. Please email info@cleanitneatly.com to make a Subject Access Request.');
            }
          },
        },
      ],
    );
  };

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Personal Details', sub: user?.email, onPress: () => router.push('/edit-profile') },
        { icon: 'location-outline', label: 'Saved Addresses', onPress: () => router.push('/edit-profile') },
        { icon: 'card-outline', label: 'Payment Methods', sub: 'Managed via payment links', onPress: () => Alert.alert('Payment Methods', 'Payments are handled securely through Stripe payment links sent with your booking confirmation. No card details are stored in the app.') },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notification Settings', onPress: () => router.push('/notification-settings') },
        { icon: 'star-outline', label: 'Leave a Review', onPress: () => router.push('/(customer)/bookings') },
        { icon: 'share-outline', label: 'Refer a Friend', sub: 'Earn rewards', onPress: () => router.push('/referrals') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'chatbubble-ellipses-outline', label: 'Help & Support', onPress: () => router.push('/help') },
        { icon: 'document-text-outline', label: 'Terms, Privacy & Cookies', onPress: () => router.push('/terms') },
      ],
    },
    {
      title: 'Your Data (GDPR)',
      items: [
        { icon: 'download-outline', label: 'Download My Data', sub: 'Subject Access Request', onPress: handleDownloadData },
        { icon: 'trash-outline', label: 'Delete My Account', sub: 'Permanently erase all data', onPress: handleDeleteAccount, danger: true },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, i < section.items.length - 1 && styles.menuItemBorder]}
                  activeOpacity={0.6}
                  onPress={item.onPress}
                >
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIcon, item.danger && { backgroundColor: '#fef2f2' }]}>
                      <Ionicons name={item.icon} size={18} color={item.danger ? '#ef4444' : COLORS.textSecondary} />
                    </View>
                    <View>
                      <Text style={[styles.menuLabel, item.danger && { color: '#ef4444' }]}>
                        {item.label}
                      </Text>
                      {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.7}>
          {loggingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>CiN Cleaning v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  name: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  email: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: 14,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  menuSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: SPACING.sm,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  version: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
});
