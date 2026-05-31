// ─── Social Screen ──────────────────────────────────────────
// Friend list, search users, pending requests, and activity feed.
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
  useRemoveFriend,
} from '../../src/hooks/useFriend';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/services/api-contracts';
import { fetchActivePact } from '../../src/services/behavioral-contracts';

// ─── Feed Pagination Envelope ────────────────────────────────
// /feed returns { events: FeedEvent[], nextCursor: number | null, hasMore: boolean }
// apiGet<T> extracts response.data.data, so we must type T as the envelope,
// not as FeedEvent[] directly.
interface FeedPage {
  events: FeedEvent[];
  nextCursor: number | null;
  hasMore: boolean;
}

// ─── Feed Event Types (aligned with feed.service.ts) ───────────────────────────────

interface FeedEvent {
  id: string;
  type:
    | 'level_unlock'
    | 'streak_milestone'
    | 'legendary_drop'
    | 'badge_earned'
    | 'study_pact_complete'
    | 'tournament_win';
  actorName: string;
  actorAvatar?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

const FEED_EVENT_COPY: Record<FeedEvent['type'], { icon: string; label: (p: Record<string, unknown>) => string }> = {
  level_unlock:          { icon: '🔓', label: (p) => `unlocked ${String(p['levelName'] ?? 'a new level')} in ${String(p['subjectName'] ?? 'a subject')}` },
  streak_milestone:      { icon: '🔥', label: (p) => `hit a ${String(p['streakDays'] ?? '')}-day streak!` },
  legendary_drop:        { icon: '✨', label: () => 'got a LEGENDARY coin drop!' },
  badge_earned:          { icon: '🏅', label: (p) => `earned the ${String(p['badgeName'] ?? 'a new badge')} badge` },
  study_pact_complete:   { icon: '🤝', label: (p) => `completed a study pact: ${String(p['pactName'] ?? '')}` },
  tournament_win:        { icon: '🏆', label: () => 'won a tournament!' },
};

type Tab = 'friends' | 'activity' | 'search' | 'requests';

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

  // Activity feed — friend milestone events from /api/v1/feed
  // Psychology: FOMO Social Proof — seeing friends achieve things drives
  // immediate study sessions to keep up.
  //
  // NOTE: /feed returns a pagination envelope { events, nextCursor, hasMore }.
  // We type the response as FeedPage (not FeedEvent[]) so we can safely
  // read feedResponse.events in the FlatList — avoiding the runtime crash
  // caused by passing a plain object to FlatList.data.
  const { data: feedResponse, isLoading: feedLoading, refetch: refetchFeed } = useQuery<FeedPage>({
    queryKey: ['social-feed'],
    queryFn: () => apiGet<FeedPage>('/feed'),
    staleTime: 60 * 1000,  // 1 minute cache — near-real-time
    enabled: activeTab === 'activity',
  });
  const feedEvents: FeedEvent[] = feedResponse?.events ?? [];

  const acceptMutation = useAcceptFriendRequest();
  const deleteMutation = useDeleteFriendship();
  const removeMutation = useRemoveFriend();
  const { showAlert } = useGlobalUI();

  const refreshing = friendsLoading || pendingLoading;
  const onRefresh = useCallback(() => {
    void refetchFriends();
    void refetchPending();
    void refetchFeed();
  }, [refetchFriends, refetchPending, refetchFeed]);

