import { useRevision } from "../api/hooks";
import type { CourseDetail } from "../api/types";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

/** Plain-code SVG layout: one column per prerequisite depth, edges point from prerequisite to concept. */
export function TopicMap({ course }: { course: CourseDetail }) {
  const { dir } = useI18n();
  const r = useRevision(course.id);
  if (r.isLoading) return <Spinner />;
  const map = r.data?.topic_map;
  if (!map?.nodes.length) return <Empty>—</Empty>;
  const layers = new Map<number, typeof map.nodes>();
  map.nodes.forEach((n) => layers.set(n.layer, [...(layers.get(n.layer) ?? []), n]));
  const colW = 210, rowH = 64, nodeW = 180, nodeH = 40, pad = 20;
  const nCols = Math.max(...map.nodes.map((n) => n.layer)) + 1;
  const nRows = Math.max(...[...layers.values()].map((l) => l.length));
  const width = pad * 2 + nCols * colW, height = pad * 2 + nRows * rowH;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((nodes, layer) =>
    nodes.forEach((n, i) => {
      const col = dir === "rtl" ? nCols - 1 - layer : layer;
      pos.set(n.id, { x: pad + col * colW, y: pad + i * rowH + ((nRows - nodes.length) * rowH) / 2 });
    }),
  );
  return (
    <div className="card topic-map">
      <div className="table-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Topic map" style={{ minWidth: Math.min(width, 900) }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8a948f" />
            </marker>
          </defs>
          {map.edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const ltr = dir !== "rtl";
            const x1 = ltr ? a.x + nodeW : a.x, x2 = ltr ? b.x : b.x + nodeW;
            return <path key={i} d={`M${x1},${a.y + nodeH / 2} C${(x1 + x2) / 2},${a.y + nodeH / 2} ${(x1 + x2) / 2},${b.y + nodeH / 2} ${x2},${b.y + nodeH / 2}`}
              fill="none" stroke="#b9c1bc" strokeWidth={1.5} markerEnd="url(#arrow)" />;
          })}
          {map.nodes.map((n) => {
            const p = pos.get(n.id)!;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={nodeW} height={nodeH} rx={8} fill="#e3f1ef" stroke="#0f766e" strokeWidth={1} />
                <text x={p.x + nodeW / 2} y={p.y + nodeH / 2 + 4} textAnchor="middle">{n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
