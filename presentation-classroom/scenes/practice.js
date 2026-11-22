// Scene 6 — "Practice, not just reading".
// Three lanterns (hints 1→3), a rubric ticking itself, a chest that only opens after an
// attempt, a timed quiz with a misconception bubble, and a sealed mock-exam envelope.
import * as THREE from 'three';
import { classroom, DESKS, YAS_DESK } from '../models/places.js';
import { part, label, glow, G, C, sheet } from '../models/kit.js';
import { ease } from '../anim.js';

const FONT = '"Patrick Hand", "Kalam", "Segoe UI", sans-serif';
/** A canvas-painted card. paint(ctx, W, H, state); m.redraw(state) repaints it. */
function board(w, h, paint) {
  const k = 260;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  m.redraw = (state = 0) => {
    m.userData.state = state;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    paint(x, cv.width, cv.height, state);
    tex.needsUpdate = true;
  };
  m.redraw(0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => m.redraw(m.userData.state));
  return m;
}
function paper(x, W, H, bg = '#fdfbf7') {
  x.fillStyle = bg;
  x.strokeStyle = '#2d2d2d';
  x.lineWidth = 9;
  x.beginPath();
  x.roundRect(7, 7, W - 14, H - 14, 26);
  x.fill();
  x.stroke();
}

