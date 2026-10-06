import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { staffApi, authApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Staff, Referral } from '../../types';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
}

export default function StaffProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (user?.name || '').split(' ')[0] || 'Staff';

  const fetchData = useCallback(async () => {
    try {
      const [profiles, refs] = await Promise.all([
        staffApi.getStaffList(),
        user?.id ? staffApi.getReferrals(user.id) : Promise.resolve([]),
      ]);
      const me = profiles.find((s: Staff) => s.email === user?.email);
      setStaff(me || null);
      setReferrals(refs);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

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
      'This will permanently delete your account and all associated personal data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              if (user?.id) await authApi.deleteAccount(user.id);
              Alert.alert('Account Deletion Requested', 'Your data will be erased within 30 days per UK GDPR. You will receive confirmation by email.');
              await logout();
            } catch {
              Alert.alert('Error', 'Please email info@cleanitneatly.com to request account deletion.');
            }
          },
        },
      ],
    );
  };

  const handleDownloadData = async () => {
    if (!user?.id) return;
    Alert.alert(
      'Download Your Data',
      'We will email a copy of your personal data within 30 days (Subject Access Request under UK GDPR).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request My Data',
          onPress: async () => {
            try {
              await authApi.requestDataExport(user.id);
              Alert.alert('Request Submitted', 'You will receive your data export via email within 30 days.');
            } catch {
              Alert.alert('Error', 'Please email info@cleanitneatly.com to make a Subject Access Request.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Profile',
      items: [
        { icon: 'person-outline', label: 'Personal Details', sub: user?.email, onPress: () => router.push('/edit-profile') },
        { icon: 'card-outline', label: 'Bank Details', sub: staff?.bankName || 'Not set', onPress: () => router.push('/bank-details') },
        { icon: 'star-outline', label: 'My Reviews', onPress: () => router.push('/my-reviews') },
      ],
    },
    {
      title: 'Work',
      items: [
        { icon: 'alarm-outline', label: 'Running Late', sub: 'Notify client & office of a delay', onPress: () => router.push('/running-late') },
        { icon: 'people-outline', label: 'Referrals', sub: `${referrals.length} referral${referrals.length !== 1 ? 's' : ''}`, onPress: () => router.push('/referrals') },
        { icon: 'document-text-outline', label: 'Contracts & Documents', onPress: () => Alert.alert('Contracts & Documents', 'Your employment contract and related documents are managed by CiN Cleaning. Contact your manager or email info@cleanitneatly.com for copies.') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'notifications-outline', label: 'Notification Settings', onPress: () => router.push('/notification-settings') },
        { icon: 'chatbubble-ellipses-outline', label: 'Help & Support', onPress: () => router.push('/help') },
        { icon: 'shield-checkmark-outline', label: 'Privacy, Terms & Cookies', onPress: () => router.push('/terms') },
      ],
    },
    {
      title: 'Your Data (GDPR)',
      items: [
        { icon: 'download-outline', label: 'Download My Data', sub: 'Subject Access Request', onPress: handleDownloadData },
        { icon: 'trash-outline', label: 'Delete My Account', sub: 'Permanently erase all data', onPress: handleDeleteAccount },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {staff?.imageUrl ? (
              <Image source={{ uri: staff.imageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{staff?.role || 'Cleaner'}</Text>
          <View style={styles.badgeRow}>
            {staff?.status === 'Active' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            <View style={[styles.statusIndicator, { backgroundColor: staff?.status === 'Active' ? '#dcfce7' : '#fef2f2' }]}>
              <View style={[styles.statusSmallDot, { backgroundColor: staff?.status === 'Active' ? '#22c55e' : '#ef4444' }]} />
              <Text style={[styles.statusIndicatorText, { color: staff?.status === 'Active' ? '#22c55e' : '#ef4444' }]}>
                {staff?.status || 'Active'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu sections */}
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
                    <View style={styles.menuIcon}>
                      <Ionicons name={item.icon} size={18} color={COLORS.textSecondary} />
                    </View>
                    <View>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
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

        <Text style={styles.version}>CiN Cleaning Staff v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 26, fontWeight: '700', color: COLORS.white },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  role: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  verifiedText: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusSmallDot: { width: 6, height: 6, borderRadius: 3 },
  statusIndicatorText: { fontSize: 12, fontWeight: '600' },

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
