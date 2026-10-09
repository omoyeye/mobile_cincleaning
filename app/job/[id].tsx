import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { staffApi, bookingsApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { StatusBadge, StepTracker } from '../../components/staff/StaffKit';
import type { Booking } from '../../types';
import { formatClock, isTodayYmd } from '../../utils/tracking';

const LOCATION_PUSH_INTERVAL_MS = 30000;

type Phase = 'pre' | 'clocked_in' | 'completing' | 'done';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const SIGNATURE_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f8fafc;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:140px;background:#fff;border-radius:8px;border:1px solid #d5e3ef}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
var c=document.getElementById('c'),ctx=c.getContext('2d'),drawing=false;
function resize(){var r=c.getBoundingClientRect();c.width=r.width*2;c.height=r.height*2;ctx.scale(2,2);ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=2.5;ctx.strokeStyle='#1e293b';}
resize();
function pt(e){var t=e.touches?e.touches[0]||e.changedTouches[0]:e;var r=c.getBoundingClientRect();return{x:t.clientX-r.left,y:t.clientY-r.top};}
function start(e){e.preventDefault();drawing=true;var p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
function move(e){if(!drawing)return;e.preventDefault();var p=pt(e);ctx.lineTo(p.x,p.y);ctx.stroke();}
function end(e){if(!drawing)return;drawing=false;var d=ctx.getImageData(0,0,c.width,c.height).data;var has=false;for(var i=3;i<d.length;i+=4){if(d[i]>0){has=true;break;}}
if(has)window.ReactNativeWebView.postMessage(c.toDataURL('image/png'));}
c.addEventListener('touchstart',start,{passive:false});
c.addEventListener('touchmove',move,{passive:false});
c.addEventListener('touchend',end);
c.addEventListener('mousedown',start);
c.addEventListener('mousemove',move);
c.addEventListener('mouseup',end);
function clearCanvas(){ctx.clearRect(0,0,c.width,c.height);window.ReactNativeWebView.postMessage('cleared');}
</script>
</body>
</html>`;

const SERVICE_CHECKLISTS: Record<string, string[]> = {
  standard: ['Vacuum all rooms', 'Mop hard floors', 'Clean kitchen surfaces', 'Clean bathrooms', 'Dust surfaces', 'Empty bins', 'Make beds'],
  deep_clean: ['Vacuum and mop all floors', 'Deep clean kitchen (oven, fridge, cupboards)', 'Deep clean bathrooms (grout, limescale)', 'Clean inside windows', 'Dust all surfaces and skirting', 'Clean behind furniture', 'Empty and sanitise bins'],
  end_of_tenancy: ['Full property deep clean', 'Oven and hob deep clean', 'Fridge and freezer clean', 'Bathroom descale and sanitise', 'All windows cleaned inside', 'Carpet vacuum and spot clean', 'Walls and doors wiped', 'Light fixtures cleaned'],
  airbnb: ['Change all bed linens', 'Full bathroom clean', 'Kitchen clean and restock', 'Vacuum and mop floors', 'Dust all surfaces', 'Empty bins and replace liners', 'Check supplies (soap, toilet paper)'],
  commercial: ['Vacuum all areas', 'Mop floors', 'Clean and sanitise kitchenette', 'Clean toilets and washrooms', 'Wipe desks and surfaces', 'Empty all bins', 'Restock supplies'],
  jet_washing: ['Set up equipment', 'Jet wash driveway/patio', 'Clean drainage channels', 'Remove moss and algae', 'Rinse down area', 'Pack up equipment'],
};

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const bookingId = Number(id);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('pre');
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [issues, setIssues] = useState('');
  const [earlyReason, setEarlyReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [checklist, setChecklist] = useState<{ task: string; done: boolean }[]>([]);
  const sigWebViewRef = useRef<WebView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [enRouteAt, setEnRouteAt] = useState<string | null>(null);
  const [startingTravel, setStartingTravel] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      const data = await bookingsApi.getOne(bookingId);
      setBooking(data);
      setEnRouteAt(data.enRouteAt ?? null);
      if (data.workCompletion) setPhase('done');
      const serviceKey = data.serviceType?.replace(/ /g, '_').toLowerCase() || 'standard';
      const tasks = SERVICE_CHECKLISTS[serviceKey] || SERVICE_CHECKLISTS.standard;
      setChecklist(tasks.map((task) => ({ task, done: false })));
    } catch {
      showToast('Could not load job details', 'error');
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const takePhoto = async (type: 'before' | 'after') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera permission required', 'warning');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const photo = { uri: asset.uri, base64: asset.base64 || '' };
      if (type === 'before') setBeforePhotos((prev) => [...prev, photo]);
      else setAfterPhotos((prev) => [...prev, photo]);
      showToast(`${type === 'before' ? 'Before' : 'After'} photo added`, 'success');
    }
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist((prev) => prev.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isJobToday = !!booking && isTodayYmd(booking.date);
  const jobOpen = !!booking && (booking.status === 'Pending' || booking.status === 'Confirmed');

  // Share GPS with the office and client while travelling (foreground only).
  useEffect(() => {
    if (!enRouteAt || phase !== 'pre' || !isJobToday || !jobOpen) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let lastSent = 0;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: LOCATION_PUSH_INTERVAL_MS, distanceInterval: 50 },
        (pos) => {
          const now = Date.now();
          if (now - lastSent < LOCATION_PUSH_INTERVAL_MS) return;
          lastSent = now;
          staffApi
            .updateLocation(bookingId, { lat: pos.coords.latitude, lng: pos.coords.longitude })
            .catch(() => {});
        },
      );
      if (cancelled) sub.remove();
      else setSharingLocation(true);
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      setSharingLocation(false);
    };
  }, [enRouteAt, phase, isJobToday, jobOpen, bookingId]);

  const handleStartTravel = async () => {
    if (!isJobToday) {
      showToast('You can only start travel on the day of the job', 'warning');
      return;
    }
    setStartingTravel(true);
    let coords: { lat: number; lng: number } | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      } else {
        showToast('Location is off, so the office cannot see you on the map', 'warning');
      }
    } catch {
      /* travel still starts without a fix */
    }
    try {
      const res = await staffApi.startTravel(bookingId, coords ?? {});
      setEnRouteAt(res.enRouteAt || new Date().toISOString());
      showToast('Client and office told you are on the way', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start travel', 'error');
    }
    setStartingTravel(false);
  };

  const openDirections = () => {
    if (!booking) return;
    const dest = encodeURIComponent([booking.address?.line1, booking.address?.postcode].filter(Boolean).join(', '));
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
  };

  const startTimer = (from: Date) => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - from.getTime()) / 1000));
    }, 1000);
  };

  const handleClockIn = async () => {
    let arrivedAt: { lat: number; lng: number } | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location services to clock in.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      arrivedAt = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(arrivedAt);
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Proceeding without it.');
    }

    // Tells the client their cleaner has arrived (and counts as en route for admin warnings).
    if (isJobToday) {
      staffApi.markArrived(bookingId, arrivedAt ?? {}).catch(() => {});
    }

    const now = new Date();
    setClockInTime(now);
    setPhase('clocked_in');
    startTimer(now);
  };

  const handleClockOut = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (booking?.propertyDetails?.duration) {
      const expectedMinutes = booking.propertyDetails.duration * 60;
      const actualMinutes = elapsed / 60;
      if (actualMinutes < expectedMinutes * 0.75) {
        setPhase('completing');
        return;
      }
    }
    setPhase('completing');
  };

  const handleSubmitCompletion = async () => {
    if (!clockInTime) return;
    setSubmitting(true);

    const clockOutTime = new Date();
    try {
      const allPhotos = [
        ...beforePhotos.map((p) => `data:image/jpeg;base64,${p.base64}`),
        ...afterPhotos.map((p) => `data:image/jpeg;base64,${p.base64}`),
      ].filter((p) => p.length > 30);

      await staffApi.completeJob(bookingId, {
        clockInTime: clockInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clockInAtIso: clockInTime.toISOString(),
        clockOutTime: clockOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clockOutAtIso: clockOutTime.toISOString(),
        notes: notes.trim() || undefined,
        issues: issues.trim() || undefined,
        earlyClockOutReason: earlyReason.trim() || undefined,
        location: location || undefined,
        signature: signature || undefined,
        photos: allPhotos.length > 0 ? allPhotos : undefined,
      });
      setPhase('done');
      Alert.alert('Job Complete', 'Your work has been submitted successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit completion.');
    }
    setSubmitting(false);
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
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Who, status and where the cleaner is in the job */}
        <View style={styles.jobHead}>
          <View style={styles.jobHeadRow}>
            <Text style={styles.jobHeadName} numberOfLines={1}>
              {booking.contact?.name || 'Client'}
            </Text>
            <StatusBadge status={phase === 'done' ? 'Completed' : booking.status} />
          </View>
          <Text style={styles.jobHeadRef}>{booking.bookingId || `Booking #${booking.id}`}</Text>
          <StepTracker
            steps={['Travel', 'On site', 'Finish', 'Done']}
            current={phase === 'pre' ? 0 : phase === 'clocked_in' ? 1 : phase === 'completing' ? 2 : 3}
          />
        </View>

        {/* Job info card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Service</Text>
          <Text style={styles.cardValue}>{booking.serviceType.replace(/_/g, ' ')}</Text>
          <View style={styles.cardDivider} />
          <View style={styles.cardRow}>
            <View style={styles.cardCol}>
              <Text style={styles.cardLabel}>Date</Text>
              <Text style={styles.cardValue}>
                {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.cardCol}>
              <Text style={styles.cardLabel}>Time</Text>
              <Text style={styles.cardValue}>{booking.time}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardIconRow}>
            <Ionicons name="person-outline" size={16} color={COLORS.primary} />
            <Text style={styles.cardValue}>{booking.contact?.name}</Text>
          </View>
          <View style={styles.cardIconRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.primary} />
            <Text style={styles.cardValueSub}>
              {booking.address?.line1}, {booking.address?.postcode}
            </Text>
          </View>
        </View>

        {/* Travel / running late */}
        {phase === 'pre' && jobOpen && (
          <View style={styles.travelCard}>
            {!isJobToday ? (
              <Text style={styles.travelHint}>Travel and running-late updates open on the day of the job.</Text>
            ) : enRouteAt ? (
              <View style={styles.enRouteRow}>
                <View style={styles.enRouteDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.enRouteTitle}>On the way since {formatClock(enRouteAt)}</Text>
                  <Text style={styles.travelHint}>
                    {sharingLocation
                      ? 'Sharing your live location with the office and client. Keep this screen open while you travel.'
                      : 'Turn on location to share your live position.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.travelBtn, startingTravel && { opacity: 0.6 }]}
                  onPress={handleStartTravel}
                  disabled={startingTravel}
                >
                  {startingTravel ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={18} color={COLORS.white} />
                      <Text style={styles.travelBtnText}>Start Travel</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={[styles.travelHint, { textAlign: 'center' }]}>
                  Lets the client and office know you are on the way.
                </Text>
              </>
            )}
            {isJobToday && (
              <View style={styles.travelActions}>
                <TouchableOpacity style={styles.travelSecondary} onPress={openDirections}>
                  <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.travelSecondaryText}>Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelSecondary, styles.lateBtn]}
                  onPress={() => router.push(`/running-late?bookingId=${bookingId}`)}
                >
                  <Ionicons name="alarm-outline" size={16} color="#b45309" />
                  <Text style={[styles.travelSecondaryText, { color: '#b45309' }]}>Running late</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Timer / Clock area */}
        {phase === 'pre' && (
          <View style={styles.timerSection}>
            <View style={styles.timerCircle}>
              <Ionicons name="play" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.timerLabel}>Ready to start?</Text>
            <Text style={styles.timerSub}>Take before photos, then clock in</Text>

            {/* Before photos */}
            <View style={styles.photoSection}>
              <Text style={styles.photoTitle}>Before Photos</Text>
              <View style={styles.photoRow}>
                {beforePhotos.map((photo, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setBeforePhotos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Ionicons name="close-circle" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {beforePhotos.length < 4 && (
                  <TouchableOpacity style={styles.photoAdd} onPress={() => takePhoto('before')}>
                    <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.photoAddText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.clockBtn} onPress={handleClockIn}>
              <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
              <Text style={styles.clockBtnText}>Clock In</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'clocked_in' && (
          <View style={styles.timerSection}>
            <View style={styles.timerCircleActive}>
              <Text style={styles.timerDigits}>{formatElapsed(elapsed)}</Text>
            </View>
            <Text style={styles.timerLabel}>In Progress</Text>
            <Text style={styles.timerSub}>
              Clocked in at {clockInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {location && (
              <View style={styles.locationTag}>
                <Ionicons name="navigate-outline" size={12} color={COLORS.secondary} />
                <Text style={styles.locationText}>Location verified</Text>
              </View>
            )}

            {/* Task Checklist */}
            {checklist.length > 0 && (
              <View style={styles.checklistSection}>
                <View style={styles.checklistHeader}>
                  <Text style={styles.checklistTitle}>Task Checklist</Text>
                  <Text style={styles.checklistProgress}>
                    {checklist.filter((c) => c.done).length}/{checklist.length}
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${(checklist.filter((c) => c.done).length / checklist.length) * 100}%` },
                    ]}
                  />
                </View>
                {checklist.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.checklistItem}
                    onPress={() => toggleChecklistItem(i)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                      {item.done && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                    </View>
                    <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
                      {item.task}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={[styles.clockBtn, styles.clockOutBtn]} onPress={handleClockOut}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.clockBtnText}>Clock Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'completing' && (
          <View style={styles.completionSection}>
            <Text style={styles.sectionTitle}>Completion Details</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatElapsed(elapsed)}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.textArea}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes about the clean..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Issues (optional)</Text>
              <TextInput
                style={styles.textArea}
                value={issues}
                onChangeText={setIssues}
                placeholder="Report any issues..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            {booking.propertyDetails?.duration && elapsed < booking.propertyDetails.duration * 3600 * 0.75 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Reason for early finish *</Text>
                <TextInput
                  style={styles.textArea}
                  value={earlyReason}
                  onChangeText={setEarlyReason}
                  placeholder="Why did the job finish early?"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}

            {/* After photos */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>After Photos</Text>
              <View style={styles.photoRow}>
                {afterPhotos.map((photo, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setAfterPhotos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Ionicons name="close-circle" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {afterPhotos.length < 4 && (
                  <TouchableOpacity style={styles.photoAdd} onPress={() => takePhoto('after')}>
                    <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.photoAddText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Signature</Text>
              <View style={styles.sigContainer}>
                <WebView
                  ref={sigWebViewRef}
                  style={styles.sigWebView}
                  originWhitelist={['*']}
                  scrollEnabled={false}
                  bounces={false}
                  javaScriptEnabled
                  onMessage={(event) => {
                    const data = event.nativeEvent.data;
                    if (data && data.startsWith('data:image')) {
                      setSignature(data);
                    } else if (data === 'cleared') {
                      setSignature('');
                    }
                  }}
                  source={{ html: SIGNATURE_HTML }}
                />
              </View>
              <View style={styles.sigActions}>
                <Text style={styles.sigHint}>{signature ? 'Signature captured' : 'Sign above with your finger'}</Text>
                {signature ? (
                  <TouchableOpacity
                    onPress={() => {
                      sigWebViewRef.current?.injectJavaScript('clearCanvas(); true;');
                      setSignature('');
                    }}
                  >
                    <Text style={styles.sigClear}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitCompletion}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                  <Text style={styles.submitBtnText}>Submit Completion</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.doneSection}>
            <View style={styles.doneCircle}>
              <Ionicons name="checkmark" size={48} color={COLORS.secondary} />
            </View>
            <Text style={styles.doneTitle}>Job Completed</Text>
            {booking.workCompletion && (
              <View style={styles.doneSummary}>
                <Text style={styles.doneSummaryText}>
                  {booking.workCompletion.clockInTime} - {booking.workCompletion.clockOutTime}
                </Text>
                {booking.workCompletion.notes && (
                  <Text style={styles.doneNotes}>{booking.workCompletion.notes}</Text>
                )}
                {booking.workCompletion.signature && (
                  <Text style={styles.doneSigned}>Signature on file</Text>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.backToSchedule} onPress={() => router.back()}>
              <Text style={styles.backToScheduleText}>Back to Schedule</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  jobHead: { marginBottom: SPACING.base },
  jobHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  jobHeadName: { flex: 1, fontSize: 24, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  jobHeadRef: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
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

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardRow: { flexDirection: 'row', gap: SPACING.xl },
  cardCol: { flex: 1 },
  cardDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  cardLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardValueSub: { fontSize: 13, color: COLORS.textSecondary },

  travelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  travelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  travelBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  travelHint: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  enRouteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  enRouteDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.secondary, marginTop: 5 },
  enRouteTitle: { fontSize: 15, fontWeight: '700', color: COLORS.secondary, marginBottom: 2 },
  travelActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  travelSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '08',
  },
  lateBtn: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  travelSecondaryText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  timerSection: { alignItems: 'center', paddingVertical: SPACING.xl },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  timerCircleActive: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  timerDigits: { fontSize: 28, fontWeight: '800', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  timerSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg },

  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
  },
  locationText: { fontSize: 11, fontWeight: '600', color: COLORS.secondary },

  clockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  clockOutBtn: { backgroundColor: COLORS.accent },
  clockBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  completionSection: { marginTop: SPACING.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  summaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, fontVariant: ['tabular-nums'] },

  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  textArea: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  sigContainer: {
    height: 140,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  sigWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sigActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  sigHint: { fontSize: 11, color: COLORS.textTertiary },
  sigClear: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  doneSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  doneCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  doneTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  doneSummary: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  doneSummaryText: { fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  doneNotes: { fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' },
  doneSigned: { fontSize: 11, fontWeight: '600', color: COLORS.secondary, marginTop: SPACING.xs, textAlign: 'center' },
  photoSection: { width: '100%', marginBottom: SPACING.lg },
  photoTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm, textAlign: 'center' },
  photoRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center' },
  photoThumb: { width: 70, height: 70, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.white, borderRadius: 10 },
  photoAdd: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '08',
  },
  photoAddText: { fontSize: 10, fontWeight: '600', color: COLORS.primary, marginTop: 2 },

  checklistSection: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  checklistTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  checklistProgress: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  progressBarTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, marginBottom: SPACING.md },
  progressBarFill: { height: '100%', backgroundColor: COLORS.secondary, borderRadius: 2 },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  checklistText: { fontSize: 14, color: COLORS.text, flex: 1 },
  checklistTextDone: { textDecorationLine: 'line-through', color: COLORS.textTertiary },

  backToSchedule: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  backToScheduleText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
});
