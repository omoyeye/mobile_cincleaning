import React, { useState, useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { Image as Photo } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp, PhotoBackdrop, PressableScale, Shine } from '../components/Motion';
import { PHOTOS, servicePhoto, wrapName } from '../components/media';
import { publicApi } from '../services/api';
import type { ServiceConfig } from '../types';

const SERVICES_PREVIEW = [
  { icon: 'sparkles-outline' as const, label: 'Regular' },
  { icon: 'flash-outline' as const, label: 'Deep Clean' },
  { icon: 'key-outline' as const, label: 'End of Tenancy' },
  { icon: 'bed-outline' as const, label: 'Airbnb' },
  { icon: 'business-outline' as const, label: 'Commercial' },
  { icon: 'water-outline' as const, label: 'Jet Wash' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [services, setServices] = useState<ServiceConfig[]>([]);

  useEffect(() => {
    publicApi.getServices().then((list) => setServices(list.filter((s) => s.active !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    // Wait until the saved sign-in has loaded, or signed-in people get sent to onboarding and login.
    if (loading) return;
    (async () => {
      try {
        const done = await AsyncStorage.getItem('onboarding_complete');
        if (!done && !user) {
          router.replace('/onboarding');
          return;
        }
      } catch {}
      setCheckingOnboarding(false);
    })();
  }, [user, loading]);

  if (loading || checkingOnboarding) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (user?.role === 'staff') return <Redirect href="/(staff)" />;
  if (user?.role === 'customer' || user?.role === 'admin') return <Redirect href="/(customer)" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image source={require('../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Hero */}
        <FadeInUp>
          <PhotoBackdrop
            source={PHOTOS.lounge}
            style={styles.hero}
            colors={['rgba(12,31,51,0.1)', 'rgba(12,31,51,0.55)', 'rgba(8,40,70,0.95)']}
            locations={[0, 0.45, 1]}
          >
            <Shine />
            <View style={styles.heroBadge}>
              <Ionicons name="star" size={12} color={COLORS.accentGold} />
              <Text style={styles.heroBadgeText}>Rated 5 stars by our clients</Text>
            </View>
            <Text style={styles.heroTitle}>Professional cleaning{'\n'}at your fingertips</Text>
            <Text style={styles.heroSub}>Trusted cleaners across London and Manchester. Book in minutes, no account needed.</Text>
            <PressableScale style={styles.bookBtn} onPress={() => router.push('/book')} accessibilityRole="button">
              <View style={styles.bookBtnInner}>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
                <Text style={styles.bookBtnText}>Book a Clean</Text>
              </View>
              <View style={styles.bookBtnArrow}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
              </View>
            </PressableScale>
          </PhotoBackdrop>
        </FadeInUp>

        {/* Inline sign-up / sign-in row */}
        <View style={styles.authRow}>
          <TouchableOpacity
            style={styles.signupBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register')}
          >
            <Ionicons name="person-add-outline" size={16} color={COLORS.white} />
            <Text style={styles.signupBtnText}>Sign Up Free</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signinBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/(auth)/login')}
          >
            <Ionicons name="log-in-outline" size={16} color={COLORS.primary} />
            <Text style={styles.signinBtnText}>Member Sign In</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.authHint}>
          Join for free to track bookings, earn rewards &amp; get discounts
        </Text>

        {/* Services: live list with photos; the fixed list is only a fallback while offline */}
        <Text style={styles.sectionTitle}>Our Services</Text>
        <View style={styles.servicesGrid}>
          {(services.length ? services.map((s) => ({ key: String(s.id), label: s.name, id: String(s.id) })) : SERVICES_PREVIEW.map((s) => ({ key: s.label, label: s.label, id: '' }))).map((svc, i) => (
            <FadeInUp key={svc.key} index={i} style={styles.serviceCell}>
              <PressableScale
                style={styles.serviceTile}
                onPress={() => router.push(svc.id ? `/book?service=${encodeURIComponent(svc.id)}` : '/book')}
                accessibilityRole="button"
                accessibilityLabel={`Book ${svc.label}`}
              >
                <Photo source={servicePhoto(svc.label)} style={styles.serviceTilePhoto} contentFit="cover" transition={300} />
                <LinearGradient colors={['rgba(12,31,51,0)', 'rgba(12,31,51,0.8)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
                <Text style={styles.serviceTileLabel} numberOfLines={2}>{wrapName(svc.label)}</Text>
              </PressableScale>
            </FadeInUp>
          ))}
        </View>

        {/* Trust badges */}
        <View style={styles.trustSection}>
          {[
            { icon: 'shield-checkmark-outline' as const, text: 'Vetted & insured cleaners' },
            { icon: 'time-outline' as const, text: 'Same-day availability' },
            { icon: 'card-outline' as const, text: 'Transparent pricing' },
            { icon: 'star-outline' as const, text: '5-star rated service' },
          ].map((item) => (
            <View key={item.text} style={styles.trustRow}>
              <View style={styles.trustIconWrap}>
                <Ionicons name={item.icon} size={16} color={COLORS.success} />
              </View>
              <Text style={styles.trustText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Staff sign-in */}
        <TouchableOpacity
          style={styles.staffSection}
          activeOpacity={0.7}
          onPress={() => router.push('/(auth)/login')}
        >
          <View style={styles.staffIconWrap}>
            <Ionicons name="briefcase-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.staffTextWrap}>
            <Text style={styles.staffTitle}>Staff Portal</Text>
            <Text style={styles.staffSub}>Sign in to manage your schedule</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg },
  hero: { borderRadius: RADIUS.xl, padding: SPACING.lg, paddingTop: 120, marginTop: SPACING.sm },
  heroBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginBottom: SPACING.md,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  serviceCell: { width: '48.5%' },
  serviceTile: { height: 120, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surfaceAlt },
  serviceTilePhoto: { width: '100%', height: '100%' },
  serviceTileLabel: { position: 'absolute', left: 12, right: 12, bottom: 10, fontSize: 14, fontWeight: '800', color: COLORS.white, lineHeight: 18 },

  logoWrap: { alignItems: 'center', marginTop: SPACING.md },
  logo: { width: 180, height: 72 },

  heroTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white, lineHeight: 32, letterSpacing: -0.4 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: SPACING.sm, lineHeight: 21 },

  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingLeft: SPACING.lg,
    paddingRight: 8,
    marginTop: SPACING.lg,
  },
  bookBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bookBtnText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  bookBtnArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  authRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  signupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
  },
  signupBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  signinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  signinBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  authHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },

  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    width: '48%',
  },
  serviceChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceChipLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },

  trustSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 10,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  trustIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  staffSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  staffIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffTextWrap: { flex: 1 },
  staffTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  staffSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
