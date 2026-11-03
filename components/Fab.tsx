import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING } from '../constants/config';
import { useHaptic } from '../hooks/useHaptic';
import { staffApi } from '../services/api';
import { localYmd } from './staff/StaffKit';
import type { Booking } from '../types';

type IconName = keyof typeof Ionicons.glyphMap;

/** Round gradient button raised above the middle of the tab bar. */
export function FabButton({
  icon,
  label,
  onPress,
  open = false,
  caption,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  open?: boolean;
  /** Short word under the button, in line with the tab labels. */
  caption?: string;
}) {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withSpring(open ? 1 : 0, { damping: 14, stiffness: 200 });
  }, [open]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.fabPress}>
      {({ pressed }) => (
        <>
          <View style={[styles.fabOuter, pressed && { transform: [{ scale: 0.94 }] }]}>
            <LinearGradient colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
              <Animated.View style={spin}>
                <Ionicons name={icon} size={28} color={COLORS.white} />
              </Animated.View>
            </LinearGradient>
          </View>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

/** Clients: one tap to book a clean. */
export function BookFab() {
  const router = useRouter();
  const haptic = useHaptic();
  return (
    <FabButton
      icon="add"
      label="Book a clean"
      caption="Book"
      onPress={() => {
        haptic.medium();
        router.push('/book');
      }}
    />
  );
}

type Action = { icon: IconName; label: string; sub?: string; tint: string; go: string };

/** Staff: quick actions for the day, opened from the middle of the tab bar. */
export function StaffActionsFab() {
  const router = useRouter();
  const haptic = useHaptic();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Booking | null>(null);

  const show = () => {
    haptic.medium();
    setOpen(true);
    const today = localYmd();
    staffApi
      .getBookings()
      .then((list) => {
        const upcoming = list
          .filter((b) => (b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'In Progress') && String(b.date).slice(0, 10) >= today)
          .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        setNext(upcoming[0] ?? null);
      })
      .catch(() => {});
  };

  const actions: Action[] = [
    ...(next
      ? [
          {
            icon: 'play-circle' as IconName,
            label: String(next.date).slice(0, 10) === localYmd() ? 'Start my next job' : 'Open my next job',
            sub: `${next.contact?.name || 'Client'} · ${String(next.date).slice(0, 10) === localYmd() ? 'Today' : String(next.date).slice(5, 10).split('-').reverse().join('/')} ${next.time}`,
            tint: COLORS.secondary,
            go: `/job/${next.id}`,
          },
        ]
      : []),
    { icon: 'alarm', label: 'Running late', sub: 'Tell the client and the office', tint: COLORS.accent, go: '/running-late' },
    { icon: 'wallet', label: 'Earnings and invoice', sub: 'This week and your weekly invoice', tint: COLORS.primary, go: '/(staff)/earnings' },
    { icon: 'chatbubbles', label: 'Message the office', tint: '#6d52e8', go: '/(staff)/inbox?tab=office' },
  ];

  const pick = (go: string) => {
    haptic.light();
    setOpen(false);
    router.push(go as never);
  };

  return (
    <>
      <FabButton icon="flash" label="Quick actions" caption="Actions" onPress={show} />
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close quick actions">
          <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={[styles.sheetWrap, { bottom: Math.max(insets.bottom, SPACING.sm) + 92 }]} pointerEvents="box-none">
          <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Quick actions</Text>
            {actions.map((a, i) => (
              <Animated.View key={a.label} entering={FadeInDown.delay(40 * i).springify().damping(16)}>
                <Pressable style={({ pressed }) => [styles.action, pressed && { backgroundColor: COLORS.surfaceAlt }]} onPress={() => pick(a.go)} accessibilityRole="button">
                  <View style={[styles.actionIcon, { backgroundColor: a.tint + '18' }]}>
                    <Ionicons name={a.icon} size={20} color={a.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                    {a.sub ? (
                      <Text style={styles.actionSub} numberOfLines={1}>
                        {a.sub}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
        <View style={[styles.fabEcho, { bottom: Math.max(insets.bottom, SPACING.sm) + 9 }]} pointerEvents="box-none">
          <FabButton icon="close" label="Close quick actions" caption="Actions" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabPress: { alignItems: 'center' },
  caption: { fontSize: 11, fontWeight: '800', color: COLORS.primary, marginTop: 3 },
  fabOuter: {
    marginTop: -34,
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 4,
    backgroundColor: COLORS.background,
    ...SHADOW.raised,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.3,
  },
  fab: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,31,51,0.45)' },
  sheetWrap: { position: 'absolute', left: SPACING.base, right: SPACING.base, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.sm,
    ...SHADOW.raised,
  },
  sheetTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  fabEcho: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
