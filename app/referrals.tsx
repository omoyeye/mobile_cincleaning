import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Share,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { customerApi, staffApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import type { Referral } from '../types';

function getStatusColor(status: string) {
  switch (status) {
    case 'Completed': return COLORS.secondary;
    case 'Paid Out': return COLORS.primary;
    default: return COLORS.accentGold;
  }
}

export default function ReferralsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = user?.role === 'staff';

  const fetchReferrals = useCallback(async () => {
    if (!user) return;
    try {
      const data = isStaff
        ? await staffApi.getReferrals(user.id)
        : await customerApi.getReferrals(user.id);
      setReferrals(data);
    } catch {}
    setLoading(false);
  }, [user, isStaff]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReferrals();
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!user?.referralCode) {
      Alert.alert('No Code', 'You don\'t have a referral code yet.');
      return;
    }
    try {
      await Share.share({
        message: `Use my referral code ${user.referralCode} when you book with CiN Cleaning and we both get rewarded! Book at https://cleanitneatly.com`,
      });
    } catch {}
  };

  const totalEarned = referrals
    .filter((r) => r.status === 'Paid Out' || r.status === 'Completed')
    .reduce((sum, r) => sum + r.rewardAmount, 0);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={referrals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Share card */}
            <View style={styles.shareCard}>
              <View style={styles.shareIconCircle}>
                <Ionicons name="gift-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.shareTitle}>Refer & Earn</Text>
              <Text style={styles.shareSub}>
                Share your code and earn rewards when friends book a clean.
              </Text>
              {user?.referralCode && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{user.referralCode}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={COLORS.white} />
                <Text style={styles.shareBtnText}>Share Code</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{referrals.length}</Text>
                <Text style={styles.statLabel}>Referrals</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{referrals.filter((r) => r.status === 'Completed' || r.status === 'Paid Out').length}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{'£'}{totalEarned.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
            </View>

            {referrals.length > 0 && (
              <Text style={styles.sectionTitle}>Your Referrals</Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No referrals yet</Text>
            <Text style={styles.emptySub}>Share your code to get started!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = getStatusColor(item.status);
          return (
            <View style={styles.refCard}>
              <View style={styles.refLeft}>
                <Text style={styles.refName}>{item.referredClientName}</Text>
                <Text style={styles.refDate}>
                  {new Date(item.dateReferred).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.refRight}>
                <Text style={styles.refAmount}>{'£'}{item.rewardAmount.toFixed(0)}</Text>
                <View style={[styles.refBadge, { backgroundColor: sc + '18' }]}>
                  <Text style={[styles.refBadgeText, { color: sc }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  shareCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  shareIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  shareTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  shareSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.md },
  codeBox: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
  },
  codeText: { fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, marginTop: 2 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  refCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  refLeft: {},
  refName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  refDate: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  refRight: { alignItems: 'flex-end' },
  refAmount: { fontSize: 16, fontWeight: '700', color: COLORS.secondary },
  refBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm, marginTop: 4 },
  refBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: 13, color: COLORS.textTertiary },
});
