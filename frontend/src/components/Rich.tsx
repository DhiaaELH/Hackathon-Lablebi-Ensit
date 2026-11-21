import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo, type ReactNode } from "react";

/**
 * Renders model/course text safely. Plain text stays React text nodes (auto-escaped); only math goes through KaTeX,
 * with trust disabled. Understands:
 *  - delimited math: $...$, $$...$$, \(...\), \[...\]
 *  - LaTeX the model wrote WITHOUT delimiters ("\mathbb{E}(X) = 0", "Application X : \Omega \to \mathbb{R} associant…"):
 *    a pure formula is rendered whole; formulas inside a sentence are rendered as islands so the words keep their spaces
 *  - **bold** (also around math), "- " / "1. " lists and "### " headings (block mode), line breaks
 * A formula KaTeX cannot parse is shown as monospace source instead of red error text.
 */

// inline $...$ follows the pandoc rule (no space just inside the dollars), so "5 $ et 10 $" stays text
const DELIM = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g;
/** Anything that only makes sense as LaTeX: a command, escaped brace, or a sub/superscript. */
const TEX_HINT = /\\[a-zA-Z]+|\\[{}]|[_^]\{|[A-Za-z0-9)}\]][_^][A-Za-z0-9({\\-]/;
const TEX_CMD = /\\[a-zA-Z]+|\\[{}]/;
/** A whitespace-separated token that is TeX. x^2 / X_{n} count; snake_case words, paths and URLs do not. */
function isTexToken(t: string): boolean {
  if (TEX_CMD.test(t)) return true;
  if (!TEX_HINT.test(t)) return false;
  return !/[A-Za-zÀ-ÿ]{3,}/.test(t.replace(/\{[^{}]*\}/g, "")) && !/:\/\/|\/|@|\.[a-z]{2,4}\b/i.test(t);
}
const hasTex = (s: string) => s.split(/\s+/).some(isTexToken);
/** Pieces of a token that are TeX: \cmd{..}{..} with optional scripts, or x^2 / X_{n} style scripts. */
const TEX_PIECE = /\\[a-zA-Z]+(?:\{[^{}]*\})*(?:[_^](?:\{[^{}]*\}|[A-Za-z0-9]))*|\\[{}]|[A-Za-z0-9()]*[_^](?:\{[^{}]*\}|[A-Za-z0-9-]+)/g;
/** Short words that are prose even though they are short enough to look like a variable. */
const STOP = new Set(("et de la le les un une des du si ou où à en est on il au aux par pour sur que qui ne pas se sa son ses ce cet " +
  "the a an of to in is and or if for be by on as it its at no").split(" "));

function hasLongWord(s: string) {
  // strip commands and \text{...}-like arguments first: their letters are not prose
  const bare = s.replace(/\\(?:text|mathrm|operatorname|textbf|mathbf|mathit)\{[^{}]*\}/g, "").replace(/\\[a-zA-Z]+/g, "");
  return /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/.test(bare);
}

function katexHtml(tex: string, display: boolean): string | null {
  try {
    return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: true, trust: false, strict: "ignore", output: "html" });
  } catch {
    return null;
  }
}

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  const html = katexHtml(tex, display);
  if (html === null) return <code className="tex-raw">{tex.trim()}</code>;
  return <span className={display ? "math-block" : "math"} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Seg = { kind: "text"; s: string } | { kind: "math"; tex: string; display: boolean };

