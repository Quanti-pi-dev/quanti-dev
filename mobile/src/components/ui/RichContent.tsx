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

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { typography as tokens } from '../../theme/tokens';
import { Typography } from './Typography';
import { TypewriterText } from './TypewriterText';
import { stripLatex, isRichContent } from '../../utils/stripLatex';

// ─── Global Height Cache ──────────────────────────────────────
// Once a piece of content has been rendered and measured, cache
// its height so re-visits (back navigation, re-render) skip the
// measurement delay entirely. Keyed by content hash.
const heightCache = new Map<string, number>();

function getContentKey(content: string, fontSize: number): string {
  // Simple hash — content + fontSize is unique enough
  return `${fontSize}:${content.slice(0, 200)}:${content.length}`;
}

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
  /**
   * Called once the WebView has fully rendered and measured its content.
   */
  onReady?: () => void;
  typewriter?: boolean;
  active?: boolean;
  speed?: number;
  startDelay?: number;
  onComplete?: () => void;
}

// ─── Constants ────────────────────────────────────────────────


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
  typewriter: boolean = false,
  speed: number = 18,
  startDelay: number = 120,
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
    @keyframes blink {
      0%, 100% { box-shadow: 2px 0 0 0 ${color}; }
      50% { box-shadow: none; }
    }
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

      if (typeof renderMathInElement === 'function') {
        renderMathInElement(wrapper, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$',  right: '$',  display: false }
          ],
          throwOnError: false
        });
      }

      var isTypewriter = ${JSON.stringify(typewriter)};
      var speed = ${JSON.stringify(speed)};
      var startDelay = ${JSON.stringify(startDelay)};
      
      var leaves = [];
      if (isTypewriter) {
        function traverse(node) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.classList.contains('katex') || node.tagName.toLowerCase() === 'img' || node.tagName.toLowerCase() === 'svg') {
              node.style.opacity = '0';
              node.style.transition = 'opacity 0.2s ease-in';
              leaves.push(node);
              return;
            }
            var children = Array.from(node.childNodes);
            for (var i = 0; i < children.length; i++) {
              traverse(children[i]);
            }
          } else if (node.nodeType === 3) { // TEXT_NODE
            var text = node.textContent;
            var fragment = document.createDocumentFragment();
            var chars = Array.from(text);
            for (var i = 0; i < chars.length; i++) {
              var char = chars[i];
              if (char.trim() === '') {
                fragment.appendChild(document.createTextNode(char));
              } else {
                var span = document.createElement('span');
                span.textContent = char;
                span.style.opacity = '0';
                fragment.appendChild(span);
                leaves.push(span);
              }
            }
            node.parentNode.replaceChild(fragment, node);
          }
        }
        traverse(wrapper);
        
        var currentIndex = 0;
        var intervalId = null;
        var hasStarted = false;
        
        window.startTypewriter = function() {
          if (hasStarted) return;
          hasStarted = true;
          
          setTimeout(function() {
            intervalId = setInterval(function() {
              if (currentIndex > 0 && currentIndex <= leaves.length) {
                var prev = leaves[currentIndex - 1];
                if (prev) prev.style.boxShadow = 'none';
              }
              
              if (currentIndex >= leaves.length) {
                clearInterval(intervalId);
                var lastTextLeaf = null;
                for (var j = leaves.length - 1; j >= 0; j--) {
                  if (leaves[j].tagName.toLowerCase() === 'span' && !leaves[j].classList.contains('katex')) {
                    lastTextLeaf = leaves[j];
                    break;
                  }
                }
                if (lastTextLeaf) {
                  lastTextLeaf.style.animation = 'blink 1s step-start infinite';
                  setTimeout(function() {
                    lastTextLeaf.style.animation = 'none';
                    lastTextLeaf.style.boxShadow = 'none';
                  }, 2000);
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'complete' }));
                return;
              }
              
              var leaf = leaves[currentIndex];
              if (leaf) {
                leaf.style.opacity = '1';
                if (leaf.tagName.toLowerCase() === 'span' && !leaf.classList.contains('katex')) {
                  leaf.style.boxShadow = '2px 0 0 0 ' + ${JSON.stringify(color)};
                }
              }
              
              currentIndex++;
            }, speed);
          }, startDelay);
        };
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