// camera in front-left of Yasmine; props live in a rig turned to face it
const CAM = [-6.5, 3.2, -4.8];

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0xbfe3ff },
  build(S) {
    const R = classroom(S, { shot: 'course-practice', empty: [0, 7] });
    const [dx, dz] = DESKS[YAS_DESK];
    const th = Math.atan2(CAM[0] - dx, CAM[2] - dz);
    const rig = new THREE.Group();
    rig.position.set(dx, 0, dz);
    rig.rotation.y = th;
    S.add(rig);
    const at = (lx, ly, lz) => [dx + lx * Math.cos(th) + lz * Math.sin(th), ly, dz - lx * Math.sin(th) + lz * Math.cos(th)];
    const put = (m, x, y, z, hidden = true) => { m.position.set(x, y, z); if (hidden) m.visible = false; rig.add(m); return m; };
    const st = { clock: 0 };
    R.yas.pose = 'write';

    // exercise sheet on her desk
    const ex = sheet(C.paper, 0.34, 0.44);
    ex.rotation.x = -Math.PI / 2;
    ex.position.set(dx + 0.3, 0.81, dz + 0.05);
    S.add(ex);

    // ----- beat 0: three lanterns
    const LX = [-0.55, 0.1, 0.75];
    const lant = new THREE.Group();
    rig.add(lant);
    lant.add(part((b) => LX.forEach((x) => b.cyl(0.012, 0.012, 1.5, C.ink, x, 3.65, 0).box(0.34, 0.06, 0.34, C.dark, x, 2.9, 0).box(0.34, 0.06, 0.34, C.dark, x, 2.48, 0).cone(0.2, 0.16, C.dark, x, 3.0, 0))));
    const glass = LX.map((x, i) => {
      const g = glow(G.box(0.26, 0.36, 0.26), 0x555b66);
      g.position.set(x, 2.69, 0);
      lant.add(g);
      const n = label(String(i + 1), { w: 0.3, h: 0.3, size: 0.8, bold: true });
      n.position.set(x, 2.2, 0.05);
      lant.add(n);
      return g;
    });
    const light = (g, delay) => {
      const to = new THREE.Color(0xffd166);
      let from = null;
      S.tween({ dur: 0.4, delay, update: (k) => { if (!from) from = g.material.color.clone(); g.material.color.copy(from).lerp(to, k); } });
      S.to(g.scale, { x: 1.18, y: 1.18, z: 1.18 }, 0.4, { delay, ease: ease.back });
    };

    // ----- beat 1: rubric
    const lines = [S.L('Méthode', 'Method'), S.L('Étapes du calcul', 'Working steps'), S.L('Résultat', 'Result'), S.L('Justification', 'Justification')];
    const rubric = put(board(1.9, 2.0, (x, W, H, n) => {
      paper(x, W, H);
      x.fillStyle = '#2d2d2d';
      x.textBaseline = 'middle';
      x.font = `700 ${H * 0.11}px Kalam, ${FONT}`;
      x.textAlign = 'center';
      x.fillText(S.L('Barème', 'Rubric'), W / 2, H * 0.13);
      x.strokeStyle = '#ff4d4d'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(W * 0.3, H * 0.2); x.lineTo(W * 0.7, H * 0.2); x.stroke();
      lines.forEach((l, i) => {
        const y = H * (0.32 + i * 0.135);
        x.strokeStyle = '#2d2d2d'; x.lineWidth = 6;
        x.strokeRect(W * 0.09, y - H * 0.04, H * 0.08, H * 0.08);
        x.fillStyle = '#2d2d2d';
        x.textAlign = 'left';
        x.font = `${H * 0.082}px ${FONT}`;
        x.fillText(l, W * 0.24, y);
        if (i < n) {
          const ok = i !== 3;
          x.fillStyle = ok ? '#2e9e4f' : '#e03131';
          x.font = `700 ${H * 0.12}px ${FONT}`;
          x.textAlign = 'center';
          x.fillText(ok ? '✓' : '✗', W * 0.09 + H * 0.04, y);
        }
      });
      if (n >= 5) {
        x.fillStyle = '#c62828';
        x.textAlign = 'center';
        x.font = `700 ${H * 0.13}px Kalam, ${FONT}`;
        x.fillText('3 / 4', W / 2, H * 0.88);
      }
    }), 2.5, 2.2, 0.2);

    // ----- beat 2: chest
    const chest = put(new THREE.Group(), 1.35, 0, 0.6);
    chest.add(part((b) => b.box(0.9, 0.45, 0.6, C.woodDark, 0, 0.225, 0).box(0.94, 0.08, 0.64, C.yellow, 0, 0.41, 0).box(0.1, 0.45, 0.64, C.yellow, -0.3, 0.225, 0).box(0.1, 0.45, 0.64, C.yellow, 0.3, 0.225, 0)));
    const lid = new THREE.Group();
    lid.position.set(0, 0.45, -0.3);
    lid.add(part((b) => b.box(0.9, 0.22, 0.6, C.wood, 0, 0.11, 0.3).box(0.1, 0.24, 0.62, C.yellow, -0.3, 0.11, 0.3).box(0.1, 0.24, 0.62, C.yellow, 0.3, 0.11, 0.3)));
    chest.add(lid);
    const lock = part((b) => b.box(0.2, 0.22, 0.08, C.metal, 0, 0, 0).box(0.05, 0.08, 0.09, C.ink, 0, -0.02, 0.005));
    lock.position.set(0, 0.42, 0.33);
    chest.add(lock);
    const tried = put(label(S.L('1 tentative ✓', '1 attempt ✓'), { w: 1.5, h: 0.42, bg: '#dcf5dc', size: 0.6 }), 2.9, 1.3, 0.3);
    const sol = put(label(S.L('Corrigé détaillé', 'Worked solution'), { w: 1.9, h: 0.5, bg: '#fff9c4', size: 0.6, bold: true }), 1.35, 0.5, 0.6);

    // ----- beat 3: quiz clock, answers, misconception
    const clock = put(new THREE.Group(), 2.9, 2.75, 0);
    clock.add(part((b) => {
      b.cyl(0.8, 0.8, 0.08, C.paper, 0, 0, 0, Math.PI / 2, 0, 0, 24).cyl(0.88, 0.88, 0.06, C.ink, 0, 0, -0.03, Math.PI / 2, 0, 0, 24);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.box(0.04, i % 3 ? 0.08 : 0.16, 0.02, C.ink, Math.sin(a) * 0.68, Math.cos(a) * 0.68, 0.045, 0, 0, -a); }
      b.sph(0.06, C.ink, 0, 0, 0.06);
    }));
    const hand = part((b) => b.box(0.05, 0.62, 0.03, C.red, 0, 0.29, 0));
    hand.position.z = 0.06;
    clock.add(hand);
    const chips = ['A', 'B', 'C'].map((c, i) => put(label(c, { w: 0.42, h: 0.42, size: 0.75, bold: true }), 0.95 + i * 0.55, 1.75, 0.35));
    const cross = put(label('✗', { w: 0.4, h: 0.4, bg: null, fg: '#e03131', size: 1, bold: true }), 1.5, 1.75, 0.4);
    const why = put(label(S.L('On retire 2 adresses :\nréseau et diffusion', 'Remove 2 addresses:\nnetwork and broadcast'), { w: 2.4, h: 0.8, bg: '#fdfbf7', size: 0.6 }), 2.65, 1.1, 0.5);

    // ----- beat 4: sealed mock-exam envelope
    const env = put(new THREE.Group(), 2.6, 2.3, 0.3);
    const key = label(S.L('Corrigé', 'Answer key'), { w: 1.25, h: 0.7, bg: '#dcf5dc', size: 0.42, bold: true });
    key.position.set(0, 0.0, -0.03);
    env.add(key);
    env.add(part((b) => b.box(1.5, 0.95, 0.04, 0xf3ead7, 0, 0, 0).box(1.5, 0.03, 0.05, C.ink, 0, -0.475, 0).box(0.03, 0.95, 0.05, C.ink, -0.75, 0, 0).box(0.03, 0.95, 0.05, C.ink, 0.75, 0, 0)));
    const title = label(S.L('Examen blanc', 'Mock exam'), { w: 1.2, h: 0.3, bg: null, size: 0.8 });
    title.position.set(0, -0.28, 0.03);
    env.add(title);
    const flap = new THREE.Group();
    flap.position.set(0, 0.475, 0.03);
    flap.add(part((b) => b.box(1.5, 0.5, 0.02, 0xe6dac2, 0, -0.25, 0).box(1.5, 0.03, 0.03, C.ink, 0, -0.5, 0)));
    env.add(flap);
    const seal = part((b) => b.cyl(0.13, 0.13, 0.04, C.red, 0, 0, 0, Math.PI / 2, 0, 0, 10));
    seal.position.set(0, -0.03, 0.07);
    env.add(seal);
    const handed = put(label(S.L('Copie remise ✓', 'Handed in ✓'), { w: 1.6, h: 0.42, bg: '#dcf5dc', size: 0.6 }), 1.25, 1.75, 0.3);

    S.loop((t) => { hand.rotation.z = -t * 1.6 * st.clock; });

    return [
      {
        cam: [-5.6, 3.0, -4.1, ...at(-0.2, 2.05, 0)],
        shot: 'course-practice',
        screen: R.smart,
        run() { glass.forEach((g, i) => light(g, 0.8 + i * 0.8)); },
      },
      {
        cam: [...CAM, ...at(0.5, 1.95, 0)],
        run() {
          R.yas.pose = 'idle';
          S.pop(rubric, 0.3);
          for (let i = 1; i <= 5; i++) S.call(0.8 + i * 0.55, () => rubric.redraw(i));
        },
      },
      {
        cam: [-6.0, 3.0, -4.6, ...at(0.4, 1.6, 0)],
        run() {
          S.hide(rubric);
          S.pop(chest, 0.2);
          S.pop(tried, 0.7);
          S.to(lock.rotation, { z: 0.6 }, 0.2, { delay: 1.2 });
          S.hide(lock, 1.4);
          S.to(lid.rotation, { x: -1.9 }, 0.7, { delay: 1.7, ease: ease.back });
          S.pop(sol, 2.0);
          S.to(sol.position, { y: 2.45 }, 0.9, { delay: 2.0, ease: ease.out });
        },
      },
      {
        cam: [...CAM, ...at(0.5, 1.95, 0)],
        run() {
          [chest, tried, sol].forEach((m) => S.hide(m));
          R.yas.pose = 'think';
          S.pop(clock, 0.2);
          S.to(st, { clock: 1 }, 0.3, { delay: 0.3 });
          chips.forEach((c, i) => S.pop(c, 0.6 + i * 0.15));
          S.call(1.6, () => chips[1].material.color.set(0xffb3b3));
          S.pop(cross, 1.6);
          S.pop(why, 2.1);
        },
      },
      {
        cam: [...CAM, ...at(0.5, 1.95, 0)],
        shot: 'course-exams',
        screen: R.smart,
        run() {
          R.smart.setShot('course-exams');
          [clock, cross, why, ...chips].forEach((m) => S.hide(m));
          S.to(st, { clock: 0 }, 0.2);
          R.yas.pose = 'write';
          S.pop(env, 0.3);
          S.pop(handed, 1.0);
          S.call(1.0, () => { R.yas.pose = 'idle'; });
          S.hide(seal, 1.6);
          S.to(flap.rotation, { x: 2.7 }, 0.6, { delay: 1.9 });
          S.to(key.position, { y: 0.78 }, 0.8, { delay: 2.3, ease: ease.out });
        },
      },
    ];
  },
};
