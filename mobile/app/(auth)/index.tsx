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
import { spacing, typography, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Divider } from '../../src/components/ui/Divider';
import { SocialLoginButton } from '../../src/components/ui/SocialLoginButton';
import type { SocialProvider } from '../../src/components/ui/SocialLoginButton';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const { theme, isDark } = useTheme();
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

  useEffect(() => {
    SecureStore.getItemAsync('refresh_token').then(token => {
      setHasStoredSession(!!token);
    }).catch(() => {});
  }, []);

  const handleBiometricLogin = async () => {
    const success = await biometricAuthenticate();
    if (!success) return;
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) {
      setError('No saved session found. Please sign in with your password.');
      return;
    }
    setIsLoading(true);
    try {
      const { api } = await import('../../src/services/api');
      const { data } = await api.post('/auth/refresh', { refreshToken });
      const newAccess = data?.data?.accessToken;
      const newRefresh = data?.data?.refreshToken;
      if (!newAccess || !newRefresh) throw new Error('Session expired.');
      await SecureStore.setItemAsync('access_token', newAccess);
      await SecureStore.setItemAsync('refresh_token', newRefresh);
      // Refresh the auth context so it picks up the new session
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric sign-in failed.');
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
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
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
              source={require('../../assets/adaptive-icon.png')}
              style={{ width: '100%', height: '100%', borderRadius: 28 }}
              resizeMode="cover"
            />
          </View>

          <Typography variant="h2" align="center" color={theme.text}>
            Quanti-pi
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
            <Typography variant="bodySmall" color={theme.error}>
              {error}
            </Typography>
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

        {/* Secondary social providers — icon row */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          {(['github', 'microsoft', 'facebook', 'linkedin'] as SocialProvider[]).map((provider) => (
            <SocialLoginButton
              key={provider}
              provider={provider}
              onPress={handleSocialLogin}
              loading={socialLoading === provider}
              disabled={socialLoading !== null && socialLoading !== provider}
              variant="icon"
            />
          ))}
        </View>

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl }}>
          <Typography variant="bodySmall" color={theme.textTertiary}>
            Don't have an account?
          </Typography>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Typography variant="bodySmall" color={theme.primary}>
              Sign up
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
