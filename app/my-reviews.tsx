import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import { ListSkeleton } from '../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../constants/config';

interface Review {
  id: number;
  rating: number;
  feedback?: string;
  customerName?: string;
  serviceName?: string;
  createdAt: string;
}

export default function MyReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avgRating, setAvgRating] = useState(0);

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    try {
      const data = await staffApi.getReviews(user.id);
      setReviews(data);
      if (data.length > 0) {
        const sum = data.reduce((a: number, r: Review) => a + r.rating, 0);
        setAvgRating(sum / data.length);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReviews();
    setRefreshing(false);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? COLORS.accentGold : COLORS.textTertiary}
        />,
      );
    }
    return stars;
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

      {loading ? (
        <ListSkeleton count={3} type="card" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryRating}>{avgRating.toFixed(1)}</Text>
              <View style={styles.summaryStars}>{renderStars(Math.round(avgRating))}</View>
              <Text style={styles.summaryCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.summaryIcon}>
              <Ionicons name="star" size={36} color={COLORS.accentGold} />
            </View>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptySub}>Reviews from customers will appear here after completed jobs.</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                {review.feedback && (
                  <Text style={styles.reviewText}>{review.feedback}</Text>
                )}
                <View style={styles.reviewMeta}>
                  {review.customerName && (
                    <Text style={styles.reviewCustomer}>{review.customerName}</Text>
                  )}
                  {review.serviceName && (
                    <Text style={styles.reviewService}>{review.serviceName}</Text>
                  )}
                </View>
              </View>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  summaryLeft: { gap: 4 },
  summaryRating: { fontSize: 36, fontWeight: '800', color: COLORS.text },
  summaryStars: { flexDirection: 'row', gap: 2 },
  summaryCount: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentGold + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },

  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { fontSize: 12, color: COLORS.textTertiary },
  reviewText: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: SPACING.sm },
  reviewMeta: { flexDirection: 'row', gap: SPACING.sm },
  reviewCustomer: { fontSize: 12, color: COLORS.textSecondary },
  reviewService: { fontSize: 12, color: COLORS.textTertiary },
});
