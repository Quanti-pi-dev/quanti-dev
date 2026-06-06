// ─── Subject Preview Sheet ──────────────────────────────────
// Modal bottom sheet that shows a sample flashcard from a subject.
// Triggered by long-press or info icon on subject selection cards.
//
// Psychology: Content Quality Proof — previewing a real card
// reduces uncertainty and builds confidence in the content
// before the student commits to selecting the subject.

import { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Skeleton } from '../ui/Skeleton';
import { api } from '../../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PreviewCard {
  id: string;
  question: string;
  options?: Array<{ id: string; text: string }>;
  difficulty?: string;
  topic?: string;
}

interface SubjectPreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  subjectId: string;
  subjectName: string;
  examId?: string;
}

export function SubjectPreviewSheet({
  visible,
  onClose,
  subjectId,
  subjectName,
  examId,
}: SubjectPreviewSheetProps) {
  const { theme, isDark } = useTheme();

  // Fetch a single sample card from the diagnostic deck
  const { data: card, isLoading, error } = useQuery<PreviewCard | null>({
    queryKey: ['subject-preview', subjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (examId) params.set('examId', examId);
      params.set('subjectId', subjectId);
      const res = await api.get(`/progress/diagnostic-deck?${params.toString()}`);
      const cards = res.data?.data?.cards ?? res.data?.data ?? [];
      if (!Array.isArray(cards) || cards.length === 0) return null;
      // Pick the first Emerging-level card for preview
      const emerging = cards.find((c: any) => c.difficulty === 'Emerging') ?? cards[0];
      return {
        id: emerging.id,
        question: emerging.question ?? emerging.front ?? 'Sample question',
        options: emerging.options,
        difficulty: emerging.difficulty ?? 'Emerging',
        topic: emerging.topic ?? emerging.tags?.[0] ?? null,
      };
    },
    enabled: visible && !!subjectId,
    staleTime: 10 * 60 * 1000, // Cache 10 minutes
    retry: 1,
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.duration(400).springify()}
          exiting={SlideOutDown.duration(200)}
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            padding: spacing.xl,
            paddingBottom: spacing['4xl'],
            maxHeight: SCREEN_HEIGHT * 0.55,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.4 : 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.border,
              }}
            />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3">
                📚 {subjectName}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>
                Sample question preview
              </Typography>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={20} width="80%" borderRadius={radius.sm} />
              <Skeleton height={16} width="60%" borderRadius={radius.sm} />
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} height={44} borderRadius={radius.lg} />
                ))}
              </View>
            </View>
          ) : error || !card ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing['2xl'],
                gap: spacing.md,
              }}
            >
              <Typography style={{ fontSize: 40 }}>📋</Typography>
              <Typography variant="body" align="center" color={theme.textSecondary}>
                Preview not available yet — select this subject to start exploring!
              </Typography>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={{ gap: spacing.md }}>
              {/* Topic + difficulty badge */}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {card.topic && (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radius.full,
                    }}
                  >
                    <Typography variant="caption" color="#6366F1">
                      {card.topic}
                    </Typography>
                  </View>
                )}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                  }}
                >
                  <Typography variant="caption" color="#10B981">
                    {card.difficulty}
                  </Typography>
                </View>
              </View>

              {/* Question */}
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}
              >
                <Typography variant="bodySemiBold" color={theme.text}>
                  {card.question}
                </Typography>
              </View>

              {/* Answer options (blurred/greyed — tease only) */}
              {card.options && card.options.length > 0 && (
                <View style={{ gap: spacing.xs }}>
                  {card.options.slice(0, 4).map((opt, idx) => (
                    <Animated.View
                      key={opt.id}
                      entering={FadeInDown.delay(200 + idx * 80).duration(300)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.md,
                        borderRadius: radius.lg,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        opacity: 0.6,
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: theme.border,
                        }}
                      />
                      <Typography variant="body" color={theme.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                        {opt.text}
                      </Typography>
                    </Animated.View>
                  ))}
                </View>
              )}

              {/* Teaser CTA */}
              <Animated.View entering={FadeInDown.delay(600).duration(300)}>
                <Typography variant="caption" align="center" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
                  Select this subject to unlock all questions ✨
                </Typography>
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
