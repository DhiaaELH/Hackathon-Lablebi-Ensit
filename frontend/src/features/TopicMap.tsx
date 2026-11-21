import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useProgress, useRevision } from "../api/hooks";
import type { CourseDetail } from "../api/types";
import { Icon } from "../components/Icon";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { Rich, texToPlain } from "../components/Rich";

/** Split a label into at most two lines of ~maxChars, breaking on spaces; the second line gets an ellipsis if still too long. */
function wrapLabel(label: string, maxChars = 24): string[] {
  if (label.length <= maxChars) return [label];
  const words = label.split(" ");
  let first = "";
  while (words.length && (first + " " + words[0]).trim().length <= maxChars) first = (first + " " + words.shift()).trim();
  if (!first) first = words.shift() ?? "";
  let second = words.join(" ");
  if (second.length > maxChars) second = second.slice(0, maxChars - 1).trimEnd() + "…";
  return second ? [first, second] : [first];
}

interface Node { id: string; label: string; section_id: string | null }
interface Edge { from: string; to: string }

const COL_W = 200, ROW_H = 60, NODE_W = 170, NODE_H = 46, PAD = 16, MAX_ROWS = 7;
const MIN_ZOOM = 0.4, MAX_ZOOM = 1.8, MIN_FIT = 0.75;
const FILL = { solid: "#e5f2e9", building: "#e1efec", practice: "#f8eedc", none: "#fffdf8" };

