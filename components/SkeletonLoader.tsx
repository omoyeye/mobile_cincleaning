import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle, type DimensionValue } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/config';

function SkeletonBlock({ width, height, style }: { width?: DimensionValue; height?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width || '100%', height: height || 16, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SkeletonBlock width="60%" height={18} />
        <SkeletonBlock width={70} height={24} style={{ borderRadius: RADIUS.sm }} />
      </View>
      <View style={[styles.cardRow, { marginTop: SPACING.md }]}>
        <SkeletonBlock width="30%" height={14} />
        <SkeletonBlock width="25%" height={14} />
        <SkeletonBlock width="20%" height={14} />
      </View>
      <View style={[styles.cardRow, { marginTop: SPACING.sm }]}>
        <SkeletonBlock width="25%" height={20} />
      </View>
    </View>
  );
}

export function StatsSkeleton() {
  return (
    <View style={styles.statsRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.statCard}>
          <SkeletonBlock width={24} height={24} style={{ borderRadius: 12 }} />
          <SkeletonBlock width="70%" height={18} />
          <SkeletonBlock width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function NotificationSkeleton() {
  return (
    <View style={styles.notifCard}>
      <SkeletonBlock width={40} height={40} style={{ borderRadius: RADIUS.md }} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="90%" height={12} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 4, type = 'card' }: { count?: number; type?: 'card' | 'notification' }) {
  const Component = type === 'notification' ? NotificationSkeleton : CardSkeleton;
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  block: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
});
