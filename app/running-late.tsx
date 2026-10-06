import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { staffApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { APP_NAME, COLORS, RADIUS, SPACING } from '../constants/config';
import type { Booking, LateNotice } from '../types';
import { addMinutesToHHMM, formatClock, isTodayYmd, isValidHHMM } from '../utils/tracking';

const REASONS = [
  'Heavy traffic',
  'Previous job overran',
  'Public transport delay',
  'Vehicle problem',
  'Parking difficulty',
  'Personal emergency',
  'Other',
];
const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const AMBER = '#f59e0b';

export default function RunningLateScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobId, setJobId] = useState<number | null>(bookingId ? Number(bookingId) : null);
  const [reasonChip, setReasonChip] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [etaMode, setEtaMode] = useState<'minutes' | 'time'>('minutes');
  const [minutesLate, setMinutesLate] = useState(15);
  const [etaTime, setEtaTime] = useState('');
  const [note, setNote] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await staffApi.getBookings();
      setJobs(Array.isArray(all) ? all : []);
    } catch {
      showToast('Could not load your jobs', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const todaysJobs = useMemo(
    () =>
      jobs
        .filter((j) => isTodayYmd(j.date) && (j.status === 'Pending' || j.status === 'Confirmed'))
        .sort((a, b) => String(a.time).localeCompare(String(b.time))),
    [jobs],
  );

  useEffect(() => {
    if (jobId != null && todaysJobs.some((j) => j.id === jobId)) return;
    setJobId(todaysJobs[0]?.id ?? null);
  }, [todaysJobs, jobId]);

  const job = todaysJobs.find((j) => j.id === jobId) || null;
  const reason = (reasonChip === 'Other' ? reasonText : reasonChip || reasonText).trim();
  const computedEta = job ? (etaMode === 'minutes' ? addMinutesToHHMM(job.time, minutesLate) : etaTime) : '';
  const etaOk = etaMode === 'minutes' || isValidHHMM(etaTime);
  const staffName = user?.name || 'Your cleaner';

  const preview = job
    ? `Hi ${job.contact?.name || 'there'}, ${staffName} from ${APP_NAME} is ${
        etaMode === 'minutes' ? `about ${minutesLate} minutes late` : 'running late'
      } for your clean today (booked ${job.time}). Reason: ${reason || '...'}.${
        computedEta && etaOk ? ` New estimated arrival: ${computedEta}.` : ''
      }${note.trim() ? ` ${note.trim()}` : ''} Sorry for the inconvenience.`
    : '';

  const notices = useMemo(
    () =>
      todaysJobs
        .flatMap((j) => (Array.isArray(j.lateNotices) ? j.lateNotices.map((n) => ({ notice: n, job: j })) : []))
        .sort((a, b) => String(b.notice.sentAt).localeCompare(String(a.notice.sentAt))),
    [todaysJobs],
  );

  const canSend = !!job && !!reason && etaOk && !!computedEta && (notifyClient || notifyAdmin) && !sending;

  const handleSend = async () => {
    if (!job || !canSend) return;
    setSending(true);
    try {
      await staffApi.sendRunningLate(job.id, {
        reason,
        etaTime: computedEta,
        minutesLate: etaMode === 'minutes' ? minutesLate : undefined,
        note: note.trim() || undefined,
        notifyClient,
        notifyAdmin,
      });
      const who = [notifyClient ? 'client' : '', notifyAdmin ? 'office' : ''].filter(Boolean).join(' and ');
      showToast(`Update sent to the ${who}`, 'success');
      setNote('');
      await load();
      if (bookingId) router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send update', 'error');
    }
    setSending(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Running Late</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <Text style={styles.intro}>
            Let the client and the office know why you are delayed and when you expect to arrive.
          </Text>

          {todaysJobs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-clear-outline" size={36} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>You have no open jobs today.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Job</Text>
              {todaysJobs.map((j) => (
                <TouchableOpacity
                  key={j.id}
                  style={[styles.jobCard, j.id === jobId && styles.jobCardActive]}
                  onPress={() => setJobId(j.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobName}>{j.contact?.name || 'Client'}</Text>
                    <Text style={styles.jobSub}>{j.serviceType} · {j.address?.postcode}</Text>
                  </View>
                  <Text style={styles.jobTime}>{j.time}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Reason</Text>
              <View style={styles.chips}>
                {REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, reasonChip === r && styles.chipActive]}
                    onPress={() => setReasonChip(reasonChip === r ? '' : r)}
                  >
                    <Text style={[styles.chipText, reasonChip === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {(reasonChip === 'Other' || !reasonChip) && (
                <TextInput
                  style={styles.input}
                  value={reasonText}
                  onChangeText={setReasonText}
                  maxLength={300}
                  placeholder="Describe the reason"
                  placeholderTextColor={COLORS.textTertiary}
                />
              )}

              <Text style={styles.label}>Arrival</Text>
              <View style={styles.segment}>
                {(['minutes', 'time'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.segmentBtn, etaMode === m && styles.segmentBtnActive]}
                    onPress={() => setEtaMode(m)}
                  >
                    <Text style={[styles.segmentText, etaMode === m && styles.segmentTextActive]}>
                      {m === 'minutes' ? 'Minutes late' : 'Exact time'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {etaMode === 'minutes' ? (
                <View style={styles.chips}>
                  {MINUTE_OPTIONS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, minutesLate === m && styles.chipActive]}
                      onPress={() => setMinutesLate(m)}
                    >
                      <Text style={[styles.chipText, minutesLate === m && styles.chipTextActive]}>{m} min</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={[styles.input, { width: 120 }, etaTime.length >= 5 && !etaOk && styles.inputError]}
                  value={etaTime}
                  onChangeText={(v) => {
                    const digits = v.replace(/\D/g, '').slice(0, 4);
                    setEtaTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
                  }}
                  keyboardType="number-pad"
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.textTertiary}
                  maxLength={5}
                />
              )}
              {job && computedEta && etaOk ? (
                <Text style={styles.etaLine}>
                  Booked for {job.time}. Estimated arrival <Text style={{ color: '#b45309', fontWeight: '800' }}>{computedEta}</Text>.
                </Text>
              ) : null}

              <Text style={styles.label}>Extra note (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                maxLength={500}
                multiline
                placeholder="e.g. I will message again if anything changes."
                placeholderTextColor={COLORS.textTertiary}
              />

              <Text style={styles.label}>Send to</Text>
              {[
                { on: notifyClient, set: setNotifyClient, title: 'Client', sub: 'SMS, email, app alert and booking chat' },
                { on: notifyAdmin, set: setNotifyAdmin, title: 'Office / admin', sub: 'Admin dashboard alert' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.title}
                  style={[styles.recipient, r.on && styles.recipientOn]}
                  onPress={() => r.set(!r.on)}
                >
                  <View style={[styles.checkbox, r.on && styles.checkboxOn]}>
                    {r.on && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientTitle}>{r.title}</Text>
                    <Text style={styles.recipientSub}>{r.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {notifyClient && !!preview && (
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>Client will see</Text>
                  <Text style={styles.previewText}>{preview}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.sendBtn, !canSend && { opacity: 0.5 }]}
                onPress={handleSend}
                disabled={!canSend}
              >
                {sending ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color={COLORS.white} />
                    <Text style={styles.sendText}>Send update</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {notices.length > 0 && (
            <>
              <Text style={styles.label}>Sent today</Text>
              {notices.map(({ notice, job: j }: { notice: LateNotice; job: Booking }) => (
                <View key={notice.id} style={styles.noticeCard}>
                  <View style={styles.noticeHead}>
                    <Text style={styles.noticeTitle}>{j.contact?.name || 'Client'} · {j.time}</Text>
                    <Text style={styles.noticeTime}>{formatClock(notice.sentAt)}</Text>
                  </View>
                  <Text style={styles.noticeBody}>
                    {notice.reason}
                    {notice.minutesLate ? ` · ${notice.minutesLate} min late` : ''}
                    {notice.etaTime ? ` · ETA ${notice.etaTime}` : ''}
                  </Text>
                  <Text style={styles.noticeSub}>
                    Sent to {[notice.notified?.client ? 'client' : '', notice.notified?.admin ? 'office' : ''].filter(Boolean).join(' and ') || 'nobody'}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  intro: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  jobCardActive: { borderColor: AMBER, backgroundColor: '#fffbeb', borderWidth: 2 },
  jobName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  jobSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  jobTime: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: AMBER, borderColor: AMBER },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  inputError: { borderColor: COLORS.error },
  textArea: { minHeight: 70, textAlignVertical: 'top', marginTop: 0 },
  segment: { flexDirection: 'row', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.sm },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: COLORS.surface },
  segmentText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  segmentTextActive: { color: COLORS.text },
  etaLine: { fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.sm },
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  recipientOn: { borderColor: COLORS.secondaryLight, backgroundColor: COLORS.successLight },
  checkbox: { width: 22, height: 22, borderRadius: 6, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: COLORS.secondary },
  recipientTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  recipientSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  preview: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  previewLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  previewText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: AMBER,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  sendText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  noticeCard: {
    backgroundColor: '#fffbeb',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: SPACING.sm,
  },
  noticeHead: { flexDirection: 'row', justifyContent: 'space-between' },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  noticeTime: { fontSize: 12, color: COLORS.textSecondary },
  noticeBody: { fontSize: 14, color: COLORS.text, marginTop: 4 },
  noticeSub: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
});
