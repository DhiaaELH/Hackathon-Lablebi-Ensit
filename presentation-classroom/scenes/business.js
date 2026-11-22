// Scene 13 — business: the school office at dusk. A balance scale weighs what LessonForge costs
// (left pan: hosting + AI) against what it earns (right pan); then the camera zooms into the full cost sheet
// on the wall (shots/business-*.webp, source tools/business.html).
// Every figure here is the same as on that sheet; see the comment at the top of tools/business.html.
import * as THREE from 'three';
import { C, F, G, part, label, karim, screen, ground, instanced, blob, reseed } from '../models/kit.js';
import { ease } from '../anim.js';

const SX = 3.2;          // scale centre
const ARM = 1.35;        // half beam length
const TOP = 2.55;        // beam pivot height
const HANG = 1.05;       // pan hangs this far below the beam end

export default {
  place: 'office',
  origin: [-40, 0, -95],
  mood: { sky: 0xf3ad80, hemi: 1.3, sun: 1.9, sunColor: 0xffb070, hemiColor: 0xffe2c4, fog: [35, 120] },
  flight: 3.0,
  build(S) {
    reseed(23);
    const L = S.L;
    S.add(ground(0xcfa77e, 50));

    // ---------------- the room (one mesh)
    S.add(part((b) => {
      b.box(14, 0.3, 10, 0xb98a5a, 0.5, -0.15, 0);
      for (let x = -6; x <= 7; x += 1.3) b.box(0.03, 0.01, 10, 0xa77a4c, x, 0.005, 0);
      b.box(14, 5, 0.3, 0xf1dcc0, 0.5, 2.5, -4.6).box(0.3, 5, 10, 0xe9d2b4, -6.4, 2.5, 0);
      b.box(14, 0.25, 0.34, 0xd7bd98, 0.5, 0.125, -4.58);
      // window on the left wall with dusk light
      b.box(0.12, 2.2, 2.6, C.white, -6.2, 2.6, 1.2);
      // bookshelf and plant on the right, desk behind the scale
      b.box(1.8, 2.6, 0.45, C.woodDark, 6.4, 1.3, -4.2);
      for (let i = 0; i < 5; i++) b.box(0.22, 0.5, 0.3, [C.red, C.blue, C.yellow, C.green, C.purple][i], 5.7 + i * 0.28, 1.95, -4.15);
      for (let i = 0; i < 4; i++) b.box(0.22, 0.45, 0.3, [C.teal, C.orange, C.blue, C.red][i], 5.75 + i * 0.3, 1.0, -4.15);
      b.use(F.plant, -5.4, 0, -3.8, 0, 1.3);
      b.use(F.desk, 5.2, 0, -2.4, -0.3, 1.1);
      // the balance scale: base, post, top cap
      b.box(1.4, 0.2, 0.9, C.woodDark, SX, 0.1, 0).cyl(0.09, 0.12, TOP - 0.2, C.metal, SX, 0.2 + (TOP - 0.2) / 2, 0, 0, 0, 0, 8);
      b.cone(0.2, 0.3, C.yellow, SX, TOP + 0.22, 0, 0, 0, 0, 6);
    }));
    const pane = new THREE.Mesh(G.plane(2.5, 2.1), new THREE.MeshBasicMaterial({ color: 0xffc99a }));
    pane.position.set(-6.13, 2.6, 1.2);
    pane.rotation.y = Math.PI / 2;
    S.add(pane);
    S.add(blob(1.0, 0.25)).position.set(SX, 0.012, 0);

    // ---------------- the cost sheet on the wall (the camera zooms into it at the end)
    const sheetScreen = screen(3.6, 2.25, L('business-fr', 'business-en'));
    sheetScreen.position.set(-4.2, 2.75, -4.43);
    const sheetFrame = part((b) => b.box(3.85, 2.5, 0.08, C.woodDark, -4.2, 2.75, -4.5));
    // hidden until the last step, so it doesn't peek out above the text card
    sheetScreen.visible = sheetFrame.visible = false;
    S.add(sheetScreen, sheetFrame);

    // ---------------- beam and pans
    const st = { tilt: 0, coins: 0, cash: 0 };
    const beam = part((b) => b.box(ARM * 2 + 0.2, 0.1, 0.12, C.metal, 0, 0, 0).sph(0.08, C.yellow, -ARM, 0, 0).sph(0.08, C.yellow, ARM, 0, 0));
    beam.position.set(SX, TOP, 0);
    S.add(beam);
    const pan = (color, txt, bg) => {
      const g = new THREE.Group();
      g.add(part((b) => {
        b.cyl(0.62, 0.48, 0.12, color, 0, 0, 0, 0, 0, 0, 12);
        for (const a of [0, 2.09, 4.19]) b.cyl(0.012, 0.012, HANG, C.ink, Math.cos(a) * 0.45, HANG / 2, Math.sin(a) * 0.45, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      }));
      const t = label(txt, { w: 1.2, h: 0.34, bg, size: 0.64 });
      t.position.set(0, -0.3, 0.62);
      g.add(t);
      S.add(g);
      return g;
    };
    const left = pan(0x7fb3e6, L('Coûts', 'Costs'), '#e4f0ff');
    const right = pan(0x8fd18f, L('Revenus', 'Revenue'), '#e3f6e3');

    // coins on the cost pan: a few small gold coins (it costs little)
    const NCOIN = 14;
    const coins = instanced(G.cyl(0.13, 0.13, 0.045, 10), Array.from({ length: NCOIN }, () => ({ c: 0xf2c14e })));
    S.add(coins);
    // bank notes on the revenue pan: green bundles
    const NCASH = 12;
    const cash = instanced(G.box(0.42, 0.07, 0.22), Array.from({ length: NCASH }, (_, i) => ({ c: i % 2 ? 0x6cbf6c : 0x58a958 })));
    S.add(cash);

    const v = new THREE.Vector3();
    S.loop((t) => {
      const a = st.tilt + Math.sin(t * 1.3) * 0.012;
      beam.rotation.z = a;
      left.position.set(SX - Math.cos(a) * ARM, TOP - Math.sin(a) * ARM - HANG, 0);
      right.position.set(SX + Math.cos(a) * ARM, TOP + Math.sin(a) * ARM - HANG, 0);
      for (let i = 0; i < NCOIN; i++) {
        if (i >= st.coins) { coins.set(i, 0, -9, 0); continue; }
        const col = i % 3, row = Math.floor(i / 3);
        v.set(left.position.x - 0.28 + col * 0.28, left.position.y + 0.08 + row * 0.05, (col - 1) * 0.1);
        coins.set(i, v.x, v.y, v.z, 0, i * 0.7, 0);
      }
      for (let i = 0; i < NCASH; i++) {
        if (i >= st.cash) { cash.set(i, 0, -9, 0); continue; }
        const col = i % 2, row = Math.floor(i / 2);
        cash.set(i, right.position.x - 0.22 + col * 0.44, right.position.y + 0.1 + row * 0.075, 0, 0, (row % 2) * 0.2, 0);
      }
    });

    // ---------------- people
    const K = karim();
    K.position.set(5.2, 0, 1.8);
    K.rotation.y = -0.8;
    S.add(K);
    S.add(blob(0.5)).position.set(5.2, 0.012, 1.8);
    S.loop((t) => K.tick(t));

    // ---------------- tags (all hidden until their beat)
    const tag = (txt, x, y, z, w, bg = '#fdfbf7', size = 0.6, h = 0.42) => {
      const m = label(txt, { w, h, bg, size });
      m.position.set(x, y, z);
      m.visible = false;
      S.add(m);
      return m;
    };
    const fr = S.lang() === 'fr';
    const n = (x) => (fr ? x : x.replace(',', '.'));
    // beat 0: fixed costs
    const t0 = [
      tag(L('Serveur : ', 'Server: ') + n('24,02 TND / mois') .replace('mois', L('mois', 'month')), SX - ARM - 0.2, 4.15, 0.2, 2.9, '#e4f0ff'),
      tag(L('Domaine .tn : ', '.tn domain: ') + n('0,99 TND / mois').replace('mois', L('mois', 'month')), SX - ARM - 0.2, 3.62, 0.2, 2.9, '#e4f0ff'),
    ];
    // beat 1: AI per action
    const t1 = [
      tag(L('Créer un cours : ', 'Build a course: ') + n('0,958 TND'), SX - ARM - 0.3, 4.65, 0.2, 2.9, '#fff9c4'),
      tag(L('Réponse du tuteur : ', 'Tutor answer: ') + n('0,0044 TND'), SX - ARM - 0.3, 4.12, 0.2, 2.9, '#fff9c4'),
      tag(L('Correction : ', 'Grading: ') + n('0,0027 TND'), SX - ARM - 0.3, 3.59, 0.2, 2.9, '#fff9c4'),
    ];
    // beat 2: per student
    const t2 = [
      tag(n('0,344 TND') + L(' / étudiant / mois', ' / student / month'), SX - ARM - 0.2, 4.4, 0.2, 3.2, '#ffd6d6', 0.62, 0.48),
      tag(L('300 étudiants : 1 203,3 TND / an', '300 students: 1,203.3 TND / year'), SX - ARM - 0.2, 3.8, 0.2, 3.2, '#fdfbf7'),
    ];
    // beat 3: plans land on the revenue pan
    const plans = [
      tag(L('Étudiant : gratuit', 'Student: free'), SX + ARM + 0.6, 4.75, 0.2, 2.5, '#fdfbf7'),
      tag(L('Premium : 5 TND / mois', 'Premium: 5 TND / month'), SX + ARM + 0.6, 4.2, 0.2, 2.5, '#fff9c4'),
      tag(L('Faculté : 15 TND / étudiant / an', 'Faculty: 15 TND / student / year'), SX + ARM + 0.6, 3.65, 0.2, 2.5, '#e3f6e3'),
    ];
    const margin = tag(L('300 étudiants : 4 500 TND / an', '300 students: 4,500 TND / year'), SX + ARM + 0.6, 3.1, 0.2, 2.5, '#e3f6e3');

    const CAM = [1.7, 3.2, 8.8, 1.7, 2.45, 0];
    return [
      {
        cam: CAM,
        run() {
          t0.forEach((m, i) => S.pop(m, 0.5 + i * 0.4));
          S.to(st, { coins: 3 }, 0.6, { delay: 1.0, ease: ease.lin });
          S.to(st, { tilt: 0.05 }, 0.9, { delay: 1.1, ease: ease.back });
          K.pose = 'point';
        },
      },
      {
        cam: CAM,
        run() {
          t0.forEach((m) => S.hide(m));
          t1.forEach((m, i) => S.pop(m, 0.3 + i * 0.35));
          S.to(st, { coins: 7 }, 0.9, { delay: 0.8, ease: ease.lin });
          S.to(st, { tilt: 0.1 }, 0.9, { delay: 0.9, ease: ease.back });
          K.pose = 'idle';
        },
      },
      {
        cam: CAM,
        run() {
          t1.forEach((m) => S.hide(m));
          t2.forEach((m, i) => S.pop(m, 0.3 + i * 0.4));
          S.to(st, { coins: NCOIN }, 1.0, { delay: 0.6, ease: ease.lin });
          S.to(st, { tilt: 0.14 }, 0.9, { delay: 0.8, ease: ease.back });
        },
      },
      {
        cam: CAM,
        run() {
          t2.forEach((m) => S.hide(m));
          plans.forEach((m, i) => S.pop(m, 0.4 + i * 0.35));
          S.pop(margin, 1.7);
          S.to(st, { cash: NCASH }, 1.2, { delay: 1.2, ease: ease.lin });
          S.to(st, { tilt: -0.28 }, 1.0, { delay: 1.5, ease: ease.back });
          S.call(2.2, () => { K.pose = 'cheer'; });
        },
      },
      {
        // the zoom into the cost sheet starts on arrival (dive: 'auto' in scenes.js)
        cam: [-4.2, 2.75, 3.2, -4.2, 2.75, -4.4],
        dur: 1.4,
        screen: sheetScreen,
        shot: sheetScreen.userData.shot,
        run() {
          sheetScreen.visible = sheetFrame.visible = true;
          [...plans, margin].forEach((m) => S.hide(m));
          K.pose = 'idle';
        },
      },
    ];
  },
};
