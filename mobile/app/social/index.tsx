// ─── Social Screen ──────────────────────────────────────────
// Friend list, search users, pending requests.
// Accessible from the Battles header icon and profile.

import { useState, useCallback, useEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, typography, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import {
  useFriends,
  usePendingFriendRequests,
  useUserSearch,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeleteFriendship,
} from '../../src/hooks/useFriend';

type Tab = 'friends' | 'search' | 'requests';

export default function SocialScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search input by 300ms to reduce API calls
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const { data: friends, isLoading: friendsLoading, refetch: refetchFriends } = useFriends();
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = usePendingFriendRequests();
  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useUserSearch(debouncedQuery);

  const sendRequestMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const deleteMutation = useDeleteFriendship();

  const refreshing = friendsLoading || pendingLoading;
  const onRefresh = useCallback(() => {
    void refetchFriends();
    void refetchPending();
  }, [refetchFriends, refetchPending]);

  const pendingCount = (pendingData?.received?.length ?? 0);

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
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/battles');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Typography variant="h3" style={{ flex: 1 }}>Friends</Typography>
      </View>

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          gap: spacing.sm,
        }}
      >
        {(
          [
            { key: 'friends', label: 'Friends' },
            { key: 'search', label: 'Find' },
            { key: 'requests', label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ] as { key: Tab; label: string }[]
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: activeTab === tab.key ? theme.primary : theme.card,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: activeTab === tab.key ? theme.primary : theme.border,
            }}
          >
            <Typography
              variant="bodySemiBold"
              style={{
                color: activeTab === tab.key ? theme.buttonPrimaryText : theme.text,
                fontSize: 12,
              }}
            >
              {tab.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Search input (only on search tab) ── */}
      {activeTab === 'search' && (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.inputBackground,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: theme.inputBorder,
              paddingHorizontal: spacing.md,
              height: 44,
            }}
          >
            <Ionicons name="search" size={18} color={theme.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or Enrollment ID…"
              placeholderTextColor={theme.textPlaceholder}
              autoFocus
              style={{
                flex: 1,
                marginLeft: spacing.sm,
                fontFamily: typography.body,
                fontSize: typography.base,
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
      )}

      {/* ── Friends Tab ── */}
      {activeTab === 'friends' && (
        <FlatList
          data={friends ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={
            friendsLoading ? (
              <View style={{ gap: spacing.md }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="100%" height={64} borderRadius={radius.md} />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
                <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
                <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
                  No friends yet. Use the Find tab to search!
                </Typography>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(index * 60).duration(300)}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.md,
                padding: spacing.base,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                    backgroundColor: theme.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="bodyBold" style={{ color: theme.primary }}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Typography>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Typography variant="bodySemiBold">{item.displayName}</Typography>
                <Typography variant="caption" style={{ color: theme.textTertiary }}>
                  ID: {item.enrollmentId}
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/battles/create' as never,
                  } as never)
                }
                style={{
                  backgroundColor: theme.primaryMuted,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                }}
              >
                <Ionicons name="flash" size={16} color={theme.primary} />
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}

      {/* ── Search Tab ── */}
      {activeTab === 'search' && (
        <FlatList
          data={searchResults ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          refreshControl={
            <RefreshControl refreshing={searchLoading} onRefresh={() => void refetchSearch()} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            searchLoading ? (
              <View style={{ gap: spacing.md }}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width="100%" height={64} borderRadius={radius.md} />
                ))}
              </View>
            ) : searchQuery.length < 2 ? (
              <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
                <Ionicons name="search-outline" size={48} color={theme.textTertiary} />
                <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
                  Type at least 2 characters to search
                </Typography>
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: spacing['2xl'] }}>
                <Typography variant="body" style={{ color: theme.textTertiary }}>
                  No users found
                </Typography>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.md,
                padding: spacing.base,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                    backgroundColor: theme.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="bodyBold" style={{ color: theme.primary }}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Typography>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Typography variant="bodySemiBold">{item.displayName}</Typography>
                <Typography variant="caption" style={{ color: theme.textTertiary }}>
                  ID: {item.enrollmentId}
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() => sendRequestMutation.mutate(item.id)}
                disabled={sendRequestMutation.isPending}
                style={{
                  backgroundColor: theme.buttonPrimary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                }}
              >
                {sendRequestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Typography variant="captionBold" style={{ color: theme.buttonPrimaryText }}>
                    Add Friend
                  </Typography>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* ── Requests Tab ── */}
      {activeTab === 'requests' && (
        <FlatList
          data={pendingData?.received ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={
            pendingLoading ? (
              <View style={{ gap: spacing.md }}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width="100%" height={64} borderRadius={radius.md} />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
                <Ionicons name="mail-open-outline" size={48} color={theme.textTertiary} />
                <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
                  No pending friend requests
                </Typography>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(index * 60).duration(300)}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.md,
                padding: spacing.base,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person-add" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="bodySemiBold">Friend Request</Typography>
                <Typography variant="caption" style={{ color: theme.textSecondary }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => deleteMutation.mutate(item.id)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: theme.errorMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={18} color={theme.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => acceptMutation.mutate(item.id)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: theme.successMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={18} color={theme.success} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        />
      )}
    </ScreenWrapper>
  );
}
