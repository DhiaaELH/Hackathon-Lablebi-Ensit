import { useMemo, useState } from "react";
import { useProgress, useRevision } from "../api/hooks";
import type { CourseDetail } from "../api/types";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

/** Plain-code layered layout. Hover a concept to trace what it builds on (ancestors) and what builds on it;
 *  click to jump to its section. Node fill reflects the student's own concept progress. */
export function TopicMap({ course, onOpenSection }: { course: CourseDetail; onOpenSection: (sectionId: string) => void }) {
  const { dir, t } = useI18n();
  const r = useRevision(course.id);
  const progress = useProgress(course.id);
  const [hover, setHover] = useState<string | null>(null);
  const map = r.data?.topic_map;
  const hot = useMemo(() => {
    if (!hover || !map) return new Set<string>();
    const up = new Map<string, string[]>(), down = new Map<string, string[]>();
    map.edges.forEach((e) => { up.set(e.to, [...(up.get(e.to) ?? []), e.from]); down.set(e.from, [...(down.get(e.from) ?? []), e.to]); });
    const out = new Set<string>([hover]);
    const walk = (id: string, g: Map<string, string[]>) => (g.get(id) ?? []).forEach((n) => { if (!out.has(n)) { out.add(n); walk(n, g); } });
    walk(hover, up);
    walk(hover, down);
    return out;
  }, [hover, map]);
  if (r.isLoading) return <Spinner />;
  if (!map?.nodes.length) return <Empty>—</Empty>;
  const score = new Map(progress.data?.concepts.map((c) => [c.concept_id, c.correct / Math.max(1, c.total)]) ?? []);
  const layers = new Map<number, typeof map.nodes>();
  map.nodes.forEach((n) => layers.set(n.layer, [...(layers.get(n.layer) ?? []), n]));
  const colW = 220, rowH = 66, nodeW = 186, nodeH = 42, pad = 24;
  const nCols = Math.max(...map.nodes.map((n) => n.layer)) + 1;
  const nRows = Math.max(...[...layers.values()].map((l) => l.length));
  const width = pad * 2 + nCols * colW - (colW - nodeW), height = pad * 2 + nRows * rowH;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((nodes, layer) => nodes.forEach((n, i) => {
    const col = dir === "rtl" ? nCols - 1 - layer : layer;
    pos.set(n.id, { x: pad + col * colW, y: pad + i * rowH + ((nRows - nodes.length) * rowH) / 2 });
  }));
  const fill = (id: string) => {
    const s = score.get(id);
    if (s === undefined) return "#fffdf8";
    return s >= 0.8 ? "#e5f2e9" : s >= 0.6 ? "#e1efec" : "#f8eedc";
  };
  return (
    <div className="stack">
      <div className="row tiny muted">
        <span className="badge" style={{ background: "#e5f2e9" }}>solid</span><span className="badge" style={{ background: "#e1efec" }}>building</span>
        <span className="badge" style={{ background: "#f8eedc" }}>needs practice</span><span className="badge">not tried</span>
        <span>· hover = prerequisite chain · click = {t("open")}</span>
      </div>
      <div className={`card topic-map${hover ? " focus" : ""}`}>
        <div className="table-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("map")} style={{ minWidth: width, maxWidth: Math.max(width, 640) }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8a948f" /></marker>
            </defs>
            {map.edges.map((e, i) => {
              const a = pos.get(e.from), b = pos.get(e.to);
              if (!a || !b) return null;
              const ltr = dir !== "rtl";
              const x1 = ltr ? a.x + nodeW : a.x, x2 = ltr ? b.x : b.x + nodeW;
              const isHot = hot.has(e.from) && hot.has(e.to);
              return <path key={i} className={`topic-edge${isHot ? " hot" : ""}`} d={`M${x1},${a.y + nodeH / 2} C${(x1 + x2) / 2},${a.y + nodeH / 2} ${(x1 + x2) / 2},${b.y + nodeH / 2} ${x2},${b.y + nodeH / 2}`}
                fill="none" stroke="#b9b2a3" strokeWidth={1.4} markerEnd="url(#arrow)" />;
            })}
            {map.nodes.map((n) => {
              const p = pos.get(n.id)!;
              return (
                <g key={n.id} className={`topic-node${hot.has(n.id) ? " hot" : ""}`} tabIndex={0} role="button" aria-label={n.label}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                  onClick={() => n.section_id && onOpenSection(n.section_id)} onKeyDown={(e) => { if (e.key === "Enter" && n.section_id) onOpenSection(n.section_id); }}>
                  <rect x={p.x} y={p.y} width={nodeW} height={nodeH} rx={10} fill={fill(n.id)} stroke="#0e6b63" strokeWidth={1} />
                  <text x={p.x + nodeW / 2} y={p.y + nodeH / 2 + 4} textAnchor="middle">{n.label.length > 27 ? n.label.slice(0, 26) + "…" : n.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
