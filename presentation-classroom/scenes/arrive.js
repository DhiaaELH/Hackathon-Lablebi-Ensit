// Scene 1 — morning: we fly over Tunis into Mr. Karim's classroom.
import { classroom, SMART } from '../models/places.js';
import { label } from '../models/kit.js';

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0xbfe3ff },
  flight: 4.6,
  via: [[-45, 30, 34], [6, 20, 30]],
  build(S) {
    const R = classroom(S, { shot: 'login', chalk: '' });
    R.chalkText.material.opacity = 0;
    R.karim.position.set(10, 0, -3.2);
    R.karim.rotation.y = -Math.PI / 2;

    const names = [S.L('Apprendre', 'Learn'), S.L('Communauté', 'Community'), S.L('Suivi de classe', 'Class insights'), S.L('Défis', 'Challenges')];
    const notes = names.map((txt, i) => {
      const m = label(txt, { w: 1.08, h: 0.42, bg: ['#fff9c4', '#ffd6d6', '#d9ecff', '#dcf5dc'][i], size: 0.56 });
      m.position.set(SMART[0] - 1.72 + i * 1.15, 4.42, -5.9);
      m.rotation.z = (i % 2 ? 1 : -1) * 0.04;
      m.visible = false;
      S.add(m);
      return m;
    });

    return [
      {
        cam: [12, 7, 14, 0, 1.6, -1.5],
        run() {
          R.karim.pose = 'walk';
          S.to(R.karim.position, { x: 5.3, z: -4.6 }, 2.6, { delay: 2.2, done: () => { R.karim.pose = 'idle'; R.karim.rotation.y = -0.25; } });
          S.call(2.6, () => R.chalkText.setText('LessonForge'));
          S.to(R.chalkText.material, { opacity: 1 }, 1.4, { delay: 2.8 });
        },
      },
      {
        cam: [-0.6, 3.1, 4.4, 0.4, 2.75, -6],
        shot: 'login',
        screen: R.smart,
        run() {
          R.karim.pose = 'point';
          notes.forEach((m, i) => S.pop(m, 0.5 + i * 0.25));
        },
      },
    ];
  },
};
