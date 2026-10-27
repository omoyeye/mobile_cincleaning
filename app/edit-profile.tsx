import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBack } from '../utils/navigation';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function normalizePostcode(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  return compact.length < 5 ? compact : `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [postcode, setPostcode] = useState(user?.postcode || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [pcCheck, setPcCheck] = useState<{ loading: boolean; note: string; error: string }>({ loading: false, note: '', error: '' });

  // The account can finish loading after this screen opens (e.g. a refresh): fill the form then.
  useEffect(() => {
    if (!user) return;
    setName((v) => v || user.name || '');
    setEmail((v) => v || user.email || '');
    setPhone((v) => v || user.phone || '');
    setAddress((v) => v || user.address || '');
    setPostcode((v) => v || user.postcode || '');
    setAvatarUri((v) => v || user.imageUrl || '');
  }, [user?.id]);

  /** Same check as the website: tidy the postcode and confirm it exists with postcodes.io. */
  const verifyPostcode = async () => {
    const pc = normalizePostcode(postcode);
    if (!pc) {
      setPcCheck({ loading: false, note: '', error: 'Enter a postcode first.' });
      return;
    }
    setPcCheck({ loading: true, note: '', error: '' });
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      if (!res.ok) {
        setPcCheck({ loading: false, note: '', error: res.status === 404 ? 'Postcode not found.' : 'Lookup failed, try again.' });
        return;
      }
      const r = (await res.json())?.result;
      const bits = [r?.admin_ward, r?.admin_district, r?.region].filter(Boolean);
      setPostcode(pc);
      setPcCheck({ loading: false, note: bits.length ? `Valid UK postcode: ${bits.join(', ')}` : 'Valid UK postcode.', error: '' });
    } catch {
      setPcCheck({ loading: false, note: '', error: 'Lookup failed, try again.' });
    }
  };

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarUri, setAvatarUri] = useState(user?.imageUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${asset.base64}`;
    setAvatarUri(asset.uri);
    if (!user) return;
    setUploadingAvatar(true);
    try {
      await authApi.updateProfile(user.id, { imageUrl: dataUri } as any);
      await refreshUser();
    } catch {
      Alert.alert('Upload failed', 'Could not save your photo. Please try again.');
    }
    setUploadingAvatar(false);
  };

  const handleSaveDetails = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Check your email', 'Please enter a valid email address.');
      return;
    }
    const pc = postcode.trim() ? normalizePostcode(postcode) : '';
    if (pc && !UK_POSTCODE.test(pc)) {
      Alert.alert('Check your postcode', 'That postcode looks invalid. Please check and try again.');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await authApi.updateProfile(user.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        postcode: pc || null,
      });
      await refreshUser();
      Alert.alert('Saved', 'Your details have been updated.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Required', 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (!user) return;
    setSavingPassword(true);
    try {
      await authApi.updateProfile(user.id, {
        currentPassword,
        password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      Alert.alert('Updated', 'Your password has been changed.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update password.');
    }
    setSavingPassword(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Profile photo */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} disabled={uploadingAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color={COLORS.textTertiary} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size={12} color={COLORS.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Personal details */}
          <Text style={styles.sectionLabel}>Personal Details</Text>
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+44 7700 900000"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Your address"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Postcode</Text>
              <View style={styles.postcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={postcode}
                  onChangeText={(v) => {
                    setPostcode(v.toUpperCase());
                    setPcCheck({ loading: false, note: '', error: '' });
                  }}
                  placeholder="E.g. SW1A 1AA"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.verifyBtn, (!postcode.trim() || pcCheck.loading) && { opacity: 0.5 }]}
                  onPress={verifyPostcode}
                  disabled={!postcode.trim() || pcCheck.loading}
                >
                  {pcCheck.loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.verifyText}>Verify</Text>}
                </TouchableOpacity>
              </View>
              {pcCheck.note ? <Text style={styles.pcNote}>{pcCheck.note}</Text> : null}
              {pcCheck.error ? <Text style={styles.pcError}>{pcCheck.error}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveDetails}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Password */}
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <View style={styles.passwordToggleLeft}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.passwordToggleText}>Change Password</Text>
            </View>
            <Ionicons
              name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textTertiary}
            />
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min 8 characters"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, savingPassword && styles.saveBtnDisabled]}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  avatarSection: { alignItems: 'center', marginBottom: SPACING.lg },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.surfaceAlt },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.borderLight,
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.surface,
  },
  avatarHint: { fontSize: 12, color: COLORS.textTertiary, marginTop: SPACING.xs },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  fieldGroup: { marginBottom: SPACING.md },
  postcodeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  verifyBtn: { backgroundColor: COLORS.text, borderRadius: RADIUS.md, paddingHorizontal: 16, height: 48, justifyContent: 'center', alignItems: 'center', minWidth: 76 },
  verifyText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  pcNote: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginTop: 6 },
  pcError: { fontSize: 12, fontWeight: '600', color: COLORS.error, marginTop: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: COLORS.text,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  passwordToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  passwordToggleText: { fontSize: 15, fontWeight: '500', color: COLORS.text },
});
