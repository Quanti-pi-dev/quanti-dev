// ─── Forgot Password ─────────────────────────────────────────
// Sends Firebase password-reset email. User clicks the link in their inbox.

import { useState } from 'react';
import { View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { isValidEmail } from '../../src/utils/validation';
import { formatFirebaseError } from '../../src/utils/errors';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!isValidEmail(email)) { setError('Enter a valid email address'); return; }
    setError('');
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMailApp = async () => {
    try {
      // iOS — opens the default Mail app
      await Linking.openURL('message://');
    } catch {
      try {
        // Android / fallback — opens mail intent chooser
        await Linking.openURL('mailto:');
      } catch {
        // No mail app available — silently ignore
      }
    }
  };

  return (
    <ScreenWrapper keyboardAvoiding>
      <Header showBack title="Reset Password" />

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing['2xl'] }}>

        {!sent ? (
          /* ─── Step 1: Enter email ─── */
          <View style={{ gap: spacing.base }}>
            <View>
              <Typography variant="h3">Forgot your password?</Typography>
              <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
                Enter your email and we'll send a reset link if an account exists.
              </Typography>
            </View>

            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Ionicons name="mail-outline" size={18} color={theme.textTertiary} />}
              error={error.length < 30 ? error : ''}
            />

            {error.length >= 30 ? (
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

            <Button fullWidth loading={isLoading} onPress={handleSend} size="lg">
              Send Reset Link
            </Button>
          </View>
        ) : (
          /* ─── Step 2: Confirmation ─── */
          <View style={{ gap: spacing.xl, alignItems: 'center' }}>
            <View
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: theme.primaryMuted,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="mail-open-outline" size={36} color={theme.primary} />
            </View>

            <View style={{ gap: spacing.sm, alignItems: 'center' }}>
              <Typography variant="h3" align="center">Check your inbox</Typography>
              <Typography variant="body" align="center" color={theme.textSecondary}>
                If an account exists for
              </Typography>
              <Typography variant="label" align="center" color={theme.primary}>
                {email}
              </Typography>
              <Typography variant="bodySmall" align="center" color={theme.textTertiary}>
                you'll receive a password reset link shortly. The link expires in 24 hours.
              </Typography>
            </View>

            <Button fullWidth onPress={handleOpenMailApp} size="lg">
              Open Mail App
            </Button>

            <Button fullWidth variant="secondary" onPress={() => setSent(false)} size="lg">
              Use a different email
            </Button>

            <Button fullWidth variant="ghost" onPress={() => router.replace('/(auth)/login')} size="lg">
              Back to Sign In
            </Button>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}
