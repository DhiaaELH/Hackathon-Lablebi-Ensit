/**
 * Business mode. Thousands of particles fly in and assemble into a 3D businessman (suit, gold tie,
 * briefcase) standing on a glowing grid floor, surrounded by floating calculations, a live cost chart,
 * candlesticks and spinning gold coins. Click him to scatter and rebuild him; click a coin to flip it.
 * A stock-ticker tape streams the real cost figures across the top.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const VIEWS = {
  levers: { pos: V(-7, 10, 31), look: V(1.5, 7.5, 0) },
  calculator: { pos: V(9, 10, 30), look: V(6, 8, -8) },
  production: { pos: V(-3, 3.2, 23), look: V(0, 8.5, 0) },
  model: { pos: V(10, 11, 29), look: V(1.5, 7.5, 0) },
};

const FORMULAS = [
  "4.1k tok × $0.10/1M", "÷30 per class", "×15.6", "Σ = $12.60/mo", "$0.042 / student", "16% cached",
  "RAG top-5", "100k in · 18k out", "4.33 wk/mo", "n ≥ 5", "C = Σ tᵢ · pᵢ", "(13k − 4.1k) / 13k = 68%",
  "1 course → 30 students", "p_fast = $0.10", "ROI ↗", "25 s / course", "0 tok · routing", "$", "%", "Δcost ↓",
  "fast tier · smart tier", "cache_hit ✓", "schema ✓", "∫ value dt",
];

const HEAD = {
  en: {
    levers: ["Σ tokens = skip + once + small + cache", "0 tok · ÷30 · 4.1k vs 13k · 16% cached"],
    production: ["uptime = fallbacks + retries + limits", "schema-checked AI · demo mode needs no key"],
    model: ["revenue = freemium + faculty licence", "LLM cost ≈ {per} / student / month"],
    calc: (S, Q, tot, per) => [`${S} students × ${Q} msg × 4.33 wk`, `= ${tot}/mo → ${per} / student`],
    hint: "Click the businessman to rebuild him · click a coin · drag to look around",
  },
  fr: {
    levers: ["Σ tokens = sauter + 1 fois + petit + cache", "0 tok · ÷30 · 4,1k vs 13k · 16 % en cache"],
    production: ["disponibilité = secours + relances + limites", "IA vérifiée par schéma · le mode démo n'a besoin d'aucune clé"],
    model: ["revenus = freemium + licence faculté", "coût LLM ≈ {per} / étudiant / mois"],
    calc: (S, Q, tot, per) => [`${S} étudiants × ${Q} msg × 4,33 sem`, `= ${tot}/mois → ${per} / étudiant`],
    hint: "Clique l'homme d'affaires pour le reconstruire · clique une pièce · glisse pour tourner",
  },
};

/** Text drawn on a canvas and shown as a sprite, so it lives in the 3D space (fog, depth, glow). */
function textSprite(lines, { color = "#ffcf86", size = 1, card = false, sub = "#c9b8ff" } = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const fs = 64, pad = card ? 40 : 8, lh = fs * 1.35;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  const w = Math.ceil(Math.max(...arr.map((l) => g.measureText(l).width))) + pad * 2;
  const h = Math.ceil(lh * arr.length) + pad * 2 - (fs * 0.35);
  c.width = w; c.height = h;
  if (card) {
    g.fillStyle = "rgba(14, 9, 32, 0.82)";
    g.strokeStyle = "rgba(242, 180, 90, 0.75)";
    g.lineWidth = 4;
    g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 26); g.fill(); g.stroke();
  }
  g.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  g.textBaseline = "top";
  arr.forEach((l, i) => { g.fillStyle = i === 0 ? color : sub; g.fillText(l, pad, pad + i * lh); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  const k = (size * 0.32) / fs;
  s.scale.set(w * k, h * k, 1);
  return s;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.4)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The businessman: primitives placed by hand, then sampled into coloured points. */
function buildFigure() {
  const SUIT = "#8f7be8", PANTS = "#5b3fc4", SKIN = "#f3e6d8", SHIRT = "#ffffff", GOLD = "#f2b45a", SHOE = "#9a8fd0", HAIR = "#6d5bd0";
  const parts = [];
  const add = (geo, color, count, m) => { if (m) geo.applyMatrix4(m); parts.push({ geo, color, count }); };
  const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)); return g; };

  add(new THREE.SphereGeometry(1.05, 32, 24), SKIN, 900, at(0, 12.9, 0));
  add(new THREE.SphereGeometry(1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), HAIR, 420, at(0, 13.0, -0.06));
  add(new THREE.CylinderGeometry(0.42, 0.48, 0.8, 20), SKIN, 140, at(0, 11.65, 0));
  add(new THREE.CylinderGeometry(2.05, 1.55, 4.8, 36, 6), SUIT, 2600, at(0, 9.0, 0, 0, 0, 0, 1, 1, 0.6));
  add(tri([[-0.62, 11.25, 1.24], [0.62, 11.25, 1.24], [0, 9.1, 1.0]]), SHIRT, 260);
  add(tri([[-0.26, 10.95, 1.32], [0.26, 10.95, 1.32], [0, 10.45, 1.32]]), GOLD, 80);
  add(tri([[-0.3, 10.45, 1.3], [0.3, 10.45, 1.3], [0, 7.5, 1.05]]), GOLD, 300);
  add(new THREE.CylinderGeometry(1.55, 1.5, 1.1, 32), PANTS, 500, at(0, 6.1, 0, 0, 0, 0, 1, 1, 0.62));
  [-0.78, 0.78].forEach((x) => {
    add(new THREE.CylinderGeometry(0.68, 0.55, 5.4, 20), PANTS, 900, at(x, 2.85, 0));
    add(new THREE.BoxGeometry(0.8, 0.45, 1.4), SHOE, 150, at(x, 0.22, 0.3));
  });
  add(new THREE.CylinderGeometry(0.55, 0.45, 4.7, 20), SUIT, 800, at(-2.45, 8.4, 0, 0, 0, -0.12));
  add(new THREE.CylinderGeometry(0.55, 0.45, 4.7, 20), SUIT, 800, at(2.45, 8.4, 0, 0, 0, 0.1));
  add(new THREE.SphereGeometry(0.45, 16, 12), SKIN, 140, at(-2.75, 5.85, 0));
  add(new THREE.SphereGeometry(0.45, 16, 12), SKIN, 140, at(2.72, 5.85, 0));
  add(new THREE.BoxGeometry(2.6, 1.9, 0.6), GOLD, 900, at(3.05, 4.45, 0));
  add(new THREE.TorusGeometry(0.45, 0.08, 8, 24, Math.PI), GOLD, 120, at(3.05, 5.4, 0));

  const total = parts.reduce((a, p) => a + p.count, 0);
  const pos = new Float32Array(total * 3), start = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const delay = new Float32Array(total), size = new Float32Array(total);
  const p = new THREE.Vector3(), c = new THREE.Color();
  let k = 0;
  for (const part of parts) {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(part.geo)).build();
    c.set(part.color);
    for (let i = 0; i < part.count; i++, k++) {
      sampler.sample(p);
      pos.set([p.x, p.y, p.z], k * 3);
      const d = V(0, 0, 0).randomDirection().multiplyScalar(35 + Math.random() * 55);
      start.set([d.x, d.y + 8, d.z], k * 3);
      col.set([c.r, c.g, c.b], k * 3);
      delay[k] = (p.y / 14) * 0.55 + Math.random() * 0.2;    // builds from the feet up
      size[k] = 0.7 + Math.random() * 0.6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 } },
    vertexShader: `
      uniform float uProgress; uniform float uTime; uniform float uPix;
      attribute vec3 aStart; attribute vec3 aColor; attribute float aDelay; attribute float aSize;
      varying vec3 vColor; varying float vA;
      void main(){
        float t = clamp((uProgress - aDelay) / 0.55, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - t, 3.0);
        vec3 p = mix(aStart, position, e);
        float ang = (1.0 - e) * 2.6;
        p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
        p += vec3(sin(uTime * 1.7 + aDelay * 50.0), cos(uTime * 1.3 + aDelay * 40.0), 0.0) * 0.035 * e;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPix * (95.0 / -mv.z) * (0.75 + 0.5 * (1.0 - e));
        vColor = aColor * (1.0 + (1.0 - e) * 1.2);
        vA = 0.35 + 0.6 * e;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vColor, vA * (1.0 - d * 2.0)); }`,
  });
  return new THREE.Points(geo, mat);
}

