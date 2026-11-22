// Low-poly building kit. Everything is made from Three.js primitives.
// B (builder) merges many coloured primitives into ONE mesh (vertex colours),
// which keeps draw calls low on weak GPUs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  ink: 0x2d2d2d, red: 0xff4d4d, postit: 0xfff9c4, paper: 0xfdfbf7,
  wood: 0xc89b6a, woodDark: 0x8a6240, wall: 0xf3e9d8, floor: 0xd9b991,
  board: 0x2f5d50, blue: 0x4a90d9, tunisBlue: 0x2f7fc1, green: 0x5cb85c,
  leaf: 0x4f9d5b, sand: 0xe6d3a8, white: 0xffffff, grey: 0x9aa3ad,
  dark: 0x3a3f4b, yellow: 0xffd166, orange: 0xf4a261, purple: 0x9b6bd6,
  teal: 0x2ec4b6, pink: 0xf78fb3, metal: 0xb8c0cc, glow: 0xfff1a8,
};

const VMAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
VMAT.userData.shared = true;
const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    geoCache.set(key, g);
  }
  return g;
}

export class B {
  constructor() {
    this.parts = [];
  }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.clone();
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m);
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }
  box(w, h, d, c, x, y, z, rx, ry, rz) {
    return this.add(cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), c, x, y, z, rx, ry, rz);
  }
  cyl(rt, rb, h, c, x, y, z, rx, ry, rz, seg = 8) {
    return this.add(cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), c, x, y, z, rx, ry, rz);
  }
  cone(r, h, c, x, y, z, rx, ry, rz, seg = 6) {
    return this.add(cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), c, x, y, z, rx, ry, rz);
  }
  sph(r, c, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) {
    return this.add(cached(`s${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), c, x, y, z, 0, 0, 0, sx, sy, sz);
  }
  /** Merge another builder's parts in, transformed. */
  use(fn, x = 0, y = 0, z = 0, ry = 0, s = 1) {
    const b = new B();
    fn(b);
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), new THREE.Vector3(s, s, s));
    for (const g of b.parts) {
      g.applyMatrix4(_m);
      this.parts.push(g);
    }
    return this;
  }
  /** One mesh for everything added so far. opts.fade → own transparent material. */
  mesh(opts = {}) {
    const geo = this.parts.length ? mergeGeometries(this.parts) : new THREE.BufferGeometry();
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    let m = VMAT;
    if (opts.fade || opts.basic || opts.side) {
      m = opts.basic
        ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      if (opts.fade) { m.transparent = true; m.opacity = opts.opacity ?? 1; }
      if (opts.side) m.side = THREE.DoubleSide;
    }
    const mesh = new THREE.Mesh(geo, m);
    mesh.userData.own = true;
    return mesh;
  }
}

/** Quick single-colour mesh helpers (own geometry is shared, material optional). */
export function part(build, opts) {
  const b = new B();
  build(b);
  return b.mesh(opts);
}
export function grp(x = 0, y = 0, z = 0, ...kids) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kids.forEach((k) => g.add(k));
  return g;
}

// ---------- flat things: screens, labels, glows ----------
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
export function shotTexture(name) {
  let t = texCache.get(name);
  if (!t) {
    t = texLoader.load(`shots/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(name, t);
  }
  return t;
}
/** A screen showing a real screenshot. Registered for "dive in" via userData.shot. */
export function screen(w, h, shot, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: shot ? shotTexture(shot) : null, color: shot ? 0xffffff : opts.color ?? 0xdfe8f2 })
  );
  m.userData.shot = shot;
  m.userData.isScreen = true;
  m.setShot = (s) => {
    m.userData.shot = s;
    m.material.map = shotTexture(s);
    m.material.color.set(0xffffff);
    m.material.needsUpdate = true;
  };
  return m;
}

