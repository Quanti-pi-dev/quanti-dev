// ─── RichContent ─────────────────────────────────────────────
// Drop-in replacement for <Typography> that also renders:
//   - LaTeX math via KaTeX auto-render ($...$ and $$...$$)
//   - Basic markdown via marked (bold, italic, bullet lists)
//
// Performance design:
//   - Plain text → native <Typography> (zero WebView overhead)
//   - Rich content → single WebView per section (not per element)
//   - KaTeX + marked are loaded via CDN (WebView requires internet for AI anyway)
//   - WebView reports its rendered height via postMessage for auto-sizing
//   - pointerEvents="none" on WebView so touch events pass to parent
//
// Resilience:
//   - Shows stripped-text immediately (native Typography) while WebView loads.
//   - If CDN resources fail or WebView doesn't render within a timeout,
//     the native fallback remains visible. No blank/empty display ever.
//   - Once WebView renders successfully, it fades in and replaces the fallback.
//   - Prevents blank/empty card display on network issues.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { WebView } from 'react-native-webview';
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
  if (!text || typeof text !== 'string') return false;
  return HAS_RICH.test(text);
}

/** Strip LaTeX $ delimiters for readable plain-text fallback. */
function stripLatex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\$\$(.*?)\$\$/gs, '$1')   // $$...$$ → content
    .replace(/\$(.*?)\$/g, '$1')         // $...$ → content
    .replace(/\\text\{(.*?)\}/g, '$1')   // \text{eV} → eV
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1/$2)')  // \frac{a}{b} → (a/b)
    .replace(/\\times/g, '×')           // \times → ×
    .replace(/\\pm/g, '±')              // \pm → ±
    .replace(/\\leq/g, '≤')             // \leq → ≤
    .replace(/\\geq/g, '≥')             // \geq → ≥
    .replace(/\\neq/g, '≠')             // \neq → ≠
    .replace(/\\rightarrow/g, '→')      // \rightarrow → →
    .replace(/\\lambda/g, 'λ')          // \lambda → λ
    .replace(/\\nu/g, 'ν')              // \nu → ν
    .replace(/\\pi/g, 'π')              // \pi → π
    .replace(/\\alpha/g, 'α')           // \alpha → α
    .replace(/\\beta/g, 'β')            // \beta → β
    .replace(/\\gamma/g, 'γ')           // \gamma → γ
    .replace(/\\theta/g, 'θ')           // \theta → θ
    .replace(/\\omega/g, 'ω')           // \omega → ω
    .replace(/\\Delta/g, 'Δ')           // \Delta → Δ
    .replace(/\\infty/g, '∞')           // \infty → ∞
    .replace(/\\\,/g, ' ')              // thin space → space
    .replace(/\\\\/g, '')               // stray backslashes
    .replace(/\\([a-zA-Z]+)/g, '$1')    // remaining \commands → just the name
    .replace(/[{}]/g, '')               // remove braces
    .replace(/\^/g, '^')                // keep carets readable
    .replace(/_/g, '_')                 // keep underscores readable
    .replace(/\s{2,}/g, ' ')            // collapse multiple spaces
    .trim();
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

/** How long to wait for the WebView to report its height before giving up. */
const WEBVIEW_TIMEOUT_MS = 8000;

// CDN URLs for KaTeX and marked.
const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css';
const KATEX_JS  = 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js';
const AUTO_RENDER_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js';
const MARKED_JS = 'https://cdn.jsdelivr.net/npm/marked@15/marked.min.js';

// ─── HTML Builder ─────────────────────────────────────────────