/** Split one undelimited prose string into text and math islands. */
function islands(s: string): Seg[] {
  const tokens = s.split(/(\s+)/);
  type Tok = { t: string; c: "M" | "C" | "W" | "S" };
  const cls: Tok[] = tokens.map((t) => {
    if (!t) return { t, c: "S" };
    if (/^\s+$/.test(t)) return { t, c: "S" };
    if (isTexToken(t)) return { t, c: "M" }; // may still hold a glued word ("\sigma-algèbre"); split below
    const low = t.toLowerCase().replace(/[,.;:!?]+$/, "");
    if (STOP.has(low)) return { t, c: "W" };
    if (/^[=+\-*/<>≤≥≠|:;,()[\]{}]+$/.test(t) || /^[A-Za-z]?\(?[A-Za-z0-9]{1,2}\)?[,;:]?$/.test(t) || /^\d+([.,]\d+)?$/.test(t)) return { t, c: "C" };
    return { t, c: "W" };
  });
  // grow math runs over adjacent connectors
  const inMath = cls.map((x) => x.c === "M");
  for (let i = 0; i < cls.length; i++) {
    if (cls[i].c !== "M") continue;
    for (let j = i - 1; j >= 0 && (cls[j].c === "C" || cls[j].c === "S"); j--) inMath[j] = true;
    for (let j = i + 1; j < cls.length && (cls[j].c === "C" || cls[j].c === "S" || cls[j].c === "M"); j++) inMath[j] = true;
  }
  const out: Seg[] = [];
  const pushText = (t: string) => { if (!t) return; const last = out[out.length - 1]; if (last?.kind === "text") last.s += t; else out.push({ kind: "text", s: t }); };
  let i = 0;
  while (i < cls.length) {
    if (!inMath[i]) { pushText(cls[i].t); i++; continue; }
    let j = i;
    while (j < cls.length && inMath[j]) j++;
    let run = cls.slice(i, j).map((x) => x.t).join("");
    // whitespace and sentence punctuation at the edges stay outside the formula
    const lead = run.match(/^\s*/)![0];
    const trail = run.match(/[\s,.;:]*$/)![0];
    run = run.slice(lead.length, run.length - trail.length);
    pushText(lead);
    if (run) {
      if (hasLongWord(run)) {
        // a word glued to a command ("\sigma-algèbre"): render only the TeX pieces
        let last = 0;
        for (const m of run.matchAll(TEX_PIECE)) {
          pushText(run.slice(last, m.index));
          out.push({ kind: "math", tex: m[0], display: false });
          last = (m.index ?? 0) + m[0].length;
        }
        pushText(run.slice(last));
      } else out.push({ kind: "math", tex: run, display: false });
    }
    pushText(trail);
    i = j;
  }
  return out;
}

/** Delimited math first; undelimited LaTeX inside the remaining text second. */
function segments(src: string, forceMath: boolean): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  DELIM.lastIndex = 0;
  const bare = (s: string) => {
    if (!s) return;
    if (!forceMath && !hasTex(s)) return out.push({ kind: "text", s });
    s.split(/(\n)/).forEach((line) => {
      if (line === "\n" || !line.trim()) return out.push({ kind: "text", s: line });
      if (!hasLongWord(line) && (hasTex(line) || forceMath)) {
        const lead = line.match(/^\s*/)![0], trail = line.match(/\s*$/)![0];
        out.push({ kind: "text", s: lead }, { kind: "math", tex: line.trim(), display: false }, { kind: "text", s: trail });
      } else out.push(...islands(line));
    });
  };
  while ((m = DELIM.exec(src))) {
    bare(src.slice(last, m.index));
    out.push({ kind: "math", tex: m[1] ?? m[2] ?? m[3] ?? m[4] ?? "", display: m[1] !== undefined || m[2] !== undefined });
    last = m.index + m[0].length;
  }
  bare(src.slice(last));
  return out;
}

type Line = { nodes: ReactNode[]; kind: "p" | "ul" | "ol" | "h"; display?: boolean };

