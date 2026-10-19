import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Image,
  Modal,
  FlatList,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { bookingsApi, staffApi, customerApi, mapsApi, publicApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking, BookingTracking } from '../../types';
import { distanceKm, formatClock, isTodayYmd, minutesAgo } from '../../utils/tracking';
import { StatusBadge, friendlyDay, serviceLabel, money } from '../../components/ClientKit';
import { Image as Photo } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInUp, PulseDot } from '../../components/Motion';
import { servicePhoto } from '../../components/media';
import { AssignedCleaners, BookingPayments } from '../../components/BookingPayments';
import { useBusinessContact } from '../../hooks/useBusinessContact';
import { addBookingToCalendar, prepChecklistFor } from '../../utils/clientPortal';

/** Where the booking is on its journey, for the step tracker at the top. */
function journeyStep(b: Booking, enRouteAt: string | null, arrived: boolean): number {
  if (b.status === 'Completed') return 4;
  if (b.status === 'In Progress' || arrived) return 3;
  if (enRouteAt) return 2;
  if (b.status === 'Confirmed') return 1;
  return 0;
}
const JOURNEY = ['Booked', 'Confirmed', 'On the way', 'Cleaning', 'Done'];

/** Clients can move a booking up to this many hours before it starts (the server enforces the same rule). */
const RESCHEDULE_NOTICE_HOURS = 24;

/** Hours from now until a local YYYY-MM-DD + HH:MM start. */
function hoursUntil(date: string, time: string): number {
  const [y, m, d] = String(date || '').split('-').map(Number);
  const [hh, mm] = String(time || '00:00').split(':').map(Number);
  if (!y || !m || !d) return -Infinity;
  return (new Date(y, m - 1, d, hh || 0, mm || 0).getTime() - Date.now()) / 3600000;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Pending': return { bg: COLORS.status.pendingBg, text: COLORS.status.pending };
    case 'Confirmed': return { bg: COLORS.status.confirmedBg, text: COLORS.status.confirmed };
    case 'In Progress': return { bg: COLORS.status.inProgressBg, text: COLORS.status.inProgress };
    case 'Completed': return { bg: COLORS.status.completedBg, text: COLORS.status.completed };
    case 'Cancelled': return { bg: COLORS.status.cancelledBg, text: COLORS.status.cancelled };
    default: return { bg: COLORS.surfaceAlt, text: COLORS.textSecondary };
  }
}

