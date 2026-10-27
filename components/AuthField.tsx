import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS } from '../constants/config';

type Props = TextInputProps & {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  error?: string | null;
  hint?: string;
  /** Adds a show/hide toggle and hides the text by default. */
  password?: boolean;
};

/** Text field for the sign in and sign up screens: icon, focus ring, inline error and password toggle. */
export const AuthField = forwardRef<TextInput, Props>(function AuthField(
  { label, icon, error, hint, password, style, onFocus, onBlur, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const tone = error ? COLORS.error : focused ? COLORS.primary : COLORS.textTertiary;

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        <Ionicons name={icon} size={18} color={tone} />
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={COLORS.textTertiary}
          secureTextEntry={password ? !visible : input.secureTextEntry}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          accessibilityLabel={label}
          {...input}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.msgRow}>
          <Ionicons name="alert-circle" size={13} color={COLORS.error} />
          <Text style={styles.error}>{error}</Text>
        </Animated.View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

/** Red banner for errors that belong to the whole form (wrong password, no connection). */
export function FormBanner({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'success' }) {
  if (!message) return null;
  const ok = tone === 'success';
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.banner, ok ? styles.bannerOk : styles.bannerErr]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={ok ? COLORS.success : COLORS.error} />
      <Text style={[styles.bannerText, { color: ok ? '#065f46' : '#9b1c14' }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  boxFocused: { borderColor: COLORS.primary, backgroundColor: '#fbfdff' },
  boxError: { borderColor: COLORS.error, backgroundColor: '#fffafa' },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 16,
    color: COLORS.text,
    // The box already shows focus; drop the browser's own outline in the web build.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  error: { fontSize: 12.5, fontWeight: '600', color: COLORS.error, flex: 1 },
  hint: { fontSize: 12.5, color: COLORS.textTertiary },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
  },
  bannerErr: { backgroundColor: COLORS.errorLight, borderColor: '#f8c9c5' },
  bannerOk: { backgroundColor: COLORS.successLight, borderColor: '#a7f3d0' },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
});
