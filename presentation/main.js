import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SLIDES, CHAPTERS, UI, BODIES } from "./slides.js";
import { createInner } from "./inner.js";
import { createBiz } from "./biz.js";

/* ════════════════════════════════════════════════════════════ state */
const $ = (s) => document.querySelector(s);
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lang = store.get("lf.deck.lang", (navigator.language || "en").startsWith("fr") ? "fr" : "en");
if (!UI[lang]) lang = "en";
let index = Math.max(0, Math.min(SLIDES.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
let exploring = false;

/* ════════════════════════════════════════════════════════════ planets */
const PLANETS = [
  { id: "clara", r: 7, size: 0.95, c1: "#8f7be8", c2: "#35298a", tilt: 0.2, a0: 0.4 },
  { id: "quinn", r: 10.5, size: 0.8, c1: "#e2a15c", c2: "#8c4a1c", tilt: 0.1, a0: 2.1 },
  { id: "alex", r: 14, size: 1.15, c1: "#d27ac0", c2: "#5e1f55", tilt: 0.35, a0: 4.0 },
  { id: "sage", r: 17.5, size: 1.0, c1: "#9fd2ea", c2: "#2b5d78", tilt: 0.15, a0: 5.4 },
  { id: "max", r: 21, size: 1.25, c1: "#d06a58", c2: "#6e2419", tilt: 0.05, a0: 1.2 },
  { id: "riley", r: 25, size: 1.05, c1: "#e3cf8c", c2: "#8d7639", tilt: 0.45, a0: 3.1, ring: true },
  { id: "sam", r: 36, size: 1.55, c1: "#7aa7dc", c2: "#22477a", tilt: 0.25, a0: 0.9, atmo: true },
  { id: "nova", r: 41.5, size: 1.3, c1: "#f1ece0", c2: "#b9b0a0", tilt: 0.1, a0: 3.9, glow: true },
];
const BELT = { inner: 28.5, outer: 32.5 };
const SUN_R = 3.2;
const ORBIT_K = 2.2;

/* ════════════════════════════════════════════════════════════ scene setup */
const canvas = $("#scene");
let renderer, scene, camera, controls, composer, bloom, labelRenderer;
const bodies = {};            // id -> { group, mesh, label, def, angle }
const pickables = [];
const comets = [];
const waves = [];
let inner = null, renderPass = null, mode = "outer", trans = null;
let sun, sunMat, sunGlow, beltGroup, beltDust, beltRocks, clusterPts, lonePts, clusterGlows = [];
let webgl = true;

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  webgl = false;
  document.body.classList.add("no-webgl");
}

const NOISE = /* glsl */ `
  float hash(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
  float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

function glowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,0.25)") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, mid);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Banded, noisy planet surface painted on a canvas — no image assets needed. */
function planetTexture(c1, c2, seed) {
  const W = 512, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const img = g.createImageData(W, H);
  const a = new THREE.Color(c1), b = new THREE.Color(c2);
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = (n) => ((n % 16) + 16) % 16; // wrap horizontally
    return (rnd(X(xi), yi) * (1 - u) + rnd(X(xi + 1), yi) * u) * (1 - v) + (rnd(X(xi), yi + 1) * (1 - u) + rnd(X(xi + 1), yi + 1) * u) * v;
  };
  const col = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 16, ny = (y / H) * 8;
      let n = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 4; o++) { n += amp * vnoise(nx * f, ny * f); amp *= 0.5; f *= 2; }
      const band = 0.5 + 0.5 * Math.sin(ny * 3.1 + n * 4.2 + seed);
      const k = Math.min(1, Math.max(0, band * 0.65 + n * 0.55 - 0.1));
      col.copy(b).lerp(a, k);
      const i = (y * W + x) * 4;
      img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function ringTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const base = new THREE.Color(color);
  for (let r = 256; r > 0; r -= 2) {
    const t = r / 256;
    const inBand = t > 0.6 && t < 1;
    const alpha = inBand ? (0.25 + 0.55 * Math.abs(Math.sin(r * 0.37)) * Math.abs(Math.sin(r * 0.11))) : 0;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.fillStyle = `rgba(${(base.r * 255) | 0},${(base.g * 255) | 0},${(base.b * 255) | 0},${alpha})`;
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeLabel(id, small = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `plabel${small ? " small" : ""}${id === "sun" ? " sun" : ""}`;
  el.dataset.body = id;
  el.innerHTML = `<b></b><span></span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); goToBody(id); });
  const anchor = document.createElement("div"); // zero-size anchor: the label sits just above the planet
  anchor.className = "lanchor";
  anchor.appendChild(el);
  return anchor;
}

function buildScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#05040b");
  camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 4000);
  camera.position.set(-8, 14, 58);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.5;
  controls.maxDistance = 420;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.addEventListener("start", () => { if (cam.t < 1) cam.t = 1; cam.user = true; });

  // nebula sky
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(1600, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `${NOISE} varying vec3 vDir; uniform float uTime;
        void main(){
          float n = fbm(vDir*2.2 + vec3(0.0, uTime*0.004, 0.0));
          float m = fbm(vDir*4.5 + 7.0);
          vec3 axis = normalize(vec3(0.35, 1.0, 0.25));
          float b = dot(vDir, axis);
          float band = exp(-b*b*12.0);
          float dust = fbm(vDir*9.0 + 3.0);
          float lanes = smoothstep(0.5, 0.72, fbm(vDir*16.0 + 11.0));
          vec3 violet = vec3(0.15, 0.05, 0.30) * smoothstep(0.42, 0.86, n);
          vec3 indigo = vec3(0.02, 0.04, 0.17) * smoothstep(0.3, 0.8, m);
          vec3 magenta = vec3(0.22, 0.03, 0.17) * smoothstep(0.62, 0.92, m) * (0.4 + band);
          vec3 milky = vec3(0.62, 0.52, 0.85) * band * (0.2 + 0.8*smoothstep(0.35, 0.8, dust)) * 0.32 * (1.0 - lanes*0.75);
          gl_FragColor = vec4(violet + indigo + magenta + milky, 1.0);
        }`,
    }),
  );
  nebula.name = "nebula";
  scene.add(nebula);

  // stars: two layers
  const starLayer = (count, size, rmin, rmax, opacity) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const tint = [new THREE.Color("#ffffff"), new THREE.Color("#cfe6ff"), new THREE.Color("#ffe6c4"), new THREE.Color("#d9ccff")];
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rmin + Math.random() * (rmax - rmin));
      pos.set([v.x, v.y, v.z], i * 3);
      const c = tint[(Math.random() * tint.length) | 0].clone().multiplyScalar(0.55 + Math.random() * 0.45);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity, depthWrite: false }));
  };
  scene.add(starLayer(4200, 1.2, 500, 1400, 0.85));
  const bright = starLayer(380, 2.4, 500, 1400, 0.9);
  bright.name = "bright";
  scene.add(bright);
  { // Milky Way: extra stars squeezed towards the galactic band
    const axis = new THREE.Vector3(0.35, 1, 0.25).normalize();
    const n = 5200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const tints = [new THREE.Color("#ffffff"), new THREE.Color("#d9ccff"), new THREE.Color("#ffd6f0"), new THREE.Color("#c9d8ff")];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.addScaledVector(axis, -v.dot(axis) * (0.82 + Math.random() * 0.17)).normalize().multiplyScalar(600 + Math.random() * 700);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = tints[(Math.random() * 4) | 0].clone().multiplyScalar(0.35 + Math.random() * 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })));
  }

  // lights
  scene.add(new THREE.AmbientLight("#41545c", 0.8));
  const light = new THREE.PointLight("#ffe3b8", 3.1, 0, 0);
  scene.add(light);

  // sun = Jordan
  sunMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 } },
    vertexShader: `varying vec3 vPos; varying vec3 vN; void main(){ vPos = position; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${NOISE} varying vec3 vPos; varying vec3 vN; uniform float uTime; uniform float uBoost;
      void main(){
        float n = fbm(vPos*0.85 + vec3(uTime*0.10, uTime*0.06, 0.0));
        float n2 = fbm(vPos*2.4 - vec3(0.0, uTime*0.18, uTime*0.05));
        vec3 deep = vec3(0.92, 0.36, 0.08), warm = vec3(1.0, 0.70, 0.30), hot = vec3(1.0, 0.94, 0.78);
        vec3 col = mix(deep, warm, smoothstep(0.30, 0.72, n));
        col = mix(col, hot, smoothstep(0.52, 0.86, n2) * 0.7);
        float rim = pow(1.0 - abs(vN.z), 2.2);
        col += rim * vec3(1.0, 0.55, 0.18) * 0.7;
        gl_FragColor = vec4(col * (1.35 + uBoost), 1.0);
      }`,
  });
  sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 64, 48), sunMat);
  sun.userData.id = "sun";
  scene.add(sun);
  pickables.push(sun);
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,214,150,1)", "rgba(255,160,70,0.35)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 }));
  sunGlow.scale.setScalar(SUN_R * 7);
  scene.add(sunGlow);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,170,90,0.6)", "rgba(255,120,40,0.12)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  corona.scale.setScalar(SUN_R * 18);
  scene.add(corona);
  const sunLabel = new CSS2DObject(makeLabel("sun"));
  sunLabel.position.set(0, SUN_R + 0.6, 0);
  sun.add(sunLabel);
  bodies.sun = { group: sun, mesh: sun, label: sunLabel.element.firstChild, def: { id: "sun", size: SUN_R, r: 0 }, pulse: 0 };

  // planets + orbits
  PLANETS.forEach((def, i) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: planetTexture(def.c1, def.c2, i + 1), roughness: 0.82, metalness: 0.0, emissive: new THREE.Color(def.c1), emissiveIntensity: def.glow ? 0.32 : 0.05 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.size, 48, 32), mat);
    mesh.rotation.z = def.tilt;
    mesh.userData.id = def.id;
    group.add(mesh);
    pickables.push(mesh);

    if (def.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(def.size * 1.45, def.size * 2.5, 96),
        new THREE.MeshBasicMaterial({ map: ringTexture(def.c1), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }),
      );
      ring.rotation.x = -Math.PI / 2 + 0.42;
      ring.rotation.y = 0.18;
      group.add(ring);
    }
    if (def.atmo) {
      group.add(new THREE.Mesh(new THREE.SphereGeometry(def.size * 1.14, 48, 32),
        new THREE.MeshBasicMaterial({ color: "#86b8ff", transparent: true, opacity: 0.13, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    }
    if (def.glow) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,250,235,0.9)", "rgba(200,230,225,0.25)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
      halo.scale.setScalar(def.size * 6);
      group.add(halo);
    }
    const label = new CSS2DObject(makeLabel(def.id));
    label.position.set(0, def.size * 1.08 + (def.ring ? 0.5 : 0.15), 0);
    group.add(label);
    scene.add(group);

    const pts = [];
    for (let k = 0; k <= 256; k++) {
      const a = (k / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * def.r, Math.sin(a) * def.r * 0.025, Math.sin(a) * def.r));
    }
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#7b6ae0", transparent: true, opacity: 0.16 }));
    scene.add(orbit);

    bodies[def.id] = { group, mesh, label: label.element.firstChild, def, angle: def.a0, orbit, pulse: 0 };
  });

  // Nova's moon: the resource finder
  {
    const nova = bodies.nova;
    const moonPivot = new THREE.Group();
    nova.group.add(moonPivot);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshStandardMaterial({ map: planetTexture("#c7c1b4", "#6f6a60", 11), roughness: 0.95 }));
    moon.position.set(2.7, 0.2, 0);
    moon.userData.id = "finder";
    moonPivot.add(moon);
    pickables.push(moon);
    const ml = new CSS2DObject(makeLabel("finder", true));
    ml.position.set(0, 0.45, 0);
    moon.add(ml);
    bodies.finder = { group: moon, mesh: moon, label: ml.element.firstChild, def: { id: "finder", size: 0.36, r: 0 }, pivot: moonPivot, pulse: 0 };
  }

  // asteroid belt = community
  beltGroup = new THREE.Group();
  scene.add(beltGroup);
  const dotTex = glowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0.6)");
  {
    const n = 2600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
      pos.set([Math.cos(a) * r, (Math.random() + Math.random() - 1) * 0.45, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    beltDust = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, color: "#9aa7a3", size: 0.16, transparent: true, opacity: 0.5, depthWrite: false }));
    beltGroup.add(beltDust);

    const rockCount = 240;
    beltRocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: "#8b877c", roughness: 1, flatShading: true, emissive: "#7b6ae0", emissiveIntensity: 0 }), rockCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < rockCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
      p.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.7, Math.sin(a) * r);
      q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      s.setScalar(0.07 + Math.random() ** 2 * 0.3);
      beltRocks.setMatrixAt(i, m.compose(p, q, s));
    }
    beltGroup.add(beltRocks);

    // class-insight clusters: groups of ≥5 light up, lone signals never do
    const cpos = [], lpos = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
      const r = BELT.inner + 1 + Math.random() * 2;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const members = 5 + ((Math.random() * 7) | 0);
      for (let j = 0; j < members; j++) cpos.push(cx + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.5, cz + (Math.random() - 0.5) * 1.2);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(205,178,255,0.9)", "rgba(150,110,240,0.25)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      glow.position.set(cx, 0, cz);
      glow.scale.setScalar(4.2);
      glow.userData.phase = Math.random() * 6;
      beltGroup.add(glow);
      clusterGlows.push(glow);
    }
    for (let j = 0; j < 46; j++) {
      const a = Math.random() * Math.PI * 2, r = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
      lpos.push(Math.cos(a) * r, (Math.random() - 0.5) * 0.5, Math.sin(a) * r);
    }
    const mk = (arr, color) => {
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.Points(g2, new THREE.PointsMaterial({ map: dotTex, color, size: 0.55, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    };
    clusterPts = mk(cpos, "#cdb2ff");
    lonePts = mk(lpos, "#8d9a97");
    beltGroup.add(clusterPts, lonePts);
  }

  // post-processing
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.55, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  biz.setPixelRatio(renderer.getPixelRatio());

  labelRenderer = new CSS2DRenderer({ element: $("#labels") });
  labelRenderer.setSize(innerWidth, innerHeight);
  inner = createInner({ canvas, labelsEl: $("#labels-inner"), getLang: () => lang, reduceMotion, noise: NOISE });

  // picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const pick = (ev) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.id : null;
  };
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (mode === "inner") { if (!trans) inner.pick(e); return; }
    if (mode === "biz") { if (!trans) biz.pick(e); return; }
    const id = pick(e);
    if (id) goToBody(id);
  });
  let hoverId = null;
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons) return;
    if (mode === "inner") { canvas.style.cursor = inner.hover(e) ? "pointer" : ""; return; }
    if (mode === "biz") { canvas.style.cursor = biz.hover(e) ? "pointer" : ""; return; }
    const id = pick(e);
    if (id === hoverId) return;
    if (hoverId && bodies[hoverId]) bodies[hoverId].label.classList.remove("hover");
    hoverId = id;
    if (id && bodies[id]) bodies[id].label.classList.add("hover");
    canvas.style.cursor = id ? "pointer" : "";
  });
}