function DetailRow({
  icon,
  label,
  value,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
      {action ? (
        <TouchableOpacity style={styles.detailAction} onPress={action.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.detailActionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [reviewPublic, setReviewPublic] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { showToast } = useToast();
  const [extraNames, setExtraNames] = useState<Record<number, string>>({});
  const policy = useBusinessContact();

  useEffect(() => {
    publicApi
      .getExtras()
      .then((list) => setExtraNames(Object.fromEntries(list.map((e) => [e.id, e.name]))))
      .catch(() => {});
  }, []);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      const data = await bookingsApi.getOne(Number(id));
      setBooking(data);
    } catch {
      Alert.alert('Error', 'Could not load booking details.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const [tracking, setTracking] = useState<BookingTracking | null>(null);
  const [jobCoords, setJobCoords] = useState<{ lat: number; lng: number } | null>(null);
  const trackLive =
    !!booking &&
    user?.role !== 'staff' &&
    isTodayYmd(booking.date) &&
    (booking.status === 'Pending' || booking.status === 'Confirmed');

  const loadTracking = useCallback(async () => {
    if (!booking) return;
    try {
      setTracking(await bookingsApi.getTracking(booking.id));
    } catch {
      /* keep last snapshot */
    }
  }, [booking?.id]);

  useEffect(() => {
    if (!trackLive) return;
    loadTracking();
    const poll = setInterval(loadTracking, 20000);
    return () => clearInterval(poll);
  }, [trackLive, loadTracking]);

  useEffect(() => {
    if (!trackLive || !booking || jobCoords) return;
    const addr = [booking.address?.line1, booking.address?.city, booking.address?.postcode].filter(Boolean).join(', ');
    if (!addr) return;
    mapsApi.geocode(addr).then(setJobCoords).catch(() => {});
  }, [trackLive, booking?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBooking();
    if (trackLive) await loadTracking();
    setRefreshing(false);
  };

  const handleCancel = () => {
    if (!booking) return;
    const shortNotice = hoursUntil(booking.date, booking.time) < policy.shortNoticeHours;
    const fee = (Number(booking.totalPrice) || 0) * (policy.shortNoticeFeePercent / 100);
    const msg = shortNotice
      ? `${policy.cancellationMessage}\n\nFee for this booking: ${money(fee)}. You can pay it by bank transfer using the details shown on this booking afterwards, then upload the proof.\n\nDo you agree and want to cancel?`
      : 'Are you sure you want to cancel this booking? There is no fee because it is more than ' +
        `${policy.shortNoticeHours} hours away.`;

    Alert.alert(shortNotice ? 'Short-notice cancellation' : 'Cancel booking', msg, [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: shortNotice ? 'I agree, cancel' : 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await bookingsApi.cancel(booking.id, shortNotice);
            setBooking((prev) =>
              prev
                ? { ...prev, status: 'Cancelled', ...(shortNotice ? { shortNoticeCancelFeeConsentedAt: new Date().toISOString() } : {}) }
                : prev
            );
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel booking.');
          }
          setCancelling(false);
        },
      },
    ]);
  };

  const handleSubmitRating = async () => {
    if (!booking || rating === 0) return;
    setSubmittingRating(true);
    try {
      await bookingsApi.rate(booking.id, rating, feedback.trim() || undefined, reviewPublic);
      setBooking((prev) => prev ? { ...prev, rating, feedback: feedback.trim() || null } : prev);
      setShowRating(false);
      if (rating >= 4 && policy.googleReviewUrl) {
        // Happy customers are invited to post on Google too: those reviews show stars in Google Search and Maps.
        Alert.alert('Thank you!', 'Glad you are happy with your clean. Would you share it on Google too? It really helps local customers find us.', [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Review on Google', onPress: () => void Linking.openURL(policy.googleReviewUrl) },
        ]);
      } else {
        Alert.alert('Thank you!', 'Your review has been submitted.');
      }
    } catch {
      Alert.alert('Error', 'Could not submit review.');
    }
    setSubmittingRating(false);
  };

  const handleReschedule = async () => {
    if (!booking || !rescheduleDate || !rescheduleTime) {
      showToast('Please pick a date and time', 'warning');
      return;
    }
    if (hoursUntil(rescheduleDate, rescheduleTime) < RESCHEDULE_NOTICE_HOURS) {
      showToast(`Choose a new time at least ${RESCHEDULE_NOTICE_HOURS} hours from now`, 'warning');
      return;
    }
    setRescheduling(true);
    try {
      const res = await customerApi.rescheduleBooking(booking.id, rescheduleDate, rescheduleTime);
      setBooking((prev) => prev ? { ...prev, date: rescheduleDate, time: rescheduleTime, status: (res.status as typeof prev.status) || prev.status } : prev);
      setShowReschedule(false);
      showToast(res.cleanerKept === false ? 'Booking moved. We will confirm your cleaner shortly.' : 'Booking moved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reschedule', 'error');
    }
    setRescheduling(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.textTertiary} />
          <Text style={styles.errorText}>Booking not found</Text>
          <TouchableOpacity onPress={() => goBack(router)} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sc = getStatusColor(booking.status);
  const isStaffRole = user?.role === 'staff';
  const canCancel = booking.status === 'Pending' || booking.status === 'Confirmed';
  const canReschedule = canCancel && hoursUntil(booking.date, booking.time) >= RESCHEDULE_NOTICE_HOURS;
  const canRate = booking.status === 'Completed' && !booking.rating;
  const hasCleaner = !!booking.assignedStaffId || !!booking.assignedStaffIds?.length;
  const canChat = booking.status !== 'Cancelled' && !booking.chatClosedByAdmin && (isStaffRole || hasCleaner);
  const isStaff = isStaffRole;

  const enRouteAt = tracking?.enRouteAt ?? booking.enRouteAt ?? null;
  const cleanerLoc = tracking?.cleanerLocation ?? null;
  const lateNotices = tracking?.lateNotices ?? (Array.isArray(booking.lateNotices) ? booking.lateNotices : []);
  const latestLate = lateNotices[lateNotices.length - 1];
  const kmAway = cleanerLoc && jobCoords ? distanceKm(cleanerLoc, jobCoords) : null;
  const seenAgo = minutesAgo(cleanerLoc?.at);
  const arrived = kmAway != null && kmAway < 0.2;

  const ymd = String(booking.date).slice(0, 10);
  const longDate = (() => {
    const [y, m, d] = ymd.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : ymd;
  })();
  const hours = Number(booking.propertyDetails?.duration) || null;
  const step = journeyStep(booking, enRouteAt, arrived);
  const cancelled = booking.status === 'Cancelled';
  const addressText = [booking.address?.line1, booking.address?.city, booking.address?.postcode].filter(Boolean).join(', ');
  const property = booking.propertyDetails
    ? [
        booking.propertyDetails.bedrooms != null ? `${booking.propertyDetails.bedrooms} bed` : null,
        booking.propertyDetails.bathrooms != null ? `${booking.propertyDetails.bathrooms} bath` : null,
        booking.propertyDetails.propertyType || null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Booking</Text>
          <Text style={styles.headerRef}>{booking.bookingId || `#${booking.id}`}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <FadeInUp style={styles.hero}>
          <View style={styles.heroPhotoWrap}>
            <Photo source={servicePhoto(booking.serviceType)} style={[styles.heroPhoto, cancelled && { opacity: 0.5 }]} contentFit="cover" transition={300} />
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', COLORS.surface]} locations={[0.35, 0.85, 1]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.heroTop}>
            <StatusBadge status={booking.status} />
            <Text style={styles.heroPrice}>{money(booking.totalPrice)}</Text>
          </View>
          <Text style={[styles.heroService, cancelled && styles.heroServiceCancelled]}>{serviceLabel(booking.serviceType)}</Text>
          <Text style={styles.heroWhen}>
            {friendlyDay(ymd)} at {booking.time || '--:--'}
          </Text>
          <Text style={styles.heroSub}>
            {longDate}
            {hours ? ` · ${hours} hour${hours === 1 ? '' : 's'}` : ''}
            {booking.frequency && booking.frequency !== 'One-time' ? ` · ${booking.frequency}` : ''}
          </Text>

          {cancelled ? (
            <View style={styles.cancelNote}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
              <Text style={styles.cancelNoteText}>This booking was cancelled.</Text>
            </View>
          ) : (
            <View style={styles.journey}>
              {JOURNEY.map((label, i) => {
                const done = i < step || (i === step && step === JOURNEY.length - 1);
                const active = i === step && !done;
                return (
                  <View key={label} style={styles.journeyStep}>
                    <View style={[styles.journeyBar, (done || active) && styles.journeyBarOn, active && styles.journeyBarActive]} />
                    <Text style={[styles.journeyLabel, active && styles.journeyLabelActive, done && styles.journeyLabelDone]} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </FadeInUp>

        {/* Live tracking (client, day of the job) */}
        {trackLive && (
          <View style={[styles.card, styles.liveCard]}>
            <View style={styles.cardIconRow}>
              {enRouteAt ? <PulseDot color={COLORS.secondary} size={10} /> : <View style={styles.liveDot} />}
              <Text style={styles.cardLabel}>Live status</Text>
            </View>
            {enRouteAt ? (
              <>
                <Text style={[styles.cardValue, { color: COLORS.status.inProgress }]}>
                  {arrived ? 'Your cleaner has arrived' : 'Your cleaner is on the way'}
                </Text>
                <Text style={styles.cardValueSub}>
                  {cleanerLoc?.staffName ? `${cleanerLoc.staffName} · ` : ''}left at {formatClock(enRouteAt)}
                  {kmAway != null && !arrived ? ` · ${kmAway.toFixed(1)} km away` : ''}
                  {seenAgo != null && !arrived ? ` · updated ${seenAgo} min ago` : ''}
                </Text>
                {cleanerLoc && !arrived && (
                  <TouchableOpacity
                    style={styles.liveMapLink}
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${cleanerLoc.lat},${cleanerLoc.lng}`)}
                  >
                    <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.liveMapLinkText}>See cleaner on map</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={styles.cardValue}>Scheduled for {booking.time} today</Text>
                <Text style={styles.cardValueSub}>We will let you know as soon as your cleaner sets off.</Text>
              </>
            )}
          </View>
        )}

        {latestLate && (booking.status === 'Pending' || booking.status === 'Confirmed') && (
          <View style={styles.lateCard}>
            <Ionicons name="alarm-outline" size={20} color="#b45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lateTitle}>{latestLate.staffName} is running late</Text>
              <Text style={styles.lateBody}>
                {latestLate.reason}
                {latestLate.minutesLate ? ` · about ${latestLate.minutesLate} min` : ''}
                {latestLate.etaTime ? ` · new arrival around ${latestLate.etaTime}` : ''}
              </Text>
              {!!latestLate.message && <Text style={styles.lateNote}>{latestLate.message}</Text>}
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow
            icon="location-outline"
            label="Address"
            value={addressText || 'Not provided'}
            action={
              addressText
                ? { label: 'Map', onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`) }
                : undefined
            }
          />
          {property ? <DetailRow icon="home-outline" label="Property" value={property} /> : null}
          {booking.extras && booking.extras.length > 0 ? (
            <DetailRow
              icon="add-circle-outline"
              label="Extras"
              value={booking.extras
                .map((ex) => `${ex.quantity > 1 ? `${ex.quantity} x ` : ''}${extraNames[ex.id] || 'Extra service'}`)
                .join('\n')}
            />
          ) : null}
          {booking.instructions ? <DetailRow icon="document-text-outline" label="Your notes for the cleaner" value={booking.instructions} /> : null}
          {isStaff ? (
            <DetailRow
              icon="person-outline"
              label="Client"
              value={[booking.contact?.name, booking.contact?.phone].filter(Boolean).join(' · ') || 'Not provided'}
              action={booking.contact?.phone ? { label: 'Call', onPress: () => Linking.openURL(`tel:${booking.contact!.phone}`) } : undefined}
            />
          ) : null}
        </View>

        {!isStaff && canCancel ? (
          <View style={styles.prepCard}>
            <View style={styles.cardIconRow}>
              <Ionicons name="clipboard-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardLabel}>Before we arrive</Text>
            </View>
            {prepChecklistFor(booking.serviceType).map((tip) => (
              <View key={tip} style={styles.prepRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.secondary} style={{ marginTop: 1 }} />
                <Text style={styles.prepText}>{tip}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => addBookingToCalendar(booking).catch((e) => showToast(e instanceof Error ? e.message : 'Could not open your calendar', 'error'))}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
              <Text style={styles.calendarBtnText}>Add to calendar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isStaff ? (
          <>
            <AssignedCleaners booking={booking} />
            <BookingPayments booking={booking} onChange={setBooking} />
          </>
        ) : null}

        {/* Price breakdown (only when a discount needs explaining; the total is in the summary) */}
        {booking.discountCode ? (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceSub}>Discount ({booking.discountCode})</Text>
              <Text style={styles.priceSub}>-{money(booking.discountAmount)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>You pay</Text>
              <Text style={styles.priceValue}>{money(booking.totalPrice)}</Text>
            </View>
          </View>
        ) : null}

        {/* Rating display */}
        {booking.rating != null && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <Ionicons name="star" size={18} color={COLORS.accentGold} />
              <Text style={styles.cardLabel}>Your Review</Text>
            </View>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= booking.rating! ? 'star' : 'star-outline'}
                  size={20}
                  color={COLORS.accentGold}
                />
              ))}
            </View>
            {booking.feedback && <Text style={styles.cardValueSub}>{booking.feedback}</Text>}
          </View>
        )}

        {/* Rating form */}
        {canRate && showRating && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Rate this clean</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Ionicons
                    name={s <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={COLORS.accentGold}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.feedbackInput}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="How was the service? (optional)"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.consentRow}>
              <Switch
                value={reviewPublic}
                onValueChange={setReviewPublic}
                trackColor={{ true: COLORS.accentGold, false: COLORS.border }}
                accessibilityLabel="Show my review on the website"
              />
              <Text style={styles.consentText}>
                Show my rating and comment on the CiN website with my first name, surname initial and town. I can ask for it to be removed at any time.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, rating === 0 && styles.actionBtnDisabled]}
              onPress={handleSubmitRating}
              disabled={rating === 0 || submittingRating}
            >
              {submittingRating ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.actionBtnTextWhite}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {canChat && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => router.push(`/chat/${booking.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnTextWhite}>
                {isStaff ? 'Message client' : 'Message your cleaner'}
              </Text>
            </TouchableOpacity>
          )}
          {canChat && hoursUntil(booking.date, booking.time) > 1 / 6 ? (
            <Text style={styles.rescheduleHint}>Chat opens 10 minutes before the start time.</Text>
          ) : null}

          {isStaff && (booking.status === 'Pending' || booking.status === 'Confirmed' || booking.status === 'In Progress') && !booking.workCompletion && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.secondary }]}
              onPress={() => router.push(`/job/${booking.id}`)}
            >
              <Ionicons name="play-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnTextWhite}>Start Job</Text>
            </TouchableOpacity>
          )}

          {!isStaff && booking.status === 'Completed' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => router.push(`/book?reorder=${booking.id}`)}
              accessibilityRole="button"
            >
              <Ionicons name="repeat-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnTextWhite}>Book this clean again</Text>
            </TouchableOpacity>
          )}

          {canRate && !showRating && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => setShowRating(true)}
            >
              <Ionicons name="star-outline" size={18} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>Rate this Clean</Text>
            </TouchableOpacity>
          )}

          {canCancel && !canReschedule && !isStaff && (
            <Text style={styles.rescheduleHint}>
              Bookings can be moved up to {RESCHEDULE_NOTICE_HOURS} hours before they start. Please contact us to change this one.
            </Text>
          )}

          {canReschedule && !isStaff && !showReschedule && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => {
                setRescheduleDate(booking.date);
                setRescheduleTime(booking.time);
                setShowReschedule(true);
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>Reschedule</Text>
            </TouchableOpacity>
          )}

          {showReschedule && (
            <View style={styles.rescheduleCard}>
              <Text style={styles.rescheduleTitle}>Reschedule Booking</Text>
              <Text style={styles.rescheduleHint}>Pick a new time at least {RESCHEDULE_NOTICE_HOURS} hours from now. Your cleaner and our team will be told.</Text>
              <View style={styles.rescheduleRow}>
                <View style={styles.rescheduleField}>
                  <Text style={styles.rescheduleLabel}>Date</Text>
                  <TouchableOpacity style={styles.rescheduleInput} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                    <Text style={[styles.rescheduleInputText, !rescheduleDate && { color: COLORS.textTertiary }]}>
                      {rescheduleDate ? new Date(rescheduleDate + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.rescheduleField}>
                  <Text style={styles.rescheduleLabel}>Time</Text>
                  <TouchableOpacity style={styles.rescheduleInput} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                    <Text style={[styles.rescheduleInputText, !rescheduleTime && { color: COLORS.textTertiary }]}>
                      {rescheduleTime || 'Select time'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rescheduleActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]}
                  onPress={() => setShowReschedule(false)}
                >
                  <Text style={styles.actionBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary, { flex: 1 }, rescheduling && styles.actionBtnDisabled]}
                  onPress={handleReschedule}
                  disabled={rescheduling}
                >
                  {rescheduling ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.actionBtnTextWhite}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <DatePickerModal
            visible={showDatePicker}
            value={rescheduleDate}
            onSelect={(d) => { setRescheduleDate(d); setShowDatePicker(false); }}
            onClose={() => setShowDatePicker(false)}
          />
          <TimePickerModal
            visible={showTimePicker}
            value={rescheduleTime}
            onSelect={(t) => { setRescheduleTime(t); setShowTimePicker(false); }}
            onClose={() => setShowTimePicker(false)}
          />

          {canCancel && !isStaff && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.actionBtnTextDanger}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isStaff && canCancel && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => {
                Alert.prompt
                  ? Alert.prompt(
                      'Request Cancellation',
                      'Provide a reason for cancelling this job:',
                      async (reason) => {
                        try {
                          await staffApi.requestCancellation(booking.id, reason || undefined);
                          Alert.alert('Request Sent', 'Your cancellation request has been sent to the admin.');
                        } catch (err) {
                          Alert.alert('Error', err instanceof Error ? err.message : 'Could not send request.');
                        }
                      }
                    )
                  : Alert.alert(
                      'Request Cancellation',
                      'Send a cancellation request to the admin for this job?',
                      [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Yes, Request',
                          onPress: async () => {
                            try {
                              await staffApi.requestCancellation(booking.id);
                              Alert.alert('Request Sent', 'Your cancellation request has been sent to the admin.');
                            } catch (err) {
                              Alert.alert('Error', err instanceof Error ? err.message : 'Could not send request.');
                            }
                          },
                        },
                      ]
                    );
              }}
            >
              <Ionicons name="flag-outline" size={18} color="#ef4444" />
              <Text style={styles.actionBtnTextDanger}>Request Cancellation</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DatePickerModal({ visible, value, onSelect, onClose }: { visible: boolean; value: string; onSelect: (d: string) => void; onClose: () => void }) {
  const today = new Date();
  const dates: { label: string; value: string }[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ymd = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ label, value: ymd });
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>Select Date</Text>
          <FlatList
            data={dates}
            keyExtractor={(item) => item.value}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pickerStyles.option, item.value === value && pickerStyles.optionActive]}
                onPress={() => onSelect(item.value)}
              >
                <Text style={[pickerStyles.optionText, item.value === value && pickerStyles.optionTextActive]}>{item.label}</Text>
                {item.value === value && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function TimePickerModal({ visible, value, onSelect, onClose }: { visible: boolean; value: string; onSelect: (t: string) => void; onClose: () => void }) {
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 20) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>Select Time</Text>
          <FlatList
            data={slots}
            keyExtractor={(item) => item}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pickerStyles.option, item === value && pickerStyles.optionActive]}
                onPress={() => onSelect(item)}
              >
                <Text style={[pickerStyles.optionText, item === value && pickerStyles.optionTextActive]}>{item}</Text>
                {item === value && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.sm,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md, textAlign: 'center' },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  optionActive: { backgroundColor: COLORS.primary + '12' },
  optionText: { fontSize: 15, color: COLORS.text },
  optionTextActive: { fontWeight: '700', color: COLORS.primary },
});

const styles = StyleSheet.create({
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerRef: { fontSize: 12, color: COLORS.textTertiary, marginTop: 1, letterSpacing: 0.3 },
  heroPhotoWrap: { height: 120, marginTop: -SPACING.lg, marginHorizontal: -SPACING.lg, marginBottom: SPACING.sm, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, overflow: 'hidden' },
  heroPhoto: { width: '100%', height: '100%' },
  hero: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    marginBottom: SPACING.md,
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPrice: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  heroService: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: SPACING.md, letterSpacing: -0.3 },
  heroServiceCancelled: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  heroWhen: { fontSize: 17, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  heroSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  journey: { flexDirection: 'row', gap: 4, marginTop: SPACING.lg },
  journeyStep: { flex: 1 },
  journeyBar: { height: 6, borderRadius: 3, backgroundColor: COLORS.borderLight },
  journeyBarOn: { backgroundColor: COLORS.secondary },
  journeyBarActive: { backgroundColor: COLORS.primary },
  journeyLabel: { fontSize: 10.5, fontWeight: '500', color: COLORS.textTertiary, marginTop: 6 },
  journeyLabelActive: { color: COLORS.primary, fontWeight: '700' },
  journeyLabelDone: { color: COLORS.secondary, fontWeight: '600' },
  cancelNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.base,
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  cancelNoteText: { fontSize: 14, fontWeight: '600', color: COLORS.error },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.textTertiary },
  liveDotOn: { backgroundColor: COLORS.secondary },
  detailsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.md,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  detailIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textTertiary },
  detailValue: { fontSize: 15, color: COLORS.text, marginTop: 2, lineHeight: 21 },
  detailAction: { alignSelf: 'center', backgroundColor: COLORS.primary + '12', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full },
  detailActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, gap: SPACING.sm },
  errorText: { fontSize: 16, color: COLORS.textSecondary },
  backLink: { marginTop: SPACING.md },
  backLinkText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },

  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxxl },

  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
  },
  statusText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveCard: { borderColor: COLORS.primary + '30', backgroundColor: COLORS.infoLight },
  liveMapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  liveMapLinkText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  lateCard: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: '#fffbeb',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  lateTitle: { fontSize: 15, fontWeight: '700', color: '#78350f' },
  lateBody: { fontSize: 13, color: '#92400e', marginTop: 2 },
  lateNote: { fontSize: 12, color: '#92400e', marginTop: 4 },
  bookingRef: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  prepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  prepRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: 6 },
  prepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '0d',
  },
  calendarBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  cardRow: { flexDirection: 'row', gap: SPACING.xl },
  cardCol: { flex: 1 },
  cardDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },
  cardLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardValueSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  propGrid: { flexDirection: 'row', gap: SPACING.lg },
  propItem: { alignItems: 'center' },
  propNum: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  propLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, marginTop: 2 },

  priceCard: {
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  priceValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  priceSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  starsRow: { flexDirection: 'row', gap: 4, marginVertical: SPACING.sm },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  feedbackInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: SPACING.sm,
  },

  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnOutline: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.primary },
  actionBtnDanger: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  rescheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    gap: SPACING.md,
  },
  rescheduleTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  rescheduleHint: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  rescheduleRow: { flexDirection: 'row', gap: SPACING.sm },
  rescheduleField: { flex: 1, gap: SPACING.xs },
  rescheduleLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  rescheduleInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  rescheduleInputText: {
    fontSize: 15,
    color: COLORS.text,
  },
  rescheduleActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnTextWhite: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  actionBtnTextDanger: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
