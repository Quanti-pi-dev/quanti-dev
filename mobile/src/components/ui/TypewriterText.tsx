// ─── TypewriterText ───────────────────────────────────────────
// Character-by-character typing animation for premium reveal UX.
//
// Design decisions:
// - Pure JS-driven (setInterval) — Reanimated is only used for
//   the cursor blink, keeping it lightweight.
// - `active` prop controls when typing begins (e.g. after card flip).
// - Splits on Unicode grapheme clusters (via [...text]) for
//   correct emoji / multi-byte character handling.
// - `speed` prop (ms per char) defaults to 18 — fast enough to feel
//   instant, slow enough to read the reveal.
// - Cursor blinks for 2 s after typing completes, then hides.

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleProp, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Typography } from './Typography';
import { useTheme } from '../../theme';

// ─── Types ────────────────────────────────────────────────────

type VariantKey =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'body' | 'bodyLarge' | 'bodySmall' | 'bodyBold' | 'bodySemiBold'
  | 'label' | 'labelMedium' | 'caption' | 'captionBold' | 'overline';

interface TypewriterTextProps {
  /** The full text to reveal. */
  children: string;
  /** Typography variant — forwarded to the underlying Typography component. */
  variant?: VariantKey;
  /** Text color token — forwarded to Typography. */
  color?: string;
  /** Text alignment. */
  align?: 'left' | 'center' | 'right';
  /** Optional extra style. */
  style?: StyleProp<TextStyle>;
  /** When true, begin typing. When false/undefined, nothing is shown. */
  active?: boolean;
  /** Characters per second interval in ms. Default: 18. */
  speed?: number;
  /** Delay before typing starts (ms). Default: 120. */
  startDelay?: number;
  /** Called when typewriter finishes typing all characters. */
  onComplete?: () => void;
}

// ─── Component ───────────────────────────────────────────────

export const TypewriterText = memo(function TypewriterText({
  children,
  variant = 'bodySmall',
  color,
  align = 'left',
  style,
  active = false,
  speed = 18,
  startDelay = 120,
  onComplete,
}: TypewriterTextProps) {
  const { theme } = useTheme();
  const resolvedColor = color ?? theme.textSecondary;
  const cursorColor = color ?? theme.primary;

  // Grapheme-safe char array
  const chars = [...(children ?? '')];
  const total = chars.length;

  const [displayed, setDisplayed] = useState(0);
  const [done, setDone] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // ── Cursor blink animation ──────────────────────────────────
  const cursorOpacity = useSharedValue(0);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const startCursorBlink = useCallback(() => {
    cursorOpacity.value = withDelay(
      startDelay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(1, { duration: 440 }),
          withTiming(0, { duration: 60 }),
          withTiming(0, { duration: 280 }),
        ),
        -1, // infinite
        false,
      ),
    );
  }, [cursorOpacity, startDelay]);

  const stopCursorBlink = useCallback(() => {
    // Fade out cursor 2 s after typing finishes
    cursorOpacity.value = withDelay(2000, withTiming(0, { duration: 300 }));
  }, [cursorOpacity]);

  // ── Typing engine ───────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset whenever text or active state changes
    cleanup();
    setDisplayed(0);
    setDone(false);
    cursorOpacity.value = 0;

    if (!active || total === 0) return;

    startCursorBlink();

    timeoutRef.current = setTimeout(() => {
      let count = 0;

      intervalRef.current = setInterval(() => {
        count += 1;
        setDisplayed(count);

        if (count >= total) {
          cleanup();
          setDone(true);
          stopCursorBlink();
          onCompleteRef.current?.();
        }
      }, speed);
    }, startDelay);

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, children, speed, startDelay]);

  const visibleText = chars.slice(0, displayed).join('');

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Typography
        variant={variant}
        color={resolvedColor}
        align={align}
        style={style as TextStyle}
      >
        {visibleText}
        {/* Inline cursor — rendered as a zero-width space after last char */}
        {!done && (
          <Animated.Text
            style={[
              cursorStyle,
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                color: cursorColor as any,
                fontWeight: '300',
              },
            ]}
          >
            {'\u2502'}{/* │ — thin vertical bar as cursor */}
          </Animated.Text>
        )}
      </Typography>
    </View>
  );
});