/* ════════════════════════════════════════════════════════════ comets & waves */
const tmp = new THREE.Vector3();
function worldPos(id, out = new THREE.Vector3()) {
  const b = bodies[id];
  if (!b) return out.set(0, 0, 0);
  return b.mesh.getWorldPosition(out);
}

function comet(fromId, toId, { dur = 1.2, color = "#ffd38a", size = 0.2, onArrive } = {}) {
  if (reduceMotion || !webgl) { onArrive?.(); return; }
  const N = 34;
  const head = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) }));
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const base = new THREE.Color(color);
  for (let i = 0; i < N; i++) { const k = (1 - i / N) ** 1.6; col.set([base.r * k * 1.6, base.g * k * 1.6, base.b * k * 1.6], i * 3); }
  const trail = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const start = worldPos(fromId);
  for (let i = 0; i < N; i++) pos.set([start.x, start.y, start.z], i * 3);
  scene.add(head, trail);
  comets.push({ head, trail, fromId, toId, t: 0, dur, onArrive, arrived: false, linger: 0, N });
}

function updateComets(dt) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = comets.length - 1; i >= 0; i--) {
    const k = comets[i];
    worldPos(k.fromId, a);
    worldPos(k.toId, b);
    if (!k.arrived) {
      k.t = Math.min(1, k.t + dt / k.dur);
      const e = k.t < 0.5 ? 2 * k.t * k.t : 1 - (-2 * k.t + 2) ** 2 / 2;
      c.addVectors(a, b).multiplyScalar(0.5);
      c.y += a.distanceTo(b) * 0.22 + 1.2;
      p.set(0, 0, 0)
        .addScaledVector(a, (1 - e) * (1 - e))
        .addScaledVector(c, 2 * (1 - e) * e)
        .addScaledVector(b, e * e);
      k.head.position.copy(p);
      if (k.t >= 1) {
        k.arrived = true;
        k.head.visible = false;
        const body = bodies[k.toId];
        if (body) body.pulse = 1;
        k.onArrive?.();
      }
    } else {
      k.linger += dt;
    }
    const arr = k.trail.geometry.attributes.position.array;
    arr.copyWithin(3, 0, (k.N - 1) * 3);
    arr[0] = k.head.position.x; arr[1] = k.head.position.y; arr[2] = k.head.position.z;
    k.trail.geometry.attributes.position.needsUpdate = true;
    if (k.linger > 0.7) {
      scene.remove(k.head, k.trail);
      k.head.geometry.dispose(); k.trail.geometry.dispose();
      comets.splice(i, 1);
    }
  }
}

function shockwave(maxR = 33, color = "#a78bfa") {
  if (reduceMotion || !webgl) return;
  const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  waves.push({ m, t: 0, maxR });
}
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.t += dt / 1.8;
    const r = SUN_R + (w.maxR - SUN_R) * (1 - (1 - w.t) ** 2);
    w.m.scale.setScalar(r);
    w.m.material.opacity = 0.85 * (1 - w.t);
    if (w.t >= 1) { scene.remove(w.m); w.m.geometry.dispose(); waves.splice(i, 1); }
  }
}

