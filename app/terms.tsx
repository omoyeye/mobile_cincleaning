import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/config';

const TERMS_SECTIONS = [
  {
    title: 'Service Agreement',
    body: 'By booking a cleaning service through CiN Cleaning, you agree to these terms and conditions. Our services are available to residential and commercial customers within our covered areas. You must be at least 18 years old to use our services.',
  },
  {
    title: 'Company Information',
    body: 'CiN Cleaning Ltd is registered in England and Wales. Registered address: [Registered Address]. Company number: [Company Number]. VAT number: [VAT Number]. Contact: info@cleanitneatly.com.',
  },
  {
    title: 'Booking & Payment',
    body: 'Bookings are confirmed upon receipt of payment or acceptance of a payment link. Prices are displayed at booking time and include VAT where applicable. We accept card payments processed securely through Stripe. A deposit may be required at the time of booking.',
  },
  {
    title: 'Cancellation Policy',
    body: 'Cancellations made more than 24 hours before the scheduled service are free of charge. Cancellations within 24 hours may incur a short-notice fee of up to 50% of the booking value. No-shows are charged at full price.',
  },
  {
    title: 'Consumer Rights & Cooling-Off Period',
    body: 'Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, you have a 14-day cooling-off period from the date of booking to cancel without charge. If you request that the service begins within this period, you acknowledge that you will lose the right to cancel once the service has been fully performed. Partial performance will be charged proportionally.',
  },
  {
    title: 'Our Responsibilities',
    body: 'All CiN cleaners are vetted, insured, and trained to a high standard. We carry public liability insurance. If you are unsatisfied with the quality of a clean, please contact us within 24 hours and we will arrange a re-clean at no additional cost.',
  },
  {
    title: 'Limitation of Liability',
    body: 'Our total liability for any claim arising from or related to our services is limited to the value of the booking in question. We are not liable for indirect, incidental, or consequential losses. Nothing in these terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.',
  },
  {
    title: 'Your Responsibilities',
    body: 'Please ensure the property is accessible at the scheduled time. Valuable, fragile, or irreplaceable items should be secured before the clean. Pets should be safely contained during the cleaning session.',
  },
  {
    title: 'Loyalty & Referral Programme',
    body: 'Loyalty points are earned on eligible bookings and can be redeemed against future services at a rate of 100 points = £1.00. Referral rewards are credited once the referred customer completes their first booking. CiN Cleaning reserves the right to modify or discontinue the programme with 30 days\' notice.',
  },
  {
    title: 'Intellectual Property',
    body: 'All content, branding, logos, and materials within the CiN Cleaning app and website are the property of CiN Cleaning Ltd and are protected by copyright and trademark laws. You may not reproduce, distribute, or create derivative works without our written permission.',
  },
  {
    title: 'Dispute Resolution',
    body: 'If you have a complaint, please contact us first at info@cleanitneatly.com and we will try to resolve it promptly. If we cannot resolve your complaint, you may refer it to an Alternative Dispute Resolution (ADR) provider. You can also contact Citizens Advice or the relevant trading standards office. As required by the Consumer Rights Act 2015, we provide this information about ADR.',
  },
  {
    title: 'Governing Law',
    body: 'These terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.',
  },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. Data Controller',
    body: 'CiN Cleaning Ltd ("we", "us", "our") is the data controller responsible for your personal data. Registered address: [Registered Address]. Company number: [Company Number]. Email: info@cleanitneatly.com. If you have questions about how we handle your data, contact our Data Protection Lead at dpo@cleanitneatly.com.',
  },
  {
    title: '2. Data We Collect',
    body: 'We collect the following categories of personal data:\n\n• Identity data: full name, email address, phone number\n• Address data: property addresses for cleaning services\n• Financial data: payment transaction records (card details are processed by Stripe — we do not store card numbers)\n• Technical data: device identifiers, push notification tokens, app usage data\n• Communication data: chat messages, booking notes, feedback and reviews\n• Location data: approximate location for service delivery verification (staff only)\n• Staff employment data: bank details, National Insurance information, availability, work history\n• Photos: work completion photos uploaded by staff',
  },
  {
    title: '3. Lawful Basis for Processing',
    body: 'We process your personal data under the following lawful bases (UK GDPR Article 6):\n\n• Contract: to fulfil booking agreements and deliver cleaning services\n• Consent: for marketing communications and promotional offers (you may withdraw consent at any time)\n• Legitimate interest: for fraud prevention, service improvement, and business administration\n• Legal obligation: for tax records, employment law compliance, and regulatory requirements',
  },
  {
    title: '4. How We Use Your Data',
    body: 'Your information is used to:\n\n• Manage bookings, send confirmations and reminders\n• Process payments via Stripe\n• Communicate with you about your service\n• Send marketing communications (only with your consent)\n• Improve our services through anonymised analytics\n• Comply with legal and regulatory obligations\n• Prevent fraud and ensure security',
  },
  {
    title: '5. Data Sharing & Third Parties',
    body: 'We share your data with the following categories of recipients, all under strict data protection agreements:\n\n• Cleaning staff: your address and booking details to deliver the service\n• Stripe (USA): payment processing — see stripe.com/privacy\n• Brevo (France/EU): email and SMS notifications — see brevo.com/legal/privacypolicy\n• Google (USA): maps and geocoding for service delivery\n• Apple/Google: push notification delivery\n• Expo (USA): mobile app push notification tokens\n\nWe do not sell your personal data to third parties.',
  },
  {
    title: '6. International Data Transfers',
    body: 'Some of our service providers are based outside the UK (primarily the USA and EU). Where data is transferred outside the UK, we ensure adequate safeguards are in place, including:\n\n• UK adequacy decisions (EU/EEA transfers)\n• Standard Contractual Clauses (UK International Data Transfer Agreement)\n• Certification under recognised frameworks\n\nYou can request details of the specific safeguards by contacting us.',
  },
  {
    title: '7. Data Retention',
    body: 'We retain your personal data only as long as necessary:\n\n• Active account data: for the duration of your account plus 12 months after deletion request\n• Booking records: 6 years (HMRC tax requirements)\n• Financial/payment records: 6 years (legal obligation)\n• Chat messages: 2 years after the booking is completed\n• Marketing consent records: until consent is withdrawn plus 12 months for audit\n• Staff employment data: duration of engagement plus 6 years\n• Staff bank details: deleted within 30 days of engagement ending\n\nAfter the retention period, data is securely deleted or anonymised.',
  },
  {
    title: '8. Your Rights',
    body: 'Under UK GDPR, you have the right to:\n\n• Access: request a copy of your personal data\n• Rectification: correct inaccurate or incomplete data\n• Erasure: request deletion of your data ("right to be forgotten")\n• Restrict processing: limit how we use your data\n• Data portability: receive your data in a structured, machine-readable format\n• Object: object to processing based on legitimate interest\n• Withdraw consent: withdraw any consent at any time without affecting the lawfulness of prior processing\n\nTo exercise any of these rights, contact us at info@cleanitneatly.com or use the "Delete My Account" and "Download My Data" options in the app. We will respond within 30 days.',
  },
  {
    title: '9. Automated Decision-Making',
    body: 'We do not use automated decision-making or profiling that produces legal or similarly significant effects on you.',
  },
  {
    title: '10. Data Security',
    body: 'We use industry-standard security measures including encrypted connections (HTTPS/TLS), secure authentication, access controls, and regular security reviews to protect your data. In the unlikely event of a data breach that poses a high risk to your rights and freedoms, we will notify you and the Information Commissioner\'s Office (ICO) within 72 hours as required by UK GDPR.',
  },
  {
    title: '11. Children\'s Data',
    body: 'Our services are not directed at children under 18 years of age. We do not knowingly collect personal data from anyone under 18. If we become aware that we have collected data from a child, we will delete it promptly.',
  },
  {
    title: '12. Complaints',
    body: 'If you are unhappy with how we handle your data, please contact us first at info@cleanitneatly.com and we will try to resolve your concern. You also have the right to lodge a complaint with the Information Commissioner\'s Office (ICO):\n\nInformation Commissioner\'s Office\nWycliffe House, Water Lane\nWilmslow, Cheshire SK9 5AF\nTel: 0303 123 1113\nWebsite: ico.org.uk',
  },
];

