import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { qaApi } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { EmptyState, FilterPills, friendlyDay, serviceLabel } from '../../components/ClientKit';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { BrandRefresh } from '../../components/BrandRefresh';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { goBack } from '../../utils/navigation';
import type { QaJob } from '../../types';

type Filter = 'todo' | 'done' | 'all';

/** Supervisors: finished jobs from the last 30 days to quality check in the field. */
export default function QualityChecksScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<QaJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');

  const load = useCallback(async () => {
    try {
      setJobs(await qaApi.jobs());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load quality checks');
    }
    setLoading(false);
  }, []);
  const { refreshing, onRefresh } = usePullRefresh(load);

  // Loads on open and again when coming back from an assessment, so it shows as checked.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const todo = jobs.filter((j) => !j.checked);
  const shown = useMemo(() => (filter === 'todo' ? todo : filter === 'done' ? jobs.filter((j) => j.checked) : jobs), [filter, jobs, todo]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quality checks</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ListSkeleton count={4} type="card" />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(j) => String(j.id)}
          contentContainerStyle={styles.list}
          refreshControl={<BrandRefresh refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <Text style={styles.intro}>
                Visit finished jobs and check the work against the job's task list. Each cleaner on the job gets their own score.
              </Text>
              <FilterPills<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { key: 'todo', label: 'To check', count: todo.length },
                  { key: 'done', label: 'Checked' },
                  { key: 'all', label: 'All' },
                ]}
              />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-outline"
              title={error ? 'Could not load jobs' : filter === 'todo' ? 'All caught up' : 'Nothing here yet'}
              body={error || (filter === 'todo' ? 'Every finished job from the last 30 days has been checked.' : 'Checked jobs appear here.')}
            />
          }
          renderItem={({ item }) => {
            const ticked = item.checklist.filter((c) => c.done).length;
            const known = item.checklist.some((c) => c.done !== null);
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push(`/qa/${item.id}`)}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{serviceLabel(item.serviceType)}</Text>
                  <View style={[styles.pill, item.checked ? styles.pillDone : styles.pillTodo]}>
                    <Ionicons name={item.checked ? 'checkmark-circle' : 'time-outline'} size={13} color={item.checked ? COLORS.secondary : COLORS.accentGold} />
                    <Text style={[styles.pillText, { color: item.checked ? COLORS.secondary : '#b7791f' }]}>{item.checked ? 'Checked' : 'To check'}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {friendlyDay(String(item.date).slice(0, 10))} · {item.time} · {item.clientName}
                </Text>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="people-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.cleaners.map((c) => `${c.name}${c.assessment ? ` (${c.assessment.rating}/5)` : ''}`).join(', ')}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="list-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={styles.meta}>
                    {item.checklist.length} tasks{known ? ` · cleaner ticked ${ticked}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, flexGrow: 1 },
  intro: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginVertical: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
  pillTodo: { backgroundColor: COLORS.accentGold + '22' },
  pillDone: { backgroundColor: COLORS.secondary + '18' },
  pillText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
});
