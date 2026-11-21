import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo, type ReactNode } from "react";

/**
 * Renders model/course text safely: plain text stays React text nodes (auto-escaped); only math segments
 * ($...$, $$...$$, \(...\), \[...\]) go through KaTeX, with trust disabled. Also supports **bold** and newlines.
 */
const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "html" });
}

function inlineText(text: string, keyBase: string): ReactNode[] {
  // **bold** + line breaks, everything else as text
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(<strong key={`${keyBase}b${i}`}>{part.slice(2, -2)}</strong>);
    } else {
      part.split("\n").forEach((line, j, arr) => {
        out.push(<Fragment key={`${keyBase}t${i}-${j}`}>{line}</Fragment>);
        if (j < arr.length - 1) out.push(<br key={`${keyBase}br${i}-${j}`} />);
      });
    }
  });
  return out;
}

/** Bare LaTeX the model sometimes emits without delimiters, e.g. "u \cdot v" or "2^{h}". */
const BARE_TEX = /\\(?:cdot|times|frac|sqrt|int|sum|lim|leq|geq|neq|infty|to|alpha|beta|pi|Delta|partial)\b|\^\{|_\{/;

export function Rich({ text, as = "span" }: { text: string | null | undefined; as?: "span" | "div" | "p" }) {
  const nodes = useMemo(() => {
    const src = text ?? "";
    if (!src.includes("$") && !src.includes("\\(") && !src.includes("\\[") && BARE_TEX.test(src) && src.length < 200) {
      return [<span key="bare" dangerouslySetInnerHTML={{ __html: renderMath(src, false) }} />];
    }
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    MATH.lastIndex = 0;
    while ((m = MATH.exec(src))) {
      if (m.index > last) parts.push(...inlineText(src.slice(last, m.index), `p${last}`));
      const display = m[1] !== undefined || m[2] !== undefined;
      const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
      parts.push(<span key={`m${m.index}`} className={display ? "math-block" : undefined} dangerouslySetInnerHTML={{ __html: renderMath(tex, display) }} />);
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push(...inlineText(src.slice(last), `p${last}`));
    return parts;
  }, [text]);
  const Tag = as;
  return <Tag>{nodes}</Tag>;
}
