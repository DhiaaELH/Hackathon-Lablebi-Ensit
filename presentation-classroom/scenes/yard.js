// Scene 9 — the courtyard: community threads, exam archive, glossary wheel,
// study groups, and a small social network with boundaries.
import * as THREE from 'three';
import { C, F, G, part, person, label, bubble, screen, ground, city, glow, reseed } from '../models/kit.js';
import { ease } from '../anim.js';

// camera that keeps the point (x, y, z) in the right half of the frame
const look = (x, y, z, d = 7.5, h = 3.2) => [x - 4.6, h, z + d, x - 2.5, y, z];

function table(b, x, z) {
  b.cyl(0.9, 0.9, 0.08, C.wood, x, 0.78, z, 0, 0, 0, 10).cyl(0.1, 0.16, 0.76, C.dark, x, 0.38, z);
  for (const a of [0.4, 2.5, 4.6]) b.cyl(0.24, 0.24, 0.46, C.tunisBlue, x + Math.cos(a) * 1.25, 0.23, z + Math.sin(a) * 1.25, 0, 0, 0, 8);
}
function seatAt(S, people, x, z, a, o = {}) {
  const p = person({ seated: true, ...o });
  p.position.set(x + Math.cos(a) * 1.25, 0, z + Math.sin(a) * 1.25);
  p.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  S.add(p);
  people.push(p);
  return p;
}