function build(src: string, block: boolean, forceMath: boolean): ReactNode[] {
  const lines: Line[] = [{ nodes: [], kind: "p" }];
  let bold = false;
  let n = 0;
  const cur = () => lines[lines.length - 1];
  const add = (node: ReactNode) => cur().nodes.push(bold ? <strong key={`b${n++}`}>{node}</strong> : node);
  const newLine = () => lines.push({ nodes: [], kind: "p" });

  for (const seg of segments(src, forceMath)) {
    if (seg.kind === "math") {
      if (seg.display && block) { if (cur().nodes.length) newLine(); cur().display = true; add(<MathSpan key={`m${n++}`} tex={seg.tex} display />); newLine(); }
      else add(<MathSpan key={`m${n++}`} tex={seg.tex} display={seg.display} />);
      continue;
    }
    seg.s.split("\n").forEach((piece, li) => {
      if (li > 0) newLine();
      let text = piece;
      if (cur().nodes.length === 0) {
        // markers only count at the start of a line
        const ul = text.match(/^\s*[-*•]\s+/), ol = text.match(/^\s*\d{1,2}[.)]\s+/), h = text.match(/^\s*#{1,4}\s+/);
        if (ul) { cur().kind = "ul"; text = text.slice(ul[0].length); }
        else if (ol) { cur().kind = "ol"; text = text.slice(ol[0].length); }
        else if (h) { cur().kind = "h"; text = text.slice(h[0].length); }
      }
      text.split("**").forEach((part, bi) => {
        if (bi > 0) bold = !bold;
        if (part && !(cur().nodes.length === 0 && !part.trim())) add(<Fragment key={`t${n++}`}>{part}</Fragment>);
      });
    });
  }
  // an unmatched ** should not bold the rest of the text: drop the trailing state silently (already rendered)
  const used = lines.filter((l, i) => l.nodes.length || (i > 0 && i < lines.length - 1));

  if (!block) {
    const out: ReactNode[] = [];
    used.forEach((l, i) => {
      if (i > 0) out.push(<br key={`br${i}`} />);
      if (l.kind === "ul") out.push(<Fragment key={`u${i}`}>• </Fragment>);
      if (l.kind === "ol") out.push(<Fragment key={`o${i}`}>{"– "}</Fragment>);
      out.push(l.kind === "h" ? <strong key={`h${i}`}>{l.nodes}</strong> : <Fragment key={`l${i}`}>{l.nodes}</Fragment>);
    });
    return out;
  }
  // block mode: group consecutive list lines, keep other lines as paragraphs separated by <br/> (blank line = gap)
  const out: ReactNode[] = [];
  let i = 0;
  while (i < used.length) {
    const l = used[i];
    if (l.kind === "ul" || l.kind === "ol") {
      const items: ReactNode[] = [];
      const kind = l.kind;
      while (i < used.length && used[i].kind === kind) { items.push(<li key={`li${i}`}>{used[i].nodes}</li>); i++; }
      out.push(kind === "ul" ? <ul key={`ul${i}`} className="rich-list">{items}</ul> : <ol key={`ol${i}`} className="rich-list">{items}</ol>);
      continue;
    }
    if (l.kind === "h") out.push(<strong key={`h${i}`} className="rich-h">{l.nodes}</strong>);
    else if (l.display) out.push(<Fragment key={`d${i}`}>{l.nodes}</Fragment>);
    else if (!l.nodes.length) out.push(<span key={`gap${i}`} className="rich-gap" />);
    else out.push(<span key={`p${i}`} className="rich-line">{l.nodes}</span>);
    i++;
  }
  return out;
}

/**
 * @param math  the field is always a formula (e.g. a formula's expression): render it as math even without delimiters
 */
export function Rich({ text, as = "span", math = false, className }: { text: string | null | undefined; as?: "span" | "div" | "p"; math?: boolean; className?: string }) {
  const block = as !== "span";
  const nodes = useMemo(() => build(text ?? "", block, math), [text, block, math]);
  const Tag = as;
  // dir="auto": French/English course text keeps its own direction inside the Arabic UI (and vice versa)
  return <Tag dir="auto" className={[block ? "rich" : undefined, className].filter(Boolean).join(" ") || undefined}>{nodes}</Tag>;
}

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π",
  sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", varphi: "φ", omega: "ω", Omega: "Ω", infty: "∞", to: "→", rightarrow: "→", mapsto: "↦",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", times: "×", cdot: "·", in: "∈", notin: "∉", subset: "⊂",
  cup: "∪", cap: "∩", forall: "∀", exists: "∃", sum: "Σ", prod: "Π", int: "∫", partial: "∂", emptyset: "∅", dots: "…", ldots: "…",
  bigcup: "⋃", bigcap: "⋂", sqrt: "√", pm: "±", mid: "|", quad: " ", ",": " ",
};
const BB: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", E: "𝔼" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", n: "ⁿ", "-": "⁻", "+": "⁺" };

/** Readable plain text for places that cannot hold HTML (SVG labels, <option>, title/aria attributes). */
export function texToPlain(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/\$\$|\$|\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\mathbb\{(\w)\}/g, (_, c: string) => BB[c] ?? c)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\(?:text|mathrm|mathcal|mathbf|mathit|operatorname|textbf|mathscr)\{([^{}]*)\}/g, "$1")
    .replace(/\\left|\\right/g, "")
    .replace(/\\([a-zA-Z]+|,)/g, (m, c: string) => SYMBOLS[c] ?? m.slice(1))
    .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_m, a: string | undefined, b: string | undefined) => {
      const x = a ?? b ?? "";
      return [...x].every((ch) => SUP[ch]) ? [...x].map((ch) => SUP[ch]).join("") : `^${x}`;
    })
    .replace(/_\{([^{}]*)\}/g, "$1").replace(/\\\{|\\\}/g, (b) => b[1]).replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