/** Text drawn on a canvas → plane. Used for in-world labels (drawer names, signs). */
export function label(text, opts = {}) {
  const { w = 1, h = 0.3, bg = '#fff9c4', fg = '#2d2d2d', font = 'Patrick Hand', size = 0.62, border = true, bold = false } = opts;
  const px = 256;
  const cv = document.createElement('canvas');
  cv.width = Math.round(px * (w / h));
  cv.height = px;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (txt) => {
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    if (bg) {
      x.fillStyle = bg;
      x.fillRect(0, 0, cv.width, cv.height);
    }
    if (border && bg) {
      x.strokeStyle = '#2d2d2d';
      x.lineWidth = 12;
      x.strokeRect(6, 6, cv.width - 12, cv.height - 12);
    }
    x.fillStyle = fg;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const lines = String(txt).split('\n');
    let fs = (px * size) / (lines.length > 1 ? lines.length * 0.8 : 1);
    x.font = `${bold ? '700 ' : ''}${fs}px "${font}", "Kalam", "Comic Sans MS", sans-serif`;
    const widest = Math.max(...lines.map((l) => x.measureText(l).width));
    if (widest > cv.width * 0.9) {
      fs *= (cv.width * 0.9) / widest;
      x.font = `${bold ? '700 ' : ''}${fs}px "${font}", "Kalam", "Comic Sans MS", sans-serif`;
    }
    lines.forEach((l, i) => x.fillText(l, cv.width / 2, px / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
    tex.needsUpdate = true;
  };
  draw(text);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(m.userData.text));
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: !!(!bg || opts.fade), side: THREE.DoubleSide })
  );
  m.userData.text = text;
  m.setText = (t) => { m.userData.text = t; draw(t); };
  return m;
}

