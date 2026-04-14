// ─── Design Tokens ──────────────────────────────────────────
// Quanti-pi theme: whiteboard (light) + blackboard (dark)
// Inspired by real study boards — chalk texture, marker ink

// ─── Raw Palette ─────────────────────────────────────────────

const palette = {
  // Whiteboard surface
  parchment: '#F5F3EE',
  paperWhite: '#FFFFFE',
  warmGray50: '#F7F5F2',
  warmGray100: '#EDE9E3',
  warmGray200: '#D6D0C8',
  warmGray300: '#BDB6AC',
  warmGray400: '#8A847C',    // Darkened for WCAG AA contrast on parchment
  warmGray500: '#7D7770',

  // Blackboard surface
  charcoal: '#1C1C1E',
  deepSlate: '#2C2C2E',
  midSlate: '#3A3A3C',
  slateEdge: '#48484A',

  // Ink / chalk text
  inkDark: '#1A1A1A',
  inkSoft: '#3A3A3A',
  chalkWhite: '#F0EDE8',
  chalkSoft: '#B8B4AE',
  chalkDim: '#908A84',       // Lightened for WCAG AA contrast on charcoal

  // Primary — Blue (marker blue)
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  blue100: '#DBEAFE',
  blue900: '#1E3A5F',

  // Correct — Chalk green
  green400: '#34D399',
  green500: '#10B981',
  green600: '#059669',
  green50: '#ECFDF5',
  green900: '#064E3B',

  // Incorrect — Red chalk
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  red50: '#FEF2F2',
  red900: '#7F1D1D',

  // Skip — Soft blue
  sky400: '#38BDF8',

  // Coin / gamify — Amber
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber100: '#FEF3C7',

  // Stat accents
  indigo500: '#6366F1',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.15)',
} as const;

// ─── Light Theme — Whiteboard ────────────────────────────────

export const lightTheme = {
  // Board surfaces
  background: palette.parchment,
  surface: palette.paperWhite,
  surfaceElevated: palette.paperWhite,
  card: palette.paperWhite,
  cardAlt: palette.warmGray50,

  // Ink text
  text: palette.inkDark,
  textSecondary: palette.inkSoft,
  textTertiary: palette.warmGray400,
  textInverse: palette.chalkWhite,
  textPlaceholder: palette.warmGray300,

  // Primary accent — marker blue
  primary: palette.blue600,
  primaryLight: palette.blue100,
  primaryDark: palette.blue700,
  primaryMuted: 'rgba(37, 99, 235, 0.12)',

  // Borders — thin pencil lines
  border: palette.warmGray200,
  borderLight: palette.warmGray100,
  borderStrong: palette.warmGray300, // FIX U19 — higher contrast for focus rings
  divider: palette.warmGray200,

  // Feedback
  success: palette.green500,
  successLight: palette.green50,
  successMuted: 'rgba(16, 185, 129, 0.12)',
  error: palette.red500,
  errorLight: palette.red50,
  errorMuted: 'rgba(239, 68, 68, 0.12)',
  errorText: palette.red600, // FIX U17 — high-contrast error label
  skip: palette.sky400,

  // Flashcard state glows
  glowCorrect: palette.green400,
  glowWrong: palette.red400,
  glowSkip: palette.blue400,
  glowCorrectBg: 'rgba(52, 211, 153, 0.08)',
  glowWrongBg: 'rgba(248, 113, 113, 0.08)',
  glowSkipBg: 'rgba(56, 189, 248, 0.08)',

  // Gamification
  coin: palette.amber500,
  coinLight: palette.amber100,

  // Buttons
  buttonPrimary: palette.blue600,
  buttonPrimaryText: palette.paperWhite,
  buttonSecondary: palette.warmGray100,
  buttonSecondaryText: palette.inkDark,
  buttonGhost: 'transparent',
  buttonGhostText: palette.blue600,
  buttonDisabled: palette.warmGray200,
  buttonDisabledText: palette.warmGray400,

  // Status bar
  statusBar: 'dark' as const,

  // Shadows — soft, neumorphic
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowInner: 'rgba(255, 255, 255, 0.7)',

  // Tab bar — clean whiteboard
  tabBarBackground: palette.paperWhite,
  tabBarBorder: palette.warmGray200,
  tabBarActive: palette.blue600,
  tabBarInactive: palette.warmGray400,

  // Input
  inputBackground: palette.paperWhite,
  inputBorder: palette.warmGray200,
  inputFocus: palette.blue600,

  // Overlay
  overlay: palette.overlay,
  overlayLight: palette.overlayLight,

  // Stat accent colors (semantic)
  statSolved: palette.indigo500,
  statAccuracy: palette.green500,
  statCoins: palette.amber500,
  statStreak: palette.red500,
} as const;

