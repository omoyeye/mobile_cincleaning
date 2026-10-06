import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/config';

const FAQ = [
  {
    q: 'How do I book a clean?',
    a: 'Tap "Book a Clean" from the home screen, choose your service type, select a date and time, enter your property details, and confirm. No account needed for guest bookings.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. Open your booking and tap "Cancel Booking". Cancellations within 24 hours of the scheduled time may incur a short-notice fee.',
  },
  {
    q: 'How do I change my booking date or time?',
    a: 'Contact us directly via email or phone and we\'ll reschedule your booking at no extra charge, subject to availability.',
  },
  {
    q: 'How are cleaners vetted?',
    a: 'All CiN cleaners are fully vetted, insured, and background-checked before joining our team. We maintain high standards through regular reviews.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major debit and credit cards through our secure Stripe payment system. Payment links are sent after booking confirmation.',
  },
  {
    q: 'How does the referral program work?',
    a: 'Share your unique referral code with friends. When they book and complete a clean, you both earn rewards. Check your referral page for your code.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<number | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact card */}
        <View style={styles.contactCard}>
          <View style={styles.contactIcon}>
            <Ionicons name="headset-outline" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.contactTitle}>Get in Touch</Text>
          <Text style={styles.contactSub}>We're here to help with any questions</Text>

          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Linking.openURL('mailto:info@cleanitneatly.com')}
            >
              <Ionicons name="mail-outline" size={20} color={COLORS.white} />
              <Text style={styles.contactBtnText}>Email Us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnOutline]}
              onPress={() => Linking.openURL('tel:+442012345678')}
            >
              <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              <Text style={styles.contactBtnTextOutline}>Call Us</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.contactEmail}>info@cleanitneatly.com</Text>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQ.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.faqCard}
            activeOpacity={0.7}
            onPress={() => setExpanded(expanded === i ? null : i)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Ionicons
                name={expanded === i ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textTertiary}
              />
            </View>
            {expanded === i && (
              <Text style={styles.faqAnswer}>{item.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Website link */}
        <TouchableOpacity
          style={styles.websiteLink}
          onPress={() => Linking.openURL('https://cleanitneatly.com')}
        >
          <Ionicons name="globe-outline" size={18} color={COLORS.primary} />
          <Text style={styles.websiteLinkText}>Visit our website</Text>
          <Ionicons name="open-outline" size={14} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  contactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  contactIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  contactTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  contactSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  contactRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  contactBtnOutline: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  contactBtnTextOutline: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  contactEmail: { fontSize: 12, color: COLORS.textTertiary, marginTop: SPACING.md },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  faqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  faqAnswer: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    marginTop: SPACING.md,
  },
  websiteLinkText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});