/* ════════════════════════════════════════════════════════════ animation timelines */
const GEN = ["quinn", "alex", "sage", "max"];
const TIMELINES = {
  workflow: { length: 7.8, steps: [
    [0.0, () => setPhase(0)],
    [0.6, () => { setPhase(1); bodies.sun.pulse = 1; }],
    [1.3, () => { setPhase(2); comet("sun", "clara", { dur: 1.0, color: "#ffcf86" }); }],
    [2.5, () => { setPhase(3); GEN.forEach((id) => comet("clara", id, { dur: 1.25, color: "#b39dff" })); }],
    [4.1, () => { setPhase(4); GEN.forEach((id, i) => comet(id, "riley", { dur: 1.2 + i * 0.08, color: "#f0dc9a" })); }],
    [5.7, () => { setPhase(5); shockwave(); beltFlash = 1; }],
  ] },
  rag: { length: 5.6, steps: [
    [0.0, () => comet("nova", "sam", { dur: 1.0, color: "#f5efe2", size: 0.18 })],
    [1.1, () => { for (let i = 0; i < 5; i++) setTimeout(() => comet("sun", "sam", { dur: 1.3, color: "#ffc874", size: 0.13 }), i * 140); }],
    [3.2, () => comet("sam", "nova", { dur: 1.0, color: "#8fbaf0", size: 0.2 })],
  ] },
  nova: { length: 4.2, steps: [
    [0.0, () => {
      const pool = ["sam", "clara", "quinn", "alex", "sage", "max", "sun", "finder", "sam"];
      novaTarget = pool[(Math.random() * pool.length) | 0];
      comet("nova", novaTarget, { dur: novaTarget === "finder" ? 0.6 : 1.25, color: "#f5efe2", size: 0.17 });
    }],
    [1.9, () => comet(novaTarget, "nova", { dur: novaTarget === "finder" ? 0.6 : 1.25, color: "#f0a8e0", size: 0.17 })],
  ] },
};
let novaTarget = "sam";
let anim = null, animClock = 0, fired = new Set(), beltFlash = 0;

function setAnim(name) {
  if (anim === name) return;
  anim = name;
  animClock = 0;
  fired = new Set();
}
function tickTimeline(dt) {
  const tl = TIMELINES[anim];
  if (!tl) return;
  animClock += dt;
  tl.steps.forEach(([at, fn], i) => { if (animClock >= at && !fired.has(i)) { fired.add(i); fn(); } });
  if (animClock >= tl.length) { animClock = 0; fired = new Set(); }
}
function setPhase(i) {
  document.querySelectorAll("#panelInner .flow li").forEach((li) => {
    const p = Number(li.dataset.phase);
    li.classList.toggle("active", p === i);
    li.classList.toggle("done", p < i);
  });
}

/* ════════════════════════════════════════════════════════════ camera director */
const cam = { t: 1, dur: 2.2, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), goal: null, last: new THREE.Vector3(), user: false };
const PRESETS = {
  hero: () => ({ pos: new THREE.Vector3(-10, 15, 60), target: new THREE.Vector3(0, -2, 0) }),
  far: () => ({ pos: new THREE.Vector3(30, 70, 150), target: new THREE.Vector3(0, 0, 0) }),
  top: () => ({ pos: new THREE.Vector3(0, 108, 16), target: new THREE.Vector3(0, 0, 0) }),
  workflow: () => ({ pos: new THREE.Vector3(4, 44, 44), target: new THREE.Vector3(0, 0, 2) }),
  belt: () => ({ pos: new THREE.Vector3(18, 24, 50), target: new THREE.Vector3(0, -1, -4) }),
  orbit: () => ({ pos: new THREE.Vector3(-56, 24, 38), target: new THREE.Vector3(0, 0, 0) }),
  explore: () => ({ pos: new THREE.Vector3(0, 70, 92), target: new THREE.Vector3(0, 0, 0) }),
};

function focusGoal(id, variant) {
  return () => {
    if (id === "sun") return { pos: new THREE.Vector3(9, 4.2, 13.5), target: new THREE.Vector3(0, 0, 0) };
    const p = worldPos(id, new THREE.Vector3());
    const dir = p.clone().setY(0).normalize();
    const tan = new THREE.Vector3(-dir.z, 0, dir.x);
    if (variant === "wide") {
      const target = p.clone().multiplyScalar(0.5);
      return { pos: target.clone().addScaledVector(tan, 34).add(new THREE.Vector3(0, 30, 0)).addScaledVector(dir, 6), target };
    }
    const d = bodies[id].def.size * 6.5 + 7.5;
    return { pos: p.clone().addScaledVector(dir, -d * 0.5).addScaledVector(tan, d * 0.8).add(new THREE.Vector3(0, d * 0.42, 0)), target: p };
  };
}

function flyTo(goalFn) {
  if (!webgl) return;
  cam.fromPos.copy(camera.position);
  cam.fromTarget.copy(controls.target);
  cam.goal = goalFn;
  cam.t = reduceMotion ? 1 : 0;
  cam.user = false;
  const g = goalFn();
  cam.last.copy(g.target);
  if (reduceMotion) { camera.position.copy(g.pos); controls.target.copy(g.target); }
}

function updateCamera(dt) {
  if (!cam.goal) return;
  const g = cam.goal();
  if (cam.t < 1) {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const e = cam.t < 0.5 ? 4 * cam.t ** 3 : 1 - (-2 * cam.t + 2) ** 3 / 2;
    camera.position.lerpVectors(cam.fromPos, g.pos, e);
    controls.target.lerpVectors(cam.fromTarget, g.target, e);
  } else {
    tmp.subVectors(g.target, cam.last); // follow a moving planet while keeping the user's orbit offset
    camera.position.add(tmp);
    controls.target.add(tmp);
  }
  cam.last.copy(g.target);
}

/* view offset: keep the system centred in the space the panel leaves free */
const shift = { x: 0, y: 0, tx: 0, ty: 0 };
function computeShift() {
  const panel = $("#panel");
  if (exploring || !panel) { shift.tx = 0; shift.ty = 0; return; }
  const r = panel.getBoundingClientRect();
  if (innerWidth > 900) { shift.tx = (r.right + 8) / 2; shift.ty = 0; }
  else { shift.tx = 0; shift.ty = Math.min(r.height, innerHeight * 0.6) / 2; }
}

