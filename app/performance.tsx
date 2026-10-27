import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { staffApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { Card, EmptyState } from '../components/staff/StaffKit';
import { FilterPills, money } from '../components/ClientKit';
import { goBack } from '../utils/navigation';
import type { StaffPerformance } from '../types';

type Section = 'overview' | 'reviews' | 'assessments' | 'jobs';

function hoursLabel(h: number): string {
  const total = Math.round((h || 0) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h ${mm}min` : `${hh}h`;
}

function prettyDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function scoreColor(pct: number | null): string {
  if (pct === null) return COLORS.textTertiary;
  if (pct >= 90) return COLORS.secondary;
  if (pct >= 75) return '#b45309';
  return COLORS.error;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? COLORS.accentGold : COLORS.border} />
      ))}
    </View>
  );
}

function Tile({ icon, tint, value, label, hint }: { icon: keyof typeof Ionicons.glyphMap; tint: string; value: string; label: string; hint?: string }) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tint + '18' }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.tileValue, label === 'On-time arrivals' && { color: tint }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <View style={styles.rowBetween}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value ? value.toFixed(1) : '-'}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value ? (value / 5) * 100 : 0}%` }]} />
      </View>
    </View>
  );
}

/** "My performance" for cleaners: the same figures as the website staff portal and the office. */
export default function PerformanceScreen() {
  const router = useRouter();
  const [data, setData] = useState<StaffPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');

  const load = useCallback(async () => {
    try {
      setData(await staffApi.getMyPerformance());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your performance');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => goBack(router, '/(staff)')} style={styles.backBtn} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>My performance</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={{ padding: SPACING.lg }}>
          <EmptyState icon="trending-up-outline" title="Performance unavailable" body={error || 'Please try again in a moment.'} />
          <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const s = data.summary;
  const since = data.staff.joinedAt
    ? new Date(data.staff.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const maxEarned = Math.max(1, ...data.months.map((m) => m.earned));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.intro}>
          {since ? `With CiN since ${since}. ` : ''}These are the same figures the office sees.
        </Text>

        <View style={styles.grid}>
          <Tile icon="ribbon-outline" tint={COLORS.secondary} value={String(s.completed)} label="Jobs completed" hint={`${s.upcoming} upcoming · ${s.cancelled} cancelled`} />
          <Tile icon="star-outline" tint={COLORS.accentGold} value={s.avgClientRating ? s.avgClientRating.toFixed(1) : '-'} label="Client rating" hint={`${s.reviewCount} review${s.reviewCount === 1 ? '' : 's'}`} />
          <Tile
            icon="time-outline"
            tint={scoreColor(s.punctualityPercent)}
            value={s.punctualityPercent === null ? '-' : `${s.punctualityPercent}%`}
            label="On-time arrivals"
            hint={s.timedJobs ? `from ${s.timedJobs} timed job${s.timedJobs === 1 ? '' : 's'}` : 'clock in to start tracking'}
          />
          <Tile icon="clipboard-outline" tint="#0d9488" value={s.supervisorScore ? s.supervisorScore.toFixed(1) : '-'} label="Supervisor score" hint={`${s.assessmentCount} assessment${s.assessmentCount === 1 ? '' : 's'}`} />
          <Tile icon="hourglass-outline" tint="#6366f1" value={hoursLabel(s.hoursWorked)} label="Hours worked" hint="completed jobs" />
          <Tile icon="calendar-outline" tint="#9333ea" value={money(s.weekEarned)} label="This week" hint="completed Mon to Sun" />
          <Tile icon="cash-outline" tint="#b45309" value={money(s.monthEarned)} label="This month" hint={s.todayScheduled > 0 ? `+ ${money(s.todayScheduled)} booked today` : `${money(s.todayEarned)} today`} />
          <Tile icon="wallet-outline" tint={COLORS.textSecondary} value={money(s.totalEarned)} label="Total earned" hint={`at ${money(data.staff.hourlyRate)}/hr`} />
        </View>

        <View style={{ marginVertical: SPACING.md }}>
          <FilterPills<Section>
            value={section}
            onChange={setSection}
            options={[
              { key: 'overview', label: 'Overview' },
              { key: 'reviews', label: 'Reviews', count: data.reviews.length },
              { key: 'assessments', label: 'Assessments', count: data.assessments.length },
              { key: 'jobs', label: 'Jobs' },
            ]}
          />
        </View>

        {section === 'overview' ? (
          <>
            <Card style={{ marginBottom: SPACING.md }}>
              <Text style={styles.cardTitle}>Last six months</Text>
              <Text style={styles.cardSub}>Earnings from completed jobs</Text>
              <View style={styles.chart}>
                {data.months.map((m) => (
                  <View key={m.month} style={styles.chartCol}>
                    <Text style={styles.chartValue}>{m.earned ? `£${Math.round(m.earned)}` : ' '}</Text>
                    <View
                      style={[
                        styles.chartBar,
                        { height: m.earned ? Math.max(8, (m.earned / maxEarned) * 110) : 4, backgroundColor: m.earned ? COLORS.primary : COLORS.borderLight },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card style={{ marginBottom: SPACING.md }}>
              <Text style={styles.cardTitle}>How you are doing</Text>
              <View style={styles.trio}>
                <View style={[styles.trioBox, { backgroundColor: COLORS.successLight }]}>
                  <Ionicons name="thumbs-up-outline" size={16} color={COLORS.secondary} />
                  <Text style={[styles.trioValue, { color: COLORS.secondary }]}>{s.compliments}</Text>
                  <Text style={[styles.trioLabel, { color: COLORS.secondary }]}>Compliments</Text>
                </View>
                <View style={[styles.trioBox, { backgroundColor: COLORS.errorLight }]}>
                  <Ionicons name="thumbs-down-outline" size={16} color={COLORS.error} />
                  <Text style={[styles.trioValue, { color: COLORS.error }]}>{s.complaints}</Text>
                  <Text style={[styles.trioLabel, { color: COLORS.error }]}>Complaints</Text>
                </View>
                <View style={[styles.trioBox, { backgroundColor: COLORS.warningLight }]}>
                  <Ionicons name="alarm-outline" size={16} color="#b45309" />
                  <Text style={[styles.trioValue, { color: '#b45309' }]}>{s.lateNotices}</Text>
                  <Text style={[styles.trioLabel, { color: '#b45309' }]}>Late notices</Text>
                </View>
              </View>
              <ScoreBar label="Punctuality (supervisor)" value={s.supervisorBreakdown.punctuality} />
              <ScoreBar label="Quality of work" value={s.supervisorBreakdown.quality} />
              <ScoreBar label="Professionalism" value={s.supervisorBreakdown.professionalism} />
              {s.completionRate !== null ? (
                <Text style={styles.note}>
                  You completed <Text style={{ fontWeight: '700', color: COLORS.text }}>{s.completionRate}%</Text> of your finished jobs (the rest were cancelled).
                </Text>
              ) : null}
            </Card>

            {s.punctualityPercent !== null && s.punctualityPercent < 90 ? (
              <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={18} color="#b45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>Tip: arrive a few minutes early</Text>
                  <Text style={styles.tipBody}>
                    Arrivals up to 5 minutes after the start count as on time. Tap Start travel when you leave, and use Running late if you are delayed.
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {section === 'reviews' ? (
          data.reviews.length === 0 ? (
            <EmptyState icon="star-outline" title="No client reviews yet" body="Ratings appear here after clients review a completed clean." />
          ) : (
            data.reviews.map((r) => (
              <Card key={r.id} style={{ marginBottom: SPACING.sm }}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowGap}>
                    <Stars value={r.rating || 0} />
                    <Text style={styles.itemTitle}>{r.client}</Text>
                  </View>
                  <Text style={styles.itemMeta}>{prettyDate(r.date)}</Text>
                </View>
                <Text style={styles.itemMeta}>
                  {r.service}
                  {r.ref ? ` · ${r.ref}` : ''}
                </Text>
                {r.feedback ? <Text style={styles.quote}>"{r.feedback}"</Text> : null}
              </Card>
            ))
          )
        ) : null}

        {section === 'assessments' ? (
          data.assessments.length === 0 ? (
            <EmptyState icon="clipboard-outline" title="No assessments yet" body="When a supervisor reviews your work, their scores and comments appear here." />
          ) : (
            data.assessments.map((a) => (
              <Card key={a.id} style={{ marginBottom: SPACING.sm }}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowGap}>
                    <Stars value={a.rating} />
                    <Text style={styles.itemTitle}>{a.assessorName}</Text>
                  </View>
                  <Text style={styles.itemMeta}>
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </Text>
                </View>
                <View style={styles.chips}>
                  {a.punctuality ? <Text style={styles.chip}>Punctuality {a.punctuality}/5</Text> : null}
                  {a.quality ? <Text style={styles.chip}>Quality {a.quality}/5</Text> : null}
                  {a.professionalism ? <Text style={styles.chip}>Professionalism {a.professionalism}/5</Text> : null}
                </View>
                <Text style={styles.quote}>{a.remark}</Text>
              </Card>
            ))
          )
        ) : null}

        {section === 'jobs' ? (
          data.recentJobs.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No finished jobs yet" body="Completed and cancelled jobs appear here." />
          ) : (
            <Card style={{ paddingVertical: 0 }}>
              {data.recentJobs.map((j, i) => (
                <TouchableOpacity
                  key={j.id}
                  style={[styles.job, i < data.recentJobs.length - 1 && styles.jobDivider]}
                  onPress={() => router.push(`/job/${j.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {j.client} · {j.service}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {prettyDate(j.date)} {j.time}
                      {j.ref ? ` · ${j.ref}` : ''}
                    </Text>
                    <View style={[styles.rowGap, { marginTop: 5 }]}>
                      {j.onTime === true ? <Text style={[styles.pill, styles.pillGood]}>On time</Text> : null}
                      {j.onTime === false && j.minutesLate !== null ? <Text style={[styles.pill, styles.pillWarn]}>{j.minutesLate} min late</Text> : null}
                      {j.rating ? <Stars value={j.rating} size={12} /> : null}
                    </View>
                  </View>
                  {j.status === 'Cancelled' ? (
                    <Text style={[styles.pill, styles.pillBad]}>Cancelled</Text>
                  ) : (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.jobPay}>{money(j.pay)}</Text>
                      <Text style={styles.itemMeta}>{hoursLabel(j.hours)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          )
        ) : null}
      </ScrollView>
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
  intro: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
  retry: { alignSelf: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    padding: SPACING.md,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileValue: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 1 },
  tileHint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },

  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  chartCol: { flex: 1, alignItems: 'center', gap: 5 },
  chartValue: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  chartBar: { width: '100%', maxWidth: 36, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  chartLabel: { fontSize: 12, color: COLORS.textSecondary },

  trio: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  trioBox: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, gap: 2 },
  trioValue: { fontSize: 20, fontWeight: '800' },
  trioLabel: { fontSize: 11, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  barLabel: { fontSize: 14, color: COLORS.textSecondary },
  barValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: COLORS.borderLight, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  note: { fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.md, lineHeight: 19 },
  tip: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.warningLight, borderWidth: 1, borderColor: COLORS.accentGold + '55' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  tipBody: { fontSize: 13, color: '#92400e', marginTop: 2, lineHeight: 19 },

  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  itemMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quote: { fontSize: 14, color: COLORS.text, marginTop: SPACING.sm, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, overflow: 'hidden' },
  job: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  jobDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  jobPay: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  pill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, overflow: 'hidden' },
  pillGood: { color: COLORS.secondary, backgroundColor: COLORS.successLight },
  pillWarn: { color: '#b45309', backgroundColor: COLORS.warningLight },
  pillBad: { color: COLORS.error, backgroundColor: COLORS.errorLight },
});