/** Columns = prerequisite depth inside the visible subset; a crowded depth is split over several columns so no column gets taller than MAX_ROWS. */
function layout(nodes: Node[], edges: Edge[], rtl: boolean) {
  const ids = new Set(nodes.map((n) => n.id));
  const pre = new Map<string, string[]>();
  edges.forEach((e) => { if (ids.has(e.from) && ids.has(e.to)) pre.set(e.to, [...(pre.get(e.to) ?? []), e.from]); });
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const d = Math.max(-1, ...(pre.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  const byDepth = new Map<number, Node[]>();
  nodes.forEach((n) => { const d = depthOf(n.id); byDepth.set(d, [...(byDepth.get(d) ?? []), n]); });
  const columns: Node[][] = [];
  [...byDepth.keys()].sort((a, b) => a - b).forEach((d) => {
    const group = byDepth.get(d)!;
    const parts = Math.ceil(group.length / MAX_ROWS), size = Math.ceil(group.length / parts);
    for (let i = 0; i < parts; i++) columns.push(group.slice(i * size, (i + 1) * size));
  });
  const nRows = Math.max(1, ...columns.map((c) => c.length));
  const width = PAD * 2 + columns.length * COL_W - (COL_W - NODE_W), height = PAD * 2 + nRows * ROW_H - (ROW_H - NODE_H);
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((col, ci) => col.forEach((n, i) => {
    const c = rtl ? columns.length - 1 - ci : ci;
    pos.set(n.id, { x: PAD + c * COL_W, y: PAD + i * ROW_H + ((nRows - col.length) * ROW_H) / 2 });
  }));
  return { pos, width, height };
}

/** Concept map of the course. Filter by chapter to keep it readable, zoom / drag / go full screen to move around,
 *  or switch to a plain list. Selecting a concept shows what it builds on and what it leads to. */
export function TopicMap({ course, onOpenSection }: { course: CourseDetail; onOpenSection: (sectionId: string) => void }) {
  const { dir, t } = useI18n();
  const r = useRevision(course.id);
  const progress = useProgress(course.id);
  const map = r.data?.topic_map;
  const [view, setView] = useState<"map" | "list" | null>(null);
  const [chapter, setChapter] = useState("all");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit to the viewport
  const [full, setFull] = useState(false);
  const [boxW, setBoxW] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  const chapterOf = useMemo(() => {
    const m = new Map<string, string>();
    course.chapters.forEach((ch) => ch.sections.forEach((s) => m.set(s.id, ch.id)));
    return m;
  }, [course.chapters]);
  const nodes = useMemo(
    () => (map?.nodes ?? []).filter((n) => chapter === "all" || (n.section_id && chapterOf.get(n.section_id) === chapter)),
    [map, chapter, chapterOf],
  );
  const rtl = dir === "rtl";
  const lay = useMemo(() => layout(nodes, map?.edges ?? [], rtl), [nodes, map, rtl]);
  const links = useMemo(() => {
    const up = new Map<string, string[]>(), down = new Map<string, string[]>();
    (map?.edges ?? []).forEach((e) => { up.set(e.to, [...(up.get(e.to) ?? []), e.from]); down.set(e.from, [...(down.get(e.from) ?? []), e.to]); });
    return { up, down };
  }, [map]);
  const focus = hover ?? selected;
  const hot = useMemo(() => {
    const out = new Set<string>();
    if (focus) {
      out.add(focus);
      const walk = (id: string, g: Map<string, string[]>) => (g.get(id) ?? []).forEach((n) => { if (!out.has(n)) { out.add(n); walk(n, g); } });
      walk(focus, links.up);
      walk(focus, links.down);
    } else if (query.trim()) {
      const q = query.trim().toLowerCase();
      nodes.forEach((n) => { if (texToPlain(n.label).toLowerCase().includes(q)) out.add(n.id); });
    }
    return out;
  }, [focus, links, query, nodes]);

  const mode = view ?? (typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches && (map?.nodes.length ?? 0) > 12 ? "list" : "map");
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, full, r.isLoading]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [full]);

  if (r.isLoading) return <Spinner />;
  if (!map?.nodes.length) return <Empty>—</Empty>;

  const fit = boxW ? Math.min(1, Math.max(MIN_FIT, boxW / lay.width)) : 1;
  const scale = zoom ?? fit;
  const step = (d: number) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + d) * 100) / 100)));
  const score = new Map(progress.data?.concepts.map((c) => [c.concept_id, c.correct / Math.max(1, c.total)]) ?? []);
  const fill = (id: string) => {
    const s = score.get(id);
    return s === undefined ? FILL.none : s >= 0.8 ? FILL.solid : s >= 0.6 ? FILL.building : FILL.practice;
  };
  const label = new Map(map.nodes.map((n) => [n.id, texToPlain(n.label)]));
  const concept = new Map(course.concepts.map((c) => [c.id, c]));
  const visible = new Set(nodes.map((n) => n.id));

  const select = (id: string | null) => {
    setSelected(id);
    if (id && !visible.has(id)) setChapter("all");
  };
  const chips = (ids: string[] | undefined) => (ids ?? []).filter((id) => label.has(id)).map((id) => (
    <button key={id} type="button" className="chip" onClick={() => select(id)}><i className="map-dot" style={{ background: fill(id) }} /> {label.get(id)}</button>
  ));
  const detail = (id: string) => {
    const n = map.nodes.find((x) => x.id === id);
    if (!n) return null;
    const up = chips(links.up.get(id)), down = chips(links.down.get(id));
    return (
      <div className="map-detail stack small">
        <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <strong style={{ fontSize: "1rem" }}><Rich text={n.label} /></strong>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(null)} aria-label={t("close")}><Icon name="x" size={15} /></button>
        </div>
        {concept.get(id)?.description && <Rich as="div" text={concept.get(id)!.description} />}
        <div className="map-links"><span className="eyebrow">{t("buildsOn")}</span>{up.length ? up : <span className="muted">{t("noPrereq")}</span>}</div>
        {down.length > 0 && <div className="map-links"><span className="eyebrow">{t("leadsTo")}</span>{down}</div>}
        {n.section_id && <div><button type="button" className="btn btn-primary btn-sm" onClick={() => { setFull(false); onOpenSection(n.section_id!); }}>{t("openSection")} <Icon name="arrow" size={13} /></button></div>}
      </div>
    );
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // touch keeps native (momentum) scrolling
    const el = e.currentTarget;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
    e.currentTarget.classList.add("dragging");
    e.currentTarget.scrollLeft = d.left - dx;
    e.currentTarget.scrollTop = d.top - dy;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("dragging");
    const d = drag.current;
    setTimeout(() => { if (drag.current === d) drag.current = null; }, 0); // let the click that ends a drag be ignored
  };
  const clickNode = (id: string) => { if (!drag.current?.moved) select(selected === id ? null : id); };

  const q = query.trim().toLowerCase();
  const listGroups = [
    ...course.chapters.map((ch) => ({ id: ch.id, title: texToPlain(ch.title), items: map.nodes.filter((n) => n.section_id && chapterOf.get(n.section_id) === ch.id) })),
    { id: "other", title: "—", items: map.nodes.filter((n) => !n.section_id || !chapterOf.has(n.section_id)) },
  ].filter((g) => chapter === "all" || g.id === chapter)
    .map((g) => ({ ...g, items: g.items.filter((n) => !q || texToPlain(n.label).toLowerCase().includes(q)) }))
    .filter((g) => g.items.length);

  return (
    <div className={`stack topic-map-root${full ? " full" : ""}`}>
      <div className="map-toolbar">
        <div className="seg" role="group" aria-label={t("map")}>
          <button type="button" className="chip" aria-pressed={mode === "map"} onClick={() => setView("map")}><Icon name="map" size={14} /> {t("mapView")}</button>
          <button type="button" className="chip" aria-pressed={mode === "list"} onClick={() => setView("list")}><Icon name="list" size={14} /> {t("listView")}</button>
        </div>
        <select value={chapter} onChange={(e) => { setChapter(e.target.value); setZoom(null); }} aria-label={t("allChapters")} className="map-chapter">
          <option value="all">{t("allChapters")} · {map.nodes.length}</option>
          {course.chapters.map((ch, i) => <option key={ch.id} value={ch.id}>{i + 1}. {texToPlain(ch.title)}</option>)}
        </select>
        <input type="search" className="map-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchConcept")} aria-label={t("searchConcept")} />
        <span style={{ flex: 1 }} />
        {mode === "map" && (
          <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button type="button" className="btn btn-sm btn-icon" onClick={() => step(-0.15)} disabled={scale <= MIN_ZOOM} aria-label={t("zoomOut")} title={t("zoomOut")}><Icon name="minus" size={15} /></button>
            <button type="button" className="btn btn-sm map-zoom" onClick={() => setZoom(null)} title={t("fitMap")} aria-label={t("fitMap")}>{Math.round(scale * 100)}%</button>
            <button type="button" className="btn btn-sm btn-icon" onClick={() => step(0.15)} disabled={scale >= MAX_ZOOM} aria-label={t("zoomIn")} title={t("zoomIn")}><Icon name="plus" size={15} /></button>
          </div>
        )}
        <button type="button" className="btn btn-sm btn-icon" onClick={() => setFull((f) => !f)} aria-label={t(full ? "exitFullscreen" : "fullscreen")} title={t(full ? "exitFullscreen" : "fullscreen")}>
          <Icon name={full ? "shrink" : "expand"} size={15} />
        </button>
      </div>
      <div className="map-legend tiny muted">
        <span className="legend-item"><i style={{ background: FILL.solid }} /> {t("mapSolid")}</span>
        <span className="legend-item"><i style={{ background: FILL.building }} /> {t("mapBuilding")}</span>
        <span className="legend-item"><i style={{ background: FILL.practice }} /> {t("mapNeedsPractice")}</span>
        <span className="legend-item"><i style={{ background: FILL.none }} /> {t("mapNotTried")}</span>
        {mode === "map" && <span className="legend-help">{t("mapHelp")}</span>}
      </div>
      {mode === "map" && selected && detail(selected)}
      {mode === "map" && nodes.length === 0 && <Empty>—</Empty>}
      {mode === "map" && nodes.length > 0 && (
        <div className={`card topic-map${hot.size ? " focus" : ""}`}>
          <div className="map-viewport" ref={boxRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
            <svg viewBox={`0 0 ${lay.width} ${lay.height}`} role="img" aria-label={t("map")} width={Math.round(lay.width * scale)} height={Math.round(lay.height * scale)}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8a948f" /></marker>
              </defs>
              {map.edges.map((e, i) => {
                const a = lay.pos.get(e.from), b = lay.pos.get(e.to);
                if (!a || !b) return null;
                const forward = rtl ? b.x < a.x : b.x > a.x;
                const x1 = forward !== rtl ? a.x + NODE_W : a.x, x2 = forward !== rtl ? b.x : b.x + NODE_W;
                const isHot = !!focus && hot.has(e.from) && hot.has(e.to);
                return <path key={i} className={`topic-edge${isHot ? " hot" : ""}`} d={`M${x1},${a.y + NODE_H / 2} C${(x1 + x2) / 2},${a.y + NODE_H / 2} ${(x1 + x2) / 2},${b.y + NODE_H / 2} ${x2},${b.y + NODE_H / 2}`}
                  fill="none" stroke="#b9b2a3" strokeWidth={1.4} markerEnd="url(#arrow)" />;
              })}
              {nodes.map((n) => {
                const p = lay.pos.get(n.id)!;
                const lines = wrapLabel(texToPlain(n.label), 21);
                const y0 = p.y + NODE_H / 2 + 5 - (lines.length - 1) * 8;
                return (
                  <g key={n.id} className={`topic-node${hot.has(n.id) ? " hot" : ""}${selected === n.id ? " selected" : ""}`} tabIndex={0} role="button" aria-pressed={selected === n.id}
                    aria-label={texToPlain(n.label)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                    onClick={() => clickNode(n.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(selected === n.id ? null : n.id); } }}>
                    <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={10} fill={fill(n.id)} stroke="#0e6b63" strokeWidth={1} />
                    <text x={p.x + NODE_W / 2} y={y0} textAnchor="middle">
                      <title>{texToPlain(n.label)}</title>
                      {lines.map((ln, i) => <tspan key={i} x={p.x + NODE_W / 2} dy={i === 0 ? 0 : 16}>{ln}</tspan>)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
      {mode === "list" && (
        <div className="map-list stack">
          {listGroups.length === 0 && <Empty>—</Empty>}
          {listGroups.map((g) => (
            <section key={g.id} className="card stack" style={{ gap: "0.35rem" }}>
              <div className="row between"><strong>{g.title}</strong><span className="tiny muted">{g.items.length} {t("conceptsShort")}</span></div>
              {g.items.map((n) => (
                <div key={n.id} className={`map-row${selected === n.id ? " open" : ""}`}>
                  <button type="button" className="map-row-head" aria-expanded={selected === n.id} onClick={() => setSelected(selected === n.id ? null : n.id)}>
                    <i className="map-dot" style={{ background: fill(n.id) }} />
                    <span className="map-row-name"><Rich text={n.label} /></span>
                    {(links.up.get(n.id)?.length ?? 0) > 0 && <span className="tiny muted map-row-pre">← {links.up.get(n.id)!.length}</span>}
                  </button>
                  {selected === n.id && detail(n.id)}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
