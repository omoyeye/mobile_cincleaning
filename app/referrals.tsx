import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBack } from '../utils/navigation';
import { useAuth } from '../contexts/AuthContext';
import { customerApi, staffApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import type { Referral, ReferralSummary } from '../types';
import { BrandRefresh } from '../components/BrandRefresh';
import { usePullRefresh } from '../hooks/usePullRefresh';

/** Plain wording for each friend's reward, depending on who referred them. */
function statusOf(r: Referral, isStaff: boolean): { label: string; color: string } {
  if (r.status === 'Paid Out') return { label: 'Paid', color: COLORS.primary };
  if (r.status === 'Rejected') return { label: 'Not eligible', color: COLORS.textTertiary };
  if (r.status === 'Completed') {
    if (!isStaff) return { label: 'Credit added', color: COLORS.secondary };
    return r.payStatus === 'claimed' ? { label: 'On an invoice', color: '#6366f1' } : { label: 'Ready to claim', color: COLORS.secondary };
  }
  return { label: 'Waiting for first clean', color: '#b45309' };
}

export default function ReferralsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => fetchReferrals());

  const isStaff = user?.role === 'staff';

  const fetchReferrals = useCallback(async () => {
    if (!user) return;
    try {
      const api = isStaff ? staffApi : customerApi;
      const [data, sum] = await Promise.all([api.getReferrals(user.id), api.getReferralSummary().catch(() => null)]);
      setReferrals(data);
      setSummary(sum);
    } catch {}
    setLoading(false);
  }, [user, isStaff]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);


  const handleShare = async () => {
    if (!user?.referralCode) {
      Alert.alert('No Code', 'You don\'t have a referral code yet.');
      return;
    }
    try {
      await Share.share({
        message: `I use CiN Cleaning and they are great. Create your account with my referral code ${user.referralCode} at https://cleanitneatly.com and book your first clean.`,
      });
    } catch {}
  };

  const reward = summary?.rewardAmount ?? referrals[0]?.rewardAmount ?? 20;
  const claimableTotal = (summary?.claimable ?? []).reduce((s, c) => s + c.amount, 0);
  const unlockedCount = referrals.filter((r) => r.status === 'Completed' || r.status === 'Paid Out').length;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={referrals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
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
                {isStaff
                  ? `Earn a £${reward.toFixed(0)} bonus for every friend who books their first clean.`
                  : `Get £${reward.toFixed(0)} cleaning credit for every friend who books their first clean.`}
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

            {/* Balance: what they can use right now */}
            {summary ? (
              isStaff ? (
                <View style={styles.balanceCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.balanceLabel}>Ready to claim</Text>
                    <Text style={styles.balanceValue}>{'£'}{claimableTotal.toFixed(2)}</Text>
                    <Text style={styles.balanceSub}>
                      {summary.paid ? `£${summary.paid.toFixed(2)} paid so far` : 'Paid with your weekly invoice'}
                      {summary.pending ? ` · £${summary.pending.toFixed(2)} waiting` : ''}
                    </Text>
                  </View>
                  {claimableTotal > 0 ? (
                    <TouchableOpacity style={styles.balanceBtn} onPress={() => router.push('/(staff)/earnings')}>
                      <Text style={styles.balanceBtnText}>Claim</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.balanceCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.balanceLabel}>Your cleaning credit</Text>
                    <Text style={styles.balanceValue}>{'£'}{(summary.credit?.balance ?? 0).toFixed(2)}</Text>
                    <Text style={styles.balanceSub}>
                      {(summary.credit?.balance ?? 0) > 0
                        ? 'Comes off your next booking automatically.'
                        : 'Credit appears here when a friend has their first clean.'}
                      {summary.pending ? ` £${summary.pending.toFixed(2)} on its way.` : ''}
                    </Text>
                    <Text style={styles.balanceFine}>Can only be used towards your cleaning. No cash value.</Text>
                  </View>
                  {(summary.credit?.balance ?? 0) > 0 ? (
                    <TouchableOpacity style={styles.balanceBtn} onPress={() => router.push('/book')}>
                      <Text style={styles.balanceBtnText}>Book</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            ) : null}

            {/* How it works */}
            <View style={styles.steps}>
              {[
                { icon: 'share-social-outline' as const, text: 'Share your code with a friend' },
                { icon: 'person-add-outline' as const, text: 'They enter it when they create their account' },
                {
                  icon: 'sparkles-outline' as const,
                  text: isStaff ? 'After their first clean, claim your bonus on your weekly invoice' : 'After their first clean, you get cleaning credit',
                },
              ].map((st, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={st.icon} size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.stepText}>{st.text}</Text>
                </View>
              ))}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{referrals.length}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{unlockedCount}</Text>
                <Text style={styles.statLabel}>Had a clean</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{'£'}{(summary?.unlocked ?? 0).toFixed(0)}</Text>
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
          const st = statusOf(item, isStaff);
          const sc = st.color;
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
                  <Text style={[styles.refBadgeText, { color: sc }]}>{st.label}</Text>
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

  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  balanceLabel: { fontSize: 12, fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceValue: { fontSize: 28, fontWeight: '800', color: '#065f46', marginTop: 2 },
  balanceSub: { fontSize: 12.5, color: '#047857', marginTop: 2, lineHeight: 17 },
  balanceFine: { fontSize: 11, color: '#059669', marginTop: 4 },
  balanceBtn: { backgroundColor: COLORS.secondary, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9 },
  balanceBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  steps: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
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
