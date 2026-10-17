import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { bookingsApi, customerApi, publicApi } from '../../services/api';
import { useBusinessContact } from '../../hooks/useBusinessContact';
import { useToast } from '../../components/Toast';
import { goBack } from '../../utils/navigation';
import { buildInvoice, formatHours, invoiceHtml } from '../../utils/invoice';
import { COLORS, SPACING, RADIUS, SITE_URL } from '../../constants/config';
import type { Booking, Extra, ServiceConfig } from '../../types';

/** The booking invoice, laid out like the website's "Invoice & receipt" page, with Print and Download PDF. */
export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const policy = useBusinessContact();
  const { showToast } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'print' | 'pdf' | 'ack' | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, svc, ext] = await Promise.all([
        bookingsApi.getOne(Number(id)),
        publicApi.getServices().catch(() => [] as ServiceConfig[]),
        publicApi.getExtras().catch(() => [] as Extra[]),
      ]);
      setBooking(b);
      setServices(svc);
      setExtras(ext);
    } catch {
      setBooking(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const service = useMemo(
    () => services.find((s) => s.name === booking?.serviceType || String(s.id) === String(booking?.serviceType)) || null,
    [services, booking?.serviceType]
  );
  const inv = useMemo(
    () => (booking ? buildInvoice(booking, service, extras, { depositPercent: policy.depositPercent, depositMessage: policy.depositMessage }) : null),
    [booking, service, extras, policy.depositPercent, policy.depositMessage]
  );

  const html = () =>
    inv
      ? invoiceHtml(inv, {
          name: policy.companyName,
          address: policy.companyAddress,
          email: policy.email,
          phone: policy.phone,
          logoDataUrl: `${SITE_URL}/brand-logo.png`,
        })
      : '';

  /** Web: print the invoice on its own, like the website does. */
  const printOnWeb = (content: string) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(content);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    }, 400);
  };

  const onPrint = async () => {
    setBusy('print');
    try {
      if (Platform.OS === 'web') printOnWeb(html());
      else await Print.printAsync({ html: html() });
    } catch {
      showToast('Could not open the printer', 'error');
    }
    setBusy(null);
  };

  const onPdf = async () => {
    setBusy('pdf');
    try {
      if (Platform.OS === 'web') {
        printOnWeb(html());
        showToast('Choose "Save as PDF" in the print window to download', 'info');
      } else {
        const { uri } = await Print.printToFileAsync({ html: html() });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: inv?.number });
        } else {
          showToast('PDF saved', 'success');
        }
      }
    } catch {
      showToast('Could not create the PDF', 'error');
    }
    setBusy(null);
  };

  const acknowledge = async () => {
    if (!booking) return;
    setBusy('ack');
    try {
      const r = await customerApi.acknowledgeDepositTerms(booking.id);
      setBooking({ ...booking, depositTermsAcceptedAt: r.depositTermsAcceptedAt ?? new Date().toISOString() });
      showToast('Agreement saved on your booking', 'success');
    } catch {
      showToast('Could not save. Please try again.', 'error');
    }
    setBusy(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Invoice & receipt</Text>
          {booking ? <Text style={styles.headerRef}>Booking ID: {booking.bookingId || booking.id}</Text> : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !inv || !booking ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={44} color={COLORS.textTertiary} />
          <Text style={styles.empty}>Could not load this invoice.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.paper}>
            <Ionicons name="shield-checkmark" size={220} color={COLORS.text} style={styles.watermark} />

            {/* Header */}
            <View style={styles.top}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h1}>INVOICE</Text>
                <Text style={styles.invNo}>{inv.number}</Text>
              </View>
              <View style={styles.brand}>
                <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
                <Text style={styles.brandName}>{policy.companyName}</Text>
                <Text style={styles.brandSub}>Professional Cleaning Services</Text>
                {policy.companyAddress ? <Text style={styles.brandLine}>{policy.companyAddress}</Text> : null}
                <Text style={styles.brandLine}>{[policy.email, policy.phone].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>

            {/* Billed to + booking details */}
            <View style={styles.block}>
              <Text style={styles.label}>Billed To</Text>
              <Text style={styles.billName}>{inv.billedTo.name}</Text>
              {inv.billedTo.email ? <Text style={styles.muted}>{inv.billedTo.email}</Text> : null}
              {inv.billedTo.line1 ? <Text style={[styles.muted, { marginTop: 4 }]}>{inv.billedTo.line1}</Text> : null}
              {inv.billedTo.cityPostcode ? <Text style={styles.muted}>{inv.billedTo.cityPostcode}</Text> : null}
            </View>
            <View style={styles.block}>
              <Text style={styles.label}>Booking Details</Text>
              {[...inv.details, { label: 'Issue Date', value: inv.issueDate }].map((d) => (
                <View key={d.label} style={styles.kv}>
                  <Text style={styles.kvLabel}>{d.label}</Text>
                  <Text style={styles.kvValue}>{d.value}</Text>
                </View>
              ))}
            </View>

            {/* Time allocation */}
            <View style={styles.timeBox}>
              <Text style={styles.label}>Time allocation (transparency)</Text>
              {inv.breakdown.lines.length === 0 ? (
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{inv.breakdown.model === 'itemized' ? inv.breakdown.baseLabel : 'Booked clean duration'}</Text>
                  <Text style={styles.timeTotal}>{formatHours(inv.breakdown.totalHours)}h</Text>
                </View>
              ) : (
                <>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{inv.breakdown.baseLabel}</Text>
                    <Text style={styles.timeHours}>{formatHours(inv.breakdown.baseHours)}h</Text>
                  </View>
                  {inv.breakdown.lines.map((l, i) => (
                    <View key={`${l.extraId}-${i}`} style={styles.timeRow}>
                      <Text style={styles.timeText}>
                        {l.label} <Text style={styles.mutedSmall}>×{l.quantity}</Text>
                      </Text>
                      <Text style={styles.timeHours}>{formatHours(l.lineHours)}h</Text>
                    </View>
                  ))}
                  <View style={[styles.timeRow, styles.timeRowTotal]}>
                    <Text style={styles.timeTotalLabel}>TOTAL BOOKED</Text>
                    <Text style={styles.timeTotal}>{formatHours(inv.breakdown.totalHours)}h</Text>
                  </View>
                </>
              )}
            </View>

            {/* Property */}
            {inv.property ? (
              <View style={styles.propGrid}>
                {inv.property.map((p) => (
                  <View key={p.label} style={styles.propCell}>
                    <Text style={styles.propLabel}>{p.label}</Text>
                    <Text style={styles.propValue}>{p.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Line items */}
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1 }]}>Description</Text>
              {inv.itemized ? <Text style={[styles.th, styles.thTime]}>Est. time</Text> : null}
              <Text style={[styles.th, styles.thAmt]}>Amount</Text>
            </View>
            {inv.lines.map((l, i) => (
              <View key={`${l.title}-${i}`} style={styles.tr}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.lineTitle}>{l.title}</Text>
                  <Text style={styles.lineNote}>{l.note}</Text>
                </View>
                {inv.itemized ? <Text style={[styles.lineTime, styles.thTime]}>{l.time}</Text> : null}
                <Text style={[styles.lineAmt, styles.thAmt]}>{l.amount}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Due</Text>
              <Text style={styles.totalValue}>£{inv.total.toFixed(2)}</Text>
            </View>

            {/* Payment details */}
            <View style={styles.payBox}>
              <Text style={styles.payTitle}>Payment Details</Text>
              {inv.payment.stage === 'paid' ? (
                <Text style={[styles.payStrong, { color: '#047857' }]}>Paid in full: £{inv.payment.total.toFixed(2)}. Thank you!</Text>
              ) : inv.payment.stage === 'deposit_paid' ? (
                <>
                  <Text style={styles.payStrong}>Paid so far: £{inv.payment.amountPaid.toFixed(2)}</Text>
                  <Text style={[styles.payStrong, { fontSize: 15 }]}>Balance due after your clean: £{inv.payment.balanceDue.toFixed(2)}</Text>
                </>
              ) : inv.payment.choice === 'full' ? (
                <>
                  <Text style={styles.payStrong}>Paying in full: £{inv.total.toFixed(2)}. Nothing more to pay after your clean.</Text>
                  <Text style={styles.payBody}>A secure payment link will be sent to your email once your booking is confirmed by our team.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.payText}>{inv.depositMessage}</Text>
                  <Text style={styles.payStrong}>
                    Deposit required now: £{inv.deposit.toFixed(2)} ({inv.depositPercent}% of £{inv.total.toFixed(2)})
                  </Text>
                  <Text style={styles.payText}>Balance of £{(inv.total - inv.deposit).toFixed(2)} due after your clean. You can choose to pay in full instead.</Text>
                  <Text style={styles.payBody}>A secure payment link will be sent to your email once your booking is confirmed by our team.</Text>
                </>
              )}
              {inv.termsAcceptedAt ? (
                <Text style={styles.ackDone}>
                  Deposit and cancellation terms acknowledged on {new Date(inv.termsAcceptedAt).toLocaleString('en-GB')}. This is stored on your booking for our team.
                </Text>
              ) : booking.status === 'Pending' || booking.status === 'Confirmed' ? (
                <TouchableOpacity style={styles.ackBox} onPress={acknowledge} disabled={busy === 'ack'} activeOpacity={0.8}>
                  {busy === 'ack' ? <ActivityIndicator size="small" color={COLORS.primary} /> : <View style={styles.checkbox} />}
                  <Text style={styles.ackText}>
                    I have read and agree to the deposit and payment details above, and to the terms and conditions (including any short-notice cancellation fee if I cancel close to the appointment).
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Status */}
            <View style={styles.status}>
              <View style={styles.statusLeft}>
                <View style={[styles.dot, { backgroundColor: inv.paid ? '#10b981' : '#f59e0b' }]} />
                <Text style={[styles.statusText, { color: inv.paid ? '#047857' : inv.payment.stage === 'deposit_paid' ? '#1d4ed8' : '#d97706' }]}>
                  {inv.paid ? 'PAID' : inv.payment.stage === 'deposit_paid' ? `DEPOSIT PAID · £${inv.payment.balanceDue.toFixed(2)} DUE` : 'PAYMENT PENDING'}
                </Text>
              </View>
              <Text style={styles.thanks}>Thank you for choosing {policy.companyName}.</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.printBtn} onPress={onPrint} disabled={!!busy} activeOpacity={0.85}>
              {busy === 'print' ? <ActivityIndicator size="small" color={COLORS.text} /> : <Ionicons name="print-outline" size={18} color={COLORS.text} />}
              <Text style={styles.printText}>Print Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pdfBtn} onPress={onPdf} disabled={!!busy} activeOpacity={0.85}>
              {busy === 'pdf' ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="download-outline" size={18} color={COLORS.white} />}
              <Text style={styles.pdfText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  headerRef: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  empty: { fontSize: 15, color: COLORS.textSecondary },
  scroll: { padding: SPACING.base, paddingBottom: SPACING.xxl },

  paper: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  watermark: { position: 'absolute', top: 10, right: -50, opacity: 0.025 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: SPACING.lg, marginBottom: SPACING.lg },
  h1: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  invNo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.2, marginTop: 4 },
  brand: { alignItems: 'flex-end', maxWidth: '58%' },
  logo: { width: 120, height: 52, marginBottom: 6 },
  brandName: { fontSize: 17, fontWeight: '900', color: '#2563eb', textAlign: 'right' },
  brandSub: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 2, textAlign: 'right' },
  brandLine: { fontSize: 11, color: '#64748b', marginTop: 3, textAlign: 'right' },

  block: { marginBottom: SPACING.base },
  label: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  billName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  muted: { fontSize: 13, color: '#64748b' },
  mutedSmall: { fontSize: 12, color: '#94a3b8' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  kvLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 },
  kvValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  timeBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.base },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  timeRowTotal: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: '#cbd5e1', marginTop: 2 },
  timeText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#334155', paddingRight: 8 },
  timeHours: { fontSize: 14, fontWeight: '900', color: '#1e293b' },
  timeTotalLabel: { fontSize: 11, fontWeight: '900', color: '#475569', letterSpacing: 0.6 },
  timeTotal: { fontSize: 15, fontWeight: '900', color: '#2563eb' },

  propGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#f8fafc', borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.base, rowGap: SPACING.sm },
  propCell: { width: '50%' },
  propLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.2, textTransform: 'uppercase' },
  propValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },

  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 10 },
  th: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.2, textTransform: 'uppercase' },
  thTime: { width: 64, textAlign: 'right' },
  thAmt: { width: 84, textAlign: 'right' },
  tr: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  lineTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  lineNote: { fontSize: 11, color: '#94a3b8', marginTop: 3, lineHeight: 15 },
  lineTime: { fontSize: 13, fontWeight: '700', color: '#475569' },
  lineAmt: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: SPACING.base, paddingVertical: SPACING.base, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalLabel: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#2563eb' },

  payBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 16, padding: SPACING.base, gap: 8, marginBottom: SPACING.base },
  payTitle: { fontSize: 15, fontWeight: '900', color: '#1e3a8a' },
  payText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8', lineHeight: 17 },
  payStrong: { fontSize: 12, fontWeight: '800', color: '#1e3a8a' },
  payBody: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
  ackDone: { fontSize: 12, fontWeight: '700', color: '#065f46', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 12, padding: SPACING.md, lineHeight: 17 },
  ackBox: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: SPACING.md },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#93c5fd', marginTop: 1 },
  ackText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b', lineHeight: 17 },

  status: { backgroundColor: '#f8fafc', borderRadius: 16, padding: SPACING.base, gap: 6 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  thanks: { fontSize: 12, color: '#94a3b8' },

  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.base },
  printBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  printText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  pdfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: '#0f172a' },
  pdfText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
