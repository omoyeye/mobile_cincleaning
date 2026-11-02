import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS, RADIUS } from '../constants/config';
import { PulseDot } from './Motion';
import { LIVE_LABEL, type LiveState } from '../utils/live';

/** Pulsing green outline laid over a card while its clean is live. Sits inside the card (last child). */
export function LiveRing({ radius = RADIUS.lg, color = COLORS.secondary }: { radius?: number; color?: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce]);
  const pulse = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.65 }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2, borderColor: color }, pulse]}
    />
  );
}

/** "On the way" / "Cleaning now" pill with a live dot. */
export function LiveBadge({ state, onDark = false, style }: { state: LiveState; onDark?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!state) return null;
  return (
    <View style={[styles.pill, onDark ? styles.pillOnDark : null, style]} accessibilityLabel={`Live: ${LIVE_LABEL[state]}`}>
      <PulseDot color={COLORS.secondary} />
      <Text style={styles.text}>{LIVE_LABEL[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondary + '14',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pillOnDark: { backgroundColor: COLORS.white },
  text: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
});
