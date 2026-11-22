// Scene 3 — backstage: behind the chalkboard, the AI team's workshop.
// Jordan conducts · Clara reads first · Quinn/Alex/Sage/Max in parallel · Riley checks (reject + retry) · Resource Finder.
import * as THREE from 'three';
import { C, F, G, part, robot, label, glow, ground, instanced } from '../models/kit.js';
import { ease } from '../anim.js';

const BELT_Z = -4, BELT_Y = 0.93;
const BENCH = [0.1, 1.7, 3.3, 4.9]; // Quinn, Alex, Sage, Max
const BENCH_Z = -6.4;
const SLOT = [2.0, 2.75, 3.5, 4.25]; // where finished work waits on the belt, in front of Riley

export default {
  place: 'back',
  origin: [0, 0, -13],
  mood: { sky: 0x2b2230, hemi: 1.5, hemiColor: 0xffe6c2, sun: 1.3, sunColor: 0xffc98a, fog: [30, 90] },
  flight: 3.6,
  // through the dark doorway behind the chalkboard (world x -4.6, y 2.3, z -6)
  via: [[-4.6, 2.5, 11], [-4.6, 2.3, 7.2]],
  build(S) {
    S.add(ground(0x3a2f2a, 40));
    // ---------- the room (one mesh) ----------
    S.add(part((b) => {
      b.box(17, 0.3, 16, 0x9a7350, 1.2, -0.15, -1.3);
      for (let x = -6; x <= 9; x += 1.5) b.box(0.04, 0.01, 16, 0x86623f, x, 0.005, -1.3);
      b.box(17, 5.4, 0.3, 0x7a6353, 1.2, 2.7, -9.35).box(0.3, 5.4, 16, 0x6f5a4b, -7.3, 2.7, -1.3).box(0.3, 5.4, 16, 0x6f5a4b, 9.7, 2.7, -1.3);
      b.box(17, 0.3, 0.34, 0x5a4638, 1.2, 0.15, -9.3);
      // conveyor belt
      b.box(6.6, 0.12, 0.9, C.dark, 2.2, 0.82, BELT_Z).box(6.6, 0.1, 0.06, C.metal, 2.2, 0.9, BELT_Z + 0.46).box(6.6, 0.1, 0.06, C.metal, 2.2, 0.9, BELT_Z - 0.46);
      for (const x of [-0.9, 1.2, 3.2, 5.3]) b.box(0.1, 0.78, 0.1, C.metal, x, 0.39, BELT_Z + 0.36).box(0.1, 0.78, 0.1, C.metal, x, 0.39, BELT_Z - 0.36);
      // Clara's reading stand with the open course book
      b.box(0.9, 0.9, 0.6, C.woodDark, -1.9, 0.45, BELT_Z + 0.9).box(0.5, 0.06, 0.6, C.paper, -2.16, 0.95, BELT_Z + 0.9, 0, 0, 0.12).box(0.5, 0.06, 0.6, C.paper, -1.64, 0.95, BELT_Z + 0.9, 0, 0, -0.12).box(0.04, 0.08, 0.62, C.red, -1.9, 0.93, BELT_Z + 0.9);
      // four workbenches + timer dials on the back wall
      BENCH.forEach((x) => { b.use(F.desk, x, 0, BENCH_Z); b.use(F.clock, x, 3.5, -9.15); });
      // Jordan's podium, the pin board for links, shelves, hanging bulbs' cords
      b.cyl(0.7, 0.8, 1.1, C.woodDark, 7.3, 0.55, -8.0).cyl(0.76, 0.76, 0.08, C.red, 7.3, 1.12, -8.0);
      b.box(2.7, 1.9, 0.1, 0xb98a5a, -3.4, 2.8, -9.15).box(2.9, 0.1, 0.14, C.woodDark, -3.4, 3.8, -9.12).box(2.9, 0.1, 0.14, C.woodDark, -3.4, 1.8, -9.12);
      b.box(1.6, 0.06, 0.3, C.woodDark, -7.0, 2.2, -3, 0, Math.PI / 2).box(0.3, 0.4, 0.2, C.blue, -7.0, 2.43, -3.4).box(0.3, 0.5, 0.2, C.yellow, -7.0, 2.48, -2.9);
      for (const [x, z] of [[-2, -2], [2.5, -1.5]]) b.cyl(0.012, 0.012, 1.2, C.ink, x, 4.8, z);
    }));
    S.add(instanced(G.sph(0.16), [[-2, -2], [2.5, -1.5]].map(([x, z]) => ({ p: [x, 4.15, z], c: 0xffe08a })), { basic: true }));
    // moving belt slats
    const slats = instanced(G.box(0.07, 0.02, 0.78), Array.from({ length: 16 }, () => ({ c: 0x5a606d })));
    S.add(slats);

    // ---------- the team ----------
    const bots = {};
    const tags = {};
    const put = (name, x, y, z, fn, ry = 0) => {
      const r = robot(name);
      r.scale.setScalar(1.25);
      r.position.set(x, y, z);
      r.rotation.y = ry;
      S.add(r);
      bots[name] = r;
      const nm = name === 'finder' ? 'Resource Finder' : name[0].toUpperCase() + name.slice(1);
      const t = label(`${nm}\n${fn}`, { w: 1.45, h: 0.56, size: 0.66 });
      t.position.set(x, y + 2.25, z);
      S.add(t);
      tags[name] = t;
      return r;
    };
    put('jordan', 7.3, 1.16, -8.0, S.L('Coordination', 'Coordination'), -0.35);
    put('clara', -1.9, 0, BELT_Z - 0.2, S.L('Analyse du cours', 'Course analysis'), 0.3);
    put('quinn', BENCH[0], 0, BENCH_Z - 0.8, S.L('Quiz', 'Quizzes'));
    put('alex', BENCH[1], 0, BENCH_Z - 0.8, S.L('Exercices', 'Exercises'));
    put('sage', BENCH[2], 0, BENCH_Z - 0.8, S.L('Révision', 'Revision'));
    put('max', BENCH[3], 0, BENCH_Z - 0.8, S.L('Examen blanc', 'Mock exam'));
    put('riley', 5.9, 0, BELT_Z - 0.1, S.L('Contrôle qualité', 'Quality check'), -0.4);
    put('finder', -9.5, 0, -7.6, S.L('Ressources', 'Resources'), 0.3);
    bots.finder.visible = false;
    tags.finder.visible = false;

    // Jordan's task board + "plain code" note
    const board = label(`${S.L('TÂCHES', 'TASKS')}\n1 · Clara\n2 · Quinn  Alex  Sage  Max\n3 · Riley`, { w: 2.5, h: 1.3, bg: '#fdfbf7', size: 0.62 });
    board.position.set(5.6, 4.6, -9.1);
    board.visible = false;
    const code = label(S.L('du code, pas une IA', 'plain code, not an AI'), { w: 1.9, h: 0.4, size: 0.62 });
    code.position.set(8.5, 4.3, -9.0);
    code.rotation.z = -0.04;
    code.visible = false;
    S.add(board, code);

    // Clara's chapter cards (with their citation tags)
    const chapters = ['Ch. 1\nS3', 'Ch. 2\nS12', 'Ch. 3\nS21', 'Ch. 4\nS30'].map((txt, i) => {
      const m = label(txt, { w: 0.62, h: 0.5, bg: '#d9ecff', size: 0.66 });
      m.position.set(-1.9, 1.1, BELT_Z + 0.9);
      m.rotation.x = -0.5;
      m.visible = false;
      m.userData.belt = [-0.5 + i * 0.75, BELT_Y + 0.22, BELT_Z];
      S.add(m);
      return m;
    });

    // timers (all four hands share one value = they are in sync)
    const st = { par: 0 };
    const hands = BENCH.map((x) => {
      const h = part((b) => b.box(0.05, 0.3, 0.03, C.red, 0, 0.13, 0));
      h.position.set(x, 3.5, -9.08);
      S.add(h);
      return h;
    });

    // what each specialist produces
    const products = [
      part((b) => b.box(0.26, 0.03, 0.34, 0xcdb4f6, -0.06, 0.015, 0, 0, 0.25).box(0.26, 0.03, 0.34, C.postit, 0, 0.045, 0).box(0.26, 0.03, 0.34, 0x9b6bd6, 0.06, 0.075, 0, 0, -0.25)),
      part((b) => b.box(0.36, 0.025, 0.46, C.paper, 0, 0.012, 0).box(0.36, 0.03, 0.1, C.orange, 0, 0.014, -0.18).box(0.26, 0.03, 0.03, C.grey, 0, 0.014, 0).box(0.26, 0.03, 0.03, C.grey, 0, 0.014, 0.1)),
      part((b) => { for (let i = 0; i < 5; i++) b.box(0.3, 0.025, 0.2, i % 2 ? C.paper : C.teal, 0, 0.012 + i * 0.026, 0, 0, i * 0.12); }),
      part((b) => b.box(0.46, 0.03, 0.32, C.paper, 0, 0.015, 0).box(0.1, 0.04, 0.1, C.red, 0, 0.02, 0).box(0.46, 0.035, 0.02, 0xe2d8c4, 0, 0.016, -0.08, 0, 0.5)),
    ];
    products.forEach((p, i) => {
      p.scale.setScalar(1.5);
      p.position.set(BENCH[i], 0.84, BENCH_Z + 0.05);
      p.visible = false;
      S.add(p);
    });
    const mark = (txt, bg, i) => {
      const m = label(txt, { w: 0.42, h: 0.42, bg, fg: '#ffffff', size: 0.8, bold: true });
      m.position.set(SLOT[i], BELT_Y + 0.62, BELT_Z + 0.1);
      m.visible = false;
      S.add(m);
      return m;
    };
    const oks = SLOT.map((_, i) => mark('✓', '#5cb85c', i));
    const no = mark('✗', '#ff4d4d', 1);
    const retry = label(S.L('à refaire', 'redo'), { w: 0.9, h: 0.3, bg: '#ffd6d6', size: 0.66 });
    retry.position.set(SLOT[1], BELT_Y + 1.05, BELT_Z + 0.1);
    retry.visible = false;
    S.add(retry);

    // Resource Finder's links, each with a "checked" light
    const links = [0, 1, 2].map((i) => {
      const m = label(`${S.L('Lien', 'Link')} ${i + 1}  →`, { w: 1.5, h: 0.4, bg: '#fdfbf7', size: 0.6 });
      m.position.set(-3.7, 3.4 - i * 0.55, -9.05);
      m.rotation.z = (i - 1) * 0.03;
      m.visible = false;
      S.add(m);
      const l = glow(G.sph(0.12), 0x8a8f98);
      l.position.set(-2.55, 3.4 - i * 0.55, -9.0);
      l.visible = false;
      S.add(l);
      return { m, l };
    });

    const all = Object.values(bots);
    S.loop((t) => {
      for (const r of all) r.tick(t);
      for (let i = 0; i < 16; i++) slats.set(i, -1.0 + ((i * 0.4 + t * 0.5) % 6.4), 0.89, BELT_Z);
      hands.forEach((h) => { h.rotation.z = -st.par * Math.PI * 2; });
    });
    const work = (names, v, delay = 0) => S.call(delay, () => names.forEach((n) => { bots[n].work = v; }));

    return [
      { cam: [-3.2, 5.0, 5.6, -1.3, 1.0, -5] },
      {
        cam: [7.7, 2.9, -2.9, 6.5, 2.9, -9],
        run() {
          // Jordan's close-up: keep the neighbours out of the corner of the frame
          S.call(0.5, () => { for (const n of ['riley', 'max', 'sage']) tags[n].visible = false; bots.riley.visible = false; bots.max.visible = false; });
          work(['jordan'], 0.6);
          S.pop(board, 0.4);
          S.pop(code, 1.0);
        },
      },
      {
        cam: [-5.2, 3.3, 3.2, -3.7, 1.2, -4],
        run() {
          for (const n of ['riley', 'max', 'sage']) tags[n].visible = true;
          bots.riley.visible = true;
          bots.max.visible = true;
          work(['jordan'], 0.15);
          work(['clara'], 1);
          chapters.forEach((m, i) => {
            const d = 0.5 + i * 0.5;
            S.pop(m, d);
            S.fly(m, m.userData.belt, 0.9, { delay: d + 0.1, arc: 0.9 });
          });
          work(['clara'], 0.2, 3.2);
        },
      },
      {
        cam: [-2.2, 4.0, 2.4, 0.4, 1.9, -7],
        run() {
          chapters.forEach((m, i) => {
            S.fly(m, [BENCH[i], 1.0, BENCH_Z + 0.05], 0.9, { delay: i * 0.08, arc: 1.3 });
            S.hide(m, 1.0);
          });
          work(['quinn', 'alex', 'sage', 'max'], 1, 0.9);
          S.to(st, { par: 1 }, 2.6, { delay: 0.9, ease: ease.lin });
          products.forEach((p) => S.pop(p, 3.5, 1.5));
          work(['quinn', 'alex', 'sage', 'max'], 0.15, 3.6);
        },
      },
      {
        cam: [-0.4, 3.5, 1.6, 1.9, 1.3, -4],
        run() {
          products.forEach((p, i) => S.fly(p, [SLOT[i], BELT_Y, BELT_Z], 0.9, { delay: i * 0.2, arc: 1.0 }));
          work(['riley'], 1, 1.2);
          S.pop(oks[0], 1.6);
          S.pop(no, 2.0);
          S.pop(retry, 2.1);
          S.pop(oks[2], 2.4);
          S.pop(oks[3], 2.8);
          // the rejected exercise sheet goes back to Alex, is redone, and returns
          S.hide(no, 3.2);
          S.hide(retry, 3.2);
          S.fly(products[1], [BENCH[1], 0.84, BENCH_Z + 0.05], 1.0, { delay: 3.3, arc: 1.2 });
          work(['alex'], 1, 4.3);
          work(['alex'], 0.15, 5.4);
          S.fly(products[1], [SLOT[1], BELT_Y, BELT_Z], 1.0, { delay: 5.4, arc: 1.2 });
          S.pop(oks[1], 6.5);
          work(['riley'], 0.15, 6.8);
        },
      },
      {
        cam: [-6.2, 3.0, -3.5, -4.0, 2.1, -9],
        run() {
          S.call(0.2, () => { bots.finder.visible = true; tags.finder.visible = true; });
          S.to(bots.finder.position, { x: -1.9 }, 1.8, { delay: 0.2, ease: ease.out });
          S.to(tags.finder.position, { x: -1.9 }, 1.8, { delay: 0.2, ease: ease.out });
          tags.finder.position.x = -9.5;
          work(['finder'], 0.8, 2.0);
          links.forEach(({ m, l }, i) => {
            S.pop(m, 2.2 + i * 0.45);
            S.pop(l, 2.4 + i * 0.45);
            S.call(3.9 + i * 0.5, () => l.material.color.set(0x5cb85c));
          });
          work(['finder'], 0.15, 5.6);
        },
      },
    ];
  },
};
