// ─── stripLatex ───────────────────────────────────────────────
// Converts a LaTeX / markdown string into readable plain text.
// Used as a native-rendered fallback while the WebView loads,
// and as Phase-1 input for the RichTypewriter animation.

/** Strip LaTeX delimiters and common commands for readable plain-text output. */
export function stripLatex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\$\$(.*?)\$\$/gs, '$1')             // $$...$$ → content
    .replace(/\$(.*?)\$/g, '$1')                   // $...$ → content
    .replace(/\\text\{(.*?)\}/g, '$1')             // \text{eV} → eV
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1/$2)') // \frac{a}{b} → (a/b)
    .replace(/\\times/g, '×')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\infty/g, '∞')
    .replace(/\\,/g, ' ')
    .replace(/\\\\/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\^/g, '^')
    .replace(/_/g, '_')
    .replace(/\*\*(.*?)\*\*/g, '$1')              // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')                  // *italic* → italic
    .replace(/^\s*[-*]\s/gm, '• ')               // bullet lists
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Returns true if the text contains LaTeX ($...$, $$...$$) or markdown (bold, italic, lists). */
const HAS_RICH = /\$\$.+?\$\$|\$.+?\$|\*\*.+?\*\*|\*.+?\*|^\s*[-*]\s/ms;
export function isRichContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return HAS_RICH.test(text);
}
