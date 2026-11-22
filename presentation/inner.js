/**
 * Inside the sun — the Platform chapter. A second three.js scene with four interactive stations:
 *   community  : a living network of students; click one to ask a question and watch it get answered
 *   insights   : the anonymity reactor; signals stay frosted until 5 different students sent one
 *   experience : six feature crystals around the forge core, each with a live demo (real speech included)
 *   roles      : a role lens; pick a role and see exactly which powers it gets
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const STATIONS = {
  community: { at: V(0, 0, 0), cam: V(0, 2.5, 24), look: V(0, 0, 0) },
  insights: { at: V(80, 0, -30), cam: V(0, 6.5, 22), look: V(0, 3, 0) },
  experience: { at: V(-80, 0, -30), cam: V(0, 5, 21), look: V(0, 0.6, 0) },
  roles: { at: V(0, 0, -95), cam: V(0, 0.5, 25), look: V(-0.5, 0, 0) },
};
const SECTIONS = ["§1.1", "§1.2", "§2.1", "§2.2", "§3.1", "§3.2"];
const ROLE_COLORS = ["#efe6d6", "#a78bfa", "#f2b45a", "#f08ac8"];
// permission matrix, same rows as the roles table (0.5 = only on your own question)
const PERMS = [[1, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1], [0, 0, 1, 1], [0.5, 1, 1, 1], [0, 0, 1, 1], [0, 0, 1, 0], [0, 0, 0, 1]];
const FEATS = [
  { id: "lang", color: "#a78bfa" }, { id: "math", color: "#f2b45a" }, { id: "voice", color: "#b39ae6" },
  { id: "progress", color: "#f29ad0" }, { id: "sources", color: "#7aa7dc" }, { id: "login", color: "#efe6d6" },
];
const GREETINGS = [["FR", "Je n'ai pas compris cette partie"], ["EN", "I didn't get this part"], ["AR", "لم أفهم هذا الجزء"], ["DERJA", "ما فهمتش البارتي هاذي"]];

const T = {
  en: {
    questions: ["What is a derivative, really?", "Why is TCP reliable?", "How do I compute a variance?", "Primary key vs foreign key?", "Bayes' theorem, concretely?"],
    answered: (who) => `✓ Answered by a ${who}`, tutor: "peer tutor", teacher: "teacher",
    hidden: "hidden · fewer than 5", students: (n) => `${n} students`,
    msgNew: "Signal received. Still hidden — fewer than 5 different students.",
    msgReveal: (s) => `5 different students on ${s}: it now appears on the teacher's heatmap.`,
    msgDup: "Counted once. An HMAC token recognises the same student again — without knowing who it is.",
    msgClar: (s) => `Clarification posted on ${s}. Opted-in students get a notification.`,
    msgNone: "No section has reached 5 students yet — keep signalling.",
    msgReset: "Reset. Every section starts hidden again.",
    feats: { lang: "4 languages", math: "Real math", voice: "Read aloud", progress: "Private progress", sources: "Any source", login: "Playful login" },
    roles: ["Student", "Peer tutor", "Teacher", "Moderator"],
    perms: ["Learn, practise, community", "Approve glossary terms", "Stuck-topics queue", "Class insights", "Accept answers & pin", "1 vote accepts a correction", "Class roster & announcements", "Moderation & accounts"],
    voiceLine: "Hi! I read your course aloud. The derivative of x squared is two x.",
    reading: "Reading aloud · 1×", noVoice: "Speech isn't available in this browser.",
    progress: "Chapter 2 · only you can see this", sources: "PDF · DOCX · scan (OCR) · YouTube → one structured course",
    login: "Link two concepts from the same subject", mathCap: "rendered with KaTeX · spoken as words",
  },
  fr: {
    questions: ["C'est quoi une dérivée, vraiment ?", "Pourquoi TCP est fiable ?", "Comment on calcule une variance ?", "Clé primaire ou clé étrangère ?", "Le théorème de Bayes, concrètement ?"],
    answered: (who) => `✓ Réponse d'un ${who}`, tutor: "tuteur pair", teacher: "enseignant",
    hidden: "caché · moins de 5", students: (n) => `${n} étudiants`,
    msgNew: "Signal reçu. Toujours caché — moins de 5 étudiants différents.",
    msgReveal: (s) => `5 étudiants différents sur ${s} : la section apparaît sur la carte de l'enseignant.`,
    msgDup: "Compté une seule fois. Un jeton HMAC reconnaît le même étudiant — sans savoir qui il est.",
    msgClar: (s) => `Clarification publiée sur ${s}. Les étudiants abonnés reçoivent une notification.`,
    msgNone: "Aucune section n'a encore atteint 5 étudiants — continue à signaler.",
    msgReset: "Réinitialisé. Toutes les sections redeviennent cachées.",
    feats: { lang: "4 langues", math: "De vraies maths", voice: "Lecture à voix haute", progress: "Progression privée", sources: "Toute source", login: "Connexion ludique" },
    roles: ["Étudiant", "Tuteur pair", "Enseignant", "Modérateur"],
    perms: ["Apprendre, s'entraîner, communauté", "Valider le glossaire", "File des sujets bloqués", "Indicateurs de classe", "Accepter & épingler", "1 vote valide une correction", "Liste de classe & annonces", "Modération & comptes"],
    voiceLine: "Salut ! Je lis ton cours à voix haute. La dérivée de x au carré est deux x.",
    reading: "Lecture à voix haute · 1×", noVoice: "La synthèse vocale n'est pas disponible dans ce navigateur.",
    progress: "Chapitre 2 · visible par toi seul", sources: "PDF · DOCX · scan (OCR) · YouTube → un seul cours structuré",
    login: "Relie deux notions de la même matière", mathCap: "rendu avec KaTeX · lu en mots",
  },
};

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textSprite(text, color) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,8,4,0.85)";
  g.strokeStyle = color; g.lineWidth = 4;
  g.beginPath(); g.roundRect(6, 6, 244, 84, 18); g.fill(); g.stroke();
  g.fillStyle = color; g.font = "600 40px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(2.4, 0.9, 1);
  return s;
}

export function createInner({ canvas, labelsEl, getLang, reduceMotion, noise }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0302");
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
  camera.position.set(0, 0, 120);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 6;
  controls.maxDistance = 70;
  controls.rotateSpeed = 0.55;
  const labels = new CSS2DRenderer({ element: labelsEl });
  labels.setSize(innerWidth, innerHeight);
  const glow = glowTexture();
  const L = () => T[getLang()] || T.en;

  /* ───────────── atmosphere: plasma shell + rising embers */
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(700, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${noise} varying vec3 vDir; uniform float uTime;
      void main(){
        float n = fbm(vDir*2.6 + vec3(uTime*0.02, uTime*0.015, 0.0));
        float f = fbm(vDir*5.5 - vec3(0.0, uTime*0.03, uTime*0.02));
        float fil = pow(1.0 - abs(f*2.0 - 1.0), 7.0);
        vec3 col = mix(vec3(0.07, 0.015, 0.006), vec3(0.36, 0.10, 0.025), smoothstep(0.3, 0.8, n));
        col += fil * vec3(1.0, 0.45, 0.12) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  scene.add(plasma);

  const EMB = 2600;
  const ePos = new Float32Array(EMB * 3), eSeed = new Float32Array(EMB);
  for (let i = 0; i < EMB; i++) {
    ePos.set([(Math.random() - 0.5) * 360, (Math.random() - 0.5) * 320, (Math.random() - 0.5) * 360 - 40], i * 3);
    eSeed[i] = Math.random();
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute("aSeed", new THREE.BufferAttribute(eSeed, 1));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uWarp: { value: 0 } },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uWarp; varying float vS;
      void main(){ vec3 p = position; p.y = mod(p.y + uTime*(1.2 + aSeed*2.5)*(1.0 + uWarp*6.0) + 160.0, 320.0) - 160.0;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = (1.0 + aSeed*2.6)*(1.0 + uWarp)*(220.0 / -mv.z); vS = aSeed; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vS; uniform float uWarp;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        vec3 c = mix(vec3(1.0,0.45,0.12), vec3(1.0,0.85,0.55), vS);
        gl_FragColor = vec4(c*(1.2 + uWarp), (1.0 - d*2.0)*(0.55 + 0.45*vS)); }`,
  });
  scene.add(new THREE.Points(eGeo, emberMat));
  scene.add(new THREE.AmbientLight("#5a3020", 1.1));
  const key = new THREE.PointLight("#ffd2a0", 2.2, 0, 0);
  key.position.set(0, 40, 60);
  scene.add(key);

  /* ───────────── shared helpers */
  const timers = [];
  let clockT = 0;
  const after = (s, fn) => timers.push({ at: clockT + (reduceMotion ? 0 : s), fn });
  const sparks = [];
  function spark(fromFn, toFn, { dur = 0.35, color = "#ffe2b0", size = 0.55, onArrive } = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(color).multiplyScalar(1.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size);
    scene.add(s);
    sparks.push({ s, fromFn, toFn, t: 0, dur: reduceMotion ? 0.01 : dur, onArrive });
  }
  function label(html, cls = "", side = "above") {
    const anchor = document.createElement("div");
    anchor.className = "lanchor";
    const el = document.createElement("div");
    el.className = `ilabel ${side} ${cls}`;
    el.innerHTML = html;
    anchor.appendChild(el);
    return { obj: new CSS2DObject(anchor), el };
  }
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  let root = null;            // the slide panel, for live stats
  let interacted = 0;         // last time the user touched a station (pauses the auto-demo)
  const setStat = (k, v) => root?.querySelectorAll(`[data-stat="${k}"]`).forEach((e) => { e.textContent = v; });
  const setMsg = (m) => { const e = root?.querySelector('[data-stat="msg"]'); if (e) { e.textContent = m; e.classList.remove("flash"); void e.offsetWidth; e.classList.add("flash"); } };

  /* ═════════════ station 1 · community network */
  const com = { group: new THREE.Group(), nodes: [], adj: [], asked: 0, answered: 0, follows: null, showFollows: false };
  {
    const g = com.group;
    g.position.copy(STATIONS.community.at);
    scene.add(g);
    const N = 66, geo = new THREE.SphereGeometry(1, 18, 14);
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), phi = i * 2.39996;
      const pos = V(Math.cos(phi) * r, y * 0.8, Math.sin(phi) * r).multiplyScalar(7 + Math.random() * 2.4);
      const type = i % 11 === 3 ? "teacher" : i % 6 === 1 ? "tutor" : "student";
      const base = new THREE.Color(type === "teacher" ? "#f2b45a" : type === "tutor" ? "#a78bfa" : "#efe6d6");
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: base.clone() }));
      m.position.copy(pos);
      m.scale.setScalar(type === "teacher" ? 0.36 : type === "tutor" ? 0.3 : 0.21);
      m.userData = { station: "community", i, type, base, glow: 0, glowColor: new THREE.Color("#ffffff") };
      g.add(m);
      com.nodes.push(m);
      com.adj.push([]);
    }
    const seg = [];
    const has = new Set();
    com.nodes.forEach((a, i) => {
      const near = com.nodes.map((b, j) => [j, a.position.distanceTo(b.position)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3);
      near.forEach(([j]) => {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (has.has(k)) return;
        has.add(k);
        com.adj[i].push(j); com.adj[j].push(i);
        seg.push(a.position, com.nodes[j].position);
      });
    });
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: "#d08a4a", transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })));
    const fpts = [];
    for (let k = 0; k < 30; k++) {
      const a = com.nodes[(Math.random() * N) | 0].position, b = com.nodes[(Math.random() * N) | 0].position;
      if (a === b) continue;
      const c = a.clone().add(b).multiplyScalar(0.5).multiplyScalar(1.45);
      const curve = new THREE.QuadraticBezierCurve3(a, c, b).getPoints(18);
      for (let s = 0; s < curve.length - 1; s++) fpts.push(curve[s], curve[s + 1]);
    }
    com.follows = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fpts), new THREE.LineBasicMaterial({ color: "#c4a8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(com.follows);
  }
  function flashNode(n, color, k = 1) { n.userData.glow = k; n.userData.glowColor.set(color); }
  function ask(i) {
    const nodes = com.nodes, root0 = nodes[i];
    com.asked++;
    setStat("asked", com.asked);
    flashNode(root0, "#ffffff", 1.4);
    const qs = L().questions;
    const q = label(`« ${qs[(Math.random() * qs.length) | 0]} »`, "q");
    root0.add(q.obj);
    q.obj.position.set(0, 1.6, 0);
    q.obj.visible = com.group.visible;
    after(3.2, () => { root0.remove(q.obj); });
    // breadth-first ripple through the network until a tutor or teacher is reached
    const parent = new Map([[i, -1]]), depth = new Map([[i, 0]]);
    const queue = [i];
    let responder = -1;
    while (queue.length) {
      const v = queue.shift();
      if (depth.get(v) >= 4) continue;
      for (const w of com.adj[v]) {
        if (parent.has(w)) continue;
        parent.set(w, v); depth.set(w, depth.get(v) + 1);
        queue.push(w);
        if (responder < 0 && nodes[w].userData.type !== "student") responder = w;
      }
    }
    for (const [w, d] of depth) {
      if (w === i || d > 3) continue;
      const p = parent.get(w);
      after(d * 0.33 - 0.3, () => spark(() => wp(nodes[p]), () => wp(nodes[w]), { dur: 0.32, color: "#ffd9a0", size: 0.45, onArrive: () => flashNode(nodes[w], "#ffe6c0", 0.8) }));
    }
    if (responder >= 0) {
      const path = [];
      for (let v = responder; v !== -1; v = parent.get(v)) path.push(v);
      const start = depth.get(responder) * 0.33 + 0.5;
      after(start, () => flashNode(nodes[responder], nodes[responder].userData.type === "teacher" ? "#ffd27a" : "#cdb2ff", 1.6));
      for (let h = 0; h < path.length - 1; h++) {
        const a = path[h], b = path[h + 1];
        after(start + 0.25 + h * 0.3, () => spark(() => wp(nodes[a]), () => wp(nodes[b]), { dur: 0.3, color: "#cdb2ff", size: 0.6 }));
      }
      after(start + 0.25 + (path.length - 1) * 0.3 + 0.3, () => {
        com.answered++;
        setStat("answered", com.answered);
        flashNode(root0, "#cdb2ff", 1.6);
        const who = nodes[responder].userData.type === "teacher" ? L().teacher : L().tutor;
        const a = label(L().answered(who), "a");
        root0.add(a.obj);
        a.obj.position.set(0, 1.6, 0);
        a.obj.visible = com.group.visible;
        after(2.6, () => root0.remove(a.obj));
      });
    }
  }

  /* ═════════════ station 2 · anonymity reactor */
  const ins = { group: new THREE.Group(), pillars: [], students: [], sets: [], last: null, sent: 0 };
  {
    const g = ins.group;
    g.position.copy(STATIONS.insights.at);
    scene.add(g);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.8, 0.35, 72), new THREE.MeshStandardMaterial({ color: "#2a140c", roughness: 0.55, metalness: 0.4, emissive: "#3a1408", emissiveIntensity: 0.5 }));
    plate.position.y = -0.2;
    g.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.06, 8, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff9a4a").multiplyScalar(1.6) }));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    SECTIONS.forEach((name, i) => {
      const x = (i - 2.5) * 3;
      const pg = new THREE.Group();
      pg.position.set(x, 0, Math.abs(i - 2.5) * 0.8 - 1);
      const mat = new THREE.MeshStandardMaterial({ color: "#9b928a", transparent: true, opacity: 0.38, roughness: 0.2, metalness: 0.1, emissive: "#000000" });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1, 40), mat);
      m.position.y = 0.5;
      m.userData = { station: "insights", i };
      pg.add(m);
      const cap = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#ffb060", blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }));
      cap.scale.setScalar(3);
      pg.add(cap);
      const lb = label("", "pill");
      pg.add(lb.obj);
      g.add(pg);
      ins.pillars.push({ g: pg, m, cap, lb, h: 1.4, shake: 0, cool: 0, name });
    });
    for (let s = 0; s < 40; s++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: "#efe6d6" }));
      m.userData = { a: (s / 40) * Math.PI * 2, r: 3.5 + (s % 4) * 1.15, y: 9 + Math.sin(s * 1.7) * 0.6, glow: 0 };
      g.add(m);
      ins.students.push(m);
    }
  }
  function seedInsights() {
    const seed = [6, 2, 0, 5, 3, 1];
    ins.sets = seed.map((n) => { const s = new Set(); while (s.size < n) s.add((Math.random() * 40) | 0); return s; });
    ins.sent = seed.reduce((a, b) => a + b, 0);
    ins.last = null;
    ins.pillars.forEach((p) => { p.cool = 0; });
    refreshPillars();
  }
  function refreshPillars() {
    ins.pillars.forEach((p, i) => {
      const n = ins.sets[i].size;
      p.lb.el.innerHTML = n >= 5 ? `<b>${p.name}</b><span>${L().students(n)}</span>` : `<b>${p.name}</b><span>${L().hidden}</span>`;
      p.lb.el.classList.toggle("on", n >= 5);
    });
    setStat("sent", ins.sent);
    setStat("visible", ins.sets.filter((s) => s.size >= 5).length);
  }
  function signal(pi, same = false) {
    let student, p = pi;
    if (same && ins.last) { [student, p] = ins.last; }
    else {
      if (p == null) { // prefer the hidden section closest to the threshold
        const cand = ins.sets.map((s, i) => [i, s.size]).filter(([, n]) => n < 5).sort((a, b) => b[1] - a[1]);
        p = cand.length ? cand[0][0] : (Math.random() * 6) | 0;
      }
      const free = ins.students.map((_, k) => k).filter((k) => !ins.sets[p].has(k));
      student = free.length ? free[(Math.random() * free.length) | 0] : (Math.random() * 40) | 0;
    }
    ins.last = [student, p];
    const st = ins.students[student], pil = ins.pillars[p];
    st.userData.glow = 1;
    spark(() => wp(st), () => wp(pil.m).add(V(0, pil.h / 2, 0)), {
      dur: 0.9, color: "#ffd9a0", size: 0.7,
      onArrive: () => {
        if (ins.sets[p].has(student)) {
          pil.shake = 1;
          setMsg(L().msgDup);
          spark(() => wp(pil.m).add(V(0, pil.h / 2, 0)), () => wp(st), { dur: 0.7, color: "#ff7a5a", size: 0.6 });
          return;
        }
        ins.sets[p].add(student);
        ins.sent++;
        const n = ins.sets[p].size;
        pil.shake = 0.6;
        if (n === 5) { pil.cap.material.opacity = 1; setMsg(L().msgReveal(pil.name)); }
        else if (n < 5) setMsg(L().msgNew);
        refreshPillars();
      },
    });
  }
  function clarify() {
    const best = ins.sets.map((s, i) => [i, s.size]).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1])[0];
    if (!best) { setMsg(L().msgNone); return; }
    const pil = ins.pillars[best[0]];
    pil.cool = 1;
    setMsg(L().msgClar(pil.name));
    ins.students.forEach((st, k) => after(k * 0.03, () => spark(() => wp(pil.m).add(V(0, pil.h / 2, 0)), () => wp(st), {
      dur: 0.8, color: "#cdb2ff", size: 0.45, onArrive: () => { st.userData.glow = 1; st.userData.teal = 1; },
    })));
  }

  /* ═════════════ station 3 · the forge core and its feature crystals */
  const exp = { group: new THREE.Group(), crystals: [], active: null, bubble: null, lines: null, gi: 0, speaking: false, srcSprites: [] };
  {
    const g = exp.group;
    g.position.copy(STATIONS.experience.at);
    scene.add(g);
    exp.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb060").multiplyScalar(1.5), wireframe: true }));
    g.add(exp.core);
    exp.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#ff9a40", blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
    exp.coreGlow.scale.setScalar(6);
    g.add(exp.coreGlow);
    FEATS.forEach((f, i) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: f.color, emissive: f.color, emissiveIntensity: 0.45, flatShading: true, roughness: 0.3, metalness: 0.2 }));
      m.userData = { station: "experience", feat: f.id, a: (i / FEATS.length) * Math.PI * 2, pulse: 0 };
      const lb = label("", "feat");
      lb.obj.position.set(0, 1.1, 0);
      m.add(lb.obj);
      m.userData.lb = lb;
      g.add(m);
      exp.crystals.push(m);
    });
    const b = label("", "bubble");
    b.obj.position.set(0, 3.1, 0);
    g.add(b.obj);
    exp.bubble = b;
    const lineGeo = new THREE.BufferGeometry().setFromPoints(new Array(12).fill(0).map(() => V(0, 0, 0)));
    exp.lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: "#ffe6c0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    g.add(exp.lines);
  }
  function pickVoice(lang) {
    const all = window.speechSynthesis?.getVoices() || [];
    const want = lang === "fr" ? "fr" : "en";
    const pool = all.filter((v) => v.lang.toLowerCase().startsWith(want));
    return pool.find((v) => /female|femme|amélie|amelie|audrey|marie|julie|denise|aria|jenny|samantha|zira|google/i.test(v.name)) || pool[0] || null;
  }
  function feature(id, user = true) {
    if (user) interacted = clockT;
    exp.active = id;
    const c = exp.crystals.find((m) => m.userData.feat === id);
    if (c) c.userData.pulse = 1;
    root?.querySelectorAll('[data-act="feat"]').forEach((b) => b.classList.toggle("active", b.dataset.feat === id));
    const el = exp.bubble.el;
    const tx = L();
    el.classList.remove("show"); void el.offsetWidth;
    if (id === "lang") {
      const [tag, line] = GREETINGS[exp.gi++ % GREETINGS.length];
      el.innerHTML = `<span class="tag">${tag}</span><span dir="auto" class="big">${line}</span>`;
    } else if (id === "math") {
      el.innerHTML = `<span class="math">f′(x) = lim<sub>h→0</sub> <span class="frac"><span>f(x+h) − f(x)</span><span>h</span></span></span><span class="cap">${tx.mathCap}</span>`;
    } else if (id === "voice") {
      if (!("speechSynthesis" in window)) { el.innerHTML = `<span class="cap">${tx.noVoice}</span>`; }
      else {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(tx.voiceLine);
        const v = pickVoice(getLang());
        if (v) u.voice = v;
        u.lang = v?.lang || (getLang() === "fr" ? "fr-FR" : "en-US");
        u.rate = 1; u.pitch = 1.08;
        exp.speaking = true;
        u.onend = u.onerror = () => { exp.speaking = false; };
        window.speechSynthesis.speak(u);
        el.innerHTML = `<span class="eqz"><i></i><i></i><i></i><i></i><i></i></span><span class="cap">${tx.reading}</span><span dir="auto" class="line">${tx.voiceLine}</span>`;
      }
    } else if (id === "progress") {
      el.innerHTML = `<svg viewBox="0 0 64 64" class="ring"><circle cx="32" cy="32" r="26"/><circle class="fill" cx="32" cy="32" r="26"/></svg><span class="big">72%</span><span class="cap">${tx.progress}</span>`;
    } else if (id === "sources") {
      el.innerHTML = `<span class="cap">${tx.sources}</span>`;
      ["PDF", "DOCX", "SCAN", "▶ YT"].forEach((t, k) => {
        const s = textSprite(t, ["#ffcf86", "#7aa7dc", "#efe6d6", "#ff7a5a"][k]);
        const ang = (k / 4) * Math.PI * 2 + 0.4;
        s.userData = { from: V(Math.cos(ang) * 14, 4 - k * 2, Math.sin(ang) * 6), t: -k * 0.18 };
        s.position.copy(s.userData.from);
        exp.group.add(s);
        exp.srcSprites.push(s);
      });
    } else if (id === "login") {
      el.innerHTML = `<span class="cap">${tx.login}</span>`;
      exp.lines.material.opacity = 1;
    }
    void el.offsetWidth;
    el.classList.add("show");
  }

  /* ═════════════ station 4 · the role lens */
  const rol = { group: new THREE.Group(), orbs: [], perms: [], beams: [], sel: 0 };
  {
    const g = rol.group;
    g.position.copy(STATIONS.roles.at);
    scene.add(g);
    ROLE_COLORS.forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c) }));
      m.position.set(-5, 4.5 - i * 3, 0);
      m.userData = { station: "roles", role: i };
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: c, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.3, depthWrite: false }));
      halo.scale.setScalar(3.4);
      m.add(halo);
      m.userData.halo = halo;
      const lb = label("", "role", "left");
      m.add(lb.obj);
      m.userData.lb = lb;
      g.add(m);
      rol.orbs.push(m);
    });
    PERMS.forEach((_, j) => {
      const y = 5.6 - j * 1.6;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color("#6b5a50") }));
      m.position.set(1.6 + Math.cos((y / 6.5) * 1.3) * 1.4, y, 0);
      m.userData = { station: "roles", perm: j };
      const lb = label("", "perm", "right");
      m.add(lb.obj);
      m.userData.lb = lb;
      g.add(m);
      rol.perms.push(m);
    });
    rol.orbs.forEach((o, i) => {
      rol.beams[i] = rol.perms.map((p) => {
        const mid = o.position.clone().add(p.position).multiplyScalar(0.5).add(V(0, 0, 2.2));
        const pts = new THREE.QuadraticBezierCurve3(o.position, mid, p.position).getPoints(30);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ROLE_COLORS[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        line.userData.pts = pts;
        g.add(line);
        return line;
      });
    });
  }
  function selectRole(i, user = true) {
    if (user) interacted = clockT;
    rol.sel = i;
    const tbl = root?.querySelector("table.roles");
    if (tbl) tbl.dataset.sel = String(i);
    root?.querySelectorAll('[data-act="role"]').forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.role) === i)));
    PERMS.forEach((row, j) => {
      if (!row[i]) return;
      const pts = rol.beams[i][j].userData.pts;
      after(j * 0.06, () => spark(() => rol.group.localToWorld(pts[0].clone()), () => rol.group.localToWorld(pts[pts.length - 1].clone()), { dur: 0.6, color: ROLE_COLORS[i], size: 0.5 }));
    });
  }

  /* ───────────── labels follow the language */
  function setLang() {
    const tx = L();
    exp.crystals.forEach((m) => { m.userData.lb.el.textContent = tx.feats[m.userData.feat]; });
    rol.orbs.forEach((m, i) => { m.userData.lb.el.textContent = tx.roles[i]; });
    rol.perms.forEach((m, j) => { m.userData.lb.el.textContent = tx.perms[j]; });
    refreshPillars();
  }

  /* ───────────── only the stations on screen are visible (and their labels) */
  const GROUPS = { community: com.group, insights: ins.group, experience: exp.group, roles: rol.group };
  function showStations(ids) {
    Object.entries(GROUPS).forEach(([k, g]) => {
      const on = ids.includes(k);
      g.visible = on;
      g.traverse((o) => { if (o.isCSS2DObject) o.visible = on; });
    });
  }

  /* ───────────── camera between stations */
  const fly = { t: 1, dur: 2.4, fromP: V(0, 0, 0), fromT: V(0, 0, 0), toP: V(0, 0, 0), toT: V(0, 0, 0) };
  let station = "community";
  function goto(id, { from } = {}) {
    if (!STATIONS[id]) return;
    showStations([station, id]);
    station = id;
    const st = STATIONS[id];
    fly.fromP.copy(from || camera.position);
    fly.fromT.copy(controls.target);
    fly.toP.copy(st.at).add(st.cam.clone().multiplyScalar(innerWidth < 900 ? 1.5 : 1));
    fly.toT.copy(st.at).add(st.look);
    fly.t = reduceMotion ? 1 : 0;
    if (reduceMotion) { camera.position.copy(fly.toP); controls.target.copy(fly.toT); showStations([id]); }
    interacted = -99;
  }
  /** Arrive from the sun's surface: start far out in the plasma and fall towards the station. */
  function enter(id) {
    const st = STATIONS[id] || STATIONS.community;
    camera.position.copy(st.at).add(V(0, 26, 95));
    controls.target.copy(st.at);
    fly.dur = 2.6;
    station = STATIONS[id] ? id : "community";
    goto(station);
  }
  controls.addEventListener("start", () => { if (fly.t < 1) { fly.t = 1; showStations([station]); } interacted = clockT; });

  /* ───────────── picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = station === "community" ? com.nodes : station === "insights" ? ins.pillars.map((p) => p.m)
      : station === "experience" ? exp.crystals : [...rol.orbs, ...rol.perms];
    return ray.intersectObjects(list, false)[0]?.object || null;
  }
  function pick(ev) {
    const o = hitAt(ev);
    if (!o) return false;
    interacted = clockT;
    const u = o.userData;
    if (u.station === "community") ask(u.i);
    else if (u.station === "insights") signal(u.i);
    else if (u.station === "experience") feature(u.feat);
    else if (u.station === "roles") {
      if (u.role != null) selectRole(u.role);
      else { const holders = PERMS[u.perm].map((v, i) => (v ? i : -1)).filter((i) => i >= 0); selectRole(holders[(holders.indexOf(rol.sel) + 1) % holders.length] ?? 0); }
    }
    return true;
  }
  let hovered = null;
  function hover(ev) {
    const o = hitAt(ev);
    if (hovered && hovered !== o) hovered.userData.hover = false;
    hovered = o;
    if (o) o.userData.hover = true;
    return !!o;
  }

  /* ───────────── panel actions */
  function act(name, data) {
    interacted = clockT;
    if (name === "ask") ask((Math.random() * com.nodes.length) | 0);
    else if (name === "follows") {
      com.showFollows = !com.showFollows;
      root?.querySelector('[data-act="follows"]')?.setAttribute("aria-pressed", String(com.showFollows));
    }
    else if (name === "signal") signal(null);
    else if (name === "again") { if (!ins.last) signal(null); else signal(null, true); }
    else if (name === "clarify") clarify();
    else if (name === "reset") { seedInsights(); setMsg(L().msgReset); }
    else if (name === "feat") feature(data.feat);
    else if (name === "role") selectRole(Number(data.role));
  }
  function bindPanel(el) {
    root = el;
    setStat("asked", com.asked); setStat("answered", com.answered);
    root?.querySelector('[data-act="follows"]')?.setAttribute("aria-pressed", String(com.showFollows));
    refreshPillars();
    if (station === "roles") selectRole(rol.sel, false);
    if (station === "experience" && exp.active) feature(exp.active, false);
  }

  /* ───────────── per-frame */
  const heat = (n) => new THREE.Color("#f2b45a").lerp(new THREE.Color("#e0442a"), Math.min(1, (n - 5) / 8));
  function update(dt, active) {
    clockT += dt;
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clockT) { const t = timers[i]; timers.splice(i, 1); t.fn(); }
    plasma.material.uniforms.uTime.value = clockT;
    emberMat.uniforms.uTime.value = clockT;

    // camera flight with an ember warp while travelling
    if (fly.t < 1) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
      camera.position.lerpVectors(fly.fromP, fly.toP, e);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      emberMat.uniforms.uWarp.value = Math.sin(fly.t * Math.PI) * 0.9;
      if (fly.t >= 1) { fly.dur = 2.4; showStations([station]); }
    } else emberMat.uniforms.uWarp.value *= 0.9;
    controls.update();

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t = Math.min(1, s.t + dt / s.dur);
      const e = s.t * s.t * (3 - 2 * s.t);
      s.s.position.lerpVectors(s.fromFn(), s.toFn(), e);
      if (s.t >= 1) { scene.remove(s.s); s.s.material.dispose(); sparks.splice(i, 1); s.onArrive?.(); }
    }

    // community
    com.group.rotation.y += dt * 0.05;
    com.nodes.forEach((n) => {
      const u = n.userData;
      u.glow = Math.max(0, u.glow - dt * 0.9);
      n.material.color.copy(u.base).lerp(u.glowColor, Math.min(1, u.glow)).multiplyScalar(1 + u.glow * 1.6 + (u.hover ? 0.8 : 0));
    });
    com.follows.material.opacity += ((com.showFollows ? 0.55 : 0) - com.follows.material.opacity) * 0.1;

    // insights
    ins.pillars.forEach((p, i) => {
      const n = ins.sets[i]?.size || 0;
      const on = n >= 5;
      const targetH = on ? 1.6 + n * 0.45 : 1.4;
      p.h += (targetH - p.h) * 0.08;
      p.m.scale.y = p.h;
      p.m.position.y = p.h / 2;
      p.shake = Math.max(0, p.shake - dt * 1.8);
      p.m.position.x = Math.sin(clockT * 60) * p.shake * 0.12;
      p.cool = Math.max(0, p.cool - dt * 0.25);
      const mat = p.m.material;
      const col = on ? heat(n).lerp(new THREE.Color("#a78bfa"), p.cool) : new THREE.Color("#9b928a");
      mat.color.lerp(col, 0.12);
      mat.emissive.lerp(on ? col.clone().multiplyScalar(0.7) : new THREE.Color(p.shake ? "#3a2a20" : "#000000"), 0.12);
      mat.opacity += ((on ? 0.92 : 0.36 + p.shake * 0.3) - mat.opacity) * 0.12;
      p.cap.position.y = p.h + 0.2;
      p.cap.material.color.copy(col);
      p.cap.material.opacity += ((on ? 0.65 + Math.sin(clockT * 3 + i) * 0.15 : 0) - p.cap.material.opacity) * 0.08;
      p.lb.obj.position.set(0, p.h + 1.0, 0);
      if (p.m.userData.hover) mat.emissive.add(new THREE.Color("#2a1408"));
    });
    ins.students.forEach((st) => {
      const u = st.userData;
      u.a += dt * 0.12;
      st.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(clockT + u.r) * 0.15, Math.sin(u.a) * u.r);
      u.glow = Math.max(0, u.glow - dt * 0.8);
      u.teal = Math.max(0, (u.teal || 0) - dt * 0.4);
      st.material.color.set("#efe6d6").lerp(new THREE.Color("#cdb2ff"), Math.min(1, u.teal)).multiplyScalar(1 + u.glow * 2);
    });

    // experience
    exp.core.rotation.y += dt * 0.35; exp.core.rotation.x += dt * 0.12;
    exp.coreGlow.material.opacity = 0.65 + Math.sin(clockT * 2.2) * 0.12 + (exp.speaking ? Math.abs(Math.sin(clockT * 9)) * 0.3 : 0);
    exp.crystals.forEach((m, i) => {
      const u = m.userData;
      u.a += dt * 0.16;
      m.position.set(Math.cos(u.a) * 6.4, Math.sin(u.a * 2 + i) * 0.8, Math.sin(u.a) * 6.4 * 0.55);
      m.rotation.y += dt * 0.8; m.rotation.x += dt * 0.3;
      u.pulse = Math.max(0, u.pulse - dt * 0.7);
      const speakingPulse = exp.speaking && u.feat === "voice" ? Math.abs(Math.sin(clockT * 9)) * 0.6 : 0;
      m.scale.setScalar(1 + u.pulse * 0.5 + speakingPulse * 0.3 + (u.hover ? 0.15 : 0));
      m.material.emissiveIntensity = 0.45 + u.pulse * 1.4 + speakingPulse + (exp.active === u.feat ? 0.4 : 0);
    });
    if (exp.lines.material.opacity > 0) {
      const pos = exp.lines.geometry.attributes.position;
      const order = [0, 2, 2, 4, 4, 1, 1, 3, 3, 5, 5, 0];
      order.forEach((ci, k) => pos.setXYZ(k, exp.crystals[ci].position.x, exp.crystals[ci].position.y, exp.crystals[ci].position.z));
      pos.needsUpdate = true;
      exp.lines.material.opacity = Math.max(0, exp.lines.material.opacity - dt * 0.18);
    }
    for (let i = exp.srcSprites.length - 1; i >= 0; i--) {
      const s = exp.srcSprites[i];
      s.userData.t += dt / 1.4;
      const t = Math.max(0, Math.min(1, s.userData.t));
      s.position.lerpVectors(s.userData.from, V(0, 0, 0), t * t);
      s.material.opacity = 1 - Math.max(0, (t - 0.85) / 0.15);
      if (t >= 1) { exp.group.remove(s); exp.srcSprites.splice(i, 1); exp.coreGlow.scale.setScalar(9); }
    }
    exp.coreGlow.scale.lerp(V(6, 6, 6), 0.06);

    // roles
    rol.orbs.forEach((o, i) => {
      const on = i === rol.sel;
      o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, on ? 1.25 : o.userData.hover ? 1.1 : 0.9, 0.12));
      o.userData.halo.material.opacity += ((on ? 0.75 : 0.18) - o.userData.halo.material.opacity) * 0.1;
      o.userData.lb.el.classList.toggle("on", on);
      rol.beams[i].forEach((b, j) => {
        const v = on ? PERMS[j][i] : 0;
        b.material.opacity += ((v === 1 ? 0.75 : v ? 0.3 : 0) - b.material.opacity) * 0.1;
      });
    });
    rol.perms.forEach((p, j) => {
      const v = PERMS[j][rol.sel];
      const c = v ? new THREE.Color(ROLE_COLORS[rol.sel]).multiplyScalar(v === 1 ? 1.6 : 0.8) : new THREE.Color("#4a3c34");
      p.material.color.lerp(c, 0.12);
      p.userData.lb.el.classList.toggle("on", !!v);
      p.userData.lb.el.classList.toggle("half", v === 0.5);
    });

    // gentle auto-demo while nobody is touching the station
    if (active && !reduceMotion && clockT - interacted > 9) {
      if (!update.next || clockT > update.next) {
        update.next = clockT + (station === "roles" ? 3.2 : 4.2);
        if (station === "community") ask((Math.random() * com.nodes.length) | 0);
        else if (station === "insights") signal(null);
        else if (station === "experience") feature(["lang", "math", "progress", "sources", "login", "lang"][(update.k = ((update.k || 0) + 1) % 6)], false);
        else if (station === "roles") selectRole((rol.sel + 1) % 4, false);
      }
    }
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    labels.setSize(innerWidth, innerHeight);
  }

  seedInsights();
  setLang();
  showStations(["community"]);
  return { scene, camera, controls, labels, enter, goto, update, resize, pick, hover, act, bindPanel, setLang, get station() { return station; } };
}
