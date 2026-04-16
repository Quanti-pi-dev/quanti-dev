// ─── CouponInput ──────────────────────────────────────────────
// Coupon code entry with validate button and feedback.

import { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius, typography } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { validateCoupon } from '../../services/subscription.service';
import type { CouponValidationResult } from '@kd/shared';

interface CouponInputProps {
  planId: string;
  onValidated: (result: CouponValidationResult | null) => void;
}

export function CouponInput({ planId, onValidated }: CouponInputProps) {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouponValidationResult | null>(null);
  const [error, setError] = useState('');

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await validateCoupon(code.trim().toUpperCase(), planId);
      setResult(res);
      onValidated(res);
      if (res.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(res.failureReason ?? 'Invalid coupon');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError('Could not validate coupon. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setCode('');
    setResult(null);
    setError('');
    onValidated(null);
  }

  const isValid = result?.valid === true;

  const borderColor = isValid
    ? theme.success
    : error
    ? theme.error
    : theme.border;

  const backgroundColor = isValid
    ? theme.successMuted
    : error
    ? theme.errorMuted
    : theme.cardAlt;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Input row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.base,
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        <Ionicons
          name={isValid ? 'pricetag' : 'pricetag-outline'}
          size={17}
          color={isValid ? theme.success : theme.textTertiary}
        />
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); setError(''); setResult(null); }}
          placeholder="Coupon code"
          placeholderTextColor={theme.textPlaceholder}
          autoCapitalize="characters"
          editable={!isValid}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.sm,
            fontFamily: typography.body,
            fontSize: typography.sm,
            color: theme.text,
          }}
        />
        {isValid ? (
          <TouchableOpacity onPress={handleClear} style={{ padding: spacing.xs }}>
            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleApply}
            disabled={loading || !code.trim()}
            style={{
              backgroundColor: theme.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
            }}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Typography variant="captionBold" color="#FFFFFF">Apply</Typography>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Feedback */}
      {isValid && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="checkmark-circle" size={14} color={theme.success} />
          <Typography variant="captionBold" color={theme.success}>
            Coupon applied! You save ₹{Math.round((result?.discountPaise ?? 0) / 100)}
          </Typography>
        </View>
      )}
      {!!error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.error} />
          <Typography variant="caption" color={theme.error}>{error}</Typography>
        </View>
      )}
    </View>
  );
}