export function createBiz({ canvas, getCost, getLang, reduceMotion }) {
  const overlay = document.getElementById("biz");
  const tickerTrack = overlay.querySelector(".track");
  const hintEl = overlay.querySelector(".biz-hint");
  const T = () => HEAD[getLang()] || HEAD.en;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07050f");
  scene.fog = new THREE.Fog("#07050f", 45, 150);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 3000);
  camera.position.set(0, 30, 95);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.target.set(0, 7.5, 0);
  const glow = glowTexture();

  /* ── space: gradient sky, a few stars, lights */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ vec3 a = vec3(0.02, 0.012, 0.045), b = vec3(0.13, 0.06, 0.26);
      vec3 c = mix(a, b, smoothstep(-0.15, 0.6, vD.y)) + vec3(0.25, 0.12, 0.02) * exp(-pow(vD.y + 0.02, 2.0) * 90.0) * 0.6;
      gl_FragColor = vec4(c, 1.0); }`,
  })));
  {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = V(0, 0, 0).randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.05; v.normalize().multiplyScalar(700); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#d9ccff", size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
  }
  scene.add(new THREE.AmbientLight("#3d3560", 1.0));
  const sunLight = new THREE.DirectionalLight("#ffe2b8", 1.6);
  sunLight.position.set(10, 20, 15);
  scene.add(sunLight);
  const rim = new THREE.PointLight("#9a82ff", 1.4, 0, 0);
  rim.position.set(-12, 9, -6);
  scene.add(rim);

  /* ── glowing grid floor + the platform he stands on */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime;
      void main(){
        vec2 q = vW.xz / 2.0; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        vec2 q2 = vW.xz / 10.0; vec2 g2 = abs(fract(q2 - 0.5) - 0.5) / fwidth(q2);
        float major = 1.0 - min(min(g2.x, g2.y), 1.0);
        float d = length(vW.xz);
        float fade = 1.0 - smoothstep(12.0, 90.0, d);
        float pulse = 0.5 + 0.5 * sin(d * 0.5 - uTime * 2.0);
        vec3 col = vec3(0.55, 0.42, 1.0) * (line * 0.35 + major * 0.7) + vec3(1.0, 0.7, 0.3) * major * pulse * 0.25;
        gl_FragColor = vec4(col, (line * 0.35 + major * 0.75) * fade);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color("#f2b45a").multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.6, 4.7, 96, 1, 0, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: "#b69cff", side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.04;
  scene.add(ring2);

  /* ── the businessman */
  const figure = buildFigure();
  const fig = new THREE.Group();
  fig.add(figure);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(8, 14.5, 3), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(0.5, 7.2, 0);
  fig.add(proxy);
  scene.add(fig);

  /* ── live cost chart on the back wall: naive climbs, LessonForge stays flat */
  const chart = new THREE.Group();
  chart.position.set(0, 0, -34);
  scene.add(chart);
  const N = 48, X0 = 6, X1 = 34;
  const axis = new THREE.LineBasicMaterial({ color: "#b69cff", transparent: true, opacity: 0.35 });
  chart.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(X0, 20, 0), V(X0, 0.1, 0), V(X1, 0.1, 0)]), axis));
  for (let y = 4; y <= 20; y += 4) chart.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(X0, y, 0), V(X1, y, 0)]), new THREE.LineBasicMaterial({ color: "#b69cff", transparent: true, opacity: 0.1 })));
  const series = (fn, color) => {
    const pts = []; for (let i = 0; i < N; i++) pts.push(V(X0 + ((X1 - X0) * i) / (N - 1), fn(i / (N - 1), i), 0));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) }));
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    head.scale.setScalar(1.6);
    chart.add(line, head);
    return { line, head, pts };
  };
  const naive = series((t, i) => 1.5 + 15.5 * t ** 1.5 + Math.sin(i * 1.7) * 0.35, "#a7a2b8");
  const ours = series((t, i) => 1.2 + 1.1 * t + Math.sin(i * 2.3) * 0.12, "#c9b8ff");
  let naiveLbl = null, oursLbl = null;
  let chartT = 0;

  /* ── candlesticks, trending up */
  const candles = new THREE.Group();
  candles.position.set(-30, 0, -26);
  scene.add(candles);
  let lvl = 3;
  for (let i = 0; i < 14; i++) {
    const up = Math.random() > 0.3, h = 0.8 + Math.random() * 2.2;
    const base = up ? lvl : lvl - h;
    lvl = up ? lvl + h * 0.7 : lvl - h * 0.4;
    const c = up ? "#f2b45a" : "#8f7be8";
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.4 }));
    body.position.set(i * 1.6, base + h / 2, 0);
    const wick = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 1.4, 0.12), new THREE.MeshBasicMaterial({ color: c }));
    wick.position.copy(body.position);
    const grp = new THREE.Group();
    grp.add(body, wick);
    grp.userData.target = 1;
    grp.scale.y = 0.01;
    candles.add(grp);
  }

  /* ── gold coins (click to flip) */
  const coins = [];
  const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 48);
  const coinMat = new THREE.MeshStandardMaterial({ color: "#f2b45a", metalness: 0.85, roughness: 0.28, emissive: "#b8741c", emissiveIntensity: 0.85 });
  [[-14, 11, -8], [15, 13, -12], [-10, 18, -18], [18, 5, -6], [-19, 4, -14], [7, 20, -8], [22, 11, -22], [-24, 15, -24]].forEach(([x, y, z], i) => {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, y, z);
    m.rotation.x = Math.PI / 2;
    m.userData = { y, phase: i * 1.3, spin: 0.6 + Math.random() * 0.6, burst: 0 };
    scene.add(m);
    coins.push(m);
  });

  /* ── floating calculations (built lazily so the mono font is loaded) */
  const formulas = [];
  let headline = null, built = false;
  function buildText() {
    if (built) return;
    built = true;
    FORMULAS.forEach((f, i) => {
      const s = textSprite(f, { color: i % 3 === 0 ? "#ffcf86" : i % 3 === 1 ? "#c9b8ff" : "#efe6d6", size: 2.2 + Math.random() * 2.2 });
      let x, z;
      do { x = (Math.random() - 0.5) * 90; z = -12 - Math.random() * 55; } while (Math.abs(x) < 10 && z > -26);
      s.position.set(x, Math.random() * 28 - 2, z);
      s.material.opacity = 0.3 + Math.random() * 0.4;
      s.userData = { v: 0.15 + Math.random() * 0.35, base: s.material.opacity, ph: Math.random() * 6 };
      scene.add(s);
      formulas.push(s);
    });
  }
  function setHeadline(lines) {
    if (headline) { scene.remove(headline); headline.material.map.dispose(); headline.material.dispose(); }
    headline = textSprite(lines, { card: true, size: 1.6 });
    headline.position.set(11, 16.8, -5);
    scene.add(headline);
  }
  function setChartLabels() {
    const { r, money } = getCost();
    [naiveLbl, oursLbl].forEach((l) => { if (l) { chart.remove(l); l.material.map.dispose(); l.material.dispose(); } });
    naiveLbl = textSprite(`naive ${money(r.naiveT)}/mo`, { color: "#a7a2b8", size: 3 });
    naiveLbl.position.copy(naive.pts[N - 1]).add(V(-2, 2.2, 0));
    oursLbl = textSprite(`LessonForge ${money(r.oursT)}/mo`, { color: "#c9b8ff", size: 3 });
    oursLbl.position.copy(ours.pts[N - 1]).add(V(-3.5, 1.6, 0));
    chart.add(naiveLbl, oursLbl);
  }

  /* ── slide-specific headline */
  let station = "levers";
  function headlineFor(id) {
    const { r, calc, money } = getCost();
    const per = money(r.oursT / calc.students, true);
    if (id === "calculator") return T().calc(calc.students.toLocaleString(), calc.questions, money(r.oursT), per);
    return (T()[id] || T().levers).map((l) => l.replace("{per}", per));
  }

  /* ── camera */
  const fly = { t: 1, dur: 2.2, fromP: V(0, 0, 0), fromT: V(0, 0, 0), toP: V(0, 0, 0), toT: V(0, 0, 0) };
  function goto(id) {
    station = VIEWS[id] ? id : "levers";
    const v = VIEWS[station];
    const k = innerWidth < 900 ? 1.35 : 1;
    fly.fromP.copy(camera.position); fly.fromT.copy(controls.target);
    fly.toP.copy(v.look).add(v.pos.clone().sub(v.look).multiplyScalar(k));
    fly.toT.copy(v.look);
    fly.t = reduceMotion ? 1 : 0;
    if (reduceMotion) { camera.position.copy(fly.toP); controls.target.copy(fly.toT); }
    buildText();
    setHeadline(headlineFor(station));
  }
  controls.addEventListener("start", () => { fly.t = 1; });

  let progress = 0;
  function enter(id) {
    buildText();
    setChartLabels();
    progress = reduceMotion ? 2 : 0;
    chartT = 0;
    candles.children.forEach((c) => { c.scale.y = 0.01; });
    camera.position.set(0, 34, 100);
    controls.target.set(0, 7.5, 0);
    fly.dur = 3.0;
    goto(id);
    hintEl.textContent = T().hint;
  }

  /* ── picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([...coins, proxy], false)[0]?.object || null;
  }
  function pick(ev) {
    const o = hit(ev);
    if (!o) return;
    if (o === proxy) progress = 0;                 // scatter and rebuild
    else o.userData.burst = 14;                    // flip the coin
  }
  const hover = (ev) => !!hit(ev);

  /* ── per frame */
  let time = 0;
  function update(dt) {
    time += dt;
    figure.material.uniforms.uTime.value = time;
    progress = Math.min(2, progress + dt / 2.4);
    figure.material.uniforms.uProgress.value = progress;
    fig.rotation.y = Math.sin(time * 0.35) * 0.45;
    floor.material.uniforms.uTime.value = time;
    ring.material.opacity = 0.7 + Math.sin(time * 2.4) * 0.2;
    ring2.rotation.z += dt * 0.4;

    chartT = Math.min(1, chartT + dt / 2.8);
    const n = Math.max(2, Math.floor(chartT * N));
    [naive, ours].forEach((sr) => { sr.line.geometry.setDrawRange(0, n); sr.head.position.copy(sr.pts[n - 1]); });
    candles.children.forEach((c, i) => { if (time > i * 0.08) c.scale.y += (1 - c.scale.y) * 0.08; });
    coins.forEach((m) => {
      const u = m.userData;
      u.burst = Math.max(0, u.burst - dt * 9);
      m.rotation.z += dt * (u.spin + u.burst);
      m.position.y = u.y + Math.sin(time * 0.9 + u.phase) * 0.6;
    });
    formulas.forEach((s) => {
      const u = s.userData;
      s.position.y += dt * u.v;
      if (s.position.y > 28) s.position.y = -3;
      s.material.opacity = u.base * (0.75 + 0.25 * Math.sin(time * 1.1 + u.ph)) * Math.min(1, (28 - s.position.y) / 4) * Math.min(1, (s.position.y + 3) / 3);
    });
    if (headline) headline.position.y = 16.8 + Math.sin(time * 1.2) * 0.25;

    if (fly.t < 1) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
      camera.position.lerpVectors(fly.fromP, fly.toP, e);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      if (fly.t >= 1) fly.dur = 2.2;
    }
    controls.update();
  }

  /* ── ticker tape */
  function ticker() {
    const { r, calc, money } = getCost();
    const items = [
      ["LFRG", ""], ["COST/STUDENT", `${money(r.oursT / calc.students, true)} ▼`], ["VS NAIVE", `×${(r.naiveT / Math.max(r.oursT, 1e-9)).toFixed(1)}`],
      ["TUTOR TURN", "4.1k tok (naive 13k)"], ["GENERATION", "1× PER CLASS"], ["RAG", "TOP-5"], ["CACHED", "16%"],
      ["AI OUTPUT", "SCHEMA ✓"], ["PROVIDERS", "CLAUDE · GEMINI · DEMO"], ["WORKFLOW", "25 s"],
    ];
    const one = items.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join("");
    tickerTrack.innerHTML = one + one;
  }

  return {
    scene, camera, controls, enter, goto, update, pick, hover,
    setPixelRatio(pr) { figure.material.uniforms.uPix.value = pr; },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
    setSlide(s) {
      const on = s.chapter === 3;
      document.body.classList.toggle("biz", on);
      if (on) ticker();
    },
    refresh() {
      ticker();
      if (!built) return;
      setChartLabels();
      if (station === "calculator") setHeadline(headlineFor(station));
    },
    setLang() { hintEl.textContent = T().hint; if (built) setHeadline(headlineFor(station)); },
  };
}
