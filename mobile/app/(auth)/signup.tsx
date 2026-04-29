// ─── Signup Screen ───────────────────────────────────────────

import { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, ScrollView, type DimensionValue } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Divider } from '../../src/components/ui/Divider';
import { SocialLoginButton } from '../../src/components/ui/SocialLoginButton';
import { authEmitter } from '../../src/services/authEmitter';
import type { SocialProvider } from '../../src/components/ui/SocialLoginButton';
import { isValidEmail } from '../../src/utils/validation';
import { formatFirebaseError } from '../../src/utils/errors';


// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SOURCE = require('../../assets/adaptive-icon.png');

// ─── Password Strength ──────────────────────────────────────

type StrengthLevel = 'none' | 'weak' | 'medium' | 'strong';

function getPasswordStrength(pw: string): { level: StrengthLevel; score: number } {
  if (!pw) return { level: 'none', score: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { level: 'weak', score };
  if (score <= 3) return { level: 'medium', score };
  return { level: 'strong', score };
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; width: DimensionValue }> = {
  none: { label: '', color: 'transparent', width: '0%' },
  weak: { label: 'Weak', color: '#EF4444', width: '33%' },
  medium: { label: 'Medium', color: '#F59E0B', width: '66%' },
  strong: { label: 'Strong', color: '#10B981', width: '100%' },
};


export default function SignupScreen() {
  const { theme } = useTheme();
  const { login, signupWithPassword } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = authEmitter.on('AUTH_ERROR', (msg?: string) => {
      setErrors({ general: msg ? formatFirebaseError({ message: msg }) : 'Authentication failed. Please try again.' });
      setIsLoading(false);
      setSocialLoading(null);
    });
    return unsub;
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!isValidEmail(email)) e.email = 'Enter a valid email';
    if (password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await signupWithPassword(email, password, name.trim());
      // Do not set isLoading(false) here on success!
      // AuthContext will take over, hydrate the profile, and then the layout will redirect.
      // Keeping the spinner active prevents the user from clicking again or thinking it failed.
    } catch (err: unknown) {
      setErrors({ general: formatFirebaseError(err) });
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    try {
      await login(provider);
    } catch {
      setErrors({ general: 'Social login failed. Please try again.' });
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <ScreenWrapper keyboardAvoiding>
      <Header showBack title="Create Account" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing['2xl'] }}
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
        <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginBottom: spacing.lg }}>
          Join Quanti-pi and start your learning journey
        </Typography>

        {/* Email-first signup form */}
        <View style={{ gap: spacing.base }}>

          <Input
            label="Full Name"
            placeholder="Alex Johnson"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            leftIcon={<Ionicons name="person-outline" size={18} color={theme.textTertiary} />}
            error={errors.name}
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              // Clear error as user types if they've already touched the field
              if (touchedFields.has('email') && isValidEmail(text)) {
                setErrors(e => ({ ...e, email: '' }));
              }
            }}
            onBlur={() => {
              setTouchedFields(prev => new Set(prev).add('email'));
              if (!isValidEmail(email) && email.length > 0) {
                setErrors(e => ({ ...e, email: 'Enter a valid email address' }));
              } else {
                setErrors(e => ({ ...e, email: '' }));
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={theme.textTertiary} />}
            error={errors.email}
            success={touchedFields.has('email') && isValidEmail(email) ? '✓' : ''}
          />

          <Input
            label="Password"
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} />}
            rightIcon={<Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textTertiary} />}
            onRightIconPress={() => setShowPassword((v) => !v)}
            error={errors.password}
          />

          {/* Password strength indicator (FIX U3) */}
          {password.length > 0 && (() => {
            const { level } = getPasswordStrength(password);
            const cfg = STRENGTH_CONFIG[level];
            return (
              <View style={{ gap: spacing.xs }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: cfg.width, backgroundColor: cfg.color, borderRadius: 2 }} />
                </View>
                <Typography variant="caption" color={cfg.color} style={{ alignSelf: 'flex-end' }}>
                  {cfg.label}
                </Typography>
              </View>
            );
          })()}

          <Button fullWidth loading={isLoading} onPress={handleSignup} size="lg"
            style={{ marginTop: spacing.sm }}>
            Create Account
          </Button>

          {errors.general ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.error + '15',
              padding: spacing.md,
              borderRadius: 12,
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: theme.error + '33',
              marginTop: spacing.sm,
            }}>
              <Ionicons name="warning-outline" size={18} color={theme.error} />
              <Typography variant="caption" color={theme.error} style={{ flex: 1, fontWeight: '500' }}>
                {errors.general}
              </Typography>
            </View>
          ) : null}
        </View>

        <Divider label="or sign up with" style={{ marginVertical: spacing.xl }} />

        {/* Primary social CTA */}
        <SocialLoginButton
          provider="google"
          onPress={handleSocialLogin}
          loading={socialLoading === 'google'}
          disabled={socialLoading !== null && socialLoading !== 'google'}
          variant="full"
        />



        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl }}>
          <Typography variant="bodySmall" color={theme.textTertiary}>Already have an account?</Typography>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Typography variant="bodySmall" color={theme.primary}>Sign in</Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
