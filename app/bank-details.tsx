import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';

export default function BankDetailsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sortCode, setSortCode] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const staff = await staffApi.getProfile(user.id);
        setBankName(staff.bankName || '');
        setAccountHolder(staff.accountHolder || '');
        setAccountNumber(staff.accountNumber || '');
        setSortCode(staff.sortCode || '');
      } catch {}
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!bankName.trim() || !accountNumber.trim() || !sortCode.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.updateProfile(user.id, {
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        sortCode: sortCode.trim(),
      });
      await refreshUser();
      Alert.alert('Saved', 'Your bank details have been updated.');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save bank details. Please try again.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.secondary} />
          <Text style={styles.infoText}>
            Your bank details are stored securely and used only for salary payments.
          </Text>
        </View>

        <Text style={styles.label}>Bank Name *</Text>
        <TextInput
          style={styles.input}
          value={bankName}
          onChangeText={setBankName}
          placeholder="e.g. Barclays, HSBC"
          placeholderTextColor={COLORS.textTertiary}
        />

        <Text style={styles.label}>Account Holder Name</Text>
        <TextInput
          style={styles.input}
          value={accountHolder}
          onChangeText={setAccountHolder}
          placeholder="Full name on account"
          placeholderTextColor={COLORS.textTertiary}
        />

        <Text style={styles.label}>Account Number *</Text>
        <TextInput
          style={styles.input}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder="8-digit account number"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="number-pad"
          maxLength={8}
        />

        <Text style={styles.label}>Sort Code *</Text>
        <TextInput
          style={styles.input}
          value={sortCode}
          onChangeText={setSortCode}
          placeholder="e.g. 20-00-00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="number-pad"
          maxLength={8}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Bank Details</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.secondary + '10',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
  },
  infoText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.base,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