export default {
  place: 'yard',
  origin: [80, 0, 10],
  mood: { sky: 0xaedcff, hemi: 1.8, sun: 2.5, sunColor: 0xfff0cf },
  build(S) {
    reseed(23);
    const people = [];
    S.add(ground(C.sand));
    S.add(city(26, 60, 44, 8));

    // ---- courtyard: paving, arcade at the back, kiosk, olive tree
    S.add(part((b) => {
      b.box(22, 0.2, 16, 0xe9dfc9, 0, -0.1, 0);
      for (let i = -10; i <= 10; i += 2.5) b.box(0.05, 0.01, 16, 0xd8ccb2, i, 0.006, 0);
      for (let i = -7; i <= 7; i += 2.5) b.box(22, 0.01, 0.05, 0xd8ccb2, 0, 0.006, i);
      // arcade wall
      b.box(22, 5, 0.4, C.white, 0, 2.5, -8).box(22.2, 0.3, 1.6, 0xf0ece2, 0, 5.1, -7.4);
      for (let x = -10; x <= 10; x += 4) b.box(0.5, 4.2, 0.5, C.white, x, 2.1, -6.6).box(0.7, 0.2, 0.7, C.tunisBlue, x, 4.3, -6.6).box(0.7, 0.2, 0.7, C.tunisBlue, x, 0.1, -6.6);
      b.box(22, 0.7, 0.5, C.white, 0, 4.75, -6.6);
      b.box(1.2, 2.3, 0.1, C.tunisBlue, -8.5, 1.15, -7.78);
      // low side walls + planters
      b.box(0.5, 1, 16, C.white, -11, 0.5, 0).box(0.5, 1, 16, C.white, 11, 0.5, 0);
      b.use(F.plant, -10.2, 0, 6.5, 0, 1.6).use(F.plant, 10.2, 0, 6.5, 1, 1.6).use(F.plant, 10.2, 0, -5.6, 2, 1.4);
      // café kiosk
      b.box(2.6, 2.2, 2, C.tunisBlue, -7.6, 1.1, -4.4).box(3.2, 0.2, 2.6, C.white, -7.6, 2.4, -4.4).box(3.2, 0.5, 0.1, C.red, -7.6, 2.05, -3.08)
        .box(2.2, 0.1, 0.5, C.wood, -7.6, 1.05, -3.2).use(F.mug, -8.1, 1.1, -3.15).use(F.mug, -7.2, 1.1, -3.15);
      // olive tree in a stone ring
      b.cyl(1.3, 1.4, 0.4, 0xd8ccb2, -4.2, 0.2, 0.2, 0, 0, 0, 10).use(F.tree, -4.2, 0.3, 0.2, 0.4, 1.7);
      // tables + stools
      table(b, 3.4, 2.2);
      table(b, 6.4, -2.4);
      // stand of the word wheel and legs of the notice board
      b.box(0.16, 1.5, 0.16, C.dark, -1.2, 0.75, -4.6).box(0.16, 1.5, 0.16, C.dark, 1.2, 0.75, -4.6).box(2.9, 0.12, 0.5, C.dark, 0, 0.06, -4.6);
      b.box(4.3, 2.7, 0.14, C.dark, 4.6, 2.8, -6.2);
      // countdown board on an easel next to table 2
      b.box(0.08, 1.6, 0.08, C.woodDark, 8.6, 0.8, -1.0, 0, 0, 0.12).box(0.08, 1.6, 0.08, C.woodDark, 9.4, 0.8, -1.0, 0, 0, -0.12).box(1.5, 1.05, 0.08, C.board, 9.0, 1.75, -0.96);
    }));

    // ---- notice board showing the real site
    const board = screen(4.1, 2.5, 'community');
    board.position.set(4.6, 2.8, -6.1);
    S.add(board);

    // ---- table 1: the community
    const t1 = [3.4, 2.2];
    const a1 = seatAt(S, people, ...t1, 0.4), a2 = seatAt(S, people, ...t1, 2.5), a3 = seatAt(S, people, ...t1, 4.6);
    a1.pose = 'think'; a2.pose = 'idle'; a3.pose = 'type';
    const mk = (m, x, y, z, ry = -0.35) => { m.position.set(x, y, z); m.rotation.y = ry; m.visible = false; S.add(m); return m; };
    const q1 = mk(bubble(S.L('Pourquoi 2ʰ − 2 ?', 'Why 2ʰ − 2?'), { w: 1.9, h: 0.5 }), 4.8, 2.35, 2.0);
    const q2 = mk(bubble(S.L('Réseau + diffusion', 'Network + broadcast'), { w: 2.0, h: 0.5, bg: '#dcf5dc' }), 5.0, 2.97, 2.0);
    const up = mk(label('▲ 12', { w: 0.8, h: 0.36, bg: '#fff9c4', size: 0.66 }), 6.62, 2.97, 2.0);
    const tick = mk(label(S.L('✔ acceptée', '✔ accepted'), { w: 1.15, h: 0.36, bg: '#5cb85c', fg: '#ffffff', size: 0.62 }), 5.0, 3.53, 2.0);
    const hard = mk(label(S.L('Chapitre 2 : difficile ▲ 7', 'Chapter 2: hard ▲ 7'), { w: 2.3, h: 0.4, bg: '#ffd6d6', size: 0.6 }), 5.75, 4.12, 2.0);

    // ---- exam archive: filing cabinet with sliding drawers
    const CAB = [9.2, -6.3];
    // the cabinet only stands there during the archive step: elsewhere the other tags would sit on its year labels
    const cab = new THREE.Group();
    cab.position.set(CAB[0], 0, CAB[1]);
    cab.visible = false;
    S.add(cab);
    cab.add(part((b) => b.box(1.5, 3.2, 1, C.grey, 0, 1.6, 0).box(1.6, 0.1, 1.1, C.dark, 0, 3.25, 0)));
    const years = ['2025', '2024', '2023', '2022'];
    const drawers = years.map((y, i) => {
      const g = new THREE.Group();
      g.add(part((b) => b.box(1.3, 0.66, 0.9, C.metal, 0, 0, 0).box(0.4, 0.07, 0.06, C.dark, 0, 0.12, 0.48).box(1.1, 0.5, 0.04, C.paper, 0, 0.12, -0.1).box(1.1, 0.46, 0.04, C.postit, 0, 0.1, 0.1)));
      const l = label(y, { w: 0.6, h: 0.24, bg: '#fdfbf7', size: 0.7 });
      l.position.set(0, -0.14, 0.46);
      g.add(l);
      g.position.set(0, 2.75 - i * 0.74, 0.1);
      cab.add(g);
      return g;
    });
    const archTag = mk(label(S.L('Faculté · Matière · Année · Session', 'Faculty · Subject · Year · Session'), { w: 3.0, h: 0.4, bg: '#d9ecff', size: 0.55 }), 8.9, 4.45, -5.9, -0.2);
    const corr = mk(label(S.L('Correction ✔', 'Correction ✔'), { w: 1.2, h: 0.4, bg: '#dcf5dc', size: 0.6 }), 10.3, 3.85, -5.9, -0.2);
    const freq = mk(label(S.L('Ce chapitre est tombé 4 fois', 'This chapter came up 4 times'), { w: 2.3, h: 0.4, bg: '#fff9c4', size: 0.58 }), 8.3, 3.85, -5.9, -0.2);

    // ---- glossary: a four-sided word wheel turning on its axle
    const wheel = new THREE.Group();
    wheel.position.set(0, 1.9, -4.6);
    wheel.add(part((b) => b.box(2.3, 0.8, 0.8, C.paper, 0, 0, 0).cyl(0.07, 0.07, 2.7, C.dark, 0, 0, 0, 0, 0, Math.PI / 2)));
    const terms = [['Masque de sous-réseau', 'FR'], ['قناع الشبكة الفرعية', 'AR'], ['الماسك', 'Derja'], ['Subnet mask', 'EN']];
    terms.forEach(([txt, lang], i) => {
      const l = label(txt, { w: 2.2, h: 0.72, bg: ['#fff9c4', '#dcf5dc', '#ffd6d6', '#d9ecff'][i], size: 0.42, font: i === 1 || i === 2 ? 'Arial' : 'Patrick Hand' });
      const a = (i * Math.PI) / 2;
      l.position.set(0, Math.sin(a) * 0.405, Math.cos(a) * 0.405);
      l.rotation.x = -a;
      wheel.add(l);
    });
    wheel.scale.setScalar(0.0001);
    wheel.visible = false;
    S.add(wheel);
    const langTags = terms.map(([, lang], i) => mk(label(lang, { w: 0.7, h: 0.32, bg: i === 3 ? '#ff4d4d' : '#fdfbf7', fg: i === 3 ? '#ffffff' : '#2d2d2d', size: 0.66 }), -1.2 + i * 0.8, 2.75, -4.6, 0));
    const wst = { q: 0 };
    const riley = mk(label(S.L('Relu par les tuteurs ✔', 'Reviewed by tutors ✔'), { w: 2.0, h: 0.38, bg: '#dcf5dc', size: 0.6 }), 0, 3.25, -4.6, 0);

    // ---- table 2: the study group
    const t2 = [6.4, -2.4];
    const g1 = seatAt(S, people, ...t2, 0.4), g2 = seatAt(S, people, ...t2, 2.5, { glasses: true }), g3 = seatAt(S, people, ...t2, 4.6);
    g1.pose = 'write'; g2.pose = 'type'; g3.pose = 'think';
    const tutor = person({ top: 0x2ec4b6, style: 'short' });
    tutor.position.set(8.3, 0, -3.7);
    tutor.rotation.y = -1.0;
    S.add(tutor);
    people.push(tutor);
    const count = label(S.L('Examen dans\n12 jours', 'Exam in\n12 days'), { w: 1.4, h: 0.95, bg: null, fg: '#fdfbf7', font: 'Kalam', size: 0.8, bold: true });
    count.position.set(9.0, 1.75, -0.91);
    S.add(count);
    count.visible = false;
    const chat = mk(bubble(S.L('On refait le /24 ?', 'Shall we redo the /24?'), { w: 1.9, h: 0.46 }), 7.0, 3.2, -2.4, -0.3);
    const badge = mk(label(S.L('★ Tuteur', '★ Peer tutor'), { w: 1.2, h: 0.4, bg: '#ffd166', size: 0.64 }), 8.3, 2.5, -3.7, -0.3);
    const ribbon = mk(label(S.L('Vérifié par les étudiants', 'Verified by students'), { w: 2.5, h: 0.42, bg: '#5cb85c', fg: '#ffffff', size: 0.6 }), 7.2, 3.8, -2.4, -0.3);

    // ---- social: follow cards with a reason, and a privacy shield
    const f1 = mk(label(S.L('+ Suivre · même cours', '+ Follow · same course'), { w: 2.3, h: 0.42, bg: '#fff9c4', size: 0.58 }), 5.0, 2.8, 2.0);
    const f2 = mk(label(S.L('+ Suivre · tuteur', '+ Follow · peer tutor'), { w: 2.0, h: 0.42, bg: '#d9ecff', size: 0.58 }), 5.5, 3.4, 2.0);
    const dm = mk(label(S.L('Messages : abonnés seulement', 'Messages: followers only'), { w: 2.8, h: 0.42, bg: '#fdfbf7', size: 0.56 }), 5.8, 4.0, 2.0);
    const shield = mk(label(S.L('Bloquer · Signaler', 'Block · Report'), { w: 1.7, h: 0.4, bg: '#ff4d4d', fg: '#ffffff', size: 0.6 }), 6.6, 2.2, 2.0);

    S.loop((t) => {
      for (const p of people) p.tick(t);
      wheel.rotation.x = wst.q * (Math.PI / 2);
      [q1, q2, chat, f1, f2].forEach((m, i) => { if (m.visible) m.position.y += Math.sin(t * 1.6 + i) * 0.0009; });
    });
    // stepped easing: stop on each face of the wheel
    const steps = (k) => { const n = 3, x = k * n, i = Math.min(Math.floor(x), n - 1), f = x - i; return (i + ease.io(Math.min(f / 0.55, 1))) / n; };

    return [
      {
        cam: look(4.2, 1.9, 1.6, 8.5, 3.8),
        shot: 'community',
        screen: board,
        run() {
          S.tw.flush(); // finish anything the previous step still had pending (fast presenter)
          S.pop(q1, 0.4);
          S.pop(q2, 1.1);
          S.pop(up, 1.6);
          S.pop(tick, 2.2);
          S.pop(hard, 2.9);
          S.call(1.0, () => { a2.pose = 'raise'; });
        },
      },
      {
        cam: [4.6, 5.2, 4.2, 6.6, 2.2, -6.0],
        run() {
          S.tw.flush(); // finish anything the previous step still had pending (fast presenter)
          [q1, q2, up, tick, hard].forEach((m) => S.hide(m));
          a2.pose = 'idle';
          S.pop(cab, 0, 1, 0.35);
          drawers.forEach((d, i) => S.to(d.position, { z: 0.1 + (i === 0 ? 1.0 : 0.25 + (i % 2) * 0.2) }, 0.7, { delay: 0.3 + i * 0.25, ease: ease.out }));
          S.pop(archTag, 0.6);
          S.pop(corr, 1.6);
          S.pop(freq, 2.1);
        },
      },
      {
        cam: [1.6, 2.6, 2.6, -1.0, 2.2, -4.6],
        run() {
          S.tw.flush(); // finish anything the previous step still had pending (fast presenter)
          [archTag, corr, freq].forEach((m) => S.hide(m));
          drawers.forEach((d) => S.to(d.position, { z: 0.1 }, 0.4));
          S.hide(cab, 0.1, 0.3);
          S.pop(wheel, 0.2);
          langTags.forEach((m, i) => S.pop(m, 0.5 + i * 0.15));
          S.to(wst, { q: 3 }, 5.2, { delay: 1.0, ease: steps });
          S.pop(riley, 2.2);
        },
      },
      {
        cam: look(7.4, 1.9, -2.2, 7.8, 3.8),
        run() {
          S.tw.flush(); // finish anything the previous step still had pending (fast presenter)
          S.hide(riley);
          S.hide(wheel);
          langTags.forEach((m) => S.hide(m));
          S.call(0, () => { count.visible = true; count.material.opacity = 0; });
          S.to(count.material, { opacity: 1 }, 0.6, { delay: 0.05 });
          S.pop(chat, 0.5);
          S.pop(badge, 1.2);
          S.call(1.2, () => { tutor.pose = 'point'; });
          S.pop(ribbon, 2.0);
        },
      },
      {
        cam: look(4.4, 2.2, 1.6, 8.5, 3.9),
        shot: 'people',
        screen: board,
        run() {
          S.tw.flush(); // finish anything the previous step still had pending (fast presenter)
          [chat, badge, ribbon].forEach((m) => S.hide(m));
          S.to(count.material, { opacity: 0 }, 0.3, { done: () => { count.visible = false; } });
          tutor.pose = 'idle';
          S.call(0, () => board.setShot('people'));
          S.pop(f1, 0.4);
          S.pop(f2, 0.9);
          S.pop(dm, 1.5);
          S.pop(shield, 2.1);
        },
      },
    ];
  },
};