  const pendingCount = (pendingData?.received?.length ?? 0);
  // Check for active pact — used to route the header button
  // to pact-detail (if active) vs create-pact (if not).
  const { data: activePact } = useQuery({
    queryKey: ['active-pact'],
    queryFn: fetchActivePact,
    staleTime: 2 * 60 * 1000,
  });

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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Typography variant="h3" style={{ flex: 1 }}>Friends</Typography>
        {/* Study Pact CTA — routes to pact-detail if active, otherwise create */}
        <TouchableOpacity
          onPress={() =>
            activePact
              ? router.push('/social/pact-detail' as never)
              : router.push('/social/create-pact' as never)
          }
          accessibilityRole="button"
          accessibilityLabel={activePact ? 'View active study pact' : 'Create a study pact'}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: activePact ? theme.success + '22' : theme.primaryMuted,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs + 2,
            borderWidth: 1,
            borderColor: activePact ? theme.success + '55' : theme.primary + '44',
          }}
        >
          <Ionicons name="people" size={14} color={activePact ? theme.success : theme.primary} />
          <Typography variant="captionBold" color={activePact ? theme.success : theme.primary}>
            {activePact ? 'My Pact' : 'Pact'}
          </Typography>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          gap: spacing.xs,
        }}
      >
        {(
          [
            { key: 'friends',  label: 'Friends' },
            { key: 'activity', label: 'Activity' },
            { key: 'search',   label: 'Find' },
            { key: 'requests', label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ] as { key: Tab; label: string }[]
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.key }}
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
                fontSize: 11,
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
                fontWeight: '400',
                fontSize: typography.base,
                color: theme.text,
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Activity Feed Tab ── */}
      {activeTab === 'activity' && (
        <FlatList
          data={feedEvents ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={feedLoading} onRefresh={() => void refetchFeed()} tintColor={theme.primary} />
          }
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={
            feedLoading ? (
              <View style={{ gap: spacing.md }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} width="100%" height={72} borderRadius={radius.md} />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
                <Typography style={{ fontSize: 48 }}>🌊</Typography>
                <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
                  Your friends haven't been active yet.
                  {`\n`}Add more friends to see their wins here!
                </Typography>
              </View>
            )
          }
          renderItem={({ item, index }) => {
            const meta = FEED_EVENT_COPY[item.type];
            const timeAgo = (() => {
              const diff = Date.now() - new Date(item.createdAt).getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h ago`;
              return `${Math.floor(hrs / 24)}d ago`;
            })();

            return (
              <Animated.View
                entering={FadeInDown.delay(index * 50).duration(300)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                {/* Avatar or event emoji */}
                {item.actorAvatar ? (
                  <Image
                    source={{ uri: item.actorAvatar }}
                    style={{ width: 40, height: 40, borderRadius: radius.full }}
                  />
                ) : (
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: radius.full,
                      backgroundColor: theme.primaryMuted,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Typography style={{ fontSize: 20 }}>{meta?.icon ?? '📊'}</Typography>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySemiBold" numberOfLines={2}>
                    {item.actorName}
                    {' '}
                    <Typography variant="body" color={theme.textSecondary}>
                      {meta ? meta.label(item.payload) : 'did something great!'}
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: 2 }}>
                    {timeAgo}
                  </Typography>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

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
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => {
                    showAlert({
                      title: 'Remove Friend',
                      message: `Are you sure you want to remove ${item.displayName} from your friends list?`,
                      type: 'warning',
                      buttons: [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Remove', 
                          style: 'destructive', 
                          onPress: () => removeMutation.mutate(item.id) 
                        }
                      ]
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.displayName} from friends`}
                  disabled={removeMutation.isPending}
                  style={{
                    backgroundColor: theme.errorMuted,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                    opacity: removeMutation.isPending && removeMutation.variables === item.id ? 0.5 : 1,
                  }}
                >
                  {removeMutation.isPending && removeMutation.variables === item.id ? (
                    <ActivityIndicator size="small" color={theme.error} />
                  ) : (
                    <Ionicons name="person-remove" size={16} color={theme.error} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/battles/create',
                      params: { opponentId: item.id, opponentName: item.displayName }
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Challenge ${item.displayName}`}
                  style={{
                    backgroundColor: theme.primaryMuted,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                  }}
                >
                  <Ionicons name="flash" size={16} color={theme.primary} />
                </TouchableOpacity>
              </View>
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
          renderItem={({ item }) => {
            const isPendingSent = pendingData?.sent?.some((req: any) => req.addresseeId === item.id) ?? false;
            const isFriend = friends?.some((f: any) => f.id === item.id) ?? false;
            return <SearchResultRow item={item} isPendingSent={isPendingSent} isFriend={isFriend} />;
          }}
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
                {/* FIX U2: Show sender's name instead of generic label */}
                <Typography variant="bodySemiBold">
                  {(item as { requesterName?: string }).requesterName ?? 'Friend Request'}
                </Typography>
                <Typography variant="caption" style={{ color: theme.textSecondary }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => deleteMutation.mutate(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline friend request from ${(item as { requesterName?: string }).requesterName ?? 'this user'}`}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Accept friend request from ${(item as { requesterName?: string }).requesterName ?? 'this user'}`}
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

// ─── FIX B7 + U3: Per-row component with its own mutation state ──

function SearchResultRow({
  item,
  isPendingSent,
  isFriend
}: {
  item: { id: string; displayName: string; enrollmentId?: string; avatarUrl?: string | null };
  isPendingSent: boolean;
  isFriend: boolean;
}) {
  const { theme } = useTheme();
  const [sent, setSent] = useState(isPendingSent);
  const mutation = useSendFriendRequest();

  useEffect(() => {
    if (isPendingSent) setSent(true);
  }, [isPendingSent]);

  const handleSend = () => {
    mutation.mutate(item.id, {
      onSuccess: () => setSent(true),
    });
  };

  return (
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
          style={{ width: 40, height: 40, borderRadius: radius.full }}
        />
      ) : (
        <View
          style={{
            width: 40, height: 40, borderRadius: radius.full,
            backgroundColor: theme.primaryMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography variant="bodyBold" style={{ color: theme.primary }}>
            {item.displayName.charAt(0).toUpperCase()}
          </Typography>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Typography variant="bodySemiBold">{item.displayName}</Typography>
        {item.enrollmentId && (
          <Typography variant="caption" style={{ color: theme.textTertiary }}>
            ID: {item.enrollmentId}
          </Typography>
        )}
      </View>
      {isFriend ? (
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
          <Typography variant="captionBold" style={{ color: theme.textSecondary }}>
            Friends ✓
          </Typography>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleSend}
          disabled={mutation.isPending || sent}
          accessibilityRole="button"
          accessibilityLabel={sent ? `Request sent to ${item.displayName}` : `Send friend request to ${item.displayName}`}
          accessibilityState={{ disabled: mutation.isPending || sent, busy: mutation.isPending }}
          style={{
            backgroundColor: sent ? theme.successMuted : theme.buttonPrimary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
          }}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : sent ? (
            <Typography variant="captionBold" style={{ color: theme.success }}>
              Requested ✓
            </Typography>
          ) : (
            <Typography variant="captionBold" style={{ color: theme.buttonPrimaryText }}>
              Add Friend
            </Typography>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
