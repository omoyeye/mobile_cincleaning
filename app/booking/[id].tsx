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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { bookingsApi, staffApi, customerApi, mapsApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Booking, BookingTracking } from '../../types';
import { distanceKm, formatClock, isTodayYmd, minutesAgo } from '../../utils/tracking';

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
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { showToast } = useToast();

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

  const isShortNotice = (bookingDate: string, bookingTime: string) => {
    const dt = new Date(`${bookingDate}T${bookingTime}`);
    return dt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  };

  const handleCancel = () => {
    if (!booking) return;
    const shortNotice = isShortNotice(booking.date, booking.time);
    const msg = shortNotice
      ? 'This booking is within 24 hours. A short-notice cancellation fee may apply. Are you sure?'
      : 'Are you sure you want to cancel this booking?';

    Alert.alert('Cancel Booking', msg, [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await bookingsApi.cancel(booking.id, shortNotice);
            setBooking((prev) => prev ? { ...prev, status: 'Cancelled' } : prev);
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
      await bookingsApi.rate(booking.id, rating, feedback.trim() || undefined);
      setBooking((prev) => prev ? { ...prev, rating, feedback: feedback.trim() || null } : prev);
      setShowRating(false);
      Alert.alert('Thank you!', 'Your review has been submitted.');
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
    setRescheduling(true);
    try {
      await customerApi.rescheduleBooking(booking.id, rescheduleDate, rescheduleTime);
      setBooking((prev) => prev ? { ...prev, date: rescheduleDate, time: rescheduleTime } : prev);
      setShowReschedule(false);
      showToast('Booking rescheduled', 'success');
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sc = getStatusColor(booking.status);
  const canCancel = booking.status === 'Pending' || booking.status === 'Confirmed';
  const canRate = booking.status === 'Completed' && !booking.rating;
  const canChat = booking.status !== 'Cancelled' && !booking.chatClosedByAdmin;
  const isStaff = user?.role === 'staff';

  const enRouteAt = tracking?.enRouteAt ?? booking.enRouteAt ?? null;
  const cleanerLoc = tracking?.cleanerLocation ?? null;
  const lateNotices = tracking?.lateNotices ?? (Array.isArray(booking.lateNotices) ? booking.lateNotices : []);
  const latestLate = lateNotices[lateNotices.length - 1];
  const kmAway = cleanerLoc && jobCoords ? distanceKm(cleanerLoc, jobCoords) : null;
  const seenAgo = minutesAgo(cleanerLoc?.at);
  const arrived = kmAway != null && kmAway < 0.2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{booking.status}</Text>
          <Text style={styles.bookingRef}>{booking.bookingId || `#${booking.id}`}</Text>
        </View>

        {/* Live tracking (client, day of the job) */}
        {trackLive && (
          <View style={[styles.card, styles.liveCard]}>
            <View style={styles.cardIconRow}>
              <Ionicons name="navigate" size={18} color={enRouteAt ? COLORS.status.inProgress : COLORS.primary} />
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
                <Text style={styles.cardValueSub}>We will notify you as soon as your cleaner sets off.</Text>
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

        {/* Service & date */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Service</Text>
          <Text style={styles.cardValue}>{booking.serviceType}</Text>

          <View style={styles.cardDivider} />

          <View style={styles.cardRow}>
            <View style={styles.cardCol}>
              <Text style={styles.cardLabel}>Date</Text>
              <Text style={styles.cardValue}>
                {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.cardCol}>
              <Text style={styles.cardLabel}>Time</Text>
              <Text style={styles.cardValue}>{booking.time}</Text>
            </View>
          </View>

          {booking.frequency && booking.frequency !== 'One-time' && (
            <>
              <View style={styles.cardDivider} />
              <Text style={styles.cardLabel}>Frequency</Text>
              <Text style={styles.cardValue}>{booking.frequency}</Text>
            </>
          )}
        </View>

        {/* Address */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardLabel}>Address</Text>
          </View>
          <Text style={styles.cardValue}>
            {booking.address?.line1}
            {booking.address?.city ? `, ${booking.address.city}` : ''}
          </Text>
          <Text style={styles.cardValueSub}>{booking.address?.postcode}</Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardLabel}>Contact</Text>
          </View>
          <Text style={styles.cardValue}>{booking.contact?.name}</Text>
          <Text style={styles.cardValueSub}>{booking.contact?.email}</Text>
          {booking.contact?.phone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${booking.contact!.phone}`)}>
              <Text style={[styles.cardValueSub, { color: COLORS.primary }]}>{booking.contact.phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Property details */}
        {booking.propertyDetails && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <Ionicons name="home-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardLabel}>Property</Text>
            </View>
            <View style={styles.propGrid}>
              {booking.propertyDetails.bedrooms != null && (
                <View style={styles.propItem}>
                  <Text style={styles.propNum}>{booking.propertyDetails.bedrooms}</Text>
                  <Text style={styles.propLabel}>Bed</Text>
                </View>
              )}
              {booking.propertyDetails.bathrooms != null && (
                <View style={styles.propItem}>
                  <Text style={styles.propNum}>{booking.propertyDetails.bathrooms}</Text>
                  <Text style={styles.propLabel}>Bath</Text>
                </View>
              )}
              {booking.propertyDetails.duration != null && (
                <View style={styles.propItem}>
                  <Text style={styles.propNum}>{booking.propertyDetails.duration}</Text>
                  <Text style={styles.propLabel}>Hours</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Extras */}
        {booking.extras && booking.extras.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardLabel}>Extras</Text>
            </View>
            {booking.extras.map((ex, i) => (
              <Text key={i} style={styles.cardValue}>
                {ex.quantity > 1 ? `${ex.quantity}x ` : ''}Extra #{ex.id}
              </Text>
            ))}
          </View>
        )}

        {/* Instructions */}
        {booking.instructions && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardLabel}>Instructions</Text>
            </View>
            <Text style={styles.cardValueSub}>{booking.instructions}</Text>
          </View>
        )}

        {/* Price */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>{'£'}{Number(booking.totalPrice).toFixed(2)}</Text>
          </View>
          {booking.discountCode && (
            <View style={styles.priceRow}>
              <Text style={styles.priceSub}>Discount ({booking.discountCode})</Text>
              <Text style={styles.priceSub}>-{'£'}{Number(booking.discountAmount || 0).toFixed(2)}</Text>
            </View>
          )}
        </View>

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
                {isStaff ? 'Chat with Client' : 'Chat with Cleaner'}
              </Text>
            </TouchableOpacity>
          )}

          {isStaff && (booking.status === 'Pending' || booking.status === 'Confirmed' || booking.status === 'In Progress') && !booking.workCompletion && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.secondary }]}
              onPress={() => router.push(`/job/${booking.id}`)}
            >
              <Ionicons name="play-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnTextWhite}>Start Job</Text>
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

          {canCancel && !isStaff && !showReschedule && (
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
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },

  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

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