/** Unlit coloured mesh (for glows, lights, eyes, beams). */
export function glow(geo, color, opacity = 1) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
}
export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sph: (r, d = 1) => new THREE.IcosahedronGeometry(r, d),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 6) => new THREE.ConeGeometry(r, h, s),
  plane: (w, h) => new THREE.PlaneGeometry(w, h),
  ring: (ri, ro, s = 24) => new THREE.RingGeometry(ri, ro, s),
};
/** Soft fake shadow blob. */
let blobTex;
export function blob(r = 0.6, opacity = 0.28) {
  if (!blobTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(cv);
    blobTex.userData.shared = true;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  return m;
}

/** Many copies of one geometry. items: [{p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz]|n, c:hex}] */
export function instanced(geo, items, opts = {}) {
  const mat = opts.basic
    ? new THREE.MeshBasicMaterial({ transparent: !!opts.fade, opacity: opts.opacity ?? 1, side: opts.side ? THREE.DoubleSide : THREE.FrontSide })
    : new THREE.MeshLambertMaterial({ flatShading: true, transparent: !!opts.fade, opacity: opts.opacity ?? 1, side: opts.side ? THREE.DoubleSide : THREE.FrontSide });
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(...(it.p || [0, 0, 0]));
    d.rotation.set(...(it.r || [0, 0, 0]));
    const s = it.s ?? 1;
    Array.isArray(s) ? d.scale.set(...s) : d.scale.setScalar(s);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    im.setColorAt(i, _c.set(it.c ?? 0xffffff));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.userData.dummy = d;
  /** Update one instance: set(i, x,y,z, rx,ry,rz, s) */
  im.set = (i, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => {
    d.position.set(x, y, z);
    d.rotation.set(rx, ry, rz);
    d.scale.setScalar(s);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    im.instanceMatrix.needsUpdate = true;
  };
  im.frustumCulled = false;
  return im;
}

// ---------- people ----------
const SKINS = [0xf1c9a5, 0xe0ac69, 0xc68642, 0xa5673f, 0x8d5524, 0xf3d2b3];
const TOPS = [0x4a90d9, 0x5cb85c, 0xf4a261, 0x9b6bd6, 0x2ec4b6, 0xf78fb3, 0xffd166, 0x6c7a89, 0xe76f51];
const HAIRS = [0x2d2d2d, 0x3b2a1a, 0x5a3a22, 0x1a1a1a, 0x6b4a2b];
const STYLES = ['short', 'long', 'hijab', 'bun', 'short', 'hijab', 'curly', 'long'];
let seedN = 7;
function rnd() {
  seedN = (seedN * 16807) % 2147483647;
  return (seedN & 0xffff) / 0xffff;
}
/** Reset the random looks so a rebuilt scene has the same people. */
export function reseed(n = 7) { seedN = n; }
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];

/**
 * A chunky low-poly person: 4 draw calls (body, head, 2 arms) + 2 legs when standing.
 * opts: skin, top, bottom, hair, style ('short'|'long'|'hijab'|'bun'|'curly'|'bald'),
 *       glasses, seated, tall (scale), pack (backpack), beard, headphones
 * Returns a Group with .parts {head, armL, armR, legL, legR, body} and .tick(t).
 * Set .pose = 'idle' | 'type' | 'raise' | 'walk' | 'think' | 'cheer' | 'write' | 'sleepy' | 'point'
 */
export function person(o = {}) {
  const skin = o.skin ?? pick(SKINS), top = o.top ?? pick(TOPS), bottom = o.bottom ?? pick([0x34495e, 0x2d3e50, 0x5d4e6d, 0x3b3b3b, 0x4b6584]);
  const hair = o.hair ?? pick(HAIRS), style = o.style ?? pick(STYLES);
  const seated = !!o.seated, tall = o.tall ?? 1;
  const g = new THREE.Group();
  const hip = seated ? 0.5 : 0.78;

  const body = part((b) => {
    b.box(0.5, 0.62, 0.3, top, 0, hip + 0.33, 0);
    b.box(0.2, 0.08, 0.2, skin, 0, hip + 0.68, 0);
    if (o.pack) b.box(0.4, 0.46, 0.16, o.pack, 0, hip + 0.36, -0.23);
    if (seated) {
      b.box(0.2, 0.18, 0.5, bottom, -0.13, hip - 0.03, 0.2).box(0.2, 0.18, 0.5, bottom, 0.13, hip - 0.03, 0.2);
      b.box(0.18, 0.45, 0.18, bottom, -0.13, hip - 0.3, 0.42).box(0.18, 0.45, 0.18, bottom, 0.13, hip - 0.3, 0.42);
      b.box(0.2, 0.09, 0.28, C.ink, -0.13, 0.045, 0.47).box(0.2, 0.09, 0.28, C.ink, 0.13, 0.045, 0.47);
    } else if (style === 'hijab' && o.skirt !== false && rnd() > 0.5) {
      b.cyl(0.26, 0.34, 0.74, bottom, 0, hip - 0.36, 0);
      b.box(0.2, 0.08, 0.26, C.ink, -0.12, 0.04, 0.04).box(0.2, 0.08, 0.26, C.ink, 0.12, 0.04, 0.04);
      g.userData.skirt = true;
    }
  });
  g.add(body);

  let legL = null, legR = null;
  if (!seated && !g.userData.skirt) {
    const leg = (x) => {
      const m = part((b) => b.box(0.2, 0.7, 0.2, bottom, 0, -0.35, 0).box(0.2, 0.09, 0.28, C.ink, 0, -0.735, 0.04));
      m.position.set(x, hip, 0);
      g.add(m);
      return m;
    };
    legL = leg(-0.13);
    legR = leg(0.13);
  }

  const head = part((b) => {
    b.sph(0.24, skin, 0, 0.2, 0, 1, 1.05, 1);
    b.box(0.045, 0.06, 0.02, C.ink, -0.09, 0.22, 0.225).box(0.045, 0.06, 0.02, C.ink, 0.09, 0.22, 0.225);
    if (style === 'short') b.sph(0.25, hair, 0, 0.27, -0.03, 1.02, 0.85, 1.02);
    if (style === 'curly') b.sph(0.29, hair, 0, 0.3, -0.03, 1.05, 0.9, 1.05);
    if (style === 'long') b.sph(0.25, hair, 0, 0.27, -0.03, 1.03, 0.86, 1.03).box(0.5, 0.42, 0.14, hair, 0, 0.04, -0.17);
    if (style === 'bun') b.sph(0.25, hair, 0, 0.27, -0.03, 1.02, 0.85, 1.02).sph(0.11, hair, 0, 0.5, -0.1);
    if (style === 'hijab') {
      const hj = o.hijab ?? pick([0xf78fb3, 0x9b6bd6, 0x2ec4b6, 0xfdfbf7, 0x4a90d9, 0xf4a261]);
      b.sph(0.275, hj, 0, 0.22, -0.035, 1, 1.05, 1).box(0.44, 0.2, 0.36, hj, 0, -0.06, -0.02);
    }
    if (o.beard) b.box(0.3, 0.12, 0.1, hair, 0, 0.06, 0.17);
    if (o.glasses) b.box(0.15, 0.1, 0.02, C.ink, -0.1, 0.22, 0.235).box(0.15, 0.1, 0.02, C.ink, 0.1, 0.22, 0.235).box(0.06, 0.02, 0.02, C.ink, 0, 0.23, 0.235);
    if (o.headphones) b.box(0.56, 0.06, 0.08, C.red, 0, 0.46, 0).box(0.07, 0.2, 0.16, C.red, -0.27, 0.22, 0).box(0.07, 0.2, 0.16, C.red, 0.27, 0.22, 0);
  });
  head.position.set(0, hip + 0.72, 0);
  g.add(head);

  const arm = (x) => {
    const m = part((b) => b.box(0.14, 0.42, 0.16, top, 0, -0.19, 0).box(0.12, 0.16, 0.13, skin, 0, -0.47, 0));
    m.position.set(x, hip + 0.6, 0);
    g.add(m);
    return m;
  };
  const armL = arm(-0.33), armR = arm(0.33);

  g.scale.setScalar(tall);
  g.parts = { body, head, armL, armR, legL, legR };
  g.pose = seated ? 'type' : 'idle';
  const ph = rnd() * 10;
  g.userData.ph = ph;
  g.tick = (t) => {
    const p = g.pose, s = Math.sin, a = t + ph;
    body.scale.y = 1 + s(a * 1.6) * 0.012;
    head.rotation.set(s(a * 0.7) * 0.05, s(a * 0.45) * 0.28, 0);
    head.scale.y = (a % 3.7) < 0.12 ? 0.97 : 1;
    armL.rotation.set(0, 0, 0.06);
    armR.rotation.set(0, 0, -0.06);
    if (legL) { legL.rotation.x = 0; legR.rotation.x = 0; }
    if (p === 'type') {
      armL.rotation.x = -1.15 + s(a * 9) * 0.06;
      armR.rotation.x = -1.15 + s(a * 9 + 2) * 0.06;
      head.rotation.x = 0.22 + s(a * 0.7) * 0.04;
      head.rotation.y *= 0.4;
    } else if (p === 'raise') {
      armR.rotation.set(0, 0, -2.9 + s(a * 3) * 0.12);
      armL.rotation.x = -1.0;
      head.rotation.set(-0.12, 0, 0);
    } else if (p === 'walk') {
      const w = s(t * 7 + ph);
      armL.rotation.x = w * 0.6;
      armR.rotation.x = -w * 0.6;
      if (legL) { legL.rotation.x = -w * 0.6; legR.rotation.x = w * 0.6; }
      head.rotation.y *= 0.3;
    } else if (p === 'think') {
      armR.rotation.set(-2.0, 0, 0.5);
      head.rotation.set(0.1, 0.25 + s(a * 0.5) * 0.1, 0.08);
    } else if (p === 'cheer') {
      armL.rotation.set(0, 0, 2.7 + s(a * 6) * 0.2);
      armR.rotation.set(0, 0, -2.7 - s(a * 6 + 1) * 0.2);
      g.position.y = (g.userData.baseY || 0) + Math.abs(s(a * 6)) * 0.12;
    } else if (p === 'write') {
      armR.rotation.set(-1.25 + s(a * 6) * 0.05, 0, 0.25 + s(a * 5) * 0.08);
      armL.rotation.x = -1.0;
      head.rotation.set(0.35, s(a * 0.6) * 0.06, 0);
    } else if (p === 'sleepy') {
      head.rotation.set(0.42 + s(a * 0.8) * 0.1, s(a * 0.3) * 0.2, 0.1);
      armL.rotation.x = -1.0;
      armR.rotation.set(-2.2, 0, 0.5);
    } else if (p === 'point') {
      armR.rotation.set(-1.5, 0, -0.5 + s(a * 2) * 0.05);
    } else if (p === 'throw') {
      armR.rotation.set(-2.6, 0, -0.2);
    } else {
      armL.rotation.x = s(a * 1.1) * 0.05;
      armR.rotation.x = -s(a * 1.1) * 0.05;
    }
  };
  return g;
}

/** The two heroes, always dressed the same so the audience recognises them. */
export const yasmine = (o = {}) => person({ skin: 0xe0ac69, top: C.red, bottom: 0x34495e, hair: 0x3b2a1a, style: 'long', pack: 0xffd166, ...o });
export const karim = (o = {}) => person({ skin: 0xc68642, top: 0x3d6b8e, bottom: 0x3b3b3b, hair: 0x2d2d2d, style: 'short', glasses: true, beard: true, tall: 1.12, ...o });

// ---------- helper robots (the AI team) ----------
export const TEAM = {
  jordan: { color: 0x34495e, prop: 'baton', label: 'Jordan' },
  clara: { color: 0x4a90d9, prop: 'magnifier', label: 'Clara' },
  quinn: { color: 0x9b6bd6, prop: 'cards', label: 'Quinn' },
  alex: { color: 0xf4a261, prop: 'pencil', label: 'Alex' },
  sage: { color: 0x2ec4b6, prop: 'lantern', label: 'Sage' },
  max: { color: 0xe76f51, prop: 'envelope', label: 'Max' },
  riley: { color: 0xff4d4d, prop: 'stamp', label: 'Riley' },
  finder: { color: 0x5cb85c, prop: 'compass', label: 'Resource Finder' },
  sam: { color: 0xffd166, prop: 'book', label: 'Sam' },
  grader: { color: 0x6c7a89, prop: 'gauge', label: '' },
};
/** Small hovering robot: 3 draw calls. .tick(t) bobs and blinks. .parts {head, arm, eyes} */
export function robot(name) {
  const def = TEAM[name] || { color: C.grey };
  const col = def.color;
  const g = new THREE.Group();
  const body = part((b) => {
    b.box(0.5, 0.5, 0.4, col, 0, 0.55, 0);
    b.box(0.34, 0.22, 0.02, C.paper, 0, 0.58, 0.205);
    b.cyl(0.16, 0.05, 0.2, C.dark, 0, 0.2, 0);
    b.box(0.1, 0.34, 0.12, col, -0.32, 0.56, 0);
    if (def.prop === 'book') b.box(0.3, 0.2, 0.04, C.red, 0, 0.58, 0.22).box(0.02, 0.2, 0.05, C.paper, 0, 0.58, 0.225);
  });
  g.add(body);
  const head = part((b) => {
    b.box(0.46, 0.36, 0.38, C.paper, 0, 0.18, 0);
    b.box(0.38, 0.2, 0.02, C.dark, 0, 0.2, 0.195);
    b.cyl(0.015, 0.015, 0.16, C.dark, 0, 0.44, 0);
    b.sph(0.05, col, 0, 0.54, 0);
    b.box(0.05, 0.14, 0.14, col, -0.255, 0.18, 0).box(0.05, 0.14, 0.14, col, 0.255, 0.18, 0);
  });
  head.position.y = 0.84;
  g.add(head);
  const eyes = glow(G.box(0.07, 0.09, 0.01), 0x7dfcff);
  const eye2 = eyes.clone();
  eyes.position.set(-0.09, 0.2, 0.21);
  eye2.position.set(0.09, 0.2, 0.21);
  head.add(eyes, eye2);
  const arm = part((b) => {
    b.box(0.1, 0.34, 0.12, col, 0, -0.14, 0);
    const p = def.prop;
    if (p === 'baton') b.cyl(0.015, 0.015, 0.5, C.paper, 0, -0.34, 0.22, Math.PI / 2);
    if (p === 'magnifier') b.cyl(0.14, 0.14, 0.03, 0xbfe9ff, 0, -0.36, 0.3, Math.PI / 2, 0, 0, 10).cyl(0.02, 0.02, 0.2, C.woodDark, 0, -0.34, 0.1, Math.PI / 2);
    if (p === 'cards') b.box(0.22, 0.03, 0.3, C.postit, 0, -0.36, 0.14).box(0.22, 0.03, 0.3, C.paper, 0.02, -0.33, 0.14, 0, 0.2).box(0.22, 0.03, 0.3, 0xcdb4f6, -0.02, -0.3, 0.14, 0, -0.2);
    if (p === 'pencil') b.cyl(0.035, 0.035, 0.46, C.yellow, 0, -0.34, 0.2, Math.PI / 2, 0, 0, 6).cone(0.035, 0.1, C.ink, 0, -0.34, 0.48, Math.PI / 2);
    if (p === 'lantern') b.box(0.18, 0.24, 0.18, C.glow, 0, -0.46, 0.08).box(0.22, 0.04, 0.22, C.dark, 0, -0.32, 0.08).box(0.22, 0.04, 0.22, C.dark, 0, -0.6, 0.08);
    if (p === 'envelope') b.box(0.34, 0.24, 0.03, C.paper, 0, -0.4, 0.14).box(0.08, 0.08, 0.035, C.red, 0, -0.4, 0.145);
    if (p === 'stamp') b.cyl(0.11, 0.13, 0.08, C.red, 0, -0.5, 0.1).cyl(0.04, 0.04, 0.2, C.woodDark, 0, -0.38, 0.1);
    if (p === 'compass') b.cyl(0.14, 0.14, 0.04, C.metal, 0, -0.38, 0.16, Math.PI / 2, 0, 0, 10).box(0.03, 0.2, 0.02, C.red, 0, -0.38, 0.19);
    if (p === 'gauge') b.box(0.3, 0.2, 0.04, C.paper, 0, -0.38, 0.14);
  });
  arm.position.set(0.32, 0.7, 0);
  arm.rotation.x = -0.5;
  g.add(arm);
  g.parts = { body, head, arm, eyes, eye2 };
  g.work = 0; // 0..1 how busy (arm waggle)
  const ph = rnd() * 10;
  g.tick = (t) => {
    const a = t + ph;
    body.position.y = Math.sin(a * 2) * 0.04;
    head.position.y = 0.84 + Math.sin(a * 2 - 0.4) * 0.05;
    arm.position.y = 0.7 + Math.sin(a * 2) * 0.04;
    head.rotation.y = Math.sin(a * 0.6) * 0.2;
    const blink = (a % 3.1) < 0.1 ? 0.1 : 1;
    eyes.scale.y = eye2.scale.y = blink;
    arm.rotation.x = -0.5 + Math.sin(a * 10) * 0.35 * g.work;
  };
  return g;
}

// ---------- furniture & props (builder functions, compose with b.use) ----------
export const F = {
  desk: (b) => b.box(1.3, 0.07, 0.7, C.wood, 0, 0.76, 0).box(0.07, 0.74, 0.07, C.dark, -0.58, 0.37, -0.28).box(0.07, 0.74, 0.07, C.dark, 0.58, 0.37, -0.28)
    .box(0.07, 0.74, 0.07, C.dark, -0.58, 0.37, 0.28).box(0.07, 0.74, 0.07, C.dark, 0.58, 0.37, 0.28).box(1.2, 0.3, 0.04, C.woodDark, 0, 0.58, -0.3),
  chair: (b) => b.box(0.46, 0.06, 0.46, C.blue, 0, 0.46, 0).box(0.46, 0.5, 0.06, C.blue, 0, 0.78, 0.21)
    .box(0.05, 0.46, 0.05, C.dark, -0.2, 0.23, -0.2).box(0.05, 0.46, 0.05, C.dark, 0.2, 0.23, -0.2).box(0.05, 0.46, 0.05, C.dark, -0.2, 0.23, 0.2).box(0.05, 0.46, 0.05, C.dark, 0.2, 0.23, 0.2),
  laptopBase: (b) => b.box(0.5, 0.03, 0.34, C.metal, 0, 0.015, 0).box(0.5, 0.34, 0.03, C.metal, 0, 0.19, -0.17, -0.2),
  book: (b, c = C.red) => b.box(0.3, 0.07, 0.4, c, 0, 0.035, 0).box(0.27, 0.05, 0.37, C.paper, 0.015, 0.035, 0),
  plant: (b) => b.cyl(0.2, 0.15, 0.3, C.orange, 0, 0.15, 0).sph(0.3, C.leaf, 0, 0.6, 0, 1, 1.2, 1).sph(0.2, 0x69b572, 0.18, 0.78, 0.05),
  palm: (b) => {
    b.cyl(0.14, 0.2, 3.4, C.woodDark, 0, 1.7, 0, 0, 0, 0.06, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(1.5, 0.05, 0.4, C.leaf, 0.12 + Math.cos(a) * 0.7, 3.3, Math.sin(a) * 0.7, 0, -a, -0.45);
    }
  },
  tree: (b) => b.cyl(0.14, 0.2, 1.3, C.woodDark, 0, 0.65, 0, 0, 0, 0, 6).sph(0.8, 0x6a8f4e, 0, 1.8, 0, 1.15, 0.9, 1.1).sph(0.55, 0x7da35c, 0.5, 2.2, 0.2).sph(0.5, 0x5f8546, -0.5, 2.1, -0.2),
  house: (b, w = 3, h = 3, d = 3, door = C.tunisBlue) => {
    b.box(w, h, d, C.white, 0, h / 2, 0).box(w + 0.15, 0.2, d + 0.15, 0xf0ece2, 0, h + 0.1, 0);
    b.box(0.6, 1.2, 0.08, door, -w * 0.18, 0.6, d / 2 + 0.03).box(0.6, 0.6, 0.08, door, w * 0.22, h * 0.62, d / 2 + 0.03);
    b.sph(0.5, C.white, w * 0.15, h + 0.2, -d * 0.1, 1, 0.7, 1);
  },
  lamp: (b) => b.cyl(0.14, 0.16, 0.04, C.dark, 0, 0.02, 0).cyl(0.02, 0.02, 0.5, C.dark, 0, 0.27, 0).cone(0.2, 0.22, C.red, 0, 0.56, 0, 0, 0, 0, 8),
  clock: (b) => b.cyl(0.4, 0.4, 0.06, C.paper, 0, 0, 0, Math.PI / 2, 0, 0, 16).cyl(0.44, 0.44, 0.04, C.ink, 0, 0, -0.02, Math.PI / 2, 0, 0, 16),
  mug: (b) => b.cyl(0.07, 0.06, 0.14, C.paper, 0, 0.07, 0).box(0.03, 0.08, 0.06, C.paper, 0.09, 0.07, 0),
  cabinet: (b, w = 1, h = 2, d = 0.5, c = C.woodDark) => b.box(w, h, d, c, 0, h / 2, 0),
};

/** Paper airplane (points +z). */
export function plane(color = C.paper, s = 1) {
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 0.5, -0.3, 0.04, -0.4, 0, 0, -0.3, 0, 0, 0.5, 0, 0, -0.3, 0.3, 0.04, -0.4, 0, 0, 0.5, 0, -0.14, -0.35, 0, 0, -0.3];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide }));
  m.scale.setScalar(s);
  return m;
}
export const planeGeo = (() => {
  let geo;
  return () => {
    if (!geo) {
      geo = new THREE.BufferGeometry();
      const v = [0, 0, 0.5, -0.3, 0.04, -0.4, 0, 0, -0.3, 0, 0, 0.5, 0, 0, -0.3, 0.3, 0.04, -0.4, 0, 0, 0.5, 0, -0.14, -0.35, 0, 0, -0.3];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.computeVertexNormals();
    }
    return geo;
  };
})();

