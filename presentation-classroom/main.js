// LessonForge — A Day at School. Stage manager: renderer, camera flights,
// scene/beat navigation, moods, dive-into-screen, explore mode.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Tweens, ease } from './anim.js';
import { ORDER, TEXT } from './scenes.js';
import { REGISTRY } from './scenes/index.js';
import { UI, initNotesWindow } from './ui.js';

const params = new URLSearchParams(location.search);
if (params.has('notes')) {
  initNotesWindow();
} else {
  start();
}

function start() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
  const SCENES = ORDER.map((id) => ({ id, ...REGISTRY[id] })).filter((s) => s.build);

  // ---------- renderer ----------
  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3ff);
  scene.fog = new THREE.Fog(0xbfe3ff, 40, 140);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8c7a8, 1.6);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(-8, 14, 9);
  scene.add(hemi, sun, sun.target);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.3 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- per-scene kit ----------
  class SceneKit {
    constructor(def) {
      this.def = def;
      this.g = new THREE.Group();
      this.g.position.set(...def.origin);
      this.tw = new Tweens();
      this.loops = [];
      this.t = 0;
      this.reduced = reduced;
      this.lang = () => ui.lang;
      this.refs = {};
      /** Pick the text for the current language: S.L('français', 'English') */
      this.L = (fr, en) => (ui.lang === 'fr' ? fr : en);
    }
    add(...objs) { objs.forEach((o) => this.g.add(o)); return objs[0]; }
    to(target, props, dur, opts) { return this.tw.to(target, props, dur, opts); }
    tween(o) { return this.tw.add(o); }
    call(delay, fn) { return this.tw.call(delay, fn); }
    loop(fn) { this.loops.push(fn); return fn; }
    /** Scale an object in with a little overshoot (it becomes visible). */
    pop(obj, delay = 0, s = 1, dur = 0.5) {
      obj.scale.setScalar(0.0001);
      const show = () => { obj.visible = true; };
      delay > 0 ? this.call(delay, show) : show();
      return this.to(obj.scale, { x: s, y: s, z: s }, dur, { delay, ease: ease.back });
    }
    /** Shrink away and hide. */
    hide(obj, delay = 0, dur = 0.3) {
      return this.to(obj.scale, { x: 0.0001, y: 0.0001, z: 0.0001 }, dur, { delay, ease: ease.in, done: () => { obj.visible = false; } });
    }
    /** Move along an arc to [x,y,z]. opts: delay, arc (height), ease, done, face (turn to travel direction) */
    fly(obj, dest, dur = 1, opts = {}) {
      let a = null;
      const arc = opts.arc ?? 1;
      const prev = new THREE.Vector3();
      return this.tw.add({
        dur, delay: opts.delay || 0, ease: opts.ease || ease.io, done: opts.done,
        update: (k) => {
          if (!a) a = obj.position.clone();
          prev.copy(obj.position);
          obj.position.set(a.x + (dest[0] - a.x) * k, a.y + (dest[1] - a.y) * k + Math.sin(k * Math.PI) * arc, a.z + (dest[2] - a.z) * k);
          if (opts.face && obj.position.distanceToSquared(prev) > 1e-8) {
            const look = obj.position.clone().multiplyScalar(2).sub(prev);
            obj.lookAt(obj.parent ? obj.parent.localToWorld(look) : look);
          }
        },
      });
    }
    /** Fade a mesh's own material. */
    fade(mesh, opacity, dur = 0.5, opts = {}) {
      mesh.material.transparent = true;
      if (opacity > 0) mesh.visible = true;
      return this.to(mesh.material, { opacity }, dur, { ...opts, done: () => { if (opacity <= 0) mesh.visible = false; opts.done && opts.done(); } });
    }
    update(dt) {
      this.t += dt;
      this.tw.tick(dt);
      for (const f of this.loops) f(this.t, dt);
    }
    dispose() {
      scene.remove(this.g);
      this.g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (m.map && m.map.isCanvasTexture && !m.map.userData.shared) m.map.dispose();
          if (!m.userData.shared) m.dispose();
        }
      });
      this.tw.clear();
      this.loops = [];
    }
  }

  // ---------- state ----------
  const ui = new UI({ scenes: SCENES, text: TEXT, onNav: (d) => nav(d), onGoto: (s, b) => goto(s, b), onLang: () => relabel() });
  let cur = null; // { index, beat, S, beats, def }
  const dying = []; // old scenes kept alive during a flight
  const camTw = new Tweens();
  const camPos = new THREE.Vector3(0, 6, 14), camLook = new THREE.Vector3(0, 1, 0);
  const moodTw = new Tweens();
  let diving = false, exploring = false, controls = null, flying = false;

  function applyMood(m = {}, instant = false) {
    const sky = new THREE.Color(m.sky ?? 0xbfe3ff);
    const sunC = new THREE.Color(m.sunColor ?? 0xfff2d8), hemiC = new THREE.Color(m.hemiColor ?? 0xffffff);
    const from = { bg: scene.background.clone(), sun: sun.color.clone(), hemi: hemi.color.clone(), hi: hemi.intensity, si: sun.intensity, n: scene.fog.near, f: scene.fog.far };
    const to = { hi: m.hemi ?? 1.6, si: m.sun ?? 2.2, n: (m.fog || [40, 140])[0], f: (m.fog || [40, 140])[1] };
    moodTw.clear();
    moodTw.add({
      dur: instant ? 1e-4 : 1.6,
      update: (k) => {
        scene.background.copy(from.bg).lerp(sky, k);
        scene.fog.color.copy(scene.background);
        sun.color.copy(from.sun).lerp(sunC, k);
        hemi.color.copy(from.hemi).lerp(hemiC, k);
        hemi.intensity = from.hi + (to.hi - from.hi) * k;
        sun.intensity = from.si + (to.si - from.si) * k;
        scene.fog.near = from.n + (to.n - from.n) * k;
        scene.fog.far = from.f + (to.f - from.f) * k;
      },
    });
    if (instant) moodTw.flush();
  }

  const worldCam = (def, cam) => {
    const o = def.origin;
    return [new THREE.Vector3(cam[0] + o[0], cam[1] + o[1], cam[2] + o[2]), new THREE.Vector3(cam[3] + o[0], cam[4] + o[1], cam[5] + o[2])];
  };

  function moveCam(def, beat, dur, flight = false, done) {
    const [p, l] = worldCam(def, beat.cam);
    camTw.clear();
    if (dur <= 0) {
      camPos.copy(p); camLook.copy(l);
      done && done();
      return;
    }
    const a = camPos.clone(), la = camLook.clone();
    if (reduced) {
      // short fade instead of a flight
      ui.fade(true);
      camTw.add({ dur: 0.3, update: () => {}, done: () => { camPos.copy(p); camLook.copy(l); ui.fade(false); done && done(); } });
      return;
    }
    if (!flight) {
      camTw.add({ dur, ease: ease.io, done, update: (k) => { camPos.lerpVectors(a, p, k); camLook.lerpVectors(la, l, k); } });
      return;
    }
    const pts = [a.clone()];
    if (def.via) for (const v of def.via) pts.push(new THREE.Vector3(v[0] + def.origin[0], v[1] + def.origin[1], v[2] + def.origin[2]));
    else {
      const d = a.distanceTo(p);
      const mid = a.clone().add(p).multiplyScalar(0.5);
      mid.y = Math.max(a.y, p.y) + Math.min(Math.max(d * 0.3, 3), 16);
      pts.push(mid);
      const back = p.clone().sub(l).normalize().multiplyScalar(Math.min(d * 0.2, 5));
      pts.push(p.clone().add(back).add(new THREE.Vector3(0, 0.8, 0)));
    }
    pts.push(p.clone());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    flying = true;
    camTw.add({
      dur, ease: ease.io,
      update: (k) => {
        curve.getPoint(k, camPos);
        const lk = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        camLook.lerpVectors(la, l, lk);
      },
      done: () => { flying = false; done && done(); },
    });
  }

  function killDying() {
    while (dying.length) dying.pop().dispose();
  }

  function build(index) {
    const def = SCENES[index];
    const S = new SceneKit(def);
    const beats = def.build(S) || [];
    scene.add(S.g);
    return { index, beat: -1, S, beats, def };
  }
  const beatMood = (st, b) => ({ ...(st.def.mood || {}), ...((st.beats[b] && st.beats[b].mood) || {}) });

  /** Go to a scene/beat. instant: no animation at all (deep links, tests). */
  function goto(si, bi = 0, instant = false) {
    si = Math.max(0, Math.min(SCENES.length - 1, si));
    if (diving) undive(true);
    if (exploring) toggleExplore(false);
    if (!cur || cur.index !== si || cur.beat !== bi) divedAt = '';
    const stepping = cur && cur.index === si && bi === cur.beat + 1 && !instant;
    if (stepping) {
      const b = cur.beats[bi];
      if (!b) return;
      cur.beat = bi;
      // finish whatever the previous beat still had pending, so a late pop can't land on this one
      cur.S.tw.flush();
      b.run && b.run(cur.S);
      if (reduced) cur.S.tw.flush();
      moveCam(cur.def, b, b.dur ?? 1.1);
      applyMood(beatMood(cur, bi));
    } else {
      const old = cur;
      const next = build(si);
      bi = Math.max(0, Math.min(next.beats.length - 1, bi));
      const samePlace = old && old.def.place && old.def.place === next.def.place;
      const forward = old && si === old.index + 1 && bi === 0 && !instant;
      camTw.flush();
      killDying();
      if (old) {
        if (samePlace || instant || !forward) old.S.dispose();
        else { dying.push(old.S); if (old.def.leave) old.def.leave(old.S); }
      }
      for (let i = 0; i <= bi; i++) {
        const b = next.beats[i];
        b.run && b.run(next.S);
        if (i < bi || !forward || reduced) next.S.tw.flush();
      }
      next.beat = bi;
      cur = next;
      const b = next.beats[bi];
      if (!old || instant) moveCam(next.def, b, 0);
      else if (samePlace || !forward) moveCam(next.def, b, forward ? 1.4 : 0.6);
      else moveCam(next.def, b, next.def.flight ?? 2.8, true, killDying);
      applyMood(beatMood(next, bi), !old || instant);
    }
    ui.show(cur.index, cur.beat, cur.beats.length, cur.beats[cur.beat]);
    const h = `#${cur.index}-${cur.beat}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  // A beat marked `dive: true` in scenes.js gets one extra step: the camera
  // pushes into the screen of the scene and the real site fills the view.
  let divedAt = '', diveT = 0;
  const wantsDive = () => {
    const t = (TEXT[cur.def.id]?.beats || [])[cur.beat];
    return !!(t && t.dive) && divedAt !== `${cur.index}-${cur.beat}` && !!currentScreen();
  };
  function nav(dir) {
    if (!cur || !dir) return;
    if (dir > 0) {
      // a press during a flight between places only finishes the flight: it must not eat the next step
      if (flying) { camTw.flush(); return; }
      if (!diving && wantsDive()) { divedAt = `${cur.index}-${cur.beat}`; diveT = performance.now(); dive(); return; }
      // a second press right after the zoom started (double tap) would leave before the page is even shown
      if (diving && performance.now() - diveT < 1300) return;
      if (diving) undive();
      if (cur.beat + 1 < cur.beats.length) goto(cur.index, cur.beat + 1);
      else if (cur.index + 1 < SCENES.length) goto(cur.index + 1, 0);
      // a beat marked dive: 'auto' goes straight into its screen (e.g. the architecture diagram)
      const t = (TEXT[cur.def.id]?.beats || [])[cur.beat];
      if (t && t.dive === 'auto' && !flying && currentScreen()) { divedAt = `${cur.index}-${cur.beat}`; diveT = performance.now(); dive(); }
    } else if (diving) { undive(); divedAt = ''; }
    else if (cur.beat > 0) goto(cur.index, cur.beat - 1);
    else if (cur.index > 0) goto(cur.index - 1, 1e9);
  }

  function relabel() {
    if (!cur) return;
    // rebuild the current scene so in-world labels pick up the language
    goto(cur.index, cur.beat, true);
  }

  // ---------- dive into a screen ----------
  let diveBack = null;
  function currentScreen() {
    const b = cur && cur.beats[cur.beat];
    if (!b) return null;
    let mesh = b.screen || null;
    const shot = b.shot || (mesh && mesh.userData.shot);
    if (!mesh && shot) cur.S.g.traverse((o) => { if (!mesh && o.userData.isScreen && o.userData.shot === shot && o.visible) mesh = o; });
    if (!mesh && !shot) {
      // fall back to any visible screen with a screenshot
      let best = null, bd = 1e9;
      cur.S.g.traverse((o) => {
        if (o.userData.isScreen && o.userData.shot && o.visible) {
          const d = o.getWorldPosition(new THREE.Vector3()).distanceTo(camLook);
          if (d < bd) { bd = d; best = o; }
        }
      });
      mesh = best;
    }
    const s = shot || (mesh && mesh.userData.shot);
    return s ? { mesh, shot: s } : null;
  }
  function dive() {
    const sc = currentScreen();
    if (!sc || flying) return;
    diving = true;
    diveBack = [camPos.clone(), camLook.clone()];
    camTw.clear();
    if (sc.mesh && !reduced) {
      const c = sc.mesh.getWorldPosition(new THREE.Vector3());
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(sc.mesh.getWorldQuaternion(new THREE.Quaternion()));
      const h = sc.mesh.geometry.parameters.height * sc.mesh.getWorldScale(new THREE.Vector3()).y;
      const w = sc.mesh.geometry.parameters.width * sc.mesh.getWorldScale(new THREE.Vector3()).x;
      const fov = (camera.fov * Math.PI) / 180;
      const dist = Math.max(h / 2 / Math.tan(fov / 2), w / 2 / Math.tan(fov / 2) / camera.aspect) * 1.02;
      const p = c.clone().add(n.multiplyScalar(dist));
      const a = camPos.clone(), la = camLook.clone();
      camTw.add({ dur: 1.0, ease: ease.io, update: (k) => { camPos.lerpVectors(a, p, k); camLook.lerpVectors(la, c, k); } });
      ui.dive(sc.shot, 0.75);
    } else ui.dive(sc.shot, 0);
  }
  function undive(instant = false) {
    if (!diving) return;
    diving = false;
    ui.undive();
    camTw.clear();
    if (diveBack) {
      const [p, l] = diveBack;
      const a = camPos.clone(), la = camLook.clone();
      if (instant || reduced) { camPos.copy(p); camLook.copy(l); }
      else camTw.add({ dur: 0.9, ease: ease.io, update: (k) => { camPos.lerpVectors(a, p, k); camLook.lerpVectors(la, l, k); } });
    }
  }

  // ---------- explore mode ----------
  function toggleExplore(on = !exploring) {
    exploring = on;
    ui.setExplore(on);
    if (on) {
      camTw.flush();
      if (!controls) {
        controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI * 0.49;
      }
      controls.target.copy(camLook);
      controls.enabled = true;
    } else if (controls) {
      controls.enabled = false;
      if (cur) moveCam(cur.def, cur.beats[cur.beat], 0.8);
    }
  }
  const ray = new THREE.Raycaster();
  canvas.addEventListener('click', (e) => {
    if (!cur) return;
    if (diving) return nav(1);
    if (!exploring) return;
    const m = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(m, camera);
    const hit = ray.intersectObjects(cur.S.g.children, true).find((h) => h.object.userData.isScreen && h.object.userData.shot);
    if (hit) {
      if (exploring) toggleExplore(false);
      const b = cur.beats[cur.beat];
      const keep = [b.screen, b.shot];
      b.screen = hit.object; b.shot = hit.object.userData.shot;
      dive();
      [b.screen, b.shot] = keep;
    }
  });

  // ---------- input ----------
  let digits = '';
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { e.preventDefault(); nav(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); nav(-1); }
    else if (k === 'Home') goto(0, 0);
    else if (k === 'End') goto(SCENES.length - 1, 0);
    else if (k === 'Enter') {
      if (digits) { goto(parseInt(digits, 10), 0); digits = ''; ui.toast(''); }
    } else if (k === 'Escape') { digits = ''; ui.toast(''); if (diving) undive(); if (exploring) toggleExplore(false); ui.help(false); }
    else if (/^[0-9]$/.test(k)) { digits = (digits + k).slice(-2); ui.toast(`→ ${digits} ⏎`); }
    else if (k === 'f' || k === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
    else if (k === 'e' || k === 'E') toggleExplore();
    else if (k === 'l' || k === 'L') ui.toggleLang();
    else if (k === 's' || k === 'S') ui.openNotes();
    else if (k === 'p' || k === 'P') ui.print();
    else if (k === 'h' || k === 'H' || k === '?') ui.help();
  });
  let touchX = null;
  window.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (touchX === null || exploring) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) nav(dx < 0 ? 1 : -1);
    touchX = null;
  });
  window.addEventListener('hashchange', () => {
    const [s, b] = parseHash();
    if (cur && (s !== cur.index || b !== cur.beat)) goto(s, b, true);
  });
  function parseHash() {
    const m = /^#(\d+)(?:-(\d+))?/.exec(location.hash);
    return m ? [parseInt(m[1], 10), parseInt(m[2] || '0', 10)] : [0, 0];
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const debug = params.has('debug') ? document.getElementById('debug') : null;
  if (debug) debug.hidden = false;
  let frames = 0, acc = 0, fps = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    camTw.tick(dt);
    moodTw.tick(dt);
    if (cur) cur.S.update(dt);
    for (const d of dying) d.update(dt);
    if (exploring && controls) controls.update();
    else { camera.position.copy(camPos); camera.lookAt(camLook); }
    sun.position.copy(camLook).add(new THREE.Vector3(-8, 14, 9));
    sun.target.position.copy(camLook);
    renderer.render(scene, camera);
    if (debug) {
      frames++; acc += dt;
      if (acc >= 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; }
      debug.textContent = `${fps} fps · ${renderer.info.render.calls} calls · ${renderer.info.render.triangles} tris`;
    }
  }

  // ---------- boot ----------
  const [s0, b0] = parseHash();
  const boot = () => {
    goto(s0, b0, true);
    frame();
    document.body.classList.add('ready');
  };
  (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve()).then(boot);

  // hooks for headless checks
  window.__deck = {
    goto: (s, b, instant = true) => goto(s, b, instant),
    nav,
    settle: () => { camTw.flush(); moodTw.flush(); if (cur) cur.S.tw.flush(); killDying(); },
    info: () => ({ scene: cur.index, id: cur.def.id, beat: cur.beat, beats: cur.beats.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    counts: () => SCENES.map((s, i) => { const st = build(i); const n = st.beats.length; st.S.dispose(); return { id: s.id, beats: n, text: (TEXT[s.id]?.beats || []).length }; }),
    dive, undive,
    scenes: SCENES.length,
  };
}
