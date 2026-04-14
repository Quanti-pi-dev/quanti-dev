// ─── Friend Select ──────────────────────────────────────────
// Picks an opponent from the user's friend list, then creates the challenge.

import { useState } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, typography, radius, shadows } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { useFriends } from '../../src/hooks/useFriend';
import { useCreateChallenge } from '../../src/hooks/useChallenge';
import type { UserSummary } from '@kd/shared';

export default function FriendSelectScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    examId: string;
    subjectId: string;
    level: string;
    betAmount: string;
    durationSeconds: string;
  }>();

  const { data: friends, isLoading } = useFriends();
  const createMutation = useCreateChallenge();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = (friends ?? []).filter((f) =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleChallenge = (friend: UserSummary) => {
    createMutation.mutate({
      opponentId: friend.id,
      examId: params.examId!,
      subjectId: params.subjectId!,
      level: params.level!,
      betAmount: parseInt(params.betAmount!, 10),
      durationSeconds: parseInt(params.durationSeconds!, 10) as 60 | 90 | 120 | 180,
    });
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.base,
          paddingBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/battles/create'); // If accessed directly, go back to step 1
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Typography variant="h4" style={{ flex: 1 }}>Choose Opponent</Typography>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.inputBackground,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: theme.inputBorder,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            height: 44,
          }}
        >
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search friends..."
            placeholderTextColor={theme.textPlaceholder}
            style={{
              flex: 1,
              fontFamily: typography.body,
              fontSize: 14,
              color: theme.text,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xl }}>
          <Ionicons name="people-outline" size={64} color={theme.textTertiary} />
          <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
            No friends yet.{'\n'}Find friends in the Social tab to challenge them!
          </Typography>
          <TouchableOpacity
            onPress={() => router.push('/social' as never)}
            style={{
              backgroundColor: theme.buttonPrimary,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
            }}
          >
            <Typography variant="bodySemiBold" style={{ color: theme.buttonPrimaryText }}>
              Find Friends
            </Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  ...shadows.xs,
                  shadowColor: theme.shadow,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: theme.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="bodyBold" style={{ color: theme.primary, fontSize: 18 }}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Typography>
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySemiBold">{item.displayName}</Typography>
                </View>
                <TouchableOpacity
                  onPress={() => handleChallenge(item)}
                  disabled={createMutation.isPending}
                  style={{
                    backgroundColor: theme.buttonPrimary,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                  }}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Typography variant="bodySemiBold" style={{ color: theme.buttonPrimaryText, fontSize: 13 }}>
                      Challenge ⚔️
                    </Typography>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        />
      )}
    </ScreenWrapper>
  );
}
