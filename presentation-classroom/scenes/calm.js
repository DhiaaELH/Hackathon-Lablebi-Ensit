// Scene 8 — the same dorm room at 02:00, but calm: flashcards with spaced
// repetition, audio summaries, a revision planner, an offline pack and a PDF.
import * as THREE from 'three';
import { dorm, DORM_CAM } from '../models/places.js';
import { label, glow, G, C, part, instanced } from '../models/kit.js';
import { ease } from '../anim.js';

const FACE = 0.68; // turn flat things towards the camera

export default {
  place: 'dorm',
  origin: [-90, 0, 30],
  mood: { sky: 0x1a1f3d, hemi: 1.05, sun: 0.8, sunColor: 0xffd9a0, hemiColor: 0xd9c8b8, fog: [30, 110] },
  build(S) {
    const R = dorm(S, { tidy: true, headphones: true, shot: 'course-revision' });
    R.yas.pose = 'type';
    const st = { wave: 0, notes: 1 };

    // ---- soft music notes drifting up (beat 0, stay through the scene)
    const notes = ['♪', '♫', '♪'].map((ch, i) => {
      const m = label(ch, { w: 0.4, h: 0.4, bg: null, fg: '#fff1a8', font: 'Kalam', size: 0.9, bold: true });
      m.rotation.y = FACE;
      S.add(m);
      return m;
    });

    // ---- flashcards (beat 1): hard comes back soon, easy comes back later
    const DECK = [-1.0, 0.93, 0.5];
    const defs = [
      { c: '#ffd6d6', t: S.L('difficile\ndemain', 'hard\ntomorrow'), wait: 0.9, dur: 0.7 },
      { c: '#fff9c4', t: S.L('moyen\ndans 3 j', 'medium\nin 3 days'), wait: 2.0, dur: 1.2 },
      { c: '#dcf5dc', t: S.L('facile\ndans 6 j', 'easy\nin 6 days'), wait: 3.2, dur: 1.9 },
      { c: '#ffd6d6', t: S.L('difficile\ndemain', 'hard\ntomorrow'), wait: 1.2, dur: 0.7 },
      { c: '#dcf5dc', t: S.L('facile\ndans 6 j', 'easy\nin 6 days'), wait: 3.6, dur: 1.9 },
    ];
    const cards = defs.map((d, i) => {
      const m = label(d.t, { w: 0.62, h: 0.44, bg: d.c, size: 0.6 });
      m.position.set(...DECK);
      m.rotation.y = FACE;
      m.visible = false;
      S.add(m);
      m.userData.fan = [-1.9 + i * 0.62, 2.25 + Math.sin(i * 1.3) * 0.22, 0.9 - i * 0.42];
      return m;
    });
    const deck = part((b) => {
      for (let i = 0; i < 5; i++) b.box(0.3, 0.012, 0.22, [C.paper, C.postit, 0xdcf5dc, C.paper, 0xffd6d6][i], 0, i * 0.013, 0, 0, i * 0.12);
    });
    deck.position.set(DECK[0], 0.885, DECK[2]);
    deck.visible = false;
    S.add(deck);
    const due = label(S.L('À revoir demain : 2 cartes', 'Due tomorrow: 2 cards'), { w: 2.0, h: 0.36, bg: '#ffd6d6', size: 0.6 });
    due.position.set(-1.3, 2.2, 0.6);
    due.rotation.y = FACE;
    due.visible = false;
    S.add(due);

    // ---- audio (beat 2): rings from the headphones, a formula read as words
    const rings = [0, 1, 2].map(() => {
      const r = glow(G.ring(0.3, 0.34, 28), 0xfff1a8, 0.9);
      r.material.transparent = true;
      r.material.side = THREE.DoubleSide;
      r.position.set(-0.3, 1.55, 0);
      r.rotation.y = FACE;
      r.visible = false;
      S.add(r);
      return r;
    });
    const formula = label('2ʰ − 2', { w: 1.1, h: 0.5, bg: '#fdfbf7', font: 'Kalam', size: 0.7, bold: true, fade: true });
    formula.position.set(-1.5, 2.55, 0.5);
    formula.rotation.y = FACE;
    formula.visible = false;
    S.add(formula);
    const spoken = label(S.L('« deux puissance h, moins deux »', '“two to the power h, minus two”'), { w: 2.5, h: 0.46, bg: '#fff9c4', size: 0.5 });
    spoken.position.set(-1.25, 2.55, 0.35);
    spoken.rotation.y = FACE;
    spoken.visible = false;
    S.add(spoken);

    // ---- planner on the left wall (beat 3)
    const planner = part((b) => b.box(0.06, 1.3, 1.9, C.paper, 0, 0, 0).box(0.07, 0.2, 1.9, C.red, 0, 0.56, 0).box(0.08, 1.36, 0.06, C.woodDark, 0, 0, -0.97).box(0.08, 1.36, 0.06, C.woodDark, 0, 0, 0.97));
    planner.position.set(-2.94, 2.3, 0.6);
    S.add(planner);
    const ptitle = label(S.L('Planning de révision', 'Revision planner'), { w: 1.8, h: 0.19, bg: null, fg: '#fdfbf7', size: 0.7 });
    ptitle.position.set(-2.9, 2.86, 0.6);
    ptitle.rotation.y = Math.PI / 2;
    S.add(ptitle);
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) cells.push({ r, c });
    const cellMesh = instanced(G.box(0.03, 0.2, 0.2), cells.map((q, i) => ({ p: [0, 0, 0], s: 0.0001, c: i === 20 ? C.red : [0xbfe0ff, 0xdcf5dc, 0xfff1a8][(q.r + q.c) % 3] })));
    cellMesh.position.set(-2.9, 2.3, 0.6);
    S.add(cellMesh);
    const cst = { k: 0 };
    const placeCells = () => {
      cells.forEach((q, i) => {
        const s = Math.max(0.0001, Math.min(1, cst.k * cells.length - i));
        cellMesh.set(i, 0, 0.28 - q.r * 0.27, 0.78 - q.c * 0.26, 0, 0, 0, s);
      });
    };
    placeCells();
    const exam = label(S.L('Examen', 'Exam'), { w: 0.8, h: 0.3, bg: '#ff4d4d', fg: '#ffffff', size: 0.62 });
    exam.position.set(-2.86, 1.42, -0.5);
    exam.rotation.y = Math.PI / 2;
    exam.visible = false;
    S.add(exam);

    // offline pack → backpack, and a printed PDF
    const pack = part((b) => b.box(0.34, 0.26, 0.1, C.tunisBlue, 0, 0, 0).box(0.36, 0.05, 0.11, C.yellow, 0, 0, 0));
    pack.position.set(-1.3, 1.25, 0);
    pack.visible = false;
    S.add(pack);
    const packLabel = label(S.L('Pack hors ligne', 'Offline pack'), { w: 1.2, h: 0.32, bg: '#d9ecff', size: 0.56 });
    packLabel.position.set(-1.2, 1.95, 1.5);
    packLabel.rotation.y = FACE;
    packLabel.visible = false;
    S.add(packLabel);
    const pdf = label('PDF', { w: 0.42, h: 0.56, bg: '#fdfbf7', fg: '#c62828', font: 'Kalam', size: 0.42, bold: true });
    pdf.position.set(-1.4, 1.1, 0);
    pdf.rotation.y = FACE;
    pdf.visible = false;
    S.add(pdf);

    S.loop((t) => {
      notes.forEach((m, i) => {
        const u = (t * 0.22 + i / 3) % 1;
        m.position.set(-0.2 + Math.sin(t + i * 2) * 0.25 + i * 0.25, 1.9 + u * 1.5, 0.3 - i * 0.3);
        m.material.opacity = Math.sin(u * Math.PI) * st.notes;
      });
      rings.forEach((r, i) => {
        const u = (t * 0.55 + i / 3) % 1;
        r.scale.setScalar(0.6 + u * 3.2);
        r.material.opacity = (1 - u) * st.wave;
      });
    });

    return [
      { cam: DORM_CAM },
      {
        cam: [3.3, 2.7, 4.4, -1.0, 1.6, 0.1],
        shot: 'course-revision',
        screen: R.laptop,
        run() {
          R.yas.pose = 'think';
          S.to(st, { notes: 0.35 }, 0.6);
          S.pop(deck, 0);
          S.pop(due, 5.6);
          cards.forEach((m, i) => {
            const d = defs[i];
            S.pop(m, 0.05 + i * 0.1);
            S.fly(m, m.userData.fan, 0.7, { delay: 0.05 + i * 0.1, arc: 0.3, ease: ease.out });
            S.fly(m, [DECK[0], DECK[1] + i * 0.012, DECK[2]], d.dur, { delay: 1.4 + d.wait, arc: 0.5 + d.dur * 0.5 });
            S.to(m.scale, { x: 0.45, y: 0.45, z: 0.45 }, d.dur, { delay: 1.4 + d.wait });
            S.hide(m, 1.4 + d.wait + d.dur, 0.15);
          });
        },
      },
      {
        cam: [3.1, 2.7, 4.2, -0.9, 1.75, 0.1],
        run() {
          R.yas.pose = 'idle';
          S.to(st, { wave: 1, notes: 1 }, 0.8);
          S.hide(due);
          S.hide(deck);
          rings.forEach((r) => { r.visible = true; });
          S.pop(formula, 0.3);
          S.fade(formula, 0, 0.7, { delay: 1.8 });
          S.pop(spoken, 2.3);
        },
      },
      {
        cam: [3.2, 2.9, 5.6, -0.9, 1.75, 0.3],
        run() {
          S.to(st, { wave: 0 }, 0.5, { done: () => rings.forEach((r) => { r.visible = false; }) });
          S.hide(spoken);
          R.yas.pose = 'type';
          S.to(cst, { k: 1 }, 2.2, { delay: 0.3, ease: ease.lin, update: placeCells });
          S.pop(exam, 2.5);
          S.pop(pack, 0.6);
          S.fly(pack, [-0.4, 0.75, 1.3], 1.3, { delay: 1.4, arc: 0.9 });
          S.hide(pack, 2.7, 0.2);
          S.pop(packLabel, 2.7);
          S.pop(pdf, 1.0);
          S.fly(pdf, [-2.1, 1.25, 1.9], 1.2, { delay: 1.5, arc: 0.5 });
        },
      },
      {
        cam: DORM_CAM,
        dur: 1.6,
        run() {
          S.hide(packLabel);
          S.hide(pdf);
          R.yas.pose = 'type';
        },
      },
    ];
  },
};
