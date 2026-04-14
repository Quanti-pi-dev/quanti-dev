// ─── Typography ──────────────────────────────────────────────
// Semantic text component. Heading variants use Playfair (serif),
// body/label/caption variants use Inter (sans-serif).


import { Text, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { typography } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────

type VariantKey =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'body' | 'bodyLarge' | 'bodySmall' | 'bodyBold' | 'bodySemiBold'
  | 'label' | 'labelMedium' | 'caption' | 'captionBold' | 'overline';

interface TypographyProps {
  variant?: VariantKey;
  color?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: TextStyle;
  children: React.ReactNode;
}

// ─── Variant Styles ───────────────────────────────────────────

const variantStyles: Record<VariantKey, TextStyle> = {
  h1: {
    fontFamily: typography.heading,
    fontSize: typography['3xl'],
    lineHeight: typography['3xl'] * typography.tight,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: typography.heading,
    fontSize: typography['2xl'],
    lineHeight: typography['2xl'] * typography.tight,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: typography.heading,
    fontSize: typography.xl,
    lineHeight: typography.xl * typography.tight,
  },
  h4: {
    fontFamily: typography.headingRegular,
    fontSize: typography.lg,
    lineHeight: typography.lg * typography.normal,
  },
  body: {
    fontFamily: typography.body,
    fontSize: typography.base,
    lineHeight: typography.base * typography.normal,
  },
  bodyLarge: {
    fontFamily: typography.body,
    fontSize: typography.md,
    lineHeight: typography.md * typography.normal,
  },
  bodySmall: {
    fontFamily: typography.body,
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.normal,
  },
  bodyBold: {
    fontFamily: typography.bodyBold,
    fontSize: typography.base,
    lineHeight: typography.base * typography.normal,
  },
  bodySemiBold: {
    fontFamily: typography.bodySemiBold,
    fontSize: typography.base,
    lineHeight: typography.base * typography.normal,
  },
  label: {
    fontFamily: typography.bodySemiBold,
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.normal,
    letterSpacing: 0.2,
  },
  labelMedium: {
    fontFamily: typography.bodyMedium,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.normal,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: typography.body,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.relaxed,
  },
  captionBold: {
    fontFamily: typography.bodySemiBold,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.relaxed,
  },
  overline: {
    fontFamily: typography.bodySemiBold,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.normal,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};

// ─── Component ───────────────────────────────────────────────

export function Typography({
  variant = 'body',
  color,
  align = 'left',
  numberOfLines,
  style,
  children,
}: TypographyProps) {
  const { theme } = useTheme();

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        variantStyles[variant],
        { color: color ?? theme.text, textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