// ─── Dark Theme — Blackboard ─────────────────────────────────

export const darkTheme = {
  // Board surfaces
  background: palette.charcoal,
  surface: palette.deepSlate,
  surfaceElevated: palette.midSlate,
  card: palette.deepSlate,
  cardAlt: palette.midSlate,

  // Chalk text
  text: palette.chalkWhite,
  textSecondary: palette.chalkSoft,
  textTertiary: palette.chalkDim,
  textInverse: palette.inkDark,
  textPlaceholder: palette.slateEdge,

  // Primary accent — lighter blue for dark
  primary: palette.blue400,
  primaryLight: palette.blue900,
  primaryDark: palette.blue500,
  primaryMuted: 'rgba(96, 165, 250, 0.15)',

  // Borders — chalk strokes
  border: palette.midSlate,
  borderLight: palette.deepSlate,
  borderStrong: palette.slateEdge, // FIX U19
  divider: palette.midSlate,

  // Feedback
  success: palette.green400,
  successLight: 'rgba(52, 211, 153, 0.15)',
  successMuted: 'rgba(52, 211, 153, 0.12)',
  error: palette.red400,
  errorLight: 'rgba(248, 113, 113, 0.15)',
  errorMuted: 'rgba(248, 113, 113, 0.12)',
  errorText: palette.red400, // FIX U17
  skip: palette.sky400,

  // Flashcard state glows
  glowCorrect: palette.green400,
  glowWrong: palette.red400,
  glowSkip: palette.blue400,
  glowCorrectBg: 'rgba(52, 211, 153, 0.12)',
  glowWrongBg: 'rgba(248, 113, 113, 0.12)',
  glowSkipBg: 'rgba(56, 189, 248, 0.12)',

  // Gamification
  coin: palette.amber400,
  coinLight: 'rgba(251, 191, 36, 0.15)',

  // Buttons
  buttonPrimary: palette.blue500,
  buttonPrimaryText: palette.chalkWhite,
  buttonSecondary: palette.midSlate,
  buttonSecondaryText: palette.chalkWhite,
  buttonGhost: 'transparent',
  buttonGhostText: palette.blue400,
  buttonDisabled: palette.slateEdge,
  buttonDisabledText: palette.chalkDim,

  // Status bar
  statusBar: 'light' as const,

  // Shadows — subtle on dark
  shadow: 'rgba(0, 0, 0, 0.4)',
  shadowInner: 'rgba(255, 255, 255, 0.05)',

  // Tab bar — blackboard bottom
  tabBarBackground: palette.deepSlate,
  tabBarBorder: palette.midSlate,
  tabBarActive: palette.blue400,
  tabBarInactive: palette.chalkDim,

  // Input
  inputBackground: palette.deepSlate,
  inputBorder: palette.midSlate,
  inputFocus: palette.blue400,

  // Overlay
  overlay: palette.overlay,
  overlayLight: palette.overlayLight,

  // Stat accent colors (semantic)
  statSolved: palette.indigo500,
  statAccuracy: palette.green400,
  statCoins: palette.amber400,
  statStreak: palette.red400,
} as const;

// ─── Type Exports ─────────────────────────────────────────────

export type Theme = Record<keyof typeof lightTheme, string>;

// ─── Typography ──────────────────────────────────────────────

export const typography = {
  // Font families
  heading: 'PlayfairDisplay_700Bold',
  headingRegular: 'PlayfairDisplay_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',

  // Sizes (pt grid)
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
  '4xl': 48,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ─── Spacing (8-pt grid) ─────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────

export const shadows = {
  xs: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
