// Scene 5 — "Where am I lost?": the topic map.
// Concepts rise out of the smartboard as floating islands joined by plank bridges.
// One island is weak (red), the bridge leading to it is broken (missing prerequisite),
// a mini-lesson rebuilds it plank by plank.
import * as THREE from 'three';
import { classroom, SMART } from '../models/places.js';
import { part, label, instanced, G } from '../models/kit.js';
import { ease } from '../anim.js';

const BLUE = 0x8ec5ff, RED = 0xff5a5a, GREEN = 0x74e08a, GREY = 0x7d8594;
// [x, y, z, fr, en]
const ISL = [
  [-2.5, 5.9, -1, 'Binaire', 'Binary'],
  [-0.7, 7.3, -2, 'Couches', 'Layers'],
  [0.9, 5.1, -0.5, 'Adresses IP', 'IP addresses'],
  [3.7, 5.6, -1, 'Masques', 'Masks'],
  [5.8, 4.0, 0, 'Sous-réseaux', 'Subnets'],
  [8.4, 5.2, -1, 'Routage', 'Routing'],
];
const MASK = 3, SUB = 4;
const BRIDGES = [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5]];
const BROKEN = 3;

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0x1a2350, hemi: 0.95, sun: 0.7, sunColor: 0x9fb0ff, hemiColor: 0xb8c4f2, fog: [40, 140] },
  build(S) {
    const R = classroom(S, { shot: 'course-map' });
    const st = { pulse: 0 };

    // ----- islands (each: own unlit material so it can be tinted)
    const isl = ISL.map(([x, y, z, fr, en], i) => {
      const g = new THREE.Group();
      const mesh = part((b) => {
        b.cyl(0.8, 0.62, 0.28, 0xffffff, 0, 0, 0, 0, 0, 0, 7);
        b.cone(0.62, 0.8, 0xb7b0a4, 0, -0.54, 0, Math.PI, 0, 0, 7);
        b.cyl(0.05, 0.07, 0.4, 0x9a7b5a, 0.32, 0.34, -0.15, 0, 0, 0, 5);
        b.sph(0.26, 0xd9f2dc, 0.32, 0.68, -0.15);
      }, { basic: true });
      mesh.material.color.set(BLUE);
      const tag = label(S.L(fr, en), { w: 1.5, h: 0.4, size: 0.6 });
      tag.position.set(-0.1, 0.5, 0.75);
      g.add(mesh, tag);
      g.position.set(SMART[0], SMART[1], SMART[2] + 0.3);
      g.visible = false;
      S.add(g);
      return { g, mesh, p: [x, y, z], i };
    });
    const tint = (m, hex, dur = 0.8, delay = 0) => {
      const to = new THREE.Color(hex);
      let from = null;
      S.tween({ dur, delay, update: (k) => { if (!from) from = m.material.color.clone(); m.material.color.copy(from).lerp(to, k); } });
    };

    // ----- bridges: one instanced mesh, every plank has its own state
    const planks = [];
    let gap = null;
    BRIDGES.forEach(([a, b], bi) => {
      const A = new THREE.Vector3(...ISL[a].slice(0, 3)), Bp = new THREE.Vector3(...ISL[b].slice(0, 3));
      const d = Bp.clone().sub(A).normalize();
      const s0 = A.clone().addScaledVector(d, 0.95), s1 = Bp.clone().addScaledVector(d, -0.95);
      const n = Math.max(4, Math.round(s0.distanceTo(s1) / 0.27));
      if (bi === BROKEN) gap = s0.clone().lerp(s1, 0.5);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, p = s0.clone().lerp(s1, u);
        p.y -= Math.sin(Math.PI * u) * 0.16;
        const end = i === 0 ? 1 : i === n - 1 ? -1 : 0;
        planks.push({ bi, i, x: p.x, y: p.y, z: p.z, rz: Math.atan2(d.y, d.x), s: 0.0001, missing: bi === BROKEN && !end, tilt: bi === BROKEN ? end * 0.95 : 0 });
      }
    });
    const pm = instanced(G.box(0.22, 0.06, 0.6), planks.map((q) => ({ p: [q.x, q.y, q.z], c: 0xd9a86c })), { basic: true });
    S.add(pm);

    // ----- little cards
    const mk = (txt, o, x, y, z) => { const m = label(txt, o); m.position.set(x, y, z); m.visible = false; S.add(m); return m; };
    const quiz = mk(S.L('Quiz : 2 / 5', 'Quiz: 2 / 5'), { w: 1.3, h: 0.4, bg: '#ffd6d6', size: 0.6 }, 7.2, 3.5, 0.4);
    const q = mk('?', { w: 0.5, h: 0.6, bg: null, fg: '#ff4d4d', font: 'Kalam', size: 0.95, bold: true }, gap.x, gap.y + 0.55, gap.z + 0.2);
    const miss = mk(S.L('Prérequis manquant', 'Missing prerequisite'), { w: 2.1, h: 0.42, bg: '#ffd6d6', size: 0.58 }, gap.x + 0.75, gap.y + 2.2, gap.z + 0.3);
    const lesson = mk(S.L('Mini-leçon', 'Mini-lesson'), { w: 1.4, h: 0.45, bg: '#ff4d4d', fg: '#ffffff', size: 0.62, bold: true }, SMART[0], SMART[1], SMART[2] + 0.3);
    const reco = mk(S.L('Recommandé : la section suivante\ncar c’est ta prochaine non terminée', 'Recommended: the next section\nbecause it is your next unfinished one'), { w: 3.3, h: 0.85, size: 0.62 }, 7.6, 2.9, 0.6);

    S.loop((t) => {
      for (let k = 0; k < planks.length; k++) {
        const p = planks[k];
        const sw = p.tilt ? Math.sin(t * 2.2 + k) * 0.12 * Math.abs(p.tilt) : 0;
        pm.set(k, p.x, p.y - Math.abs(p.tilt) * 0.12, p.z, 0, 0, p.rz - p.tilt + sw, p.s);
      }
      const s = 1 + Math.sin(t * 5) * 0.07 * st.pulse;
      isl[SUB].mesh.scale.setScalar(s);
      if (q.visible) q.position.y = gap.y + 0.55 + Math.sin(t * 3) * 0.06;
    });

    return [
      {
        cam: [2.5, 2.0, 10.5, 2.5, 3.9, -1],
        shot: 'course-map',
        screen: R.smart,
        run() {
          isl.forEach((o, i) => {
            S.pop(o.g, 0.3 + i * 0.22, 1, 0.7);
            S.fly(o.g, o.p, 1.5, { delay: 0.3 + i * 0.22, arc: 0.8 });
          });
          planks.forEach((p) => { if (!p.missing) S.to(p, { s: 1 }, 0.3, { delay: 2.2 + p.bi * 0.22 + p.i * 0.045, ease: ease.back }); });
        },
      },
      {
        cam: [3.4, 2.2, 9.6, 3.6, 3.9, -1],
        run() {
          R.yas.pose = 'think';
          tint(isl[SUB].mesh, RED, 0.8, 0.3);
          S.to(st, { pulse: 1 }, 0.5, { delay: 0.3 });
          S.pop(quiz, 0.9);
        },
      },
      {
        cam: [5.0, 3.0, 8.4, 3.9, 4.7, -0.6],
        run() {
          tint(isl[MASK].mesh, GREY, 0.8, 0.3);
          S.pop(q, 0.7);
          S.pop(miss, 1.1);
        },
      },
      {
        cam: [5.6, 2.7, 9.2, 5.4, 4.3, -0.6],
        run() {
          S.hide(q);
          S.hide(miss);
          S.hide(quiz);
          S.pop(lesson, 0.2);
          S.fly(lesson, [gap.x + 0.75, gap.y + 1.9, gap.z + 0.3], 1.1, { delay: 0.2, arc: 1 });
          let j = 0;
          planks.forEach((p) => {
            if (p.tilt) S.to(p, { tilt: 0 }, 0.5, { delay: 1.3 });
            if (p.missing) S.to(p, { s: 1 }, 0.3, { delay: 1.6 + (j++) * 0.2, ease: ease.back });
          });
          const end = 1.6 + j * 0.2 + 0.3;
          tint(isl[MASK].mesh, BLUE, 0.6, end);
          tint(isl[SUB].mesh, GREEN, 0.8, end);
          S.to(st, { pulse: 0 }, 0.4, { delay: end });
          S.call(end, () => { R.yas.pose = 'type'; });
          S.pop(reco, end + 0.6);
        },
      },
    ];
  },
};