/** Speech / thought bubble with text. */
export function bubble(text, opts = {}) {
  const m = label(text, { w: opts.w ?? 1.6, h: opts.h ?? 0.5, bg: opts.bg ?? '#fdfbf7', font: opts.font ?? 'Patrick Hand', size: opts.size ?? 0.5, fg: opts.fg });
  m.renderOrder = 5;
  return m;
}

/** A flat sheet of paper. */
export function sheet(color = C.paper, w = 0.3, h = 0.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
  return m;
}

let groundN = 0;
/** Ground disc so places do not float in the void. */
export function ground(color = C.sand, r = 70) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshLambertMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  // every ground disc sits at its own height: two scenes are alive during a camera flight,
  // and two discs at the same height flicker (z-fighting)
  m.position.y = -0.03 - (groundN++ % 9) * 0.02;
  return m;
}

/** Simple low-poly city ring (white Tunis houses, blue doors, palms): 1 draw call. */
export function city(rIn = 16, rOut = 46, n = 46, seed = 3) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
  return part((b) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = rIn + r() * (rOut - rIn);
      const w = 2.5 + r() * 2.5, h = 2 + r() * 3.5, dd = 2.5 + r() * 2.5;
      b.use((x) => F.house(x, w, h, dd, r() > 0.25 ? C.tunisBlue : 0x3aa0a0), Math.cos(a) * d, 0, Math.sin(a) * d, r() * 6.28);
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = rIn - 3 + r() * (rOut - rIn);
      b.use(F.palm, Math.cos(a) * d, 0, Math.sin(a) * d, r() * 6, 0.9 + r() * 0.6);
    }
  });
}

