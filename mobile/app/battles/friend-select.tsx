// ─── Friend Select ──────────────────────────────────────────
// Picks an opponent from the user's friend list.
// Improvements:
//  - Premium header with gradient accent
//  - Friend cards with avatar initials + colored ring
//  - "Challenge" button with gradient styling
//  - Better empty state with CTA
//  - Search bar with rounded pill design

import { useState } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { spacing, radius, shadows } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { useFriends } from '../../src/hooks/useFriend';
import type { UserSummary } from '@kd/shared';

// Color palette for avatar rings
const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6'];

export default function FriendSelectScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const { data: friends, isLoading } = useFriends();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = (friends ?? []).filter((f) =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleChallenge = (friend: UserSummary) => {
    router.push({
      pathname: '/battles/create',
      params: { opponentId: friend.id, opponentName: friend.displayName },
    });
  };

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
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
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/battles');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h4">Choose Opponent</Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            Select a friend to challenge
          </Typography>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/social')}
          style={{
            width: 36, height: 36, borderRadius: radius.full,
            backgroundColor: theme.primaryMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="person-add" size={16} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.cardAlt,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            height: 46,
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
              fontWeight: '400',
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Typography variant="caption" color={theme.textTertiary}>
            Loading your friends...
          </Typography>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xl }}>
          <View
            style={{
              width: 80, height: 80, borderRadius: radius.full,
              backgroundColor: theme.primaryMuted,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="people-outline" size={40} color={theme.primary} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Typography variant="label" color={theme.textSecondary} align="center">
              {searchQuery ? 'No friends found' : 'No friends yet'}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} align="center">
              {searchQuery
                ? 'Try a different name'
                : 'Find friends in the Social tab to challenge them!'}
            </Typography>
          </View>
          {!searchQuery && (
            <TouchableOpacity
              onPress={() => router.push('/social')}
              style={{ borderRadius: radius.xl, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="person-add" size={16} color="#FFF" />
                <Typography variant="label" color="#FFF">Find Friends</Typography>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          renderItem={({ item, index }) => {
            const accentColor = AVATAR_COLORS[index % AVATAR_COLORS.length]!;
            return (
              <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    borderWidth: 1,
                    borderColor: theme.border,
                    ...shadows.xs,
                    shadowColor: theme.shadow,
                  }}
                >
                  {/* Avatar */}
                  <View
                    style={{
                      width: 48, height: 48, borderRadius: radius.full,
                      backgroundColor: accentColor + '18',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: accentColor + '55',
                    }}
                  >
                    <Typography variant="label" color={accentColor} style={{ fontSize: 20 }}>
                      {item.displayName.charAt(0).toUpperCase()}
                    </Typography>
                  </View>

                  {/* Name */}
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{item.displayName}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      Ready to battle
                    </Typography>
                  </View>

                  {/* Challenge button */}
                  <TouchableOpacity
                    onPress={() => handleChallenge(item)}
                    style={{ borderRadius: radius.lg, overflow: 'hidden' }}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons name="flash" size={12} color="#FFF" />
                      <Typography variant="captionBold" color="#FFF" style={{ fontSize: 12 }}>
                        Challenge
                      </Typography>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          }}
        />
      )}
    </ScreenWrapper>
  );
}
