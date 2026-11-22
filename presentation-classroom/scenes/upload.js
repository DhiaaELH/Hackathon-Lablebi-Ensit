// Scene 2 — "Drop your course in": Mr. Karim throws his PDF as a paper plane into the smartboard,
// other formats follow, every file is checked and kept private.
import * as THREE from 'three';
import { classroom, SMART } from '../models/places.js';
import { label, plane, part, glow, G, C } from '../models/kit.js';
import { ease } from '../anim.js';

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0xbfe3ff },
  /** Leaving for the backstage: the chalkboard swings open like a secret door. */
  leave(S) {
    const R = S.refs.room;
    if (R) S.to(R.chalk.rotation, { y: -1.9 }, 1.1, { ease: ease.io });
  },
  build(S) {
    const R = classroom(S, { shot: 'login', chalk: 'LessonForge' });
    R.karim.pose = 'idle';

    // --- the PDF paper plane ---
    const pdf = new THREE.Group();
    const pl = plane(C.paper, 1.5);
    const tagPdf = label('PDF', { w: 0.6, h: 0.3, bg: '#ff4d4d', fg: '#ffffff', size: 0.7, bold: true });
    tagPdf.position.y = 0.42;
    pdf.add(pl, tagPdf);
    pdf.position.set(5.3, 2.3, -4.3);
    pdf.visible = false;
    S.add(pdf);
    const path = new THREE.CatmullRomCurve3([[5.3, 2.3, -4.3], [4.2, 3.5, 0.2], [0.5, 4.1, 3.0], [-4.6, 3.4, 0.6], [-3.0, 3.1, -3.4], [1.2, 2.8, -4.9], [SMART[0], SMART[1], SMART[2] + 0.1]].map((p) => new THREE.Vector3(...p)));
    const tmp = new THREE.Vector3();

    // --- other formats: cards in a row above the smartboard ---
    const mk = (i, front, cap, bg, fg) => {
      const g = new THREE.Group();
      const a = label(front, { w: 1.3, h: 0.62, bg, fg, font: 'Kalam', size: 0.5, bold: true });
      const c = label(cap, { w: 1.3, h: 0.24, bg: '#fff9c4', size: 0.7 });
      c.position.y = -0.43;
      g.add(a, c);
      g.userData.slot = [SMART[0] - 1.5 + i * 1.5, 4.56, -5.82];
      g.position.set(9 + i, 2.5, 7);
      g.visible = false;
      S.add(g);
      return g;
    };
    const cards = [
      mk(0, 'PPTX', S.L('Diapos', 'Slides'), '#ffd9b3', '#2d2d2d'),
      mk(1, 'x² + 2x − 3…', S.L('Photo → texte (OCR)', 'Photo → text (OCR)'), '#fdfbf7', '#3d6b8e'),
      mk(2, '▶', S.L('Vidéo YouTube', 'YouTube video'), '#2d2d2d', '#ffffff'),
    ];
    // OCR scanning line over the photo card
    const scan = glow(G.box(1.3, 0.04, 0.02), 0x2ec4b6, 0.9);
    scan.position.set(0, 0, 0.03);
    scan.visible = false;
    cards[1].add(scan);
    S.loop((t) => { scan.position.y = Math.sin(t * 2.4) * 0.27; });

    // --- checked + private ---
    const ticks = cards.map((g) => {
      const m = label('✓', { w: 0.34, h: 0.34, bg: '#5cb85c', fg: '#ffffff', size: 0.8, bold: true });
      m.position.set(0.62, 0.3, 0.05);
      m.visible = false;
      g.add(m);
      return m;
    });
    const lock = part((b) => b.box(0.62, 0.5, 0.18, C.yellow, 0, 0, 0).box(0.1, 0.4, 0.1, C.metal, -0.18, 0.4, 0).box(0.1, 0.4, 0.1, C.metal, 0.18, 0.4, 0).box(0.46, 0.1, 0.1, C.metal, 0, 0.62, 0).box(0.1, 0.18, 0.02, C.ink, 0, 0, 0.1));
    lock.position.set(5.75, 3.55, -5.75);
    lock.visible = false;
    const priv = label(S.L('Stockage privé', 'Private storage'), { w: 1.5, h: 0.36, size: 0.62 });
    priv.position.set(5.75, 2.9, -5.8);
    priv.visible = false;
    S.add(lock, priv);

    return [
      {
        cam: [9, 5.6, 10, 0.2, 2.3, -2],
        shot: 'setup',
        screen: R.smart,
        run() {
          R.karim.pose = 'throw';
          S.call(0.5, () => { pdf.visible = true; });
          S.tween({
            dur: 3.2, delay: 0.5, ease: ease.io,
            update: (k) => {
              path.getPoint(k, pdf.position);
              path.getPoint(Math.min(k + 0.02, 1), tmp);
              if (k < 0.98) pl.lookAt(tmp);
              tagPdf.rotation.y = 0.6;
              pdf.scale.setScalar(k > 0.92 ? Math.max(0.001, (1 - k) / 0.08) : 1);
            },
            done: () => { pdf.visible = false; R.smart.setShot('setup'); R.karim.pose = 'idle'; },
          });
          S.to(R.smart.scale, { x: 1.06, y: 1.06 }, 0.18, { delay: 3.7, ease: ease.out });
          S.to(R.smart.scale, { x: 1, y: 1 }, 0.3, { delay: 3.9 });
        },
      },
      {
        cam: [-2.2, 3.7, 7.8, 0.2, 3.1, -6],
        shot: 'setup',
        screen: R.smart,
        run() {
          R.karim.pose = 'point';
          cards.forEach((g, i) => {
            S.call(0.2 + i * 0.6, () => { g.visible = true; });
            S.fly(g, g.userData.slot, 1.3, { delay: 0.2 + i * 0.6, arc: 1.4, ease: ease.out });
          });
          S.call(2.2, () => { scan.visible = true; });
        },
      },
      {
        cam: [-0.8, 3.7, 5.6, 1.2, 3.2, -6],
        shot: 'setup',
        screen: R.smart,
        run() {
          R.karim.pose = 'idle';
          ticks.forEach((m, i) => S.pop(m, 0.3 + i * 0.3));
          S.pop(lock, 1.3, 1.1);
          S.pop(priv, 1.6);
        },
      },
    ];
  },
};
