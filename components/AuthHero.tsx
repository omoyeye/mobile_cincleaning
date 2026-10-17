import React from 'react';
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { FadeInUp, PhotoBackdrop } from './Motion';

/** Photo banner with the logo badge, used at the top of sign in and sign up. */
export function AuthHero({ photo, title, subtitle }: { photo: ImageSourcePropType; title: string; subtitle: string }) {
  return (
    <View style={styles.wrap}>
      <FadeInUp>
        <PhotoBackdrop
          source={photo}
          style={styles.photo}
          colors={['rgba(12,31,51,0.05)', 'rgba(12,31,51,0.15)', 'rgba(12,31,51,0.55)']}
          locations={[0, 0.5, 1]}
        />
        <View style={styles.logoBadge}>
          <Image source={require('../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="CiN Cleaning logo" />
        </View>
      </FadeInUp>
      <FadeInUp index={1} style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.xl },
  photo: { height: 170, borderRadius: RADIUS.xl },
  logoBadge: {
    alignSelf: 'center',
    marginTop: -38,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  logo: { width: 130, height: 56 },
  text: { alignItems: 'center', marginTop: SPACING.base },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
});
