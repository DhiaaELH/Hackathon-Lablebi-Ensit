// Scene 0 — cold open: 02:00, the night before the exam.
// The paper towers wobble, collapse into a tornado and form the word "LessonForge".
import { dorm, DORM_CAM } from '../models/places.js';
import { label, textPoints } from '../models/kit.js';
import { ease } from '../anim.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

export default {
  place: 'dorm',
  origin: [-90, 0, 30],
  mood: { sky: 0x141a33, hemi: 0.75, sun: 0.7, sunColor: 0x93a8ff, hemiColor: 0xaab8ee, fog: [30, 110] },
  build(S) {
    const R = dorm(S);
    R.yas.pose = 'sleepy';
    const { mesh, sheets } = R.towers;
    const n = sheets.length;
    const targets = textPoints('LessonForge', n, 10.5, '700 130px "Atkinson Hyperlegible Next", Arial, sans-serif');
    const st = { wob: 0.12, fly: 0 };
    const LOGO_Y = 5.6;

    const qs = [0, 1, 2].map((i) => {
      const q = label('?', { w: 0.45, h: 0.55, bg: null, fg: '#ff4d4d', font: 'Kalam', size: 0.95, bold: true });
      q.position.set(-0.3 + (i - 1) * 0.5, 2.3 + (i % 2) * 0.3, (i - 1) * 0.25);
      q.rotation.y = 0.65;
      q.visible = false;
      S.add(q);
      return q;
    });

    S.loop((t) => {
      const io = ease.io;
      for (let k = 0; k < n; k++) {
        const q = sheets[k];
        // wobble: higher sheets sway more
        const sway = Math.sin(t * 2.2 + q.tower * 1.7) * st.wob * q.i * 0.006;
        let x = q.x + sway, y = q.y, z = q.z + Math.cos(t * 1.9 + q.tower) * st.wob * q.i * 0.004;
        let rx = 0, ry = q.ry + sway * 2, s = 1;
        if (st.fly > 0) {
          const f = clamp((st.fly - (k / n) * 0.4) / 0.6);
          const a0 = Math.atan2(q.z, q.x), r0 = Math.hypot(q.x, q.z);
          const u = clamp(f / 0.55), v = io(clamp((f - 0.55) / 0.45));
          const ang = a0 + u * u * 9 + (k % 5) * 0.3 * u;
          const rad = r0 + (1.1 + (k % 9) * 0.12 - r0) * io(u);
          const sx = Math.cos(ang) * rad, sz = Math.sin(ang) * rad, sy = q.y + io(u) * (3.4 + (k % 11) * 0.28);
          const [tx, ty] = targets[k];
          x = sx + (tx - sx) * v;
          y = sy + (LOGO_Y + ty - sy) * v;
          z = sz + (0 - sz) * v;
          rx = u * 3 * (1 - v) + (Math.PI / 2) * v;
          ry = (q.ry + ang * 2) * (1 - v) + (Math.PI / 2) * v * 0;
          s = 1 - 0.42 * v;
        }
        mesh.set(k, x, y, z, rx, ry, 0, s);
      }
      qs.forEach((q, i) => { if (q.visible) q.position.y = 2.3 + (i % 2) * 0.3 + Math.sin(t * 2 + i) * 0.06; });
    });

    return [
      { cam: DORM_CAM },
      {
        cam: [3.4, 2.5, 4.4, -0.4, 1.35, 0],
        run() {
          R.yas.pose = 'think';
          S.to(st, { wob: 1 }, 1.2);
          qs.forEach((q, i) => S.pop(q, 0.3 + i * 0.25));
        },
      },
      {
        cam: [1.2, 5.3, 13, 0, 5.2, 0],
        dur: 2.6,
        mood: { hemi: 2.4, sky: 0x1b2450 },
        run() {
          qs.forEach((q) => S.hide(q));
          R.yas.pose = 'idle';
          S.to(st, { fly: 1 }, 3.6, { ease: ease.lin });
        },
      },
    ];
  },
};
