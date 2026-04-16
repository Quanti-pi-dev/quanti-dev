// ─── Signup Screen ───────────────────────────────────────────

import {  useState  } from 'react';
import { View, TouchableOpacity, ScrollView, type DimensionValue } from 'react-native';
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
import type { SocialProvider } from '../../src/components/ui/SocialLoginButton';
import { isValidEmail } from '../../src/utils/validation';

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
  none:   { label: '',       color: 'transparent', width: '0%' },
  weak:   { label: 'Weak',   color: '#EF4444',     width: '33%' },
  medium: { label: 'Medium', color: '#F59E0B',     width: '66%' },
  strong: { label: 'Strong', color: '#10B981',     width: '100%' },
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
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Sign up failed. Please try again.' });
    } finally {
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
            <Typography variant="bodySmall" color={theme.error} align="center">
              {errors.general}
            </Typography>
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

        {/* Secondary social provider — icon */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <SocialLoginButton
            provider="twitter"
            onPress={handleSocialLogin}
            loading={socialLoading === 'twitter'}
            disabled={socialLoading !== null && socialLoading !== 'twitter'}
            variant="icon"
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl }}>
          <Typography variant="bodySmall" color={theme.textTertiary}>Already have an account?</Typography>
          <TouchableOpacity onPress={() => router.back()}>
            <Typography variant="bodySmall" color={theme.primary}>Sign in</Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
