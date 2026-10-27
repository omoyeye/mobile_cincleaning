import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Image,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as Photo } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { PHOTOS } from '../components/media';
import { PressableScale } from '../components/Motion';

const slides: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; color: string; photo: ImageSourcePropType }[] = [
  {
    icon: 'sparkles-outline',
    title: 'Professional Cleaning',
    description: 'Book trusted, vetted cleaners for your home or office with just a few taps.',
    color: COLORS.primary,
    photo: PHOTOS.deep,
  },
  {
    icon: 'calendar-outline',
    title: 'Easy Scheduling',
    description: 'Pick a date and time that works for you. Move or cancel your booking from the app.',
    color: '#6366f1',
    photo: PHOTOS.towels,
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Stay Connected',
    description: 'Chat with your cleaner, follow them live on the day, and get real-time updates.',
    color: '#0891b2',
    photo: PHOTOS.trolley,
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Safe & Secure',
    description: 'Vetted, insured cleaners and secure card payments. Your satisfaction is guaranteed.',
    color: '#16a34a',
    photo: PHOTOS.standard,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const photoHeight = Math.round(Math.min(height * 0.52, 460));

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    // Everyone (clients and staff) lands on the shared welcome page first.
    router.replace('/welcome');
  };

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          // Parallax: the photo drifts slower than the swipe.
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const translateX = scrollX.interpolate({ inputRange, outputRange: [-width * 0.25, 0, width * 0.25], extrapolate: 'clamp' });
          const textOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const textShift = scrollX.interpolate({ inputRange, outputRange: [24, 0, -24], extrapolate: 'clamp' });
          return (
            <View style={{ width }}>
              <View style={[styles.photoWrap, { height: photoHeight }]}>
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }, { scale: 1.12 }] }]}>
                  <Photo source={item.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
                </Animated.View>
                <LinearGradient
                  colors={['rgba(12,31,51,0.35)', 'rgba(12,31,51,0)', 'rgba(247,250,252,0)', COLORS.background]}
                  locations={[0, 0.25, 0.7, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Animated.View style={[styles.textBlock, { opacity: textOpacity, transform: [{ translateX: textShift }] }]}>
                <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={28} color={COLORS.white} />
                </View>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideDesc}>{item.description}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      {/* Logo and Skip float over the photos */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.logoPill}>
            <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
          </View>
          {currentIndex < slides.length - 1 ? (
            <TouchableOpacity onPress={finishOnboarding} style={styles.skipPill} accessibilityLabel="Skip the introduction">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
      </SafeAreaView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 26, 8], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity, backgroundColor: s.color }]} />;
          })}
        </View>

        <PressableScale style={styles.nextBtn} onPress={goNext} accessibilityRole="button">
          <Text style={styles.nextText}>{currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  photoWrap: { overflow: 'hidden', backgroundColor: COLORS.surfaceAlt },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  logoPill: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 4 },
  headerLogo: { width: 96, height: 34 },
  skipPill: { backgroundColor: 'rgba(12,31,51,0.45)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  skipText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  textBlock: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xl, marginTop: -36 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 4,
    borderColor: COLORS.background,
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  slideTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.md, letterSpacing: -0.3 },
  slideDesc: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 340 },
  bottom: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