function buildRichHtml(
  content: string,
  fontSize: number,
  color: string,
  align: string,
): string {
  const contentJson = JSON.stringify(content);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="${KATEX_CSS}">
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
    /* Hide MathML immediately to prevent "ghosting" while CDN CSS loads */
    .katex-mathml { display: none; }
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
<div id="wrapper"></div>
<script src="${MARKED_JS}"></script>
<script src="${KATEX_JS}"></script>
<script src="${AUTO_RENDER_JS}"></script>
<script>
  (function() {
    // Escape HTML entities for safe display when marked is unavailable
    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    try {
      var content = ${contentJson};
      var wrapper = document.getElementById('wrapper');

      // Graceful degradation: if marked failed to load, render escaped text
      var html;
      if (typeof marked !== 'undefined' && marked.parse) {
        // Configure marked to NOT render raw HTML from input (e.g. Gemini output).
        // This prevents layout-breaking tags like <div>, <table>, <script> etc.
        var renderer = new marked.Renderer();
        renderer.html = function(token) { return escapeHtml(typeof token === 'string' ? token : (token.text || '')); };
        html = marked.parse(content, { breaks: false, gfm: true, renderer: renderer });
      } else {
        html = '<p>' + escapeHtml(content).replace(/\\n/g, '<br>') + '</p>';
      }
      wrapper.innerHTML = html;

      // Graceful degradation: only render math if KaTeX loaded
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(wrapper, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$',  right: '$',  display: false }
          ],
          throwOnError: false
        });
      }

      // Send height after a small delay to ensure rendering and font-loading are complete
      setTimeout(function() {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'height', value: wrapper.offsetHeight })
        );
      }, 80);
    } catch(e) {
      // Last resort: show raw content safely and report a fallback height
      var wrapper = document.getElementById('wrapper');
      if (wrapper) {
        wrapper.textContent = ${contentJson};
        setTimeout(function() {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'height', value: wrapper.offsetHeight })
          );
        }, 80);
      }
    }
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

  // Guard: null, undefined, or non-string children → render nothing
  if (!children || typeof children !== 'string') {
    return null;
  }

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
      variant={variant}
      fontSize={VARIANT_FONT_SIZE[variant] ?? tokens.base}
      color={color}
      align={align}
      style={style}
    />
  );
}

// ─── Inner WebView (extracted to allow hook usage) ────────────

interface RichWebViewProps {
  content: string;
  variant?: VariantKey;
  fontSize: number;
  color?: string;
  align: string;
  style?: StyleProp<TextStyle & ViewStyle>;
}

function RichWebView({ content, variant, fontSize, color, align, style }: RichWebViewProps) {
  const { theme } = useTheme();
  const resolvedColor = color ?? theme.text;
  const [webViewHeight, setWebViewHeight] = useState(0);
  const [hasRendered, setHasRendered] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirrors hasRendered to avoid stale closures in the timeout callback
  const hasRenderedRef = useRef(false);

  // Timeout: if WebView doesn't report height within WEBVIEW_TIMEOUT_MS,
  // mark as failed so we permanently show the native fallback.
  useEffect(() => {
    hasRenderedRef.current = false;
    setHasRendered(false);
    setHasFailed(false);

    timeoutRef.current = setTimeout(() => {
      if (!hasRenderedRef.current) {
        setHasFailed(true);
      }
    }, WEBVIEW_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content]); // reset on content change

  const html = useMemo(
    () => buildRichHtml(content, fontSize, resolvedColor, align),
    [content, fontSize, resolvedColor, align],
  );

  const source = useMemo(() => ({ html }), [html]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; value: number };
      if (msg.type === 'height' && msg.value > 0) {
        setWebViewHeight(msg.value + 4);
        setHasRendered(true);
        hasRenderedRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  const handleError = useCallback(() => {
    setHasFailed(true);
  }, []);

  // --- Stripped-text fallback (always present as baseline) ---
  const fallbackText = useMemo(() => stripLatex(content), [content]);

  // If WebView has permanently failed, show only native text
  if (hasFailed) {
    return (
      <Typography
        variant={variant ?? 'body'}
        color={color}
        align={align as 'left' | 'center' | 'right'}
        style={style as TextStyle}
      >
        {fallbackText}
      </Typography>
    );
  }

  return (
    <View style={[{ width: '100%' }, style]}>
      {/* Native text fallback — always visible until WebView is ready.
          This guarantees the user NEVER sees a blank card. */}
      {!hasRendered && (
        <Typography
          variant={variant ?? 'body'}
          color={color}
          align={align as 'left' | 'center' | 'right'}
        >
          {fallbackText}
        </Typography>
      )}

      {/* WebView — hidden (0 height) until it reports its rendered height.
          Once ready, it replaces the native fallback. */}
      <View style={{ height: hasRendered ? webViewHeight : 0, overflow: 'hidden' }}>
        <WebView
          source={source}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          // pointerEvents="none" so touch events pass through to parent TouchableOpacity
          pointerEvents="none"
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleError}
          // Disable all WebView features we don't need
          javaScriptEnabled
          domStorageEnabled={false}
          allowsInlineMediaPlayback={false}
          mediaPlaybackRequiresUserAction
          originWhitelist={['*']}
        />
      </View>
    </View>
  );
}
