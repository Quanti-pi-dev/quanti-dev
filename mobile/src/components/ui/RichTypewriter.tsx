// ─── RichTypewriter ───────────────────────────────────────────
// Two-phase typewriter animation for LaTeX / markdown content.
//
// Problem:
//   KaTeX renders into complex nested DOM elements inside a WebView.
//   Injecting character-by-character reveals via injectJavaScript is
//   unreliable (async bridge, no delivery guarantee). Instead:
//
// Solution — Two-phase crossfade:
//   Phase 1 (typing):    TypewriterText types the *stripped* plain-text
//                        version natively. WebView pre-loads invisibly.
//   Phase 2 (crossfade): When typing finishes AND WebView is ready,
//                        a 300 ms Reanimated crossfade swaps layers.
//
// State machine:
//   'idle' → (active=true) → 'typing' → (both ready) → 'crossfading' → 'done'
//
// Edge cases:
//   - WebView still loading when typing finishes → waits for onComplete
//   - CDN failure → stays on stripped text; crossfade skipped
//   - Cache hit → WebView ready before typing finishes; crossfade fires immediately
//   - Card reset (active → false) → full state reset to 'idle'

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TypewriterText } from './TypewriterText';
import { RichContent } from './RichContent';
import { stripLatex } from '../../utils/stripLatex';

// ─── Types ────────────────────────────────────────────────────

type VariantKey =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'body' | 'bodyLarge' | 'bodySmall' | 'bodyBold' | 'bodySemiBold'
  | 'label' | 'labelMedium' | 'caption' | 'captionBold' | 'overline';

type Phase = 'idle' | 'typing' | 'crossfading' | 'done';

interface RichTypewriterProps {
  /** Raw rich text (LaTeX / markdown). */
  children: string;
  variant?: VariantKey;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<ViewStyle>;
  /** When true, begin typing. When false, reset to idle. */
  active?: boolean;
  /** ms per character for Phase 1 (plain-text typing). Default: 16. */
  speed?: number;
  /** ms delay before Phase 1 typing begins. Default: 180. */
  startDelay?: number;
}

// Crossfade duration in ms
const CROSSFADE_MS = 300;

// ─── Component ───────────────────────────────────────────────

export const RichTypewriter = memo(function RichTypewriter({
  children,
  variant = 'bodySmall',
  color,
  align = 'left',
  style,
  active = false,
  speed = 16,
  startDelay = 180,
}: RichTypewriterProps) {
  const [phase, setPhase] = useState<Phase>('idle');

  // Track readiness of each phase independently so we can wait for both
  const typingDoneRef  = useRef(false);
  const webViewDoneRef = useRef(false);

  // Reanimated opacity for each layer
  const stripOpacity = useSharedValue(0); // TypewriterText (Phase 1)
  const richOpacity  = useSharedValue(0); // RichContent WebView (Phase 2)

  // ── Crossfade trigger ──────────────────────────────────────
  // Fires only when BOTH typing and WebView are ready.
  const maybeCrossfade = useCallback(() => {
    if (!typingDoneRef.current || !webViewDoneRef.current) return;
    setPhase('crossfading');
    stripOpacity.value = withTiming(0, { duration: CROSSFADE_MS });
    richOpacity.value = withTiming(1, { duration: CROSSFADE_MS }, (finished) => {
      'worklet';
      if (finished) runOnJS(setPhase)('done');
    });
  }, [stripOpacity, richOpacity]);

  // ── Phase 1: typing complete ───────────────────────────────
  const handleTypingComplete = useCallback(() => {
    typingDoneRef.current = true;
    maybeCrossfade();
  }, [maybeCrossfade]);

  // ── Phase 2: WebView rendered ──────────────────────────────
  const handleWebViewReady = useCallback(() => {
    webViewDoneRef.current = true;
    maybeCrossfade();
  }, [maybeCrossfade]);

  // ── Reset on active change ─────────────────────────────────
  useEffect(() => {
    if (!active) {
      // Reset everything when the card is not active (e.g. new question)
      setPhase('idle');
      typingDoneRef.current = false;
      webViewDoneRef.current = false;
      stripOpacity.value = 0;
      richOpacity.value = 0;
    } else {
      // Begin Phase 1
      setPhase('typing');
      stripOpacity.value = 1;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Stripped text for Phase 1
  const strippedText = stripLatex(children);

  // Animated styles
  const stripStyle = useAnimatedStyle(() => ({ opacity: stripOpacity.value }));
  const richStyle  = useAnimatedStyle(() => ({ opacity: richOpacity.value }));

  // In 'done' state we drop the TypewriterText layer from the tree
  // to free memory and avoid the native text being interactive.
  const isDone = phase === 'done';

  return (
    <View style={[{ position: 'relative' }, style]}>
      {/* ── Layer 1: TypewriterText (Phase 1) ───────────────── */}
      {!isDone && (
        <Animated.View style={[stripStyle, { width: '100%' }]}>
          <TypewriterText
            variant={variant}
            color={color}
            align={align}
            active={phase === 'typing'}
            speed={speed}
            startDelay={startDelay}
            onComplete={handleTypingComplete}
          >
            {strippedText}
          </TypewriterText>
        </Animated.View>
      )}

      {/* ── Layer 2: RichContent WebView (always mounted, pre-warms) ── */}
      {/* Visibility controlled by opacity only — never unmounted after first mount
          so the WebView doesn't have to re-load on crossfade. */}
      <Animated.View
        style={[
          richStyle,
          {
            // Stack on top of Phase 1 during crossfade; sit below during typing
            position: isDone ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            right: 0,
          },
        ]}
        pointerEvents={isDone ? 'auto' : 'none'}
      >
        <RichContent
          variant={variant}
          color={color}
          align={align}
          onReady={handleWebViewReady}
        >
          {children}
        </RichContent>
      </Animated.View>
    </View>
  );
});
