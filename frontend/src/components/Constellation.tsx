import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * "Living notebook" background for the sign-in page: concepts from real courses (French, Arabic, math)
 * drift on graph paper and link up when they are close, like ideas connecting. The cursor gathers nearby
 * concepts and draws threads to them; a click sends a ripple through the network; each keystroke lights a
 * concept. Honors prefers-reduced-motion (renders one still frame) and pauses when the tab is hidden.
 */
const WORDS = [
  "dérivée", "sous-réseau", "intégrale", "matrice", "TCP/IP", "algorithme", "probabilité", "récursivité", "vecteur", "fonction",
  "مشتقة", "خوارزمية", "مصفوفة", "احتمال", "دالة", "شبكة", "متتالية", "تكامل",
  "∫", "Σ", "∂", "λ", "π", "√", "∞", "Δ", "≤", "f(x)", "2ʰ−2", "O(n)", "∀x", "eⁱπ",
  "OSI", "SQL", "limite", "graphe", "pile", "boucle", "masque /24", "théorème",
];

interface Node { x: number; y: number; vx: number; vy: number; label: string; size: number; glow: number; glyph: boolean; phase: number }
interface Ripple { x: number; y: number; r: number; life: number }

export interface ConstellationHandle { pulse: () => void }

export const Constellation = forwardRef<ConstellationHandle>(function Constellation(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ pulse: () => void }>({ pulse: () => {} });
  useImperativeHandle(ref, () => ({ pulse: () => api.current.pulse() }), []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const INK = css.getPropertyValue("--ink").trim() || "#1d2a2f";
    const ACCENT = css.getPropertyValue("--primary").trim() || "#0e6b63";
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    let nodes: Node[] = [];
    const ripples: Ripple[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    let paper: HTMLCanvasElement | null = null;

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function drawPaper() {
      paper = document.createElement("canvas");
      paper.width = w * dpr;
      paper.height = h * dpr;
      const p = paper.getContext("2d")!;
      p.scale(dpr, dpr);
      p.strokeStyle = "rgba(29,42,47,0.045)";
      p.lineWidth = 1;
      for (let x = 0; x < w; x += 28) { p.beginPath(); p.moveTo(x + 0.5, 0); p.lineTo(x + 0.5, h); p.stroke(); }
      for (let y = 0; y < h; y += 28) { p.beginPath(); p.moveTo(0, y + 0.5); p.lineTo(w, y + 0.5); p.stroke(); }
      p.strokeStyle = "rgba(180,83,9,0.10)"; // notebook margin line
      p.beginPath(); p.moveTo(Math.min(96, w * 0.08), 0); p.lineTo(Math.min(96, w * 0.08), h); p.stroke();
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(64, Math.max(22, (w * h) / 22000)));
      nodes = Array.from({ length: count }, (_, i) => {
        const label = WORDS[i % WORDS.length];
        const glyph = label.length <= 3 || /^[∫Σ∂λπ√∞Δ≤]/.test(label);
        return { x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.18, 0.18), vy: rnd(-0.18, 0.18), label, glyph,
                 size: glyph ? rnd(18, 30) : rnd(12, 16), glow: 0, phase: rnd(0, Math.PI * 2) };
      });
      drawPaper();
    }

    api.current.pulse = () => {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      if (n) n.glow = 1;
    };

    function step(dt: number) {
      for (const n of nodes) {
        if (mouse.active) {
          const dx = mouse.x - n.x, dy = mouse.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 190 && d > 1) {
            const f = (1 - d / 190) * 0.012;
            n.vx += (dx / d) * f * dt - (dy / d) * f * 0.6 * dt; // gentle pull + orbit
            n.vy += (dy / d) * f * dt + (dx / d) * f * 0.6 * dt;
            n.glow = Math.max(n.glow, (1 - d / 190) * 0.55);
          }
        }
        for (const r of ripples) {
          const d = Math.hypot(n.x - r.x, n.y - r.y);
          if (Math.abs(d - r.r) < 22 && d > 1) {
            n.vx += ((n.x - r.x) / d) * 0.35 * r.life;
            n.vy += ((n.y - r.y) / d) * 0.35 * r.life;
            n.glow = Math.max(n.glow, r.life);
          }
        }
        n.vx *= 0.985; n.vy *= 0.985;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.06) { n.vx += rnd(-0.02, 0.02); n.vy += rnd(-0.02, 0.02); }
        if (sp > 2.2) { n.vx *= 2.2 / sp; n.vy *= 2.2 / sp; }
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < -40) n.x = w + 40; if (n.x > w + 40) n.x = -40;
        if (n.y < -30) n.y = h + 30; if (n.y > h + 30) n.y = -30;
        n.glow *= 0.975;
        n.phase += 0.01 * dt;
      }
      for (const r of ripples) { r.r += 4.2 * dt; r.life *= 0.965; }
      while (ripples.length && ripples[0].life < 0.03) ripples.shift();
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, w, h);
      if (paper) ctx.drawImage(paper, 0, 0, w, h);
      const LINK = 150;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const k = 1 - Math.sqrt(d2) / LINK;
          const g = Math.max(a.glow, b.glow);
          ctx.strokeStyle = g > 0.15 ? hexA(ACCENT, 0.12 + 0.5 * k * g) : `rgba(29,42,47,${0.09 * k})`;
          ctx.lineWidth = 0.6 + g * 0.9;
          ctx.beginPath(); ctx.moveTo(a.x, a.y);
          const mx = (a.x + b.x) / 2 + Math.sin(t / 1400 + i) * 6, my = (a.y + b.y) / 2 + Math.cos(t / 1600 + j) * 6; // ink-like curve
          ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
        }
        if (mouse.active) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 170) {
            ctx.strokeStyle = hexA(ACCENT, 0.35 * (1 - d / 170));
            ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(a.x, a.y); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      for (const r of ripples) {
        ctx.strokeStyle = hexA(ACCENT, 0.35 * r.life);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const n of nodes) {
        const bob = Math.sin(n.phase) * 1.5;
        ctx.font = `${n.glyph ? "500" : "400"} ${n.size}px ${n.glyph ? "Fraunces, serif" : "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"}`;
        if (n.glow > 0.2) {
          ctx.fillStyle = hexA(ACCENT, 0.1 * n.glow);
          ctx.beginPath(); ctx.arc(n.x, n.y + bob, n.size * 1.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = n.glow > 0.2 ? hexA(ACCENT, 0.55 + 0.45 * n.glow) : hexA(INK, n.glyph ? 0.32 : 0.42);
        ctx.fillText(n.label, n.x, n.y + bob);
      }
    }

    function loop(t: number) {
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;
      step(dt);
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("form, button, a, input, select, label")) return;
      const r = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 4, life: 1 });
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    resize();
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation" aria-hidden="true" />;
});

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
