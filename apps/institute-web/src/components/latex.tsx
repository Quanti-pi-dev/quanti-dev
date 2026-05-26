import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexProps {
  text: string;
  className?: string;
}

export function Latex({ text, className }: LatexProps) {
  if (!text) return null;

  // Split content by $$ (block/display math) and $ (inline math)
  // The parentheses in the regex capture the delimiters, keeping them in the split array.
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                className="block my-2 overflow-x-auto max-w-full text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={index} className="text-red-400 bg-red-950/30 px-1 py-0.5 rounded text-xs">{part}</code>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                className="inline-block px-1 align-middle"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={index} className="text-red-400 bg-red-950/30 px-1 py-0.5 rounded text-xs">{part}</code>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
