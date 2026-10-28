import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { AuthHero } from '../../components/AuthHero';
import { AuthField, FormBanner } from '../../components/AuthField';
import { PressableScale } from '../../components/Motion';
import { PHOTOS } from '../../components/media';
import { useHaptic } from '../../hooks/useHaptic';
import { friendlyAuthError, isEmail, passwordStrength } from '../../utils/authForm';
import { SafeAreaView } from 'react-native-safe-area-context';

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm' | 'terms' | 'age';

const STRENGTH = [
  { label: 'At least 8 characters', color: COLORS.textTertiary },
  { label: 'Okay', color: COLORS.warning },
  { label: 'Good', color: COLORS.primary },
  { label: 'Strong', color: COLORS.success },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const haptic = useHaptic();
  const { register } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const strength = passwordStrength(password);
  const clear = (f: Field) => { if (errors[f]) setErrors((e) => ({ ...e, [f]: undefined })); };

  const handleRegister = async () => {
    const mail = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    const next: Partial<Record<Field, string>> = {};
    if (!name.trim()) next.name = 'Enter your full name.';
    if (!mail) next.email = 'Enter your email address.';
    else if (!isEmail(mail)) next.email = 'That email address does not look right.';
    if (phone.trim() && digits.length < 10) next.phone = 'Enter a UK number with at least 10 digits, or leave it blank.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (!next.password && password !== confirmPassword) next.confirm = 'The passwords do not match.';
    if (!agreedTerms) next.terms = 'Please agree to the terms to continue.';
    if (!ageConfirmed) next.age = 'You need to be 18 or over to book.';
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) {
      haptic.error();
      // Bring the first problem into view when it sits above the keyboard.
      if (next.name || next.email || next.phone) scrollRef.current?.scrollTo({ y: 120, animated: true });
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: mail,
        password,
        phone: phone.trim() || undefined,
        referredBy: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
      haptic.success();
    } catch (err) {
      haptic.error();
      setFormError(friendlyAuthError(err, 'We could not create your account. Please try again.'));
      scrollRef.current?.scrollTo({ y: 120, animated: true });
    } finally {
      setLoading(false);
    }
  };

  const goToSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => goBack(router, '/welcome')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <AuthHero photo={PHOTOS.lounge} title="Create account" subtitle="Book your first clean today" />

          <View style={styles.form}>
            <FormBanner message={formError} />

            <AuthField
              label="Full name"
              icon="person-outline"
              value={name}
              onChangeText={(v) => { setName(v); clear('name'); }}
              error={errors.name}
              placeholder="John Smith"
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <AuthField
              ref={emailRef}
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={(v) => { setEmail(v); clear('email'); }}
              error={errors.email}
              placeholder="your@email.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />

            <AuthField
              ref={phoneRef}
              label="Phone (optional)"
              icon="call-outline"
              value={phone}
              onChangeText={(v) => { setPhone(v); clear('phone'); }}
              error={errors.phone}
              hint="Handy if your cleaner needs to reach you on the day."
              placeholder="+44 7700 900000"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <View>
              <AuthField
                ref={passwordRef}
                label="Password"
                icon="lock-closed-outline"
                password
                value={password}
                onChangeText={(v) => { setPassword(v); clear('password'); clear('confirm'); }}
                error={errors.password}
                placeholder="At least 8 characters"
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              {!errors.password && password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[styles.strengthBar, strength >= i && { backgroundColor: STRENGTH[strength].color }]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, { color: STRENGTH[strength].color }]}>{STRENGTH[strength].label}</Text>
                </View>
              )}
            </View>

            <AuthField
              ref={confirmRef}
              label="Confirm password"
              icon="shield-checkmark-outline"
              password
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); clear('confirm'); }}
              error={errors.confirm}
              placeholder="Type it again"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            {showReferral ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <AuthField
                  label="Referral code"
                  icon="gift-outline"
                  hint="Your friend's code gives you credit off your first clean."
                  value={referralCode}
                  onChangeText={setReferralCode}
                  placeholder="e.g. ABCD1234"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
              </Animated.View>
            ) : (
              <TouchableOpacity style={styles.referralLink} onPress={() => setShowReferral(true)} hitSlop={8}>
                <Ionicons name="gift-outline" size={16} color={COLORS.primary} />
                <Text style={styles.referralText}>Have a referral code?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.checks}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => { setAgreedTerms(!agreedTerms); clear('terms'); }}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedTerms }}
                accessibilityLabel="Agree to Terms of Service and Privacy Policy"
              >
                <View style={[styles.checkbox, agreedTerms && styles.checkboxChecked, !!errors.terms && styles.checkboxError]}>
                  {agreedTerms && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the{' '}
                  <Text style={styles.checkboxLink} onPress={() => router.push('/terms')}>
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text style={styles.checkboxLink} onPress={() => router.push('/terms')}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
              {errors.terms && <Text style={styles.checkError}>{errors.terms}</Text>}

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => { setAgeConfirmed(!ageConfirmed); clear('age'); }}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ageConfirmed }}
                accessibilityLabel="Confirm you are at least 18 years old"
              >
                <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked, !!errors.age && styles.checkboxError]}>
                  {ageConfirmed && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
                <Text style={styles.checkboxLabel}>I confirm I am at least 18 years old</Text>
              </TouchableOpacity>
              {errors.age && <Text style={styles.checkError}>{errors.age}</Text>}
            </View>

            <PressableScale
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Create your account"
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={COLORS.white} />
                  <Text style={styles.buttonText}>Creating your account</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </PressableScale>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={goToSignIn} hitSlop={8}>
              <Text style={styles.footerLink}> Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  form: { gap: SPACING.base },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  strengthText: { fontSize: 12, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  referralLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  referralText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  checks: { gap: SPACING.xs },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xs,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  footerText: { fontSize: 14, color: COLORS.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxError: { borderColor: COLORS.error },
  checkError: { fontSize: 12.5, fontWeight: '600', color: COLORS.error, marginLeft: 30, marginTop: -2 },
  checkboxLabel: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  checkboxLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline' as const,
  },
});
