import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { COLORS, RADIUS, SHADOW, SPACING } from '../constants/config';
import { useHaptic } from '../hooks/useHaptic';

type IconName = keyof typeof Ionicons.glyphMap;

/** Icon per tab route: outline when idle, filled when selected. */
export type TabIcons = Record<string, [IconName, IconName]>;

function TabItem({
  label,
  icons,
  focused,
  badge,
  onPress,
  onLongPress,
}: {
  label: string;
  icons: [IconName, IconName];
  focused: boolean;
  badge?: number | string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduce = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [focused, reduce]);
  const pill = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: 0.6 + on.value * 0.4 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(focused ? -1 : 0, { duration: 150 }) }] }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={4}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pill]} />
        <Animated.View style={icon}>
          <Ionicons name={focused ? icons[1] : icons[0]} size={22} color={focused ? COLORS.primary : COLORS.textTertiary} />
        </Animated.View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Floating bottom bar used by the client and staff apps. It sits on the screen background with a
 * soft shadow, clears the phone's own gesture bar or buttons, and hides routes marked `href: null`.
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
  icons,
  fab,
}: BottomTabBarProps & { icons: TabIcons; /** Raised button in the middle of the bar (not a tab). */ fab?: React.ReactNode }) {
  const haptic = useHaptic();
  const routes = state.routes.filter((r) => {
    const style = descriptors[r.key].options.tabBarItemStyle as { display?: string } | undefined;
    return style?.display !== 'none';
  });

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.light();
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          const item = (
            <TabItem
              key={route.key}
              label={label}
              icons={icons[route.name] ?? ['ellipse-outline', 'ellipse']}
              focused={focused}
              badge={options.tabBarBadge}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
          // The action button sits in the middle, between the two halves of the tabs.
          if (fab && i === Math.floor(routes.length / 2)) {
            return (
              <React.Fragment key={route.key}>
                <View style={styles.fabSlot}>{fab}</View>
                {item}
              </React.Fragment>
            );
          }
          return item;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.xs,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border + '66',
    ...SHADOW.raised,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  fabSlot: { width: 68, alignItems: 'center' },
  iconWrap: { width: 56, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.full, backgroundColor: COLORS.primary + '18' },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary },
  labelOn: { color: COLORS.primary, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
});
