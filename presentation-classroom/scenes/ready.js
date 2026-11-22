// Scene 4 — "The course is ready": what the workshop made flies back through the secret door
// onto every desk, then one drawer per course tab slides open.
import { classroom, DESKS } from '../models/places.js';
import { label, sheet, instanced, G, C } from '../models/kit.js';
import { ease } from '../anim.js';

const DOOR = [-4.6, 2.3, -5.6];

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0xbfe3ff },
  flight: 3.4,
  via: [[-4.6, 2.5, -8.5], [-4.6, 2.4, -5.2], [-1, 4, 2]],
  build(S) {
    const R = classroom(S, { shot: 'course-overview', chalk: 'LessonForge' });
    R.chalk.rotation.y = -1.9; // the secret door is still open
    R.karim.pose = 'idle';

    // one sheet per occupied desk, coming out of the doorway
    const cols = [C.paper, C.postit, 0xd9ecff, 0xdcf5dc, 0xffd6d6];
    const items = DESKS.map(([x, z], i) => {
      if (i === 7) return null;
      const m = sheet(cols[i % cols.length], 0.34, 0.44);
      m.rotation.x = -Math.PI / 2;
      m.position.set(...DOOR);
      m.visible = false;
      S.add(m);
      return { m, dest: [x + 0.32, 0.82, z + 0.02], i };
    }).filter(Boolean);

    // drawers: one per tab, on the eight desks of the first two rows
    const tabs = [S.L('Aperçu', 'Overview'), S.L('Exercices', 'Practice'), S.L('Révision', 'Revision'), S.L('Carte', 'Map'),
      S.L('Ressources', 'Resources'), S.L('Examens', 'Exams'), S.L('Projets', 'Projects'), S.L('Progrès', 'Progress')];
    const tints = [0xff4d4d, 0xf4a261, 0x2ec4b6, 0x9b6bd6, 0x5cb85c, 0xe76f51, 0x4a90d9, 0xffd166];
    const st = { open: 0 };
    const drawers = instanced(G.box(0.5, 0.2, 0.56), tabs.map((_, i) => ({ p: [DESKS[i][0], 0.62, DESKS[i][1]], c: tints[i] })));
    S.add(drawers);
    const tags = tabs.map((txt, i) => {
      const m = label(txt, { w: 1.25, h: 0.42, size: 0.6 });
      m.position.set(DESKS[i][0] + 0.75, 1.55 + (i % 2) * 0.18, DESKS[i][1] - 0.1);
      m.rotation.y = 0.55;
      m.visible = false;
      S.add(m);
      return m;
    });
    S.loop(() => {
      for (let i = 0; i < 8; i++) {
        const k = Math.max(0, Math.min(1, st.open * 8 - i));
        drawers.set(i, DESKS[i][0] + 0.38 + ease.out(k) * 0.52, 0.62, DESKS[i][1], 0, 0, 0, k > 0 ? 1 : 0.001);
      }
    });

    return [
      {
        cam: [10, 6.6, 11, -0.5, 1.2, -1],
        run() {
          items.forEach(({ m, dest }, n) => {
            const d = 2.2 + n * 0.16;
            S.call(d, () => { m.visible = true; });
            S.fly(m, dest, 1.5, { delay: d, arc: 2.2, ease: ease.io });
          });
          S.to(R.chalk.rotation, { y: 0 }, 1.1, { delay: 2.2 + items.length * 0.16 + 1.2 });
          S.call(4.5, () => { R.yas.pose = 'write'; });
        },
      },
      {
        cam: [9.5, 5.8, 10.5, -3.2, 0.9, -0.5],
        shot: 'course-overview',
        screen: R.smart,
        run() {
          S.to(st, { open: 1 }, 2.4, { ease: ease.lin });
          tags.forEach((m, i) => S.pop(m, 0.25 + i * 0.3));
        },
      },
    ];
  },
};
