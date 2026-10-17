import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking, CustomerInvoice, ServiceConfig } from '../../types';
import { Image as Photo } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp, PhotoBackdrop, PressableScale, Shine } from '../../components/Motion';
import { PHOTOS, servicePhoto, wrapName } from '../../components/media';
import { addBookingToCalendar, prepChecklistFor } from '../../utils/clientPortal';
import {
  TopBar,
  Avatar,
  NextCleanCard,
  QuickAction,
  BookingCard,
  SectionTitle,
  EmptyState,
  isUpcoming,
  money,
} from '../../components/ClientKit';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const byDateAsc = (a: Booking, b: Booking) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

export default function CustomerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [services, setServices] = useState<ServiceConfig[]>([]);

  useEffect(() => {
    customerApi.getServices().then((list) => setServices(list.filter((s) => s.active !== false))).catch(() => {});
  }, []);

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const fetchBookings = useCallback(async () => {
    try {
      const data = await customerApi.getBookings();
      setBookings(data);
      setLoadError(false);
      customerApi.getInvoices().then(setInvoices).catch(() => {});
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const upcoming = bookings.filter(isUpcoming).sort(byDateAsc);
  const [next, ...later] = upcoming;
  const recentCompleted = bookings
    .filter((b) => b.status === 'Completed')
    .sort((a, b) => byDateAsc(b, a))
    .slice(0, 3);
  const points = Number(user?.loyaltyPoints || 0);
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const owed = unpaid.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  // Deposit links waiting on upcoming bookings (website: "Pay deposit now").
  const depositDue = upcoming.filter((b) => b.stripePaymentLink && !b.invoicePaid);
  // Finished cleans where only the deposit was paid: the balance is due now.
  const balances = bookings.filter((b) => b.status === 'Completed' && b.paymentStage === 'deposit_paid' && Number(b.balanceDue) > 0);
  const balanceTotal = balances.reduce((sum, b) => sum + (Number(b.balanceDue) || 0), 0);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <TopBar right={<Avatar name={user?.name} onPress={() => router.push('/(customer)/account')} />} />

        <FadeInUp style={styles.hello}>
          <Text style={styles.greeting}>
            {getGreeting()}, {firstName}
          </Text>
          <Text style={styles.subGreeting}>
            {upcoming.length > 0
              ? `You have ${upcoming.length} clean${upcoming.length > 1 ? 's' : ''} coming up`
              : 'Ready when you are. Book a clean in under two minutes.'}
          </Text>
        </FadeInUp>

        {loadError ? (
          <TouchableOpacity style={styles.offline} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="cloud-offline-outline" size={18} color={COLORS.warning} />
            <Text style={styles.offlineText}>Could not load your bookings. Tap to try again.</Text>
          </TouchableOpacity>
        ) : null}

        <FadeInUp index={1}>
          {next ? (
            <>
              <NextCleanCard booking={next} onPress={() => router.push(`/booking/${next.id}`)} />
              <View style={styles.prep}>
                <Text style={styles.prepTitle}>Before we arrive</Text>
                {prepChecklistFor(next.serviceType).map((tip) => (
                  <View key={tip} style={styles.prepRow}>
                    <Ionicons name="checkmark-circle" size={15} color={COLORS.secondary} style={{ marginTop: 2 }} />
                    <Text style={styles.prepText}>{tip}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.prepCalendar}
                  onPress={() => addBookingToCalendar(next).catch(() => {})}
                  accessibilityRole="button"
                >
                  <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.prepCalendarText}>Add to calendar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <PressableScale style={styles.bookHeroShadow} onPress={() => router.push('/book')} accessibilityRole="button" scaleTo={0.98}>
              <PhotoBackdrop
                source={PHOTOS.towels}
                style={styles.bookHero}
                colors={['rgba(12,135,214,0.25)', 'rgba(10,106,171,0.82)', 'rgba(8,62,104,0.96)']}
                locations={[0, 0.5, 1]}
              >
                <Shine />
                <View style={styles.bookHeroIcon}>
                  <Ionicons name="sparkles" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.bookHeroTitle}>Book a clean</Text>
                <Text style={styles.bookHeroSub}>Pick a service, date and time. You see your price before you confirm.</Text>
                <View style={styles.bookHeroBtn}>
                  <Text style={styles.bookHeroBtnText}>Get started</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
                </View>
              </PhotoBackdrop>
            </PressableScale>
          )}
        </FadeInUp>

        {unpaid.length > 0 || balances.length > 0 || depositDue.length > 0 ? (
          <TouchableOpacity
            style={styles.payBanner}
            activeOpacity={0.85}
            onPress={() =>
              unpaid.length
                ? router.push('/invoices')
                : balances.length
                  ? router.push(`/booking/${balances[0].id}`)
                  : router.push(`/booking/${depositDue[0].id}`)
            }
          >
            <View style={styles.payIcon}>
              <Ionicons name="card-outline" size={20} color={COLORS.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>
                {unpaid.length
                  ? `${money(owed)} to pay`
                  : balances.length
                    ? `${money(balanceTotal)} balance to pay`
                    : `Deposit due for ${depositDue.length} booking${depositDue.length > 1 ? 's' : ''}`}
              </Text>
              <Text style={styles.paySub}>
                {unpaid.length
                  ? `${unpaid.length} unpaid invoice${unpaid.length > 1 ? 's' : ''}. Tap to pay securely.`
                  : balances.length
                    ? 'Your clean is done. Tap to pay the balance.'
                    : 'Pay now to secure your cleaner.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.error} />
          </TouchableOpacity>
        ) : null}

        <FadeInUp index={2} style={styles.quickRow}>
          <QuickAction icon="add-circle-outline" label="Book now" onPress={() => router.push('/book')} />
          <QuickAction icon="chatbubbles-outline" label="Messages" tint="#6d52e8" onPress={() => router.push('/messages')} />
          <QuickAction icon="receipt-outline" label="Invoices" tint={COLORS.error} onPress={() => router.push('/invoices')} />
          <QuickAction icon="help-buoy-outline" label="Help" tint={COLORS.secondary} onPress={() => router.push('/help')} />
        </FadeInUp>

        {services.length ? (
          <FadeInUp index={3}>
            <SectionTitle>Explore services</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow} style={styles.servicesScroll}>
              {services.map((svc) => (
                <PressableScale
                  key={svc.id}
                  style={styles.serviceTile}
                  onPress={() => router.push(`/book?service=${encodeURIComponent(String(svc.id))}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Book ${svc.name}`}
                >
                  <Photo source={servicePhoto(svc.name)} style={styles.serviceTilePhoto} contentFit="cover" transition={300} />
                  <LinearGradient colors={['rgba(12,31,51,0)', 'rgba(12,31,51,0.82)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.serviceTileText}>
                    <Text style={styles.serviceTileName} numberOfLines={3}>{wrapName(svc.name)}</Text>
                    <Text style={styles.serviceTileCta}>Book now</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </FadeInUp>
        ) : null}

        {points > 0 && (
          <FadeInUp index={4} style={styles.loyalty}>
            <View style={styles.loyaltyIcon}>
              <Ionicons name="diamond" size={20} color={COLORS.accentGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyTitle}>{points} loyalty points</Text>
              <Text style={styles.loyaltySub}>Worth {money(points / 100)} off a future clean</Text>
            </View>
          </FadeInUp>
        )}

        {later.length > 0 && (
          <>
            <SectionTitle
              right={
                <TouchableOpacity onPress={() => router.push('/(customer)/bookings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.link}>See all</Text>
                </TouchableOpacity>
              }
            >
              Also coming up
            </SectionTitle>
            {later.slice(0, 3).map((b, i) => (
              <FadeInUp key={b.id} index={5 + i}>
                <BookingCard booking={b} onPress={() => router.push(`/booking/${b.id}`)} />
              </FadeInUp>
            ))}
          </>
        )}

        {recentCompleted.length > 0 && (
          <>
            <SectionTitle>Recently completed</SectionTitle>
            {recentCompleted.map((b, i) => (
              <FadeInUp key={b.id} index={6 + i}>
                <BookingCard booking={b} onPress={() => router.push(`/booking/${b.id}`)} />
              </FadeInUp>
            ))}
          </>
        )}

        {bookings.length === 0 && !loadError && (
          <View style={{ marginTop: SPACING.lg }}>
            <EmptyState icon="home-outline" title="No bookings yet" body="Your cleans will show here once you book. First time? Use code FIRST10 for 10% off." />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  hello: { paddingTop: SPACING.md, paddingBottom: SPACING.base },
  greeting: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  subGreeting: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4, lineHeight: 21 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  offlineText: { flex: 1, fontSize: 14, color: COLORS.text },

  bookHeroShadow: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  bookHero: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    minHeight: 220,
    justifyContent: 'flex-end',
  },
  bookHeroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  bookHeroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white, marginTop: SPACING.md, letterSpacing: -0.3 },
  bookHeroSub: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 21 },
  bookHeroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    marginTop: SPACING.base,
  },
  bookHeroBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  prep: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    padding: SPACING.base,
  },
  prepTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  prepRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: 6 },
  prepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  prepCalendar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingVertical: 4 },
  prepCalendarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.base },
  servicesScroll: { marginHorizontal: -SPACING.lg },
  servicesRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  serviceTile: { width: 150, height: 180, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surfaceAlt },
  serviceTilePhoto: { width: '100%', height: '100%' },
  serviceTileText: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  serviceTileName: { fontSize: 15, fontWeight: '800', color: COLORS.white, lineHeight: 19 },
  serviceTileCta: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  payBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.base,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  payIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center' },
  payTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },

  loyalty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.base,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.accentGold + '40',
  },
  loyaltyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  loyaltyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  loyaltySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },

  link: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});
