import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { customerApi } from '../services/api';
import { ListSkeleton } from '../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS, SITE_URL } from '../constants/config';
import { EmptyState, FilterPills, money } from '../components/ClientKit';
import { goBack } from '../utils/navigation';
import type { CustomerInvoice } from '../types';
import { BrandRefresh } from '../components/BrandRefresh';
import { usePullRefresh } from '../hooks/usePullRefresh';

type Filter = 'unpaid' | 'paid' | 'all';

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  paid: { label: 'Paid', fg: COLORS.status.completed, bg: COLORS.status.completedBg },
  sent: { label: 'Due', fg: COLORS.status.confirmed, bg: COLORS.status.confirmedBg },
  pending: { label: 'Due', fg: '#a16207', bg: COLORS.status.pendingBg },
  overdue: { label: 'Overdue', fg: COLORS.status.cancelled, bg: COLORS.status.cancelledBg },
};

function prettyDate(raw?: string | null) {
  if (!raw) return '';
  const d = new Date(raw.length <= 10 ? `${raw}T00:00` : raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Same list as "My invoices" in the website's client portal, with Pay now. */
export default function InvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh(() => load());
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('unpaid');

  const load = useCallback(async () => {
    try {
      setInvoices(await customerApi.getInvoices());
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unpaid = useMemo(() => invoices.filter((i) => i.status !== 'paid'), [invoices]);
  const paid = useMemo(() => invoices.filter((i) => i.status === 'paid'), [invoices]);
  const list = filter === 'unpaid' ? unpaid : filter === 'paid' ? paid : invoices;
  const owed = unpaid.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  // First visit with nothing unpaid: show everything instead of an empty tab.
  useEffect(() => {
    if (!loading && filter === 'unpaid' && unpaid.length === 0 && invoices.length > 0) setFilter('all');
  }, [loading]);

  const pay = (inv: CustomerInvoice) => {
    const url = inv.stripePaymentUrl || `${SITE_URL}/pay/invoice/${inv.id}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoices</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ListSkeleton count={3} type="card" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <BrandRefresh
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={[styles.summary, unpaid.length ? styles.summaryDue : styles.summaryClear]}>
                <View style={[styles.summaryIcon, { backgroundColor: unpaid.length ? COLORS.errorLight : COLORS.successLight }]}>
                  <Ionicons
                    name={unpaid.length ? 'card-outline' : 'checkmark-circle'}
                    size={22}
                    color={unpaid.length ? COLORS.error : COLORS.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>{unpaid.length ? `${money(owed)} to pay` : 'All paid up'}</Text>
                  <Text style={styles.summarySub}>
                    {unpaid.length
                      ? `${unpaid.length} unpaid invoice${unpaid.length > 1 ? 's' : ''}. Pay securely by card.`
                      : 'Thank you. New invoices will appear here.'}
                  </Text>
                </View>
              </View>
              {failed ? (
                <TouchableOpacity style={styles.retry} onPress={load}>
                  <Ionicons name="cloud-offline-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.retryText}>Could not load invoices. Tap to try again.</Text>
                </TouchableOpacity>
              ) : null}
              <View style={{ marginVertical: SPACING.md }}>
                <FilterPills<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { key: 'unpaid', label: 'To pay', count: unpaid.length },
                    { key: 'paid', label: 'Paid' },
                    { key: 'all', label: 'All' },
                  ]}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={filter === 'unpaid' ? 'Nothing to pay' : 'No invoices yet'}
              body="Invoices for your bookings will appear here."
            />
          }
          renderItem={({ item }) => {
            const tone = STATUS[item.status] ?? { label: item.status, fg: COLORS.textSecondary, bg: COLORS.surfaceAlt };
            const isPaid = item.status === 'paid';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.number}>{item.invoiceNumber}</Text>
                    <Text style={styles.meta}>
                      {prettyDate(item.createdAt)}
                      {item.dueDate && !isPaid ? ` · Due ${prettyDate(item.dueDate)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.total}>{money(item.total)}</Text>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
                    </View>
                  </View>
                </View>

                {Array.isArray(item.items) && item.items.length > 0 ? (
                  <View style={styles.lines}>
                    {item.items.map((line, idx) => (
                      <View key={idx} style={styles.line}>
                        <Text style={styles.lineText} numberOfLines={2}>
                          {line.quantity > 1 ? `${line.quantity} x ` : ''}
                          {line.description}
                        </Text>
                        <Text style={styles.lineAmount}>{money(line.lineTotal)}</Text>
                      </View>
                    ))}
                    {Number(item.vatAmount) > 0 ? (
                      <View style={styles.line}>
                        <Text style={styles.lineMuted}>VAT</Text>
                        <Text style={styles.lineMuted}>{money(item.vatAmount)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {item.notes && String(item.notes).trim() ? (
                  <View style={styles.note}>
                    <Text style={styles.noteLabel}>Note from us</Text>
                    <Text style={styles.noteText}>{item.notes}</Text>
                  </View>
                ) : null}

                {!isPaid ? (
                  <TouchableOpacity style={styles.payBtn} onPress={() => pay(item)} activeOpacity={0.85} accessibilityRole="button">
                    <Ionicons name="card" size={18} color={COLORS.white} />
                    <Text style={styles.payText}>Pay {money(item.total)} now</Text>
                    <Ionicons name="open-outline" size={15} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                ) : item.paidAt ? (
                  <Text style={styles.paidOn}>Paid on {prettyDate(item.paidAt)}</Text>
                ) : null}
              </View>
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

  summary: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.base, borderRadius: RADIUS.lg, borderWidth: 1, marginTop: SPACING.sm },
  summaryDue: { backgroundColor: COLORS.surface, borderColor: COLORS.error + '33' },
  summaryClear: { backgroundColor: COLORS.surface, borderColor: COLORS.secondary + '33' },
  summaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  summarySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.warningLight },
  retryText: { flex: 1, fontSize: 13, color: COLORS.text },

  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border + '80', padding: SPACING.base, marginBottom: SPACING.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  total: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '700' },

  lines: { marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  lineText: { flex: 1, fontSize: 14, color: COLORS.text },
  lineAmount: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lineMuted: { fontSize: 13, color: COLORS.textSecondary },

  note: { marginTop: SPACING.md, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md },
  noteLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  noteText: { fontSize: 14, color: COLORS.text, marginTop: 2, lineHeight: 20 },

  payBtn: { marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  payText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  paidOn: { marginTop: SPACING.sm, fontSize: 13, color: COLORS.status.completed, fontWeight: '600' },
});
