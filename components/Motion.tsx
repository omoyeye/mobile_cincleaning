import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle, type ImageSourcePropType } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Small motion kit used across the app. Everything respects the phone's "reduce motion" setting
 * and uses Reanimated so animations run on the UI thread and stay smooth.
 */

/** Fades content up into place; `index` staggers lists so cards arrive one after another. */
export function FadeInUp({ index = 0, children, style, delay = 0 }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View
      style={style}
      entering={reduce ? undefined : FadeInDown.delay(delay + Math.min(index, 8) * 60).duration(420).springify().damping(18).mass(0.8)}
    >
      {children}
    </Animated.View>
  );
}

type PressableScaleProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode };

// Keys that position the card among its siblings; they must sit on the outer Pressable or `flex: 1` and margins do nothing.
const OUTER_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
] as const;

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = { ...(StyleSheet.flatten(style) || {}) } as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  for (const k of OUTER_KEYS) {
    if (k in flat) {
      outer[k] = flat[k];
      delete flat[k];
    }
  }
  return { outer: outer as ViewStyle, inner: flat as ViewStyle };
}

/** A pressable card that sinks slightly under the finger, then springs back. */
export function PressableScale({ style, scaleTo = 0.97, children, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { outer, inner } = splitStyle(style);
  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(e) => {
        if (!reduce) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[inner, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Live indicator: a solid dot with a soft ring that keeps pulsing outwards. */
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduce]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** Slowly drifting highlight used on hero cards (very subtle). */
export function Shine({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: -30 + t.value * 60 }, { translateY: -10 + t.value * 20 }] }));
  return <Animated.View pointerEvents="none" style={[styles.shine, style, drift]} />;
}

/**
 * Photo with a gradient laid over it so text on top stays readable.
 * `fade` is the colour the gradient ends in (usually the screen background or brand blue).
 */
export function PhotoBackdrop({
  source,
  style,
  children,
  colors = ['rgba(12,31,51,0.05)', 'rgba(12,31,51,0.55)', 'rgba(12,31,51,0.88)'],
  locations = [0, 0.55, 1],
  contentStyle,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.backdrop, style]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} cachePolicy="memory-disk" />
      <LinearGradient colors={colors} locations={locations} style={StyleSheet.absoluteFill} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { overflow: 'hidden' },
  shine: {
    position: 'absolute',
    right: -60,
    top: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
