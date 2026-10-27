import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { getToken } from '../../services/tokenStorage';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import { AuthHero } from '../../components/AuthHero';
import { AuthField, FormBanner } from '../../components/AuthField';
import { PressableScale } from '../../components/Motion';
import { PHOTOS } from '../../components/media';
import { useHaptic } from '../../hooks/useHaptic';
import { goBack } from '../../utils/navigation';
import { friendlyAuthError, isEmail } from '../../utils/authForm';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const haptic = useHaptic();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const isStaff = as === 'staff';
  const { login, refreshUser } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const hasToken = !!(await getToken());
        if (compatible && enrolled && hasToken) {
          setBiometricAvailable(true);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Fingerprint');
          }
        }
      } catch {
        // No biometrics on this device (or on web): the password form is enough.
      }
    })();
  }, []);

  const handleBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in with ${biometricType}`,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLoading(true);
      setFormError(null);
      try {
        await refreshUser();
        haptic.success();
      } catch {
        haptic.error();
        setFormError('Your session has expired. Please sign in with your password.');
        setBiometricAvailable(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const openForgot = () => {
    // Carry over whatever they already typed so they don't have to type it twice.
    if (!showForgot) setForgotEmail((v) => v || email.trim());
    setForgotError(null);
    setFormError(null);
    setResetSentTo(null);
    setShowForgot((v) => !v);
  };

  const handleForgotPassword = async () => {
    const value = forgotEmail.trim().toLowerCase();
    if (!isEmail(value)) {
      haptic.error();
      setForgotError(value ? 'That email address does not look right.' : 'Enter the email you signed up with.');
      return;
    }
    Keyboard.dismiss();
    setForgotError(null);
    setSendingReset(true);
    try {
      await authApi.forgotPassword(value);
      haptic.success();
      setResetSentTo(value);
    } catch (err) {
      haptic.error();
      setForgotError(friendlyAuthError(err, 'We could not send the reset email. Please try again.'));
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogin = async () => {
    const value = email.trim().toLowerCase();
    const next: typeof errors = {};
    if (!value) next.email = 'Enter your email address.';
    else if (!isEmail(value)) next.email = 'That email address does not look right.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) {
      haptic.error();
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      // On success the auth layout sends them straight to their portal.
      await login(value, password);
      haptic.success();
    } catch (err) {
      haptic.error();
      setFormError(friendlyAuthError(err, 'That email and password do not match. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => goBack(router, '/welcome')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to the home page"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <AuthHero
            photo={PHOTOS.trolley}
            title={isStaff ? 'Staff sign in' : 'Welcome back'}
            subtitle={isStaff ? 'Use the email and password from the office' : 'Sign in to your account'}
          />

          <View style={styles.form}>
            <FormBanner message={formError} />

            <AuthField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
              error={errors.email}
              placeholder="your@email.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <AuthField
              ref={passwordRef}
              label="Password"
              icon="lock-closed-outline"
              password
              value={password}
              onChangeText={(v) => { setPassword(v); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
              error={errors.password}
              placeholder="Enter your password"
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity style={styles.forgotBtn} onPress={openForgot} hitSlop={8}>
              <Text style={styles.forgotText}>{showForgot ? 'Back to sign in' : 'Forgot password?'}</Text>
            </TouchableOpacity>

            {showForgot && (
              <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(150)} style={styles.forgotCard}>
                {resetSentTo ? (
                  <View style={styles.sentWrap}>
                    <View style={styles.sentIcon}>
                      <Ionicons name="mail-open-outline" size={22} color={COLORS.success} />
                    </View>
                    <Text style={styles.forgotTitle}>Check your inbox</Text>
                    <Text style={[styles.forgotSub, styles.centered]}>
                      If an account exists for {resetSentTo}, a reset link is on its way. It can take a minute, so check your spam folder too.
                    </Text>
                    <TouchableOpacity onPress={() => setResetSentTo(null)} hitSlop={8}>
                      <Text style={styles.forgotText}>Use a different email</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.forgotTitle}>Reset your password</Text>
                    <Text style={styles.forgotSub}>We will email you a link to choose a new one.</Text>
                    <AuthField
                      label="Email"
                      icon="mail-outline"
                      value={forgotEmail}
                      onChangeText={(v) => { setForgotEmail(v); setForgotError(null); }}
                      error={forgotError}
                      placeholder="your@email.com"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="send"
                      onSubmitEditing={handleForgotPassword}
                    />
                    <TouchableOpacity
                      style={[styles.forgotSendBtn, sendingReset && styles.buttonDisabled]}
                      onPress={handleForgotPassword}
                      disabled={sendingReset}
                      activeOpacity={0.85}
                    >
                      {sendingReset ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={styles.forgotSendText}>Send reset link</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            )}

            {!showForgot && (
              <>
                <PressableScale
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to your account"
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={COLORS.white} />
                      <Text style={styles.buttonText}>Signing in</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </PressableScale>

                {biometricAvailable && (
                  <TouchableOpacity
                    style={styles.biometricBtn}
                    onPress={handleBiometric}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons
                      name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                      size={22}
                      color={COLORS.primary}
                    />
                    <Text style={styles.biometricText}>Sign in with {biometricType}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {isStaff ? (
            <View style={styles.footerCol}>
              <Text style={styles.footerText}>No staff login yet? Ask the office to set one up.</Text>
              <TouchableOpacity onPress={() => router.setParams({ as: undefined })} hitSlop={8}>
                <Text style={styles.footerLink}>Not staff? Client sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.footerCol}>
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')} hitSlop={8}>
                  <Text style={styles.footerLink}> Create one</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => router.setParams({ as: 'staff' })} hitSlop={8}>
                <Text style={styles.staffLink}>Work with us? Staff sign in</Text>
              </TouchableOpacity>
            </View>
          )}
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
    justifyContent: 'flex-start',
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
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
  },
  footerCol: { alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xl },
  footerText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  staffLink: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textDecorationLine: 'underline' },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
    backgroundColor: COLORS.primary + '08',
  },
  biometricText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -SPACING.xs },
  forgotText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  forgotCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  forgotTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  forgotSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: -SPACING.sm },
  forgotSendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  forgotSendText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  sentWrap: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  centered: { textAlign: 'center', marginTop: 0 },
  sentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
