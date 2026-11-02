import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { qaApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { EmptyState, friendlyDay, serviceLabel } from '../../components/ClientKit';
import { goBack } from '../../utils/navigation';
import type { QaCheck, QaJob } from '../../types';

type Result = QaCheck['result'];
type Row = { task: string; cleanerTicked: boolean | null; result: Result | null; note: string };

const RESULTS: { key: Result; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'pass', label: 'Pass', icon: 'checkmark', color: COLORS.secondary },
  { key: 'fail', label: 'Fail', icon: 'close', color: COLORS.accent },
  { key: 'na', label: 'N/A', icon: 'remove', color: COLORS.textTertiary },
];

function Stars({ value, onChange, label, optional }: { value: number; onChange: (n: number) => void; label: string; optional?: boolean }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(value === n && optional ? 0 : n)}
            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
            accessibilityLabel={`${label} ${n} of 5`}
          >
            <Ionicons name={n <= value ? 'star' : 'star-outline'} size={26} color={COLORS.accentGold} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** Supervisor field assessment of a finished job, task by task, for each cleaner on it. */
export default function QualityCheckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const bookingId = Number(id);

  const [job, setJob] = useState<QaJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [overall, setOverall] = useState(0);
  const [overallTouched, setOverallTouched] = useState(false);
  const [punctuality, setPunctuality] = useState(0);
  const [quality, setQuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await qaApi.job(bookingId);
      setJob(data);
      setRows(data.checklist.map((c) => ({ task: c.task, cleanerTicked: c.done, result: null, note: '' })));
      const open = data.cleaners.filter((c) => !c.assessment).map((c) => c.id);
      setSelected(open.length ? open : data.cleaners.slice(0, 1).map((c) => c.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the job');
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const scored = rows.filter((r) => r.result && r.result !== 'na');
  const passed = rows.filter((r) => r.result === 'pass').length;
  const unanswered = rows.filter((r) => !r.result).length;

  // Until the supervisor picks one, the overall score follows the pass rate.
  const suggested = useMemo(() => (scored.length ? Math.max(1, Math.round(1 + (4 * passed) / scored.length)) : 0), [scored.length, passed]);
  const overallValue = overallTouched ? overall : suggested;

  const setResult = (i: number, result: Result) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, result: r.result === result ? null : result } : r)));
  const setNote = (i: number, note: string) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, note } : r)));
  const passAll = () => setRows((prev) => prev.map((r) => (r.result ? r : { ...r, result: 'pass' })));
  const toggleCleaner = (sid: number) =>
    setSelected((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));

  const submit = async () => {
    if (!job) return;
    if (!selected.length) return showToast('Pick who you are assessing', 'warning');
    if (unanswered) return showToast(`Mark all ${rows.length} tasks (${unanswered} left)`, 'warning');
    if (!overallValue) return showToast('Give an overall score', 'warning');
    if (rows.some((r) => r.result === 'fail' && !r.note.trim())) return showToast('Add a short note to each failed task', 'warning');
    if (remark.trim().length < 3) return showToast('Write a short remark about the visit', 'warning');

    setSaving(true);
    const checklist: QaCheck[] = rows.map((r) => ({ task: r.task, result: r.result as Result, ...(r.note.trim() ? { note: r.note.trim() } : {}) }));
    const failed: string[] = [];
    for (const sid of selected) {
      try {
        await qaApi.assess(sid, {
          bookingId: job.id,
          rating: overallValue,
          punctuality: punctuality || null,
          quality: quality || null,
          professionalism: professionalism || null,
          remark: remark.trim(),
          checklist,
        });
      } catch (e) {
        failed.push(`${job.cleaners.find((c) => c.id === sid)?.name || 'Cleaner'}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }
    setSaving(false);
    if (failed.length) {
      Alert.alert('Some assessments were not saved', failed.join('\n'));
      load();
      return;
    }
    showToast(selected.length > 1 ? `Saved for ${selected.length} cleaners` : 'Assessment saved', 'success');
    goBack(router);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Quality check</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={{ padding: SPACING.lg }}>
          <EmptyState icon="clipboard-outline" title="Job unavailable" body={error || 'Please try again in a moment.'} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      <KeyboardAwareScrollView bottomOffset={40} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Job */}
        <View style={styles.card}>
          <Text style={styles.title}>{serviceLabel(job.serviceType)}</Text>
          <Text style={styles.meta}>
            {friendlyDay(String(job.date).slice(0, 10))} · {job.time} · {job.clientName}
            {job.ref ? ` · ${job.ref}` : ''}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={COLORS.textTertiary} />
            <Text style={styles.meta}>{job.address}</Text>
          </View>
          {job.cleanerNotes ? <Text style={styles.note}>Cleaner's notes: {job.cleanerNotes}</Text> : null}
          {job.cleanerIssues ? <Text style={[styles.note, { color: COLORS.accent }]}>Issues reported: {job.cleanerIssues}</Text> : null}
          {job.photos.length ? (
            <View style={styles.photos}>
              {job.photos.map((u) => (
                <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" transition={200} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Who */}
        <Text style={styles.section}>Assessing</Text>
        <View style={styles.chips}>
          {job.cleaners.map((c) => {
            const on = selected.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggleCleaner(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.chipText, on && { color: COLORS.white }]}>{c.name}</Text>
                {c.assessment ? <Text style={[styles.chipDone, on && { color: COLORS.white }]}>{c.assessment.rating}/5 done</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        {job.cleaners.length > 1 ? <Text style={styles.hint}>Tick more than one to give the team the same result.</Text> : null}

        {/* Tasks */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>
            Task checklist · {passed}/{scored.length || 0} passed
          </Text>
          {unanswered ? (
            <TouchableOpacity onPress={passAll} style={styles.passAll} accessibilityLabel="Mark the rest as pass">
              <Ionicons name="checkmark-done" size={15} color={COLORS.secondary} />
              <Text style={styles.passAllText}>Pass the rest</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {rows.map((r, i) => (
          <View key={r.task} style={[styles.task, r.result === 'fail' && styles.taskFail]}>
            <Text style={styles.taskName}>{r.task}</Text>
            {r.cleanerTicked !== null ? (
              <Text style={[styles.ticked, { color: r.cleanerTicked ? COLORS.secondary : COLORS.textTertiary }]}>
                {r.cleanerTicked ? 'Cleaner ticked this' : 'Cleaner did not tick this'}
              </Text>
            ) : null}
            <View style={styles.results}>
              {RESULTS.map((opt) => {
                const on = r.result === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.resultBtn, on && { backgroundColor: opt.color, borderColor: opt.color }]}
                    onPress={() => setResult(i, opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${r.task}: ${opt.label}`}
                  >
                    <Ionicons name={opt.icon} size={15} color={on ? COLORS.white : opt.color} />
                    <Text style={[styles.resultText, { color: on ? COLORS.white : opt.color }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {r.result === 'fail' ? (
              <TextInput
                style={styles.noteInput}
                value={r.note}
                onChangeText={(t) => setNote(i, t)}
                placeholder="What needs fixing?"
                placeholderTextColor={COLORS.textTertiary}
                maxLength={300}
              />
            ) : null}
          </View>
        ))}

        {/* Scores */}
        <Text style={styles.section}>Scores</Text>
        <View style={styles.card}>
          <Stars
            label="Overall"
            value={overallValue}
            onChange={(n) => {
              setOverall(n);
              setOverallTouched(true);
            }}
          />
          {!overallTouched && suggested ? <Text style={styles.hint}>Suggested from the tasks passed. Tap to change.</Text> : null}
          <Stars label="Quality of work" value={quality} onChange={setQuality} optional />
          <Stars label="Punctuality" value={punctuality} onChange={setPunctuality} optional />
          <Stars label="Professionalism" value={professionalism} onChange={setProfessionalism} optional />
        </View>

        <Text style={styles.section}>Remark</Text>
        <TextInput
          style={styles.remark}
          value={remark}
          onChangeText={setRemark}
          placeholder="What you saw on the visit. The cleaner will see this."
          placeholderTextColor={COLORS.textTertiary}
          multiline
          maxLength={2000}
        />

        <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Save assessment</Text>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border + '80', padding: SPACING.md, gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  meta: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  note: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  photo: { width: 72, height: 72, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceAlt },
  section: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  chipDone: { fontSize: 11, fontWeight: '600', color: COLORS.secondary },
  passAll: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  passAllText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  task: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border + '80', padding: SPACING.md, marginBottom: SPACING.sm, gap: 6 },
  taskFail: { borderColor: COLORS.accent + '66', backgroundColor: COLORS.accent + '06' },
  taskName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  ticked: { fontSize: 12, fontWeight: '600' },
  results: { flexDirection: 'row', gap: SPACING.sm },
  resultBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  resultText: { fontSize: 13, fontWeight: '700' },
  noteInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  scoreLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  optional: { fontSize: 12, fontWeight: '400', color: COLORS.textTertiary },
  stars: { flexDirection: 'row', gap: 4 },
  remark: { minHeight: 96, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surface },
  submit: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center' },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
