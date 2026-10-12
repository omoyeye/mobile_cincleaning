import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { COLORS, SPACING, RADIUS, APP_VERSION } from '../../constants/config';
import { TopBar, Avatar, RowGroup, ListRow } from '../../components/ClientKit';

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
              'All your bookings, messages and personal data will be permanently erased within 30 days, as required by UK GDPR. This cannot be undone.',
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
                      Alert.alert('Error', 'Could not process your request. Please email support@cleanitneatly.com to request account deletion.');
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
              Alert.alert('Error', 'Could not process your request. Please email support@cleanitneatly.com to make a Subject Access Request.');
            }
          },
        },
      ],
    );
  };

  const points = Number(user?.loyaltyPoints || 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TopBar />

        <View style={styles.profileCard}>
          <Avatar name={user?.name} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || firstName}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
            {points > 0 ? (
              <View style={styles.pointsPill}>
                <Ionicons name="diamond" size={12} color={COLORS.accentGold} />
                <Text style={styles.pointsText}>{points} points</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')} accessibilityLabel="Edit profile">
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <RowGroup title="Your account">
          <ListRow icon="person-outline" title="Personal details" subtitle="Name, phone and email" onPress={() => router.push('/edit-profile')} />
          <ListRow icon="location-outline" title="Saved address" subtitle="Where we clean" onPress={() => router.push('/edit-profile')} />
          <ListRow icon="notifications-outline" tint="#6d52e8" title="Notifications" subtitle="Email, SMS and app alerts" onPress={() => router.push('/notification-settings')} last />
        </RowGroup>

        <RowGroup title="Bookings and payments">
          <ListRow icon="receipt-outline" tint={COLORS.error} title="Invoices" subtitle="See and pay your invoices" onPress={() => router.push('/invoices')} />
          <ListRow icon="chatbubbles-outline" tint="#6d52e8" title="Messages" subtitle="Chat with your cleaner" onPress={() => router.push('/messages')} last />
        </RowGroup>

        <RowGroup title="Rewards">
          <ListRow icon="gift-outline" tint={COLORS.secondary} title="Refer a friend" subtitle="You both get money off" onPress={() => router.push('/referrals')} />
          <ListRow
            icon="star-outline"
            tint={COLORS.accentGold}
            title="Rate a clean"
            subtitle="Open a completed booking to leave a review"
            onPress={() => router.push('/(customer)/bookings')}
            last
          />
        </RowGroup>

        <RowGroup title="Help">
          <ListRow icon="chatbubble-ellipses-outline" title="Help and support" subtitle="FAQs, call or message us" onPress={() => router.push('/help')} />
          <ListRow icon="document-text-outline" tint={COLORS.textSecondary} title="Terms, privacy and cookies" onPress={() => router.push('/terms')} last />
        </RowGroup>

        <RowGroup title="Your data">
          <ListRow icon="download-outline" tint={COLORS.textSecondary} title="Download my data" subtitle="We email you a copy" onPress={handleDownloadData} />
          <ListRow icon="trash-outline" title="Delete my account" subtitle="Permanently erase your data" onPress={handleDeleteAccount} danger last />
        </RowGroup>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.7}>
          {loggingOut ? (
            <ActivityIndicator color={COLORS.error} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
              <Text style={styles.logoutText}>Sign out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>CiN Cleaning v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    marginTop: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 6,
  },
  pointsText: { fontSize: 12, fontWeight: '700', color: '#a16207' },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.errorLight,
    marginTop: SPACING.xl,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: COLORS.error },
  version: { fontSize: 12, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md },
});
