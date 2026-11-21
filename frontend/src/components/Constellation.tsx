import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Sign-in background: a living notebook of course concepts (French / English) on graph paper.
 *  - drag & throw concepts (momentum, soft wall bounce)          - hover a concept → definition card (via onHover)
 *  - "link the concepts" game: click two concepts of the same subject → a permanent link (onLink)
 *  - typing launches letters into the network (passwords send "∗", never the real characters)
 *  - ink trail behind the cursor, ripple on click, double-click = supernova scatter
 * Honors prefers-reduced-motion (single still frame) and pauses when the tab is hidden.
 */
export interface Concept { label: string; group: string; def: string }
export const GROUPS: Record<string, string> = {
  analyse: "Analyse", reseaux: "Réseaux", algo: "Algorithmique", proba: "Probabilités", algebre: "Algèbre", bdd: "Bases de données", ia: "IA / ML",
};
const CONCEPTS: Concept[] = [
  { label: "dérivée", group: "analyse", def: "Taux de variation instantané : f′(x) = lim (f(x+h) − f(x)) / h" },
  { label: "intégrale", group: "analyse", def: "Aire algébrique sous la courbe : ∫ₐᵇ f = F(b) − F(a)" },
  { label: "limite", group: "analyse", def: "La valeur dont f(x) s'approche quand x tend vers a" },
  { label: "∫", group: "analyse", def: "Le symbole de l'intégrale (un S allongé, pour « somme »)" },
  { label: "∂", group: "analyse", def: "Dérivée partielle : on dérive par rapport à une seule variable" },
  { label: "f(x)", group: "analyse", def: "L'image de x par la fonction f" },
  { label: "TCP/IP", group: "reseaux", def: "Le modèle à 4 couches d'Internet" },
  { label: "OSI", group: "reseaux", def: "Modèle de référence à 7 couches, de la physique à l'application" },
  { label: "sous-réseau", group: "reseaux", def: "Réseau plus petit obtenu en empruntant des bits d'hôte" },
  { label: "masque /24", group: "reseaux", def: "255.255.255.0 — les 24 premiers bits désignent le réseau" },
  { label: "routage", group: "reseaux", def: "Choisir où envoyer un paquet — règle du plus long préfixe" },
  { label: "2ʰ−2", group: "reseaux", def: "Hôtes utilisables avec h bits d'hôte (on retire réseau et diffusion)" },
  { label: "algorithme", group: "algo", def: "Suite finie d'étapes qui résout un problème" },
  { label: "récursivité", group: "algo", def: "Une fonction qui s'appelle elle-même, avec un cas de base" },
  { label: "pile", group: "algo", def: "Structure LIFO : dernier entré, premier sorti" },
  { label: "O(n log n)", group: "algo", def: "Complexité du tri fusion" },
  { label: "graphe", group: "algo", def: "Des sommets reliés par des arêtes" },
  { label: "boucle", group: "algo", def: "Répéter des instructions tant qu'une condition est vraie" },
  { label: "probabilité", group: "proba", def: "La chance qu'un événement se produise, entre 0 et 1" },
  { label: "espérance", group: "proba", def: "Moyenne pondérée : E[X] = Σ xᵢ pᵢ" },
  { label: "variance", group: "proba", def: "Dispersion autour de la moyenne : V(X) = E[X²] − E[X]²" },
  { label: "loi normale", group: "proba", def: "La courbe en cloche N(μ, σ²)" },
  { label: "Bayes", group: "proba", def: "P(A|B) = P(B|A) · P(A) / P(B)" },
  { label: "matrice", group: "algebre", def: "Tableau de nombres à n lignes et p colonnes" },
  { label: "vecteur", group: "algebre", def: "Un élément d'un espace vectoriel — une direction et une norme" },
  { label: "λ", group: "algebre", def: "Valeur propre : A·v = λ·v" },
  { label: "déterminant", group: "algebre", def: "det(A) ≠ 0 ⇔ A est inversible" },
  { label: "base", group: "algebre", def: "Famille libre et génératrice" },
  { label: "SQL", group: "bdd", def: "Le langage de requêtes des bases relationnelles" },
  { label: "clé primaire", group: "bdd", def: "Identifie chaque ligne de façon unique" },
  { label: "jointure", group: "bdd", def: "Combine les lignes de deux tables liées" },
  { label: "index", group: "bdd", def: "Accélère la recherche dans une table" },
  { label: "gradient", group: "ia", def: "Direction de plus forte pente — la base de l'apprentissage" },
  { label: "neural network", group: "ia", def: "Couches de neurones artificiels qui apprennent des poids" },
  { label: "dataset", group: "ia", def: "L'ensemble de données d'entraînement" },
  { label: "overfitting", group: "ia", def: "Le modèle apprend le bruit au lieu de généraliser" },
];

