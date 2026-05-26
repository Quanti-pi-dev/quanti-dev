// ─── Institute Mock Test Detail Screen ─────────────────────────────
// Read-only overview of an examiner-authored mock test.
// Shows exam template, sections with per-section marks, duration, and
// settings. A "Start" button is displayed but disabled (coming soon)
// because student start/submit routes for mock tests are not yet live
// on the backend — they are tracked for a future phase.

import { useEffect, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../../src/theme';
import { spacing, radius } from '../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../../src/components/ui/Typography';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import {
  fetchInstituteMockTests,
  type InstituteMockTest,
} from '../../../../src/services/api-contracts';

// ── Stat tile ───────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  const { theme } = useTheme();
  return (
    <View style={{
      flex: 1, minWidth: '42%', padding: spacing.md,
      borderRadius: radius.lg, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
      alignItems: 'center', gap: 4,
    }}>
      <Ionicons name={icon as 'timer-outline'} size={20} color="#a5b4fc" />
      <Typography variant="h3" color={theme.text}>{value}</Typography>
      <Typography variant="caption" color={theme.textTertiary}>{label}</Typography>
    </View>
  );
}

// ── Section row ─────────────────────────────────────────────────

function SectionRow({
  section,
  index,
}: {
  section: InstituteMockTest['sections'][number];
  index: number;
}) {
  const { theme } = useTheme();
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const label = letters[index] ?? `${index + 1}`;
  const maxMarks = section.questionCount * section.marksPerCorrect;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: 'rgba(99,102,241,0.08)',
    }}>
      {/* Section label badge */}
      <View style={{
        width: 36, height: 36, borderRadius: radius.md,
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography variant="label" color="#a5b4fc" style={{ fontWeight: '700' }}>
          {label}
        </Typography>
      </View>

      {/* Name + Q count */}
      <View style={{ flex: 1 }}>
        <Typography variant="label" color={theme.text} numberOfLines={1}>
          {section.subjectName ?? `Section ${label}`}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: 2 }}>
          {section.questionCount} questions · {maxMarks} marks
        </Typography>
      </View>

      {/* Marks scheme */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Typography variant="caption" color="#4ade80" style={{ fontSize: 11 }}>
          +{section.marksPerCorrect} correct
        </Typography>
        {section.marksPerIncorrect !== 0 && (
          <Typography variant="caption" color="#f87171" style={{ fontSize: 11 }}>
            −{Math.abs(section.marksPerIncorrect)} wrong
          </Typography>
        )}
      </View>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function MockTestDetailScreen() {
  const { mockTestId, instituteId } = useLocalSearchParams<{
    mockTestId: string;
    instituteId: string;
  }>();
  const { theme } = useTheme();
  const router = useRouter();

  const [mockTest, setMockTest] = useState<InstituteMockTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mockTestId || !instituteId) return;

    // The list endpoint returns all live mock tests; we find our target from
    // the already-cached collection. There is no dedicated single-item GET
    // for students on the backend yet, so we re-fetch the list and pick by id.
    const load = async () => {
      setLoading(true);
      try {
        const tests = await fetchInstituteMockTests(instituteId, { limit: 50 });
        const found = tests.find(t => t.id === mockTestId) ?? null;
        setMockTest(found);
        if (!found) setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [mockTestId, instituteId]);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenWrapper>
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={24} style={{ borderRadius: radius.md, marginBottom: spacing.lg, width: 80 }} />
          <Skeleton height={140} style={{ borderRadius: radius.xl, marginBottom: spacing.lg }} />
          <Skeleton height={200} style={{ borderRadius: radius.xl, marginBottom: spacing.lg }} />
          <Skeleton height={60} style={{ borderRadius: radius.xl }} />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error || !mockTest) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
          <Typography variant="body" color={theme.textSecondary}>
            Mock test not found or no longer active.
          </Typography>
          <TouchableOpacity onPress={() => router.back()}>
            <Typography variant="label" color="#a5b4fc">Go back</Typography>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  const scheduledLabel = mockTest.scheduledAt
    ? new Date(mockTest.scheduledAt).toLocaleString()
    : null;
  const closesLabel = mockTest.closesAt
    ? new Date(mockTest.closesAt).toLocaleString()
    : null;

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: spacing.lg, alignSelf: 'flex-start' }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textSecondary} />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.springify()}>

          {/* Header card */}
          <LinearGradient
            colors={['rgba(251,191,36,0.14)', 'rgba(99,102,241,0.10)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.lg,
              borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
            }}
          >
            {/* Exam template badge */}
            {mockTest.examTemplateName && (
              <View style={{
                alignSelf: 'flex-start', marginBottom: spacing.sm,
                paddingHorizontal: spacing.sm, paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: 'rgba(99,102,241,0.2)',
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)',
              }}>
                <Typography variant="caption" color="#a5b4fc" style={{ fontSize: 11, fontWeight: '600' }}>
                  {mockTest.examTemplateName}
                </Typography>
              </View>
            )}
            <Typography variant="h2" color={theme.text} style={{ marginBottom: spacing.xs }}>
              {mockTest.title}
            </Typography>
            {scheduledLabel && (
              <Typography variant="caption" color={theme.textTertiary}>
                Opens: {scheduledLabel}
              </Typography>
            )}
            {closesLabel && (
              <Typography variant="caption" color={theme.textTertiary}>
                Closes: {closesLabel}
              </Typography>
            )}
          </LinearGradient>

          {/* Stats grid */}
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap',
            gap: spacing.md, marginBottom: spacing.lg,
          }}>
            <StatTile icon="help-circle-outline" label="Questions" value={mockTest.totalQuestions} />
            <StatTile icon="timer-outline" label="Duration" value={`${mockTest.durationMinutes} min`} />
            <StatTile icon="star-outline" label="Total Marks" value={mockTest.totalMarks} />
            <StatTile
              icon="albums-outline"
              label="Sections"
              value={mockTest.sections.length}
            />
          </View>

          {/* Settings */}
          <View style={{
            padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.lg,
            backgroundColor: theme.card,
            borderWidth: 1, borderColor: theme.border, gap: spacing.sm,
          }}>
            <Typography variant="label" color={theme.text} style={{ marginBottom: spacing.xs }}>
              Exam Settings
            </Typography>
            {[
              {
                icon: 'swap-horizontal-outline',
                text: mockTest.settings.sectionSwitching
                  ? 'Section switching is allowed'
                  : 'Section switching is disabled — complete each section in order',
              },
              {
                icon: 'calculator-outline',
                text: mockTest.settings.calculatorAllowed
                  ? 'On-screen calculator is available'
                  : 'No calculator allowed',
              },
              {
                icon: 'time-outline',
                text: 'Timer starts when you tap Start',
              },
            ].map(rule => (
              <View key={rule.text} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Ionicons name={rule.icon as 'time-outline'} size={14} color="#6366f1" style={{ marginTop: 2 }} />
                <Typography variant="body" color={theme.textSecondary} style={{ flex: 1, fontSize: 13 }}>
                  {rule.text}
                </Typography>
              </View>
            ))}
          </View>

          {/* Sections breakdown */}
          <View style={{
            padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.xl,
            backgroundColor: theme.card,
            borderWidth: 1, borderColor: theme.border,
          }}>
            <Typography variant="label" color={theme.text} style={{ marginBottom: spacing.sm }}>
              Section Breakdown
            </Typography>
            {mockTest.sections.map((section, i) => (
              <SectionRow key={section.subjectId} section={section} index={i} />
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      {/* Start button — disabled (backend routes not yet implemented) */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: spacing.lg, paddingBottom: spacing.xl,
        backgroundColor: theme.background,
        borderTopWidth: 1, borderTopColor: theme.border,
      }}>
        {/* "Coming soon" badge */}
        <View style={{
          alignSelf: 'center', marginBottom: spacing.sm,
          paddingHorizontal: spacing.md, paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: 'rgba(251,191,36,0.12)',
          borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
        }}>
          <Typography variant="caption" color="#fbbf24" style={{ fontSize: 11, fontWeight: '600' }}>
            🚧  Mock test taking — launching soon
          </Typography>
        </View>
        <TouchableOpacity
          disabled
          activeOpacity={1}
          style={{
            backgroundColor: '#6366f1', borderRadius: radius.xl,
            paddingVertical: spacing.md + 2,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: spacing.sm,
            opacity: 0.45,
          }}
        >
          <Ionicons name="play" size={18} color="white" />
          <Typography variant="label" color="white">Start Mock Test</Typography>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}