/* ════════════════════════════════════════════════════════════ render loop */
const clock = new THREE.Clock();
let elapsed = 0;
const flashEl = $("#flash");
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fwd = new THREE.Vector3();
function tickTransition(dt) {
  if (!trans) return;
  trans.t = Math.min(1, trans.t + dt / trans.dur);
  if (trans.kind === "dive") {
    flashEl.style.opacity = smooth(0.3, 1, trans.t);
    bodies.sun.pulse = Math.max(bodies.sun.pulse, trans.t);
    if (trans.t >= 1) {
      setMode("inner");
      inner.enter(trans.s.id);
      cam.dur = 2.2;
      trans = { kind: "reveal", t: 0, dur: 1.4 };
    }
  } else if (trans.kind === "rise") {
    flashEl.style.opacity = smooth(0.15, 1, trans.t);
    inner.camera.getWorldDirection(fwd);
    const step = dt * 90 * trans.t;
    inner.camera.position.addScaledVector(fwd, step);
    inner.controls.target.addScaledVector(fwd, step);
    if (trans.t >= 1 && trans.to === "biz") {
      setMode("biz");
      biz.enter(trans.s.id);
      trans = { kind: "reveal", t: 0, dur: 1.2 };
    } else if (trans.t >= 1) {
      const s = trans.s;
      setMode("outer");
      const g = goalFor(s)();
      camera.position.copy(g.pos).normalize().multiplyScalar(SUN_R * 0.3);
      controls.target.set(0, 0, 0);
      flyTo(goalFor(s));
      cam.dur = 2.6;
      setTimeout(() => { cam.dur = 2.2; }, 2700);
      setAnim(s.anim);
      bodies.sun.pulse = 1;
      shockwave(40, "#ffb060");
      trans = { kind: "reveal", t: 0, dur: 1.2 };
    }
  } else if (trans.kind === "swap") {
    flashEl.style.opacity = smooth(0, 1, trans.t);
    if (trans.t >= 1) {
      const s = trans.s;
      setMode(trans.to);
      if (trans.to === "biz") biz.enter(s.id);
      else { camera.position.set(0, 40, 150); controls.target.set(0, 0, 0); setAnim(s.anim); flyTo(goalFor(s)); }
      trans = { kind: "reveal", t: 0, dur: 1.0 };
    }
  } else {
    flashEl.style.opacity = 1 - smooth(0, 1, trans.t);
    if (trans.t >= 1) { flashEl.style.opacity = 0; flashEl.classList.remove("cool"); trans = null; }
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  tickTransition(dt);
  shift.x += (shift.tx - shift.x) * 0.08;
  shift.y += (shift.ty - shift.y) * 0.08;
  if (mode === "biz") {
    biz.update(dt);
    biz.camera.setViewOffset(innerWidth, innerHeight, -shift.x, shift.y, innerWidth, innerHeight);
    composer.render();
    requestAnimationFrame(frame);
    return;
  }
  if (mode === "inner") {
    inner.update(dt, !exploring && !trans);
    inner.camera.setViewOffset(innerWidth, innerHeight, -shift.x, shift.y, innerWidth, innerHeight);
    composer.render();
    inner.labels.render(inner.scene, inner.camera);
    requestAnimationFrame(frame);
    return;
  }
  const slide = SLIDES[index];
  const focused = exploring ? null : slide.focus;
  const timeScale = reduceMotion ? 0.12 : focused && slide.camVariant !== "wide" ? 0.35 : 1;

  sunMat.uniforms.uTime.value = elapsed;
  scene.getObjectByName("nebula").material.uniforms.uTime.value = elapsed;
  scene.getObjectByName("bright").material.opacity = 0.75 + Math.sin(elapsed * 1.3) * 0.15;
  sun.rotation.y += dt * 0.05;

  bodies.sun.pulse = Math.max(0, bodies.sun.pulse - dt * 1.4);
  sunMat.uniforms.uBoost.value = bodies.sun.pulse * 0.6;
  sunGlow.material.opacity = 0.72 + bodies.sun.pulse * 0.25 + Math.sin(elapsed * 2) * 0.03;

  PLANETS.forEach((def) => {
    const b = bodies[def.id];
    b.angle += dt * timeScale * (ORBIT_K / def.r ** 1.5);
    b.group.position.set(Math.cos(b.angle) * def.r, Math.sin(b.angle) * def.r * 0.025, Math.sin(b.angle) * def.r);
    b.mesh.rotation.y += dt * 0.25;
    b.pulse = Math.max(0, b.pulse - dt * 1.6);
    b.group.scale.setScalar(1 + b.pulse * 0.28);
    b.mesh.material.emissiveIntensity = (def.glow ? 0.32 : 0.05) + b.pulse * 0.9;
    const hot = focused === def.id || (exploring && b.label.classList.contains("hover"));
    b.orbit.material.opacity += ((hot ? 0.55 : 0.16) - b.orbit.material.opacity) * 0.08;
  });
  const fd = bodies.finder;
  fd.pivot.rotation.y += dt * 0.6 * timeScale;
  fd.pulse = Math.max(0, fd.pulse - dt * 1.6);
  fd.mesh.scale.setScalar(1 + fd.pulse * 0.5);

  beltGroup.rotation.y += dt * timeScale * (ORBIT_K / 30 ** 1.5);
  beltFlash = Math.max(0, beltFlash - dt * 0.9);
  const beltOn = anim === "belt" || anim === "insights";
  const dustTarget = anim === "belt" ? 0.95 : 0.5 + beltFlash * 0.4;
  beltDust.material.opacity += (dustTarget - beltDust.material.opacity) * 0.06;
  beltDust.material.size = 0.16 + (anim === "belt" ? 0.06 : 0);
  beltRocks.material.emissiveIntensity += ((anim === "belt" ? 0.35 : beltFlash * 0.5) - beltRocks.material.emissiveIntensity) * 0.08;
  const ins = anim === "insights";
  clusterPts.material.opacity += ((ins ? 0.95 : 0) - clusterPts.material.opacity) * 0.06;
  lonePts.material.opacity += ((ins ? 0.32 : 0) - lonePts.material.opacity) * 0.06;
  clusterGlows.forEach((g) => {
    const target = ins ? 0.55 + Math.sin(elapsed * 1.8 + g.userData.phase) * 0.25 : 0;
    g.material.opacity += (target - g.material.opacity) * 0.08;
  });
  document.body.classList.toggle("belt-on", beltOn);

  if (!exploring) tickTimeline(dt);
  updateComets(dt);
  updateWaves(dt);
  updateCamera(dt);
  controls.update();

  camera.setViewOffset(innerWidth, innerHeight, -shift.x, shift.y, innerWidth, innerHeight);

  document.body.classList.toggle("far", camera.position.distanceTo(controls.target) > 125);
  composer.render();
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function onResize() {
  if (!webgl) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
  inner.resize();
  biz.resize();
  computeShift();
}

/* ════════════════════════════════════════════════════════════ slides UI */
const panelInner = $("#panelInner");
const strip = (html) => html.replace(/<[^>]+>/g, "");

function slideHTML(s, l) {
  const c = s[l];
  return `<p class="eyebrow">${c.eyebrow}</p><h1>${c.title}</h1><div class="body">${c.body}</div>`;
}

let swapTimer = null;
function show(i, { instant = false } = {}) {
  index = (i + SLIDES.length) % SLIDES.length;
  const s = SLIDES[index];
  history.replaceState(null, "", `#${index + 1}`);
  const apply = () => {
    panelInner.innerHTML = slideHTML(s, lang);
    panelInner.dataset.slide = s.id;
    panelInner.scrollTop = 0;
    $("#panel").scrollTop = 0;
    if (s.calculator) mountCalculator(panelInner.querySelector("#calc"));
    if (s.chapter === 2 && inner) inner.bindPanel(panelInner);
    panelInner.classList.remove("out");
    void panelInner.offsetWidth;
    panelInner.classList.add("in");
    computeShift();
  };
  clearTimeout(swapTimer);
  if (instant) apply();
  else { panelInner.classList.remove("in"); panelInner.classList.add("out"); swapTimer = setTimeout(apply, 230); }

  Object.values(bodies).forEach((b) => b.label.classList.toggle("active", b.def.id === s.focus));
  document.body.dataset.slide = s.id;
  biz.setSlide(s);
  if (webgl && !exploring) routeScene(s);
  renderProgress();
}

/* ════════════════════════════════════════════════════════════ into / out of the sun */
const goalFor = (s) => (s.focus ? focusGoal(s.focus, s.camVariant) : PRESETS[s.cam || "hero"]);
function setMode(m) {
  mode = m;
  document.body.classList.toggle("in-core", m === "inner");
  document.body.classList.toggle("in-biz", m === "biz");
  controls.enabled = m === "outer";
  inner.controls.enabled = m === "inner";
  biz.controls.enabled = m === "biz";
  renderPass.scene = m === "inner" ? inner.scene : m === "biz" ? biz.scene : scene;
  renderPass.camera = m === "inner" ? inner.camera : m === "biz" ? biz.camera : camera;
  if (m === "outer" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
const modeFor = (s) => (s.chapter === 2 ? "inner" : s.chapter === 3 ? "biz" : "outer");
function enterNow(m, s) {
  setMode(m);
  if (m === "inner") inner.enter(s.id);
  else if (m === "biz") biz.enter(s.id);
  else { setAnim(s.anim); flyTo(goalFor(s)); }
}
function routeScene(s) {
  const want = modeFor(s);
  const heading = trans && trans.kind !== "reveal" ? (trans.kind === "dive" ? "inner" : trans.to) : mode;
  if (want === heading) {
    if (trans && trans.kind !== "reveal") { trans.s = s; return; }
    if (want === "inner") inner.goto(s.id);
    else if (want === "biz") biz.goto(s.id);
    else { setAnim(s.anim); flyTo(goalFor(s)); }
    return;
  }
  if (trans && trans.kind !== "reveal") { // changed our mind mid-transition: cancel it
    trans = null; flashEl.style.opacity = 0; flashEl.classList.remove("cool"); cam.dur = 2.2;
    if (mode === want) { routeScene(s); return; }
  }
  if (reduceMotion) { enterNow(want, s); return; }
  if (mode === "outer" && want === "inner") { // dive: fall into the sun, the screen floods with light
    setAnim(null);
    const dir = camera.position.clone().normalize();
    flyTo(() => ({ pos: dir.clone().multiplyScalar(SUN_R * 0.25), target: dir.clone().multiplyScalar(-6) }));
    cam.dur = 1.8;
    trans = { kind: "dive", t: 0, dur: 1.8, s, to: "inner" };
  } else if (mode === "inner") {
    trans = { kind: "rise", t: 0, dur: 1.0, s, to: want };
  } else {
    flashEl.classList.add("cool");
    trans = { kind: "swap", t: 0, dur: 0.7, s, to: want };
  }
}

function renderProgress() {
  const wrap = $("#progress");
  const groups = CHAPTERS[lang].map((name, ci) => {
    const dots = SLIDES.map((s, i) => [s, i]).filter(([s]) => s.chapter === ci)
      .map(([s, i]) => `<button type="button" class="pdot${i === index ? " on" : ""}${i < index ? " past" : ""}" data-i="${i}" aria-label="${i + 1}. ${strip(s[lang].title)}" ${i === index ? 'aria-current="step"' : ""}></button>`).join("");
    const cur = SLIDES[index].chapter === ci;
    return `<div class="chap${cur ? " cur" : ""}"><span class="chap-name">${name}</span><div class="dots">${dots}</div></div>`;
  });
  wrap.innerHTML = groups.join("");
  $("#counter").textContent = `${index + 1} / ${SLIDES.length}`;
}

function goToBody(id) {
  const target = id === "finder" ? "nova" : id;
  const i = SLIDES.findIndex((s) => s.focus === target);
  if (i < 0) return;
  if (exploring) setExplore(false);
  show(i);
}

function setExplore(on) {
  exploring = on;
  document.body.classList.toggle("exploring", on);
  $("#exploreBtn").setAttribute("aria-pressed", String(on));
  $("#exploreBtn .lbl").textContent = on ? UI[lang].present : UI[lang].explore;
  const hint = $("#explore-hint");
  hint.hidden = !on;
  hint.textContent = UI[lang].exploreHint;
  computeShift();
  if (!webgl) return;
  if (on) { if (mode === "outer") { setAnim(null); flyTo(PRESETS.explore); } }
  else show(index, { instant: true });
}

function setLang(l) {
  lang = l;
  store.set("lf.deck.lang", l);
  document.documentElement.lang = l;
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === l)));
  $("#exploreBtn .lbl").textContent = exploring ? UI[l].present : UI[l].explore;
  $("#explore-hint").textContent = UI[l].exploreHint;
  $("#prevBtn").setAttribute("aria-label", UI[l].prev);
  $("#nextBtn").setAttribute("aria-label", UI[l].next);
  Object.entries(BODIES).forEach(([id, info]) => {
    const b = bodies[id];
    if (!b) return;
    b.label.querySelector("b").textContent = info.name;
    b.label.querySelector("span").textContent = info.role[l];
    b.label.setAttribute("aria-label", `${info.name} — ${info.role[l]}. ${UI[l].open}`);
  });
  panelInner.innerHTML = slideHTML(SLIDES[index], lang);
  if (SLIDES[index].calculator) mountCalculator(panelInner.querySelector("#calc"));
  panelInner.classList.add("in");
  if (inner) inner.setLang();
  biz.setLang();
  $("#core-badge").textContent = UI[l].core;
  renderProgress();
  buildPrint();
}

/* ════════════════════════════════════════════════════════════ cost calculator */
// Token figures measured from our own llm_calls log (see deck footnote). Prices are editable assumptions.
const TOK = {
  genIn: 100_000, genOut: 18_000,          // one full course generation, all agents incl. Riley
  tutorIn: 4_100, tutorOut: 150, tutorCached: 0.16,
  gradeIn: 1_400, gradeOut: 190,
  corpus: 9_000,                           // whole test course, what a naive tutor would resend each turn
  history: 3_000,
};
const WEEKS = 4.33;
const calc = { students: 300, classSize: 30, courses: 4, questions: 15, graded: 5, smartIn: 0.3, smartOut: 2.5, fastIn: 0.1, fastOut: 0.4, cacheDisc: 75 };

function costs(v) {
  const classes = Math.max(1, Math.ceil(v.students / v.classSize));
  const turns = v.students * v.questions * WEEKS;
  const grades = v.students * v.graded * WEEKS;
  const genOne = (TOK.genIn * v.smartIn + TOK.genOut * v.smartOut) / 1e6;
  const fastInEff = v.fastIn * (1 - TOK.tutorCached) + v.fastIn * (1 - v.cacheDisc / 100) * TOK.tutorCached;
  const ours = {
    gen: classes * v.courses * genOne,
    tutor: (turns * (TOK.tutorIn * fastInEff + TOK.tutorOut * v.fastOut)) / 1e6,
    grade: (grades * (TOK.gradeIn * v.fastIn + TOK.gradeOut * v.fastOut)) / 1e6,
  };
  const naive = {
    gen: v.students * v.courses * genOne,
    tutor: (turns * ((TOK.corpus + TOK.history + 1_000) * v.smartIn + TOK.tutorOut * v.smartOut)) / 1e6,
    grade: (grades * ((TOK.corpus + TOK.gradeIn) * v.smartIn + TOK.gradeOut * v.smartOut)) / 1e6,
  };
  const sum = (o) => o.gen + o.tutor + o.grade;
  return { ours, naive, oursT: sum(ours), naiveT: sum(naive), classes };
}

const CALC_TXT = {
  en: {
    students: "Students", classSize: "Class size", courses: "New courses / class / month", questions: "Tutor messages / student / week", graded: "Graded exercises / student / week",
    perMonth: "per month", perStudent: "per student / month", cheaper: "cheaper", naive: "Naive approach", ours: "LessonForge",
    gen: "Course generation", tutor: "Tutor (Nova / Sam)", grade: "Exercise grading", total: "Total",
    prices: "Price assumptions (USD per 1M tokens)", smartIn: "Smart in", smartOut: "Smart out", fastIn: "Fast in", fastOut: "Fast out", cacheDisc: "Cache discount %",
    more: "More assumptions & prices", breakdown: "Breakdown",
    note: `Tokens measured from our call logs. Prices are editable examples. <strong>Naive</strong> = each student generates their own copy, smart model everywhere, no RAG, no cache.`,
  },
  fr: {
    students: "Étudiants", classSize: "Taille de classe", courses: "Nouveaux cours / classe / mois", questions: "Messages au tuteur / étudiant / semaine", graded: "Exercices corrigés / étudiant / semaine",
    perMonth: "par mois", perStudent: "par étudiant / mois", cheaper: "moins cher", naive: "Approche naïve", ours: "LessonForge",
    gen: "Génération des cours", tutor: "Tuteur (Nova / Sam)", grade: "Correction d'exercices", total: "Total",
    prices: "Hypothèses de prix (USD par million de tokens)", smartIn: "Smart entrée", smartOut: "Smart sortie", fastIn: "Rapide entrée", fastOut: "Rapide sortie", cacheDisc: "Remise cache %",
    more: "Autres hypothèses & prix", breakdown: "Détail",
    note: `Tokens mesurés dans nos journaux d'appels. Prix modifiables, à titre d'exemple. <strong>Naïf</strong> = chaque étudiant génère sa copie, modèle « smart » partout, pas de RAG, pas de cache.`,
  },
};
const SLIDERS = [["students", 30, 5000, 10], ["classSize", 5, 120, 1], ["courses", 1, 12, 1], ["questions", 0, 80, 1], ["graded", 0, 30, 1]];
const PRICE_KEYS = ["smartIn", "smartOut", "fastIn", "fastOut", "cacheDisc"];

const money = (x, small = false) => {
  const loc = lang === "fr" ? "fr-FR" : "en-US";
  const digits = small ? (x < 0.1 ? 3 : 2) : x < 100 ? 2 : 0;
  return new Intl.NumberFormat(loc, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
};
const num = (x) => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US").format(x);

const MAIN_SLIDERS = ["students", "questions", "classSize"];
function mountCalculator(root, { readonly = false } = {}) {
  if (!root) return;
  const T = CALC_TXT[lang];
  const slider = ([k, min, max, step]) => `<label class="sl"><span>${T[k]} <output data-out="v-${k}"></output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${calc[k]}" data-k="${k}" /></label>`;
  root.innerHTML = `
    <div class="calc">
      <div class="calc-hero">
        <div><b class="calc-x" data-out="ratio"></b><span>${T.cheaper}</span></div>
        <div><b data-out="perStudent"></b><span>${T.perStudent}</span></div>
      </div>
      <div class="bars" role="group" aria-label="${T.naive} / ${T.ours}">
        <div class="bar-row" tabindex="0" data-which="naive"><span class="bar-name">${T.naive}</span><div class="bar-track"><i class="bar naive"></i></div><span class="bar-val" data-out="naiveT"></span></div>
        <div class="bar-row" tabindex="0" data-which="ours"><span class="bar-name">${T.ours}</span><div class="bar-track"><i class="bar ours"></i></div><span class="bar-val" data-out="oursT"></span></div>
      </div>
      ${readonly ? "" : `<div class="sliders">
        ${SLIDERS.filter(([k]) => MAIN_SLIDERS.includes(k)).map(slider).join("")}
      </div>`}
      <details class="prices"${readonly ? " open" : ""}><summary>${T.breakdown}</summary>
      <table class="breakdown">
        <thead><tr><th></th><th>${T.naive}</th><th>${T.ours}</th></tr></thead>
        <tbody>
          ${["gen", "tutor", "grade"].map((k) => `<tr><td>${T[k]}</td><td data-out="n-${k}"></td><td data-out="o-${k}"></td></tr>`).join("")}
          <tr class="tot"><td>${T.total} <span class="muted">· ${T.perMonth}</span></td><td data-out="n-t"></td><td data-out="o-t"></td></tr>
        </tbody>
      </table></details>
      ${readonly ? "" : `<details class="prices"><summary>${T.more}</summary>
        <div class="sliders">${SLIDERS.filter(([k]) => !MAIN_SLIDERS.includes(k)).map(slider).join("")}</div>
        <p class="tiny-cap">${T.prices}</p>
        <div class="price-grid">
        ${PRICE_KEYS.map((k) => `<label><span>${T[k]}</span><input type="number" min="0" step="${k === "cacheDisc" ? 5 : 0.01}" value="${calc[k]}" data-k="${k}" /></label>`).join("")}
      </div></details>`}
      <p class="calc-note">${T.note}</p>
    </div>`;
  const out = (k) => root.querySelector(`[data-out="${k}"]`);
  const update = () => {
    const r = costs(calc);
    out("ratio").textContent = `×${new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 }).format(r.naiveT / Math.max(r.oursT, 1e-9))}`;
    out("perStudent").textContent = money(r.oursT / calc.students, true);
    out("naiveT").textContent = money(r.naiveT);
    out("oursT").textContent = money(r.oursT);
    const max = Math.max(r.naiveT, r.oursT, 1e-9);
    root.querySelector(".bar.naive").style.width = `${(r.naiveT / max) * 100}%`;
    root.querySelector(".bar.ours").style.width = `${Math.max(1.2, (r.oursT / max) * 100)}%`;
    ["gen", "tutor", "grade"].forEach((k) => { out(`n-${k}`).textContent = money(r.naive[k]); out(`o-${k}`).textContent = money(r.ours[k]); });
    out("n-t").textContent = money(r.naiveT);
    out("o-t").textContent = money(r.oursT);
    SLIDERS.forEach(([k]) => { const o = out(`v-${k}`); if (o) o.textContent = num(calc[k]); });
    root._r = r;
    if (!readonly) biz.refresh();
  };
  root.querySelectorAll("input[data-k]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v) && v >= 0) calc[inp.dataset.k] = inp.dataset.k === "cacheDisc" ? Math.min(100, v) : v;
      update();
    });
  });
  // hover / focus tooltip with the breakdown
  const tip = $("#tooltip");
  root.querySelectorAll(".bar-row").forEach((row) => {
    const showTip = (x, y) => {
      const r = root._r; if (!r) return;
      const o = row.dataset.which === "ours" ? r.ours : r.naive;
      tip.innerHTML = `<strong>${row.dataset.which === "ours" ? T.ours : T.naive}</strong>
        <div><span>${T.gen}</span><b>${money(o.gen)}</b></div><div><span>${T.tutor}</span><b>${money(o.tutor)}</b></div><div><span>${T.grade}</span><b>${money(o.grade)}</b></div>`;
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = `${Math.min(innerWidth - w - 8, x + 14)}px`;
      tip.style.top = `${Math.max(8, y - h - 12)}px`;
    };
    row.addEventListener("pointermove", (e) => showTip(e.clientX, e.clientY));
    row.addEventListener("pointerleave", () => { tip.hidden = true; });
    row.addEventListener("focus", () => { const b = row.getBoundingClientRect(); showTip(b.left + b.width / 2, b.top); });
    row.addEventListener("blur", () => { tip.hidden = true; });
  });
  update();
}