/** Sample n points inside rendered text (for forming a word out of objects). Returns [[x,y]] centred, width = w. */
export function textPoints(text, n, w = 8, font = '700 120px Kalam, "Patrick Hand", sans-serif') {
  const cv = document.createElement('canvas');
  const x = cv.getContext('2d');
  x.font = font;
  const tw = Math.ceil(x.measureText(text).width) + 20;
  cv.width = tw; cv.height = 170;
  x.font = font; x.textBaseline = 'middle'; x.fillStyle = '#000';
  x.fillText(text, 10, 85);
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  // pick the grid step that gives about n filled cells, so the word is evenly covered
  let pts = [];
  for (let step = 14; step >= 2; step--) {
    pts = [];
    for (let j = step / 2; j < cv.height; j += step) for (let i = step / 2; i < cv.width; i += step) if (d[(Math.floor(j) * cv.width + Math.floor(i)) * 4 + 3] > 128) pts.push([i, j]);
    if (pts.length >= n) break;
  }
  const out = [];
  const sc = w / cv.width;
  for (let k = 0; k < n; k++) {
    const p = pts[Math.floor(((k + 0.5) / n) * pts.length)] || [cv.width / 2, 85];
    out.push([(p[0] - cv.width / 2) * sc, -(p[1] - 85) * sc]);
  }
  return out;
}
