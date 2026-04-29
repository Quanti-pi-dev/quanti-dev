// ─── Login Screen ────────────────────────────────────────────
// Whiteboard / blackboard themed auth screen.

import { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, ScrollView } from 'react-native';
// ↑ react-native Image is intentional here: the logo is a local `require()` asset.
//   expo-image's blur-up / disk-cache only apply to network URIs, so it provides
//   no benefit for bundled assets and would add unnecessary overhead.

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Divider } from '../../src/components/ui/Divider';
import { SocialLoginButton } from '../../src/components/ui/SocialLoginButton';
import type { SocialProvider } from '../../src/components/ui/SocialLoginButton';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';
import { auth } from '../../src/lib/firebase';
import { authEmitter } from '../../src/services/authEmitter';
import { formatFirebaseError } from '../../src/utils/errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SOURCE = require('../../assets/adaptive-icon.png');

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login, loginWithPassword, refreshUser } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState('');

  // Biometric auth (P2.4)
  const { isAvailable: biometricAvailable, biometricType, authenticate: biometricAuthenticate } = useBiometricAuth();
  const [hasStoredSession, setHasStoredSession] = useState(false);

  // Firebase persists auth state via AsyncStorage — check if a session exists
  useEffect(() => {
    setHasStoredSession(auth.currentUser !== null);
  }, []);

  useEffect(() => {
    const unsub = authEmitter.on('AUTH_ERROR', (msg?: string) => {
      setError(msg ? formatFirebaseError({ message: msg }) : 'Authentication failed. Please try again.');
      setIsLoading(false);
      setSocialLoading(null);
    });
    return unsub;
  }, []);

  const handleBiometricLogin = async () => {
    const success = await biometricAuthenticate();
    if (!success) return;
    // Firebase sessions are persisted via AsyncStorage. After biometric
    // unlock, the user is already signed in — just refresh the profile.
    if (!auth.currentUser) {
      setError('No saved session found. Please sign in with your password.');
      return;
    }
    setIsLoading(true);
    try {
      await refreshUser();
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await loginWithPassword(email, password);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setError('');
    setSocialLoading(provider);
    try {
      await login(provider);
    } catch {
      setError('Social login failed. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <ScreenWrapper keyboardAvoiding>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / brand */}
        <View style={{ alignItems: 'center', marginBottom: spacing['3xl'] }}>
          <View
            style={{
              width: 300,
              height: 300,
              borderRadius: 28,
              overflow: 'hidden',
              //marginBottom: spacing.base,
            }}
          >
            <Image
              source={LOGO_SOURCE}
              style={{ width: '100%', height: '100%', borderRadius: 28 }}
              resizeMode="cover"
            />
          </View>

          <Typography variant="h2" align="center" color={theme.text}>
            Quanti-Pi
          </Typography>
          <Typography variant="bodySmall" align="center" color={theme.textTertiary}
            style={{ marginTop: spacing.xs }}>
            Your quantitative aptitude companion
          </Typography>
        </View>

        {/* Heading */}
        <Typography variant="h3" style={{ marginBottom: spacing.xs }}>
          Welcome back
        </Typography>
        <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginBottom: spacing['2xl'] }}>
          Sign in to continue your study streak
        </Typography>

        {/* Form */}
        <View style={{ gap: spacing.base }}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={theme.textTertiary} />}
            error={error && !email ? 'Enter your email' : ''}
          />

          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} />}
            rightIcon={
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={theme.textTertiary}
              />
            }
            onRightIconPress={() => setShowPassword((v) => !v)}
            error={error && !password ? 'Enter your password' : ''}
          />

          {error ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.error + '15',
              padding: spacing.md,
              borderRadius: 12,
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: theme.error + '33',
            }}>
              <Ionicons name="warning-outline" size={18} color={theme.error} />
              <Typography variant="caption" color={theme.error} style={{ flex: 1, fontWeight: '500' }}>
                {error}
              </Typography>
            </View>
          ) : null}

          {/* Forgot password */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end' }}
          >
            <Typography variant="caption" color={theme.primary}>
              Forgot password?
            </Typography>
          </TouchableOpacity>

          <Button
            fullWidth
            loading={isLoading}
            onPress={handleLogin}
            size="lg"
          >
            Sign In
          </Button>

          {/* Biometric login (P2.4) */}
          {biometricAvailable && hasStoredSession && (
            <Button
              fullWidth
              variant="secondary"
              size="lg"
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              {`Sign in with ${biometricType ?? 'Biometric'}`}
            </Button>
          )}
        </View>

        <Divider label="or continue with" style={{ marginVertical: spacing.xl }} />

        {/* Primary social CTA */}
        <SocialLoginButton
          provider="google"
          onPress={handleSocialLogin}
          loading={socialLoading === 'google'}
          disabled={socialLoading !== null && socialLoading !== 'google'}
          variant="full"
        />



        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl }}>
          <Typography variant="bodySmall" color={theme.textTertiary}>
            Don't have an account?
          </Typography>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)}>
            <Typography variant="bodySmall" color={theme.primary}>
              Sign up
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