const COOKIE_SECTIONS = [
  {
    title: 'What Are Cookies',
    body: 'Cookies are small text files stored on your device when you visit our website. They help us provide a better experience and understand how our site is used.',
  },
  {
    title: 'Essential Cookies',
    body: 'These are necessary for the website to function and cannot be switched off. They include:\n\n• nn_session: authentication session cookie (expires when browser closes)\n• nn_cookie_consent_v1: stores your cookie preferences (persistent)\n\nThese are set based on our legitimate interest in providing a functioning service.',
  },
  {
    title: 'Optional / Analytics Cookies',
    body: 'With your consent, we may use analytics cookies (such as Google Analytics via Google Tag Manager) to understand how visitors interact with our website. These cookies collect anonymised usage data.\n\nYou can accept or decline optional cookies when first visiting the site, and change your preference at any time using the "Manage Cookies" link in the website footer.',
  },
  {
    title: 'Third-Party Cookies',
    body: 'Our payment provider (Stripe) may set cookies when you interact with payment forms. These are governed by Stripe\'s own cookie policy at stripe.com/cookie-policy.',
  },
  {
    title: 'Mobile App',
    body: 'The CiN Cleaning mobile app does not use cookies. It uses secure token-based authentication stored locally on your device. Push notification tokens are stored to deliver service notifications.',
  },
  {
    title: 'Managing Cookies',
    body: 'You can control cookies through your browser settings. Note that disabling essential cookies may affect the functionality of our website. For more information about cookies, visit allaboutcookies.org.',
  },
];

type TabKey = 'terms' | 'privacy' | 'cookies';

export default function TermsScreen() {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>('terms');

  const tabConfig: { key: TabKey; label: string; sections: typeof TERMS_SECTIONS }[] = [
    { key: 'terms', label: 'Terms', sections: TERMS_SECTIONS },
    { key: 'privacy', label: 'Privacy', sections: PRIVACY_SECTIONS },
    { key: 'cookies', label: 'Cookies', sections: COOKIE_SECTIONS },
  ];

  const currentSections = tabConfig.find((t) => t.key === tab)?.sections ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="CiN Cleaning logo" />
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {tabConfig.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            accessibilityLabel={t.label}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {currentSections.map((s, i) => (
          <View key={i} style={styles.section} accessibilityRole="text">
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        {tab === 'privacy' && (
          <TouchableOpacity
            style={styles.icoLink}
            onPress={() => Linking.openURL('https://ico.org.uk/make-a-complaint/')}
            accessibilityRole="link"
            accessibilityLabel="Visit ICO website to make a complaint"
          >
            <Ionicons name="open-outline" size={16} color={COLORS.primary} />
            <Text style={styles.icoLinkText}>Visit ICO website</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>
          Last updated: September 2026 (v2.0){'\n'}
          CiN Cleaning Ltd — info@cleanitneatly.com
        </Text>
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

  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },

  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  sectionBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  icoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  icoLinkText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  footer: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 18,
  },
});
