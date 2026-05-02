// ─── RichContent ─────────────────────────────────────────────
// Drop-in replacement for <Typography> that also renders:
//   - LaTeX math via KaTeX auto-render ($...$ and $$...$$)
//   - Basic markdown via marked (bold, italic, bullet lists)
//
// Performance design:
//   - Plain text → native <Typography> (zero WebView overhead)
//   - Rich content → single WebView per section (not per element)
//   - KaTeX + marked are bundled locally (offline-first, zero latency)
//   - WebView reports its rendered height via postMessage for auto-sizing
//   - pointerEvents="none" on WebView so touch events pass to parent

import { useState, useMemo, useCallback } from 'react';
import { View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { useTheme } from '../../theme';
import { typography as tokens } from '../../theme/tokens';
import { Typography } from './Typography';

// ─── Types ────────────────────────────────────────────────────

type VariantKey =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'body' | 'bodyLarge' | 'bodySmall' | 'bodyBold' | 'bodySemiBold'
  | 'label' | 'labelMedium' | 'caption' | 'captionBold' | 'overline';

interface RichContentProps {
  variant?: VariantKey;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Accepts both TextStyle (for Typography fallback) and ViewStyle (for WebView wrapper) */
  style?: StyleProp<TextStyle & ViewStyle>;
  children: string;
}

// ─── Constants ────────────────────────────────────────────────

// Detect LaTeX ($...$ or $$...$$) or markdown (bold, italic, lists)
const HAS_RICH = /\$\$.+?\$\$|\$.+?\$|\*\*.+?\*\*|\*.+?\*|^\s*[-*]\s/ms;

function containsRichContent(text: string): boolean {
  return HAS_RICH.test(text);
}

// Map variant → font size in px (matches Typography token sizes)
const VARIANT_FONT_SIZE: Record<VariantKey, number> = {
  h1: tokens['3xl'],
  h2: tokens['2xl'],
  h3: tokens.xl,
  h4: tokens.lg,
  body: tokens.base,
  bodyLarge: tokens.md,
  bodySmall: tokens.sm,
  bodyBold: tokens.base,
  bodySemiBold: tokens.base,
  label: tokens.sm,
  labelMedium: tokens.xs,
  caption: tokens.xs,
  captionBold: tokens.xs,
  overline: tokens.xs,
};

// Asset paths resolved at runtime to avoid hardcoded paths
// expo-asset ensures these are available even after bundling
const KATEX_JS_PATH = require('../../../assets/katex/katex.min.js');
const KATEX_CSS_PATH = require('../../../assets/katex/katex.min.css');
const AUTO_RENDER_PATH = require('../../../assets/katex/contrib/auto-render.min.js');
const MARKED_PATH = require('../../../assets/marked/marked.min.js');

// ─── HTML Builder ─────────────────────────────────────────────

function buildRichHtml(
  content: string,
  fontSize: number,
  color: string,
  align: string,
  katexJsUri: string,
  katexCssUri: string,
  autoRenderUri: string,
  markedUri: string,
): string {
  // Safely encode content as a JSON string for inline script injection
  const contentJson = JSON.stringify(content);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="${katexCssUri}">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      font-family: -apple-system, system-ui, 'Helvetica Neue', sans-serif;
      font-size: ${fontSize}px;
      color: ${color};
      background: transparent;
      line-height: 1.55;
      text-align: ${align};
      overflow: hidden;
      word-break: break-word;
    }
    .katex { font-size: 1.1em; }
    .katex-display { margin: 6px 0; overflow-x: auto; }
    ul, ol { padding-left: 1.3em; margin: 4px 0; }
    li { margin: 2px 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    p { margin: 0; }
  </style>
</head>
<body>
<script src="${markedUri}"></script>
<script src="${katexJsUri}"></script>
<script src="${autoRenderUri}"></script>
<script>
  (function() {
    var content = ${contentJson};
    // Parse markdown first
    var html = marked.parse(content, { breaks: false, gfm: true });
    document.body.innerHTML = html;
    // Then render math in the resulting DOM
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false }
      ],
      throwOnError: false
    });
    // Report rendered height so React Native can size the View correctly
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'height', value: document.body.scrollHeight })
    );
  })();
</script>
</body>
</html>`;
}

// ─── Component ───────────────────────────────────────────────

export function RichContent({
  variant = 'body',
  color,
  align = 'left',
  style,
  children,
}: RichContentProps) {
  const { theme } = useTheme();

  // Fast-path: plain text → native Typography, zero WebView overhead
  if (!containsRichContent(children)) {
    return (
      // Cast: ViewStyle & TextStyle overlap for common layout props (flex, width, etc.)
      <Typography variant={variant} color={color} align={align} style={style as TextStyle}>
        {children}
      </Typography>
    );
  }

  return (
    <RichWebView
      content={children}
      fontSize={VARIANT_FONT_SIZE[variant] ?? tokens.base}
      color={color ?? theme.text}
      align={align}
      style={style}
    />
  );
}

// ─── Inner WebView (extracted to allow hook usage) ────────────

interface RichWebViewProps {
  content: string;
  fontSize: number;
  color: string;
  align: string;
  style?: StyleProp<TextStyle & ViewStyle>;
}

function RichWebView({ content, fontSize, color, align, style }: RichWebViewProps) {
  const [height, setHeight] = useState(fontSize * 1.55 * 2); // reasonable initial estimate

  // Resolve asset URIs once
  const assetUris = useMemo(() => {
    const katexJs = Asset.fromModule(KATEX_JS_PATH).uri;
    const katexCss = Asset.fromModule(KATEX_CSS_PATH).uri;
    const autoRender = Asset.fromModule(AUTO_RENDER_PATH).uri;
    const marked = Asset.fromModule(MARKED_PATH).uri;
    return { katexJs, katexCss, autoRender, marked };
  }, []);

  const html = useMemo(
    () => buildRichHtml(
      content,
      fontSize,
      color,
      align,
      assetUris.katexJs,
      assetUris.katexCss,
      assetUris.autoRender,
      assetUris.marked,
    ),
    [content, fontSize, color, align, assetUris],
  );

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; value: number };
      if (msg.type === 'height' && msg.value > 0) {
        setHeight(msg.value + 4); // +4px buffer for subpixel rounding
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  return (
    <View style={[{ height, width: '100%' }, style]}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        // pointerEvents="none" so touch events pass through to parent TouchableOpacity
        pointerEvents="none"
        onMessage={handleMessage}
        // Disable all WebView features we don't need
        javaScriptEnabled
        domStorageEnabled={false}
        allowsInlineMediaPlayback={false}
        mediaPlaybackRequiresUserAction
        originWhitelist={['*']}
      />
    </View>
  );
}
