import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/config';

/** Shown instead of a blank or closed app if a screen crashes. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name="refresh-circle-outline" size={34} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>Please try again. If it keeps happening, close and reopen the app.</Text>
      <TouchableOpacity style={styles.btn} onPress={retry} activeOpacity={0.85}>
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.background },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.infoLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.base },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  body: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, maxWidth: 300, lineHeight: 21 },
  btn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.md },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
