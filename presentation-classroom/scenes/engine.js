// Scene 12 — under the hood: the engine room beneath the classroom.
// Four zones along x, one per beat: pipeline · hybrid search · three caches · models.
import * as THREE from 'three';
import { C, G, part, label, glow, instanced } from '../models/kit.js';
import { ease } from '../anim.js';

const BP = { floor: 0x14315e, wall: 0x0f2750, line: 0xdfeeff, m1: 0x2a62b8, m2: 0x3f7fd6, m3: 0x5b9cf0, cyan: 0x58d8ff, pink: 0xff9ecb, yel: 0xffe27a };
const Z2 = 24, Z3 = 44, Z4 = 64;
const cam = (cx) => [cx, 5, 8.5, cx, -0.3, -2];
const DOWN = new THREE.Vector3(0, -1, 0);

export default {
  place: 'engine',
  origin: [0, -16, 0],
  mood: { sky: 0x0d2046, hemi: 1.7, sun: 1.3, sunColor: 0xcfe2ff, hemiColor: 0xdbe8ff, fog: [30, 115] },
  flight: 3.4,
  via: [[5.2, 30, 4], [5.2, 12, 7]],
  build(S) {
    const tag = (txt, x, y, z, w = 2.2, h = 0.56, bg = '#eaf3ff', size = 0.6) => {
      const m = label(txt, { w, h, bg, size });
      m.position.set(x, y, z);
      S.add(m);
      return m;
    };

    // ---------------- static room (one mesh)
    const MX = [-1, 1.5, 4, 6.5, 9, 11.5];
    S.add(part((b) => {
      b.box(96, 0.4, 13, BP.floor, 38, -0.2, 0);
      for (let x = -9; x <= 85; x += 2) b.box(0.03, 0.01, 13, 0x2c5596, x, 0.006, 0);
      for (let z = -6; z <= 6; z += 2) b.box(96, 0.01, 0.03, 0x2c5596, 38, 0.006, z);
      b.box(96, 5.2, 0.3, BP.wall, 38, 2.6, -4.4).box(96, 0.05, 0.02, BP.line, 38, 4.9, -4.24).box(96, 0.05, 0.02, BP.line, 38, 0.3, -4.24);
      b.box(18, 0.5, 13, 0xcaa77f, 5.2, 9.5, 0); // underside of the classroom floor, far above
      // zone 1: six machines on plinths, linked by pipes, with a rail for the data cubes
      MX.forEach((x, i) => {
        b.box(1.7, 0.2, 1.4, BP.line, x, 0.1, -2).box(1.5, 1.3, 1.2, [BP.m2, BP.m1, 0x34495e, BP.m3, 0xd9534f, 0x2f8f83][i], x, 0.85, -2);
        b.box(1.1, 0.5, 0.04, BP.line, x, 0.95, -1.38).box(0.9, 0.06, 0.05, BP.m1, x, 1.05, -1.36).box(0.6, 0.06, 0.05, BP.m1, x - 0.15, 0.88, -1.36);
        if (i < 5) b.cyl(0.1, 0.1, 1.0, BP.line, x + 1.25, 1.0, -2, 0, 0, Math.PI / 2);
      });
      for (let k = 0; k < 4; k++) b.cyl(0.1, 0.13, 0.5, BP.line, 6.5 - 0.45 + k * 0.3, 1.75, -2.2); // the roles: four chimneys
      b.cyl(0.55, 0.55, 0.25, 0x2f8f83, 11.5, 1.62, -2, 0, 0, 0, 12).cyl(0.55, 0.55, 0.25, 0x3aa596, 11.5, 1.9, -2, 0, 0, 0, 12); // database drums
      b.box(13.6, 0.05, 0.08, BP.line, 5.25, 0.45, -1.1);
      // zone 2: library board, fence, two searchlight bases
      b.box(8, 3.0, 0.2, 0x1b3f78, Z2 + 4.8, 1.75, -3.4);
      for (let r = 0; r < 4; r++) b.box(8, 0.06, 0.5, BP.line, Z2 + 4.8, 0.52 + r * 0.68, -3.15);
      for (let x = Z2 + 0.6; x <= Z2 + 9.1; x += 0.85) b.box(0.08, 0.8, 0.08, BP.line, x, 0.4, -1.5);
      b.box(8.6, 0.07, 0.07, BP.line, Z2 + 4.85, 0.75, -1.5).box(8.6, 0.07, 0.07, BP.line, Z2 + 4.85, 0.4, -1.5);
      b.cyl(0.35, 0.45, 0.5, BP.cyan, Z2 + 1.2, 0.25, -0.3, 0, 0, 0, 10).cyl(0.35, 0.45, 0.5, BP.pink, Z2 + 8.4, 0.25, -0.3, 0, 0, 0, 10);
      // zone 3: three shelves, the AI machine
      for (let r = 0; r < 3; r++) b.box(5.6, 0.1, 0.7, BP.line, Z3 + 7, 0.8 + r * 0.95, -3).box(5.6, 0.9, 0.08, 0x1b3f78, Z3 + 7, 1.25 + r * 0.95, -3.35);
      b.box(1.8, 1.5, 1.4, 0x34495e, Z3 + 14.2, 0.75, -0.6).box(1.3, 0.6, 0.05, BP.line, Z3 + 14.2, 0.95, 0.12).cyl(0.14, 0.18, 0.7, BP.line, Z3 + 14.7, 1.8, -0.9);
      // zone 4: two engines, switch base, meter post, banner posts
      b.box(1.6, 0.2, 1.5, BP.line, Z4 + 5.8, 0.1, -2).box(1.3, 1.0, 1.2, BP.m3, Z4 + 5.8, 0.7, -2).cyl(0.1, 0.1, 0.5, BP.line, Z4 + 5.8, 1.45, -2);
      b.box(2.6, 0.2, 1.9, BP.line, Z4 + 9.2, 0.1, -2).box(2.3, 1.9, 1.6, BP.m1, Z4 + 9.2, 1.15, -2).cyl(0.12, 0.12, 0.5, BP.line, Z4 + 9.2, 2.35, -2)
        .box(1.8, 0.7, 0.05, BP.line, Z4 + 9.2, 1.3, -1.18);
      b.box(2.2, 0.3, 0.9, BP.line, Z4 + 9.4, 0.15, 1.2).box(0.3, 0.2, 0.3, 0x34495e, Z4 + 9.4, 0.4, 1.2);
      b.cyl(0.08, 0.1, 1.2, BP.line, Z4 + 12, 0.6, -0.5).cyl(0.7, 0.7, 0.12, BP.line, Z4 + 12, 1.7, -0.5, Math.PI / 2, 0, 0, 16).cyl(0.6, 0.6, 0.13, 0x1b3f78, Z4 + 12, 1.7, -0.49, Math.PI / 2, 0, 0, 16);
    }));

    // ---------------- zone 1: pipeline
    const names = ['React', 'FastAPI', 'Jordan', S.L('Les rôles', 'The roles'), 'Riley', 'PostgreSQL'];
    MX.forEach((x, i) => tag(names[i], x, i === 3 ? 2.6 : 2.3, -2, 2.1, 0.56));
    const guard = tag(S.L('cookie · CSRF · limites', 'cookie · CSRF · rate limits'), 1.5, 3.05, -2, 3.6, 0.5, '#fff9c4', 0.56);
    guard.visible = false;
    const NC = 10;
    const cubes = instanced(G.box(0.2, 0.2, 0.2), Array.from({ length: NC }, () => ({ p: [0, -5, 0], c: BP.yel })), { basic: true });
    S.add(cubes);

    // ---------------- zone 2: hybrid search
    const WIN = new Set(['2,1', '4,2', '5,0', '3,3']);
    const cell = (c, r) => [Z2 + 1.5 + c * 1.1, 0.8 + r * 0.68, -3.1];
    const plain = [], winners = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) (WIN.has(`${c},${r}`) ? winners : plain).push(cell(c, r));
    S.add(instanced(G.box(0.9, 0.46, 0.3), plain.map((p, i) => ({ p, c: [0xdbe7f7, 0xc7d9f0, 0xe9f1fb][i % 3] }))));
    const win = winners.map((p) => {
      const m = part((b) => b.box(0.9, 0.46, 0.3, 0xe9f1fb, 0, 0, 0).box(0.6, 0.05, 0.02, BP.m1, -0.05, 0.08, 0.16).box(0.45, 0.05, 0.02, BP.m1, -0.12, -0.06, 0.16));
      m.position.set(...p);
      const halo = glow(G.box(1.1, 0.66, 0.05), BP.yel, 0.85);
      halo.position.set(0, 0, -0.2);
      halo.visible = false;
      m.add(halo);
      m.userData.halo = halo;
      S.add(m);
      return m;
    });
    const beam = (x, color) => {
      const g = new THREE.Group();
      g.position.set(x, 0.55, -0.3);
      const c = glow(G.cone(1.0, 5.2, 14), color, 0.2);
      c.position.y = -2.6;
      c.material.side = THREE.DoubleSide;
      g.add(c);
      const lens = glow(G.sph(0.22), color);
      g.add(lens);
      S.add(g);
      return g;
    };
    const beamA = beam(Z2 + 1.2, BP.cyan), beamB = beam(Z2 + 8.4, BP.pink);
    tag(S.L('① les mots', '① words'), Z2 + 1.9, 3.5, -3.2, 2.2, 0.5, '#c9f1ff');
    tag(S.L('② le sens', '② meaning'), Z2 + 7.7, 3.5, -3.2, 2.2, 0.5, '#ffd9ea');
    const fused = tag(S.L('classements fusionnés', 'rankings fused'), Z2 + 4.8, 3.5, -3.2, 3.3, 0.5, '#fff9c4');
    fused.visible = false;
    tag(S.L('Vos cours seulement', 'Your courses only'), Z2 + 7.4, 1.2, -1.45, 3.0, 0.5, '#fff9c4', 0.56);

    // ---------------- zone 3: three caches
    const JC = [BP.cyan, BP.yel, BP.pink];
    const jarAt = (r, c) => [Z3 + 4.8 + c * 0.86, 1.13 + r * 0.95, -3];
    const jarItems = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) if (!(r === 1 && c === 5)) jarItems.push({ p: jarAt(r, c), c: JC[r] });
    S.add(instanced(G.cyl(0.26, 0.26, 0.56, 10), jarItems));
    S.add(instanced(G.cyl(0.2, 0.2, 0.08, 10), jarItems.map((j) => ({ p: [j.p[0], j.p[1] + 0.32, j.p[2]], c: 0xf3f7fd }))));
    const jar = part((b) => b.cyl(0.26, 0.26, 0.56, BP.yel, 0, 0, 0, 0, 0, 0, 10).cyl(0.2, 0.2, 0.08, 0xf3f7fd, 0, 0.32, 0, 0, 0, 0, 10));
    jar.position.set(...jarAt(1, 5));
    S.add(jar);
    [S.L('cache de prompt', 'prompt cache'), S.L('cache de réponses', 'response cache'), S.L('cache du navigateur', 'browser cache')]
      .forEach((txt, r) => tag(txt, Z3 + 11.75, 1.2 + r * 0.95, -3, 3.3, 0.52, ['#c9f1ff', '#fff3b8', '#ffd9ea'][r]));
    tag(S.L('IA', 'AI'), Z3 + 14.2, 2.0, -0.6, 0.9, 0.5);
    const req = glow(G.box(0.34, 0.34, 0.34), BP.yel);
    req.position.set(Z3 + 19, 1.3, 1.0);
    req.visible = false;
    S.add(req);
    const free = tag(S.L('coût ≈ 0', 'cost ≈ 0'), Z3 + 14.6, 3.2, -1.2, 2.2, 0.56, '#dcf5dc', 0.64);
    free.visible = false;
    const gear = part((b) => { for (let i = 0; i < 4; i++) b.box(0.9, 0.16, 0.08, BP.line, 0, 0, 0, 0, 0, (i * Math.PI) / 4); });
    gear.position.set(Z3 + 14.2, 0.95, 0.16);
    S.add(gear);

    // ---------------- zone 4: models
    const fan = (x, y, s) => {
      const m = part((b) => { for (let i = 0; i < 3; i++) b.box(1.0, 0.05, 0.22, BP.line, 0, 0, 0, 0, (i * Math.PI) / 1.5, 0); });
      m.position.set(x, y, -2);
      m.scale.setScalar(s);
      S.add(m);
      return m;
    };
    const fanFast = fan(Z4 + 5.8, 1.72, 0.9), fanSmart = fan(Z4 + 9.2, 2.62, 1.5);
    tag(S.L('rapide · le tuteur', 'fast · the tutor'), Z4 + 5.4, 2.35, -2, 2.9, 0.5, '#c9f1ff', 0.56);
    tag(S.L('puissant · crée le cours', 'smart · builds the course'), Z4 + 10.2, 3.15, -2, 3.9, 0.5, '#ffd9ea', 0.56);
    const lever = new THREE.Group();
    lever.position.set(Z4 + 9.4, 0.45, 1.2);
    lever.add(part((b) => b.cyl(0.05, 0.05, 0.9, BP.line, 0, 0.45, 0).sph(0.14, C.red, 0, 0.95, 0)));
    lever.rotation.z = 0.6;
    S.add(lever);
    const gem = tag('Gemini', Z4 + 8.0, 1.0, 1.3, 1.5, 0.5, '#fff9c4');
    const cla = tag('Claude', Z4 + 10.8, 1.0, 1.3, 1.5, 0.5, '#eaf3ff');
    const demo = tag(S.L('MODE DÉMO · aucune IA n’a tourné', 'DEMO MODE · no AI ran'), Z4 + 4.6, 3.4, -3, 5.4, 0.56, '#fff9c4', 0.58);
    demo.visible = false;
    const needle = part((b) => b.box(0.05, 0.5, 0.03, C.red, 0, 0.22, 0));
    needle.position.set(Z4 + 12, 1.7, -0.4);
    S.add(needle);
    const meter = tag(S.L('jetons comptés', 'tokens logged'), Z4 + 12.4, 2.75, -0.5, 2.6, 0.5);
    const st = { flow: 0, conv: 0, spin: 0, tok: 0 };

    const tmp = new THREE.Vector3();
    const aim = (g, tx, ty) => {
      tmp.set(tx - g.position.x, ty - g.position.y, -3.1 - g.position.z).normalize();
      g.quaternion.setFromUnitVectors(DOWN, tmp);
    };
    S.loop((t) => {
      for (let i = 0; i < NC; i++) {
        const u = ((t * 1.5 * st.flow + i * 1.36) % 13.6);
        cubes.set(i, -1.55 + u, 0.62 + Math.abs(Math.sin(u * 2.5)) * 0.12, -1.1, 0, t + i, 0, st.flow > 0 ? 1 : 0.0001);
      }
      const cx = Z2 + 4.8, k = st.conv;
      aim(beamA, (cx + Math.sin(t * 0.9) * 3.3) * (1 - k) + (cx - 0.6) * k, (1.8 + Math.cos(t * 1.3) * 0.9) * (1 - k) + 1.8 * k);
      aim(beamB, (cx + Math.sin(t * 0.7 + 2) * 3.3) * (1 - k) + (cx + 0.6) * k, (1.8 + Math.cos(t * 1.1 + 1) * 0.9) * (1 - k) + 1.8 * k);
      gear.rotation.z = t * 0.6;
      fanFast.rotation.y = t * 9;
      fanSmart.rotation.y = t * 3;
      needle.rotation.z = 0.9 - st.tok * 1.8 + Math.sin(t * 5) * 0.05 * st.tok;
    });

    return [
      {
        cam: cam(5.2),
        run() {
          S.to(st, { flow: 1 }, 1.2, { delay: 0.8 });
          S.pop(guard, 2.0);
        },
      },
      {
        cam: cam(Z2 + 4.8),
        dur: 1.8,
        run() {
          S.to(st, { conv: 1 }, 1.4, { delay: 2.6 });
          win.forEach((m, i) => {
            S.to(m.position, { z: -2.2 }, 0.7, { delay: 3.6 + i * 0.2, ease: ease.back });
            S.pop(m.userData.halo, 3.6 + i * 0.2);
          });
          S.pop(fused, 4.6);
        },
      },
      {
        cam: cam(Z3 + 10.6),
        dur: 1.8,
        run() {
          S.call(1.6, () => { req.visible = true; });
          S.to(req.position, { x: Z3 + 15.6 }, 1.0, { delay: 1.6 });
          S.fly(req, [Z3 + 10.6, 2.6, -1.6], 0.9, { delay: 2.8, arc: 0.4 });
          S.fly(jar, [Z3 + 10.6, 2.2, -1.6], 0.8, { delay: 3.4, arc: 0.3 });
          S.fly(req, [Z3 + 16.4, 2.0, 0.8], 1.2, { delay: 4.5, arc: 0.5 });
          S.fly(jar, [Z3 + 16.4, 1.6, 0.8], 1.2, { delay: 4.5, arc: 0.5 });
          S.pop(free, 4.8);
        },
      },
      {
        cam: cam(Z4 + 8.4),
        dur: 1.8,
        run() {
          S.to(st, { tok: 1 }, 2.0, { delay: 1.2 });
          const sw = (z, a, b, delay) => {
            S.to(lever.rotation, { z }, 0.5, { delay, ease: ease.back });
            S.call(delay + 0.2, () => { a.scale.setScalar(1.15); b.scale.setScalar(0.9); });
          };
          a0(gem, cla);
          sw(-0.6, cla, gem, 2.0);
          sw(0.6, gem, cla, 3.6);
          S.pop(demo, 4.8);
        },
      },
    ];
    function a0(a, b) { a.scale.setScalar(1.15); b.scale.setScalar(0.9); }
  },
};