interface Node { x: number; y: number; vx: number; vy: number; c: Concept; size: number; glow: number; glyph: boolean; phase: number; w: number; flash: number }
interface Ripple { x: number; y: number; r: number; life: number; strong: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; ch: string; life: number; target: Node | null }
interface Spark { x: number; y: number; vx: number; vy: number; life: number }

export interface HoverInfo { label: string; group: string; def: string; x: number; y: number }
export interface ConstellationHandle { pulse: () => void; type: (ch: string, from: { x: number; y: number }) => void; scatter: () => void }
interface Props {
  onHover?: (h: HoverInfo | null) => void;
  onLink?: (total: number, a: Concept, b: Concept) => void;
  onMiss?: () => void;
  onSelect?: (c: Concept | null) => void;
}

export const Constellation = forwardRef<ConstellationHandle, Props>(function Constellation(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef(props);
  cb.current = props;
  const api = useRef<ConstellationHandle>({ pulse: () => {}, type: () => {}, scatter: () => {} });
  useImperativeHandle(ref, () => ({ pulse: () => api.current.pulse(), type: (c, f) => api.current.type(c, f), scatter: () => api.current.scatter() }), []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const INK = css.getPropertyValue("--ink").trim() || "#1d2a2f";
    const ACCENT = css.getPropertyValue("--primary").trim() || "#0e6b63";
    const WARN = "#a8321f";
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    let nodes: Node[] = [];
    const ripples: Ripple[] = [];
    const particles: Particle[] = [];
    const sparks: Spark[] = [];
    const links: [Node, Node][] = [];
    const trail: { x: number; y: number; t: number }[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    let hovered: Node | null = null, selected: Node | null = null, dragging: Node | null = null;
    let drag = { ox: 0, oy: 0, sx: 0, sy: 0, lx: 0, ly: 0, moved: 0, vx: 0, vy: 0 };
    let miss: { a: Node; b: Node; life: number } | null = null;
    let paper: HTMLCanvasElement | null = null;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const font = (n: Node) => `${n.glyph ? "500" : "400"} ${n.size}px ${n.glyph ? "Fraunces, serif" : "'IBM Plex Sans', sans-serif"}`;

    function drawPaper() {
      paper = document.createElement("canvas");
      paper.width = w * dpr; paper.height = h * dpr;
      const p = paper.getContext("2d")!;
      p.scale(dpr, dpr);
      p.strokeStyle = "rgba(29,42,47,0.045)";
      for (let x = 0; x < w; x += 28) { p.beginPath(); p.moveTo(x + 0.5, 0); p.lineTo(x + 0.5, h); p.stroke(); }
      for (let y = 0; y < h; y += 28) { p.beginPath(); p.moveTo(0, y + 0.5); p.lineTo(w, y + 0.5); p.stroke(); }
      p.strokeStyle = "rgba(180,83,9,0.10)";
      const mx = Math.min(96, w * 0.08);
      p.beginPath(); p.moveTo(mx, 0); p.lineTo(mx, h); p.stroke();
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(CONCEPTS.length, Math.max(18, (w * h) / 26000)));
      const pool = [...CONCEPTS].sort(() => Math.random() - 0.5).slice(0, count);
      links.length = 0;
      nodes = pool.map((c) => {
        const glyph = c.label.length <= 2;
        const n: Node = { x: rnd(20, w - 20), y: rnd(20, h - 20), vx: rnd(-0.18, 0.18), vy: rnd(-0.18, 0.18), c, glyph,
                          size: glyph ? rnd(22, 30) : rnd(13, 16), glow: 0, phase: rnd(0, Math.PI * 2), w: 0, flash: 0 };
        ctx.font = font(n);
        n.w = ctx.measureText(c.label).width;
        return n;
      });
      drawPaper();
    }

    const hit = (x: number, y: number) => {
      let best: Node | null = null, bd = Infinity;
      for (const n of nodes) {
        const dx = Math.abs(x - n.x), dy = Math.abs(y - n.y);
        if (dx < n.w / 2 + 10 && dy < n.size * 0.8 + 6) {
          const d = dx + dy;
          if (d < bd) { bd = d; best = n; }
        }
      }
      return best;
    };
    const burst = (x: number, y: number, n = 18) => {
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(1, 3.2); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 }); }
    };

    api.current = {
      pulse: () => { const n = nodes[Math.floor(Math.random() * nodes.length)]; if (n) n.glow = 1; },
      type: (ch, from) => {
        const r = canvas.getBoundingClientRect();
        const target = nodes[Math.floor(Math.random() * nodes.length)] ?? null;
        particles.push({ x: from.x - r.left, y: from.y - r.top, vx: rnd(-2.5, -1), vy: rnd(-1.5, 1.5), ch, life: 1, target });
      },
      scatter: () => {
        for (const n of nodes) { n.vx += rnd(-6, 6); n.vy += rnd(-6, 6); n.glow = 1; }
        ripples.push({ x: w / 2, y: h / 2, r: 4, life: 1, strong: true });
      },
    };

    function select(n: Node) {
      if (!selected) { selected = n; n.flash = 1; cb.current.onSelect?.(n.c); return; }
      if (selected === n) { selected = null; cb.current.onSelect?.(null); return; }
      const a = selected, b = n;
      selected = null;
      cb.current.onSelect?.(null);
      if (a.c.group === b.c.group) {
        if (!links.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) {
          links.push([a, b]);
          a.glow = b.glow = 1;
          burst((a.x + b.x) / 2, (a.y + b.y) / 2, 22);
          cb.current.onLink?.(links.length, a.c, b.c);
        }
      } else {
        miss = { a, b, life: 1 };
        cb.current.onMiss?.();
      }
    }

    function step(dt: number) {
      for (const n of nodes) {
        if (n === dragging) continue;
        if (n === hovered && !dragging) { n.vx *= 0.8; n.vy *= 0.8; }
        else if (mouse.active && !dragging) {
          const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
          if (d < 190 && d > 1) {
            const f = (1 - d / 190) * 0.01;
            n.vx += ((dx / d) * f - (dy / d) * f * 0.6) * dt;
            n.vy += ((dy / d) * f + (dx / d) * f * 0.6) * dt;
            n.glow = Math.max(n.glow, (1 - d / 190) * 0.5);
          }
        }
        for (const r of ripples) {
          const d = Math.hypot(n.x - r.x, n.y - r.y);
          if (Math.abs(d - r.r) < 24 && d > 1) {
            const k = r.strong ? 1.1 : 0.35;
            n.vx += ((n.x - r.x) / d) * k * r.life; n.vy += ((n.y - r.y) / d) * k * r.life;
            n.glow = Math.max(n.glow, r.life);
          }
        }
        n.vx *= 0.985; n.vy *= 0.985;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.05) { n.vx += rnd(-0.02, 0.02); n.vy += rnd(-0.02, 0.02); }
        if (sp > 9) { n.vx *= 9 / sp; n.vy *= 9 / sp; }
        n.x += n.vx * dt; n.y += n.vy * dt;
        const mx = n.w / 2 + 6, my = n.size;
        if (n.x < mx) { n.x = mx; n.vx = Math.abs(n.vx) * 0.7; }
        if (n.x > w - mx) { n.x = w - mx; n.vx = -Math.abs(n.vx) * 0.7; }
        if (n.y < my) { n.y = my; n.vy = Math.abs(n.vy) * 0.7; }
        if (n.y > h - my) { n.y = h - my; n.vy = -Math.abs(n.vy) * 0.7; }
        n.glow *= 0.975; n.flash *= 0.96; n.phase += 0.01 * dt;
      }
      for (const r of ripples) { r.r += (r.strong ? 9 : 4.2) * dt; r.life *= 0.965; }
      while (ripples.length && ripples[0].life < 0.03) ripples.shift();
      for (const p of particles) {
        if (p.target) { const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy) || 1; p.vx += (dx / d) * 0.25 * dt; p.vy += (dy / d) * 0.25 * dt; if (d < 14) { p.target.glow = 1; p.life = 0; } }
        p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.008 * dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.04 * dt; s.life -= 0.022 * dt; }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      if (miss) { miss.life -= 0.03 * dt; if (miss.life <= 0) miss = null; }
      const now = performance.now();
      while (trail.length && now - trail[0].t > 450) trail.shift();
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, w, h);
      if (paper) ctx.drawImage(paper, 0, 0, w, h);
      // ink trail
      if (trail.length > 2) {
        const now = performance.now();
        for (let i = 1; i < trail.length; i++) {
          const a = 1 - (now - trail[i].t) / 450;
          ctx.strokeStyle = hexA(INK, 0.16 * a); ctx.lineWidth = 2.4 * a + 0.3;
          ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
        }
      }
      const LINK = 150;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const k = 1 - Math.sqrt(d2) / LINK, g = Math.max(a.glow, b.glow);
          ctx.strokeStyle = g > 0.15 ? hexA(ACCENT, 0.1 + 0.45 * k * g) : `rgba(29,42,47,${0.08 * k})`;
          ctx.lineWidth = 0.6 + g * 0.8;
          ctx.beginPath(); ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) / 2 + Math.sin(t / 1400 + i) * 6, (a.y + b.y) / 2 + Math.cos(t / 1600 + j) * 6, b.x, b.y);
          ctx.stroke();
        }
        if (mouse.active && !dragging) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 170) {
            ctx.strokeStyle = hexA(ACCENT, 0.3 * (1 - d / 170)); ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(a.x, a.y); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
      // game links: permanent, animated dashes flowing along the link
      for (const [a, b] of links) {
        ctx.strokeStyle = hexA(ACCENT, 0.85); ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t / 40;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      if (miss) {
        ctx.strokeStyle = hexA(WARN, 0.6 * miss.life); ctx.lineWidth = 2; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(miss.a.x, miss.a.y); ctx.lineTo(miss.b.x, miss.b.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (selected && mouse.active) { // rubber band from the selected concept to the cursor
        ctx.strokeStyle = hexA(ACCENT, 0.6); ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t / 50;
        ctx.beginPath(); ctx.moveTo(selected.x, selected.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const r of ripples) {
        ctx.strokeStyle = hexA(ACCENT, (r.strong ? 0.5 : 0.35) * r.life); ctx.lineWidth = r.strong ? 2 : 1.2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const n of nodes) {
        const bob = n === dragging ? 0 : Math.sin(n.phase) * 1.5;
        const isSel = n === selected, isHov = n === hovered;
        ctx.font = font(n);
        if (isSel || isHov || n.glow > 0.2) {
          const pad = 8;
          ctx.fillStyle = isSel ? hexA(ACCENT, 0.16) : hexA(ACCENT, 0.08 * Math.max(n.glow, isHov ? 1 : 0));
          roundRect(ctx, n.x - n.w / 2 - pad, n.y + bob - n.size * 0.7 - 4, n.w + pad * 2, n.size * 1.4 + 8, 10);
          ctx.fill();
          if (isSel) { ctx.strokeStyle = hexA(ACCENT, 0.8); ctx.lineWidth = 1.4; ctx.stroke(); }
        }
        ctx.fillStyle = isSel || isHov ? ACCENT : n.glow > 0.2 ? hexA(ACCENT, 0.55 + 0.45 * n.glow) : hexA(INK, n.glyph ? 0.34 : 0.46);
        ctx.fillText(n.c.label, n.x, n.y + bob);
      }
      ctx.font = "500 15px 'IBM Plex Mono', monospace";
      for (const p of particles) { ctx.fillStyle = hexA(ACCENT, Math.max(0, p.life)); ctx.fillText(p.ch, p.x, p.y); }
      for (const s of sparks) { ctx.fillStyle = hexA(ACCENT, Math.max(0, s.life)); ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
    }

    function loop(t: number) {
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;
      step(dt); draw(t);
      raf = requestAnimationFrame(loop);
    }

    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const overUi = (e: Event) => !!(e.target as HTMLElement).closest?.("form, button, a, input, select, label, .no-canvas");
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      mouse.x = p.x; mouse.y = p.y; mouse.active = true;
      trail.push({ x: p.x, y: p.y, t: performance.now() });
      if (dragging) {
        const nx = p.x - drag.ox, ny = p.y - drag.oy;
        drag.vx = nx - dragging.x; drag.vy = ny - dragging.y;
        drag.moved += Math.abs(drag.vx) + Math.abs(drag.vy);
        dragging.x = nx; dragging.y = ny; dragging.glow = 1;
        return;
      }
      const hv = overUi(e) ? null : hit(p.x, p.y);
      if (hv !== hovered) {
        hovered = hv;
        canvas.style.cursor = hv ? "grab" : "default";
        cb.current.onHover?.(hv ? { label: hv.c.label, group: hv.c.group, def: hv.c.def, x: hv.x, y: hv.y } : null);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (overUi(e)) return;
      const p = local(e);
      const n = hit(p.x, p.y);
      if (n) {
        dragging = n; canvas.style.cursor = "grabbing";
        drag = { ox: p.x - n.x, oy: p.y - n.y, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: 0, vx: 0, vy: 0 };
        cb.current.onHover?.(null);
      } else {
        ripples.push({ x: p.x, y: p.y, r: 4, life: 1, strong: false });
      }
    };
    const onUp = () => {
      if (!dragging) return;
      const n = dragging;
      dragging = null; canvas.style.cursor = hovered ? "grab" : "default";
      if (drag.moved < 6) select(n);
      else { n.vx = drag.vx * 0.8; n.vy = drag.vy * 0.8; }
    };
    const onDbl = (e: MouseEvent) => {
      if (overUi(e)) return;
      api.current.scatter();
    };
    const onLeave = () => { mouse.active = false; hovered = null; cb.current.onHover?.(null); };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    resize();
    if (reduce) draw(0); else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("dblclick", onDbl);
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("dblclick", onDbl);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation" aria-hidden="true" />;
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function hexA(hex: string, a: number): string {
  const hx = hex.replace("#", "");
  const n = parseInt(hx.length === 3 ? hx.split("").map((c) => c + c).join("") : hx, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
