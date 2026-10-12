import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { customerApi } from '../services/api';
import { useToast } from './Toast';
import { useBusinessContact } from '../hooks/useBusinessContact';
import { photoToDataUrl } from '../utils/photos';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import { money } from './ClientKit';
import type { Booking, PaymentEvidenceItem, PublicStaff } from '../types';

/* ───────────── Assigned cleaners (website: "Assigned professionals") ───────────── */

let staffCache: PublicStaff[] | null = null;

export function AssignedCleaners({ booking }: { booking: Booking }) {
  const [staff, setStaff] = useState<PublicStaff[]>(staffCache ?? []);
  const ids = (booking.assignedStaffIds?.length ? booking.assignedStaffIds : booking.assignedStaffId ? [booking.assignedStaffId] : []).map(Number);

  useEffect(() => {
    if (staffCache || !ids.length) return;
    customerApi
      .getStaffList()
      .then((list) => {
        staffCache = list;
        setStaff(list);
      })
      .catch(() => {});
  }, [ids.length]);

  if (booking.status === 'Cancelled') return null;
  const people = ids.map((id) => staff.find((s) => Number(s.id) === id)).filter(Boolean) as PublicStaff[];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{people.length > 1 ? 'Your cleaners' : 'Your cleaner'}</Text>
      {!ids.length ? (
        <View style={styles.pendingRow}>
          <View style={[styles.avatar, { backgroundColor: COLORS.surfaceAlt }]}>
            <Ionicons name="hourglass-outline" size={20} color={COLORS.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>Choosing your cleaner</Text>
            <Text style={styles.personSub}>We will let you know as soon as someone is assigned.</Text>
          </View>
        </View>
      ) : people.length === 0 ? (
        <Text style={styles.personSub}>Cleaner assigned. Details are loading…</Text>
      ) : (
        people.map((p) => {
          const photo = p.profilePhoto || p.imageUrl;
          const verified = p.isVerified !== false && (p.status ? p.status === 'Active' : true);
          return (
            <View key={p.id} style={styles.personRow}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{p.name}</Text>
                <View style={styles.personMeta}>
                  <Ionicons name="star" size={13} color={COLORS.accentGold} />
                  <Text style={styles.personSub}>{Number(p.rating ?? 4.9).toFixed(1)}</Text>
                  <View style={[styles.verified, { backgroundColor: verified ? COLORS.successLight : COLORS.warningLight }]}>
                    <Ionicons name={verified ? 'shield-checkmark' : 'shield-outline'} size={12} color={verified ? COLORS.secondary : '#a16207'} />
                    <Text style={[styles.verifiedText, { color: verified ? COLORS.secondary : '#a16207' }]}>
                      {verified ? 'Vetted' : 'Being checked'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

/* ───────────── Payments (website: deposit link, paid badge, terms, proof upload) ───────────── */

const MAX_PROOFS = 6;
const MAX_DATA_URL = 740_000;

export function BookingPayments({ booking, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const policy = useBusinessContact();
  const [acking, setAcking] = useState(false);
  const [kind, setKind] = useState<PaymentEvidenceItem['kind']>(
    booking.depositTermsAcceptedAt || !booking.shortNoticeCancelFeeConsentedAt ? 'deposit' : 'cancellation_fee'
  );
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);

  if (booking.status === 'Cancelled' && !booking.shortNoticeCancelFeeConsentedAt) return null;

  const total = Number(booking.totalPrice) || 0;
  const deposit = (total * policy.depositPercent) / 100;
  const proofs = booking.paymentFeeEvidence?.items ?? [];
  const showProof = !!(booking.depositTermsAcceptedAt || booking.shortNoticeCancelFeeConsentedAt);
  const bothKinds = !!(booking.depositTermsAcceptedAt && booking.shortNoticeCancelFeeConsentedAt);

  const acknowledge = async () => {
    setAcking(true);
    try {
      const r = await customerApi.acknowledgeDepositTerms(booking.id);
      onChange({ ...booking, depositTermsAcceptedAt: r.depositTermsAcceptedAt ?? new Date().toISOString() });
      showToast('Agreement saved on your booking', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save. Please try again.', 'error');
    }
    setAcking(false);
  };

  const uploadProof = async () => {
    if (proofs.length >= MAX_PROOFS) {
      showToast(`You can upload up to ${MAX_PROOFS} files for this booking`, 'warning');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Allow photo access to upload a screenshot', 'warning');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    try {
      const dataUrl = await photoToDataUrl(asset.uri, asset.width, asset.height);
      if (dataUrl.length > MAX_DATA_URL) throw new Error('That image is too large. Try a screenshot instead.');
      const item: PaymentEvidenceItem = {
        kind: bothKinds ? kind : booking.depositTermsAcceptedAt ? 'deposit' : 'cancellation_fee',
        dataUrl,
        uploadedAt: new Date().toISOString(),
        fileName: asset.fileName || `payment-proof-${proofs.length + 1}.jpg`,
        ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
      };
      const next = [...proofs, item];
      const r = await customerApi.savePaymentEvidence(booking.id, next);
      onChange({ ...booking, paymentFeeEvidence: r.paymentFeeEvidence ?? { items: next } });
      setNote('');
      showToast('Payment proof sent to our team', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload', 'error');
    }
    setUploading(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Payment</Text>

      <View style={styles.payRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.payLabel}>Booking total</Text>
          <Text style={styles.payValue}>{money(total)}</Text>
        </View>
        {booking.status !== 'Cancelled' ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.payLabel}>Deposit ({policy.depositPercent}%)</Text>
            <Text style={styles.payValue}>{money(deposit)}</Text>
          </View>
        ) : null}
      </View>

      {booking.invoicePaid ? (
        <View style={[styles.banner, { backgroundColor: COLORS.successLight }]}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: COLORS.secondary }]}>Deposit paid</Text>
            <Text style={styles.bannerSub}>Payment confirmed. Thank you!</Text>
          </View>
        </View>
      ) : booking.stripePaymentLink && booking.status !== 'Cancelled' ? (
        <TouchableOpacity style={styles.payBtn} onPress={() => Linking.openURL(booking.stripePaymentLink!)} activeOpacity={0.85}>
          <Ionicons name="card" size={18} color={COLORS.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payBtnTitle}>Pay deposit now</Text>
            <Text style={styles.payBtnSub}>Secure card payment by Stripe</Text>
          </View>
          <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      ) : booking.status !== 'Cancelled' ? (
        <Text style={styles.hint}>
          {policy.depositMessage} A secure payment link will be emailed to you once our team confirms the booking.
        </Text>
      ) : null}

      {booking.status !== 'Cancelled' ? (
        booking.depositTermsAcceptedAt ? (
          <View style={styles.ackDone}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.secondary} />
            <Text style={styles.ackDoneText}>
              Deposit and cancellation terms agreed on {new Date(booking.depositTermsAcceptedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.ackBox} onPress={acknowledge} disabled={acking} activeOpacity={0.8}>
            {acking ? <ActivityIndicator size="small" color={COLORS.primary} /> : <View style={styles.checkbox} />}
            <Text style={styles.ackText}>
              I agree to the deposit and payment details and the terms and conditions, including the {policy.shortNoticeFeePercent}% fee if I cancel within{' '}
              {policy.shortNoticeHours} hours.
            </Text>
          </TouchableOpacity>
        )
      ) : null}

      {showProof ? (
        <View style={styles.proof}>
          <Text style={styles.proofTitle}>Paid by bank transfer?</Text>
          <Text style={styles.hint}>Upload a screenshot of the payment so we can match it to this booking. Include the reference, date and amount.</Text>
          {bothKinds ? (
            <View style={styles.kindRow}>
              {(['deposit', 'cancellation_fee'] as const).map((k) => (
                <TouchableOpacity key={k} style={[styles.kind, kind === k && styles.kindOn]} onPress={() => setKind(k)}>
                  <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k === 'deposit' ? 'Deposit' : 'Cancellation fee'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note, e.g. paid from account ending 1234"
            placeholderTextColor={COLORS.textTertiary}
            maxLength={500}
          />
          <TouchableOpacity style={styles.uploadBtn} onPress={uploadProof} disabled={uploading} activeOpacity={0.85}>
            {uploading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />}
            <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Upload payment screenshot'}</Text>
            <Text style={styles.uploadCount}>
              {proofs.length}/{MAX_PROOFS}
            </Text>
          </TouchableOpacity>
          {proofs.map((p, i) => (
            <View key={`${p.uploadedAt}-${i}`} style={styles.proofItem}>
              {p.dataUrl?.startsWith('data:image/') ? (
                <Image source={{ uri: p.dataUrl }} style={styles.proofThumb} />
              ) : (
                <View style={[styles.proofThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.proofPdf}>PDF</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.proofKind}>{p.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Deposit'}</Text>
                <Text style={styles.proofMeta} numberOfLines={1}>
                  {new Date(p.uploadedAt).toLocaleString()}
                </Text>
                {p.note ? (
                  <Text style={styles.proofMeta} numberOfLines={2}>
                    {p.note}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.invoiceLink} onPress={() => router.push('/invoices')}>
        <Ionicons name="receipt-outline" size={17} color={COLORS.primary} />
        <Text style={styles.invoiceLinkText}>View my invoices</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border + '80', padding: SPACING.base, marginBottom: SPACING.md },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.sm },

  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  personName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  personMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  personSub: { fontSize: 13, color: COLORS.textSecondary },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: 6 },
  verifiedText: { fontSize: 11, fontWeight: '700' },

  payRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  payLabel: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600' },
  payValue: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerSub: { fontSize: 13, color: COLORS.textSecondary },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.secondary, padding: SPACING.md, borderRadius: RADIUS.md },
  payBtnTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  payBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  hint: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  ackBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '40', backgroundColor: COLORS.infoLight },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: COLORS.white, marginTop: 1 },
  ackText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 19 },
  ackDone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md },
  ackDoneText: { flex: 1, fontSize: 12, color: COLORS.secondary, fontWeight: '600' },

  proof: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: SPACING.sm },
  proofTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  kindRow: { flexDirection: 'row', gap: SPACING.sm },
  kind: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  kindOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  kindText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  kindTextOn: { color: COLORS.primary },
  noteInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 11, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 48, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary + '66' },
  uploadText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.primary },
  uploadCount: { fontSize: 12, color: COLORS.textTertiary },
  proofItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  proofThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.surfaceAlt },
  proofPdf: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  proofKind: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  proofMeta: { fontSize: 12, color: COLORS.textSecondary },

  invoiceLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md, alignSelf: 'flex-start' },
  invoiceLinkText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
