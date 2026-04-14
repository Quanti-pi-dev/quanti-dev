// ─── CouponInput ──────────────────────────────────────────────
// Coupon code entry with validate button and feedback (NativeWind).

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { validateCoupon } from '../../services/subscription.service';
import type { CouponValidationResult } from '@kd/shared';

interface CouponInputProps {
  planId: string;
  onValidated: (result: CouponValidationResult | null) => void;
}

export function CouponInput({ planId, onValidated }: CouponInputProps) {
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

  return (
    <View className="gap-2">
      {/* Input row */}
      <View
        className={`flex-row items-center border rounded-2xl px-4 overflow-hidden ${
          isValid
            ? 'border-correct bg-correct/5'
            : error
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <Ionicons
          name={isValid ? 'pricetag' : 'pricetag-outline'}
          size={17}
          color={isValid ? '#10B981' : '#9CA3AF'}
        />
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); setError(''); setResult(null); }}
          placeholder="Coupon code"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          className="flex-1 py-3 px-2 text-sm font-body text-gray-800 dark:text-gray-100"
          editable={!isValid}
        />
        {isValid ? (
          <TouchableOpacity onPress={handleClear} className="p-1">
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleApply}
            disabled={loading || !code.trim()}
            className="bg-primary px-3 py-1.5 rounded-xl"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white text-xs font-body-semibold">Apply</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Feedback */}
      {isValid && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text className="text-correct text-xs font-body-semibold">
            Coupon applied! You save ₹{Math.round((result?.discountPaise ?? 0) / 100)}
          </Text>
        </View>
      )}
      {!!error && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
          <Text className="text-red-500 text-xs font-body">{error}</Text>
        </View>
      )}
    </View>
  );
}