const biz = createBiz({ canvas, getCost: () => ({ r: costs(calc), calc, money }), getLang: () => lang, reduceMotion });

/* ════════════════════════════════════════════════════════════ print deck (Ctrl/⌘+P → PDF) */
function buildPrint() {
  const root = $("#print");
  root.innerHTML = SLIDES.map((s, i) => `<section class="print-slide"><div class="print-meta">LessonForge · ${i + 1} / ${SLIDES.length}</div>${slideHTML(s, lang)}</section>`).join("");
  root.querySelectorAll("#calc").forEach((el) => { el.removeAttribute("id"); mountCalculator(el, { readonly: true }); });
}

/* ════════════════════════════════════════════════════════════ input */
$("#prevBtn").addEventListener("click", () => show(index - 1));
panelInner.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (b && inner && mode === "inner") inner.act(b.dataset.act, b.dataset);
});
$("#nextBtn").addEventListener("click", () => show(index + 1));
$("#progress").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) show(Number(b.dataset.i)); });
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
$("#exploreBtn").addEventListener("click", () => setExplore(!exploring));
$("#fsBtn").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, select, textarea, summary")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === "ArrowRight" || k === "PageDown" || (k === " " && !e.target.closest?.("button, a"))) { e.preventDefault(); if (exploring) setExplore(false); show(index + 1); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); if (exploring) setExplore(false); show(index - 1); }
  else if (k === "Home") show(0);
  else if (k === "End") show(SLIDES.length - 1);
  else if (k === "e" || k === "E") setExplore(!exploring);
  else if (k === "f" || k === "F") $("#fsBtn").click();
  else if (k === "p" || k === "P") window.print();
  else if (k === "Escape" && exploring) setExplore(false);
});
addEventListener("hashchange", () => {
  const i = (parseInt(location.hash.slice(1), 10) || 1) - 1;
  if (i !== index && i >= 0 && i < SLIDES.length) show(i);
});
{ // swipe on the panel
  let sx = null, sy = null;
  const panel = $("#panel");
  panel.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener("touchend", (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest("input")) show(index + (dx < 0 ? 1 : -1));
    sx = null;
  });
}
addEventListener("resize", onResize);
addEventListener("beforeprint", buildPrint);

/* ════════════════════════════════════════════════════════════ boot */
if (webgl) {
  try {
    buildScene();
    onResize();
  } catch (err) {
    console.error(err);
    webgl = false;
    document.body.classList.add("no-webgl");
  }
}
setLang(lang);
if (webgl && modeFor(SLIDES[index]) !== "outer") { setMode(modeFor(SLIDES[index])); }
show(index, { instant: true });
if (webgl && mode !== "outer") {
  if (mode === "inner") inner.enter(SLIDES[index].id); else biz.enter(SLIDES[index].id);
  requestAnimationFrame(frame);
} else if (webgl) {
  const g = (SLIDES[index].focus ? focusGoal(SLIDES[index].focus, SLIDES[index].camVariant) : PRESETS[SLIDES[index].cam || "hero"])();
  camera.position.copy(g.pos).add(new THREE.Vector3(0, 40, 120)); // fly in on load
  flyTo(SLIDES[index].focus ? focusGoal(SLIDES[index].focus, SLIDES[index].camVariant) : PRESETS[SLIDES[index].cam || "hero"]);
  cam.dur = 3.2;
  setTimeout(() => { cam.dur = 2.2; }, 3300);
  requestAnimationFrame(frame);
}
document.body.classList.add("ready");