export const RichContent = memo(function RichContent({
  variant = 'body',
  color,
  align = 'left',
  style,
  children,
  onReady,
  typewriter = false,
  active = false,
  speed = 18,
  startDelay = 120,
  onComplete,
}: RichContentProps) {
  const { theme } = useTheme();

  // Determine if content needs WebView — must be computed before any hooks
  const validChildren = children && typeof children === 'string' ? children : null;
  const isRich = validChildren ? isRichContent(validChildren) : false;

  // ⚠️ All hooks must be called unconditionally (Rules of Hooks).
  // For the plain-text fast-path, signal onReady on next tick.
  useEffect(() => {
    if (validChildren && !isRich) {
      onReady?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady, isRich, validChildren]);

  // Guard: null, undefined, or non-string children → render nothing
  if (!validChildren) return null;

  // Fast-path: plain text → native Typography, zero WebView overhead
  if (!isRich) {
    if (typewriter) {
      return (
        <TypewriterText
          variant={variant ?? 'body'}
          color={color}
          align={align as 'left' | 'center' | 'right'}
          style={style as TextStyle}
          active={active}
          speed={speed}
          startDelay={startDelay}
          onComplete={onComplete}
        >
          {stripLatex(validChildren)}
        </TypewriterText>
      );
    }

    return (
      <Typography variant={variant} color={color} align={align} style={style as TextStyle}>
        {stripLatex(validChildren)}
      </Typography>
    );
  }

  return (
    <RichWebView
      content={validChildren}
      variant={variant}
      fontSize={VARIANT_FONT_SIZE[variant] ?? tokens.base}
      color={color}
      align={align}
      style={style}
      onReady={onReady}
      typewriter={typewriter}
      active={active}
      speed={speed}
      startDelay={startDelay}
      onComplete={onComplete}
    />
  );
});

// ─── Inner WebView (extracted to allow hook usage) ────────────

interface RichWebViewProps {
  content: string;
  variant?: VariantKey;
  fontSize: number;
  color?: string;
  align: string;
  style?: StyleProp<TextStyle & ViewStyle>;
  /** Forwarded from RichContentProps — called when WebView reports its height. */
  onReady?: () => void;
  typewriter?: boolean;
  active?: boolean;
  speed?: number;
  startDelay?: number;
  onComplete?: () => void;
}

function RichWebView({
  content, variant, fontSize, color, align, style, onReady,
  typewriter, active, speed, startDelay, onComplete
}: RichWebViewProps) {
  const { theme } = useTheme();
  const resolvedColor = color ?? theme.text;

  // PERF: Check height cache for instant render on revisit.
  // Include typewriter in the key — a typewriter render has DOM traversal applied;
  // a static render does not. Mixing them would produce wrong height cache hits.
  const cacheKey = `${typewriter ? 'tw' : 'st'}:${getContentKey(content, fontSize)}`;
  const cachedHeight = heightCache.get(cacheKey);

  const [webViewHeight, setWebViewHeight] = useState(cachedHeight ?? 0);
  const [hasRendered, setHasRendered] = useState(!!cachedHeight);
  const [hasFailed, setHasFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirrors hasRendered to avoid stale closures in the timeout callback
  const hasRenderedRef = useRef(!!cachedHeight);

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
    () => buildRichHtml(content, fontSize, resolvedColor, align, !!typewriter, speed ?? 18, startDelay ?? 120),
    [content, fontSize, resolvedColor, align, typewriter, speed, startDelay],
  );

  const source = useMemo(() => ({ html }), [html]);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Use ref for onComplete too — consistent with onReady pattern, avoids
  // recreating handleMessage on every parent re-render.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (typewriter && active && hasRendered) {
      webViewRef.current?.injectJavaScript('window.startTypewriter && window.startTypewriter(); true;');
    }
  }, [typewriter, active, hasRendered]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; value: number };
      if (msg.type === 'height' && msg.value > 0) {
        const h = msg.value + 4;
        setWebViewHeight(h);
        setHasRendered(true);
        hasRenderedRef.current = true;
        // PERF: Cache height for instant render on revisit
        heightCache.set(cacheKey, h);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onReadyRef.current?.();
      } else if (msg.type === 'complete') {
        onCompleteRef.current?.();
      }
    } catch {
      // ignore malformed messages
    }
  }, [cacheKey]);

  const handleError = useCallback(() => {
    setHasFailed(true);
  }, []);

  // --- Stripped-text fallback (always present as baseline) ---
  const fallbackText = useMemo(() => stripLatex(content), [content]);

  // If WebView has permanently failed, show only native text
  if (hasFailed) {
    if (typewriter) {
      return (
        <TypewriterText
          variant={variant ?? 'body'}
          color={color}
          align={align as 'left' | 'center' | 'right'}
          style={style as TextStyle}
          active={active}
          speed={speed}
          startDelay={startDelay}
          onComplete={onComplete}
        >
          {fallbackText}
        </TypewriterText>
      );
    }
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
      {!hasRendered && !typewriter && (
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
          ref={webViewRef}
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
          // PERF: Cache CDN resources (KaTeX, marked) on disk after first load.
          // Eliminates ~200-500ms network overhead per card after the first one.
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
        />
      </View>
    </View>
  );
}
