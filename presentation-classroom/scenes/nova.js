// Scene 7 — "Raise your hand": Nova and Sam.
// Nova (a glowing paper plane) takes the question and hands it to Sam, who answers
// from the course: red threads to the cited pages, a fake citation that drops off,
// "not in your course" for an off-topic question, the modes dial, four languages.
import * as THREE from 'three';
import { classroom, DESKS, YAS_DESK } from '../models/places.js';
import { part, label, glow, G, C, plane, robot } from '../models/kit.js';
import { ease } from '../anim.js';

const FONT = '"Patrick Hand", "Kalam", "Segoe UI", "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif';
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
function paper(x, W, H, bg = '#fdfbf7', stroke = '#2d2d2d') {
  x.fillStyle = bg;
  x.strokeStyle = stroke;
  x.lineWidth = 9;
  x.beginPath();
  x.roundRect(7, 7, W - 14, H - 14, 26);
  x.fill();
  x.stroke();
}
function fitText(x, txt, maxW, px, weight = '') {
  x.font = `${weight}${px}px ${FONT}`;
  const w = x.measureText(txt).width;
  if (w > maxW) x.font = `${weight}${(px * maxW) / w}px ${FONT}`;
}

// The real suggestion strings of the Nova panel (frontend/src/features/Nova.tsx)
const SAY = [
  ['Français', 'Résume-moi le chapitre 1', false, '#fff9c4'],
  ['English', 'Summarise chapter 1 for me', false, '#d9ecff'],
  ['العربية', 'لخّص لي الفصل الأول', true, '#dcf5dc'],
  ['Derja', 'فسّرلي الفصل الأول', true, '#ffd6d6'],
];

const CAM = [-6.5, 3.2, -4.8];

export default {
  place: 'class',
  origin: [0, 0, 0],
  mood: { sky: 0xbfe3ff },
  build(S) {
    const R = classroom(S, { shot: 'nova-1', empty: [0, 7] });
    const [dx, dz] = DESKS[YAS_DESK];
    const th = Math.atan2(CAM[0] - dx, CAM[2] - dz);
    const rig = new THREE.Group();
    rig.position.set(dx, 0, dz);
    rig.rotation.y = th;
    S.add(rig);
    const at = (lx, ly, lz) => [dx + lx * Math.cos(th) + lz * Math.sin(th), ly, dz - lx * Math.sin(th) + lz * Math.cos(th)];
    const put = (m, x, y, z, hidden = true) => { m.position.set(x, y, z); if (hidden) m.visible = false; rig.add(m); return m; };

    // question bubble above Yasmine
    const Q1 = S.L('Quels sont les prérequis ?', 'What are the prerequisites?');
    const Q2 = S.L('Quelle est la capitale de l’Australie ?', 'What is the capital of Australia?');
    const qb = put(label(Q1, { w: 2.5, h: 0.5, bg: '#fdfbf7', size: 0.56 }), 0.0, 2.95, -0.3);

    // Nova: glowing paper plane
    const nv = put(new THREE.Group(), 4.2, 4.2, 0.6);
    const nvIn = new THREE.Group();
    const pl = plane(0xfff1a8, 0.75);
    pl.rotation.set(0.2, -1.2, 0);
    nvIn.add(pl, glow(G.sph(0.36), 0xffe27a, 0.3));
    nv.add(nvIn);
    const nvTag = label('Nova', { w: 0.7, h: 0.26, size: 0.7, bg: '#fff9c4' });
    nvTag.position.set(0, 0.5, 0);
    nv.add(nvTag);

    // Sam + relay baton
    const sam = put(robot('sam'), 1.9, 0.3, 0.4);
    sam.rotation.y = -0.45;
    const samTag = label('Sam', { w: 0.6, h: 0.26, size: 0.7, bg: '#ffd166' });
    samTag.position.set(0, 1.75, 0);
    sam.add(samTag);
    const baton = put(glow(G.cyl(0.04, 0.04, 0.42), 0xff4d4d), 0.95, 1.75, 0.35);
    baton.rotation.z = 0.9;
    const relay = put(label('Nova  →  Sam', { w: 1.7, h: 0.42, bg: '#ffd6d6', size: 0.6, bold: true }), 2.65, 3.0, 0.4);

    // answer, cited pages, threads
    const ans = put(label(S.L('Avant ce chapitre, il te faut :\nle binaire et les adresses IP', 'Before this chapter you need:\nbinary and IP addresses'), { w: 2.6, h: 0.8, size: 0.6 }), 3.2, 2.75, 0.4);
    const PG = [[2.4, 'S12', false], [3.2, 'S4', false], [4.0, 'S99', true]];
    const pages = PG.map(([px, tag, fake]) => put(board(0.62, 0.8, (x, W, H) => {
      paper(x, W, H, fake ? '#ffe3e3' : '#fdfbf7');
      x.strokeStyle = '#b9b2a6'; x.lineWidth = 5;
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(W * 0.16, H * (0.16 + i * 0.11)); x.lineTo(W * (i === 3 ? 0.6 : 0.84), H * (0.16 + i * 0.11)); x.stroke(); }
      x.fillStyle = fake ? '#e03131' : '#2d2d2d';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${H * 0.26}px Kalam, ${FONT}`;
      x.fillText(tag, W / 2, H * 0.74);
      x.fillStyle = '#ff4d4d';
      x.beginPath(); x.arc(W / 2, H * 0.07, H * 0.045, 0, 7); x.fill();
    }), px, 3.85, 0.4));
    const threads = PG.map(([px]) => {
      const a = [px > 3.2 ? 3.8 : px < 3.2 ? 2.6 : 3.2, 3.15], b = [px, 3.47];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = put(glow(G.box(len, 0.03, 0.03), 0xff4d4d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.42);
      m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return m;
    });

    const nic = put(board(2.8, 0.75, (x, W, H) => {
      paper(x, W, H, '#fff9c4', '#c62828');
      x.fillStyle = '#c62828'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const msg = S.L('Pas trouvé dans ton cours', 'Not found in your course');
      fitText(x, msg, W * 0.86, H * 0.5, '700 ');
      x.fillText(msg, W / 2, H * 0.53);
    }), 3.2, 2.85, 0.4);

    // modes dial (one canvas, repainted as the pointer steps)
    const MODES = [S.L('Question', 'Ask'), S.L('Socratique', 'Socratic'), S.L('Indices', 'Hints'), S.L('Réponse', 'Answer'), S.L('Autre\nexplication', 'Alternative\nexplanation'), S.L('Explique\nmon erreur', 'Explain\nmy mistake'), S.L('Mini-leçon', 'Mini-lesson')];
    const dial = put(board(2.5, 2.5, (x, W, H, cur) => {
      const cx = W / 2, cy = H / 2, r = W * 0.48;
      x.fillStyle = '#fdfbf7'; x.strokeStyle = '#2d2d2d'; x.lineWidth = 10;
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke();
      const n = MODES.length;
      MODES.forEach((mname, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2, a0 = a - Math.PI / n, a1 = a + Math.PI / n;
        if (i === cur) {
          x.fillStyle = '#fff9c4';
          x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r - 6, a0, a1); x.closePath(); x.fill();
        }
        x.strokeStyle = '#cfc8ba'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(cx + Math.cos(a0) * r * 0.2, cy + Math.sin(a0) * r * 0.2); x.lineTo(cx + Math.cos(a0) * (r - 6), cy + Math.sin(a0) * (r - 6)); x.stroke();
        x.fillStyle = i === cur ? '#c62828' : '#2d2d2d';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        const ls = mname.split('\n'), px = W * 0.058;
        x.font = `${i === cur ? '700 ' : ''}${px}px ${FONT}`;
        ls.forEach((l, j) => x.fillText(l, cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66 + (j - (ls.length - 1) / 2) * px * 1.05));
      });
      // pointer
      const a = -Math.PI / 2 + (cur / n) * Math.PI * 2;
      x.strokeStyle = '#ff4d4d'; x.lineWidth = 14; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36); x.stroke();
      x.fillStyle = '#2d2d2d';
      x.beginPath(); x.arc(cx, cy, W * 0.035, 0, 7); x.fill();
    }), 3.3, 2.9, 0.3);

    // four languages
    const says = SAY.map(([lang, txt, rtl, bg], i) => put(board(1.55, 0.75, (x, W, H) => {
      paper(x, W, H, bg);
      x.textBaseline = 'middle';
      x.fillStyle = '#66615a';
      x.direction = rtl ? 'rtl' : 'ltr';
      x.textAlign = rtl ? 'right' : 'left';
      const ex = rtl ? W * 0.93 : W * 0.07;
      x.font = `${H * 0.2}px ${FONT}`;
      x.fillText(lang, ex, H * 0.26);
      x.fillStyle = '#2d2d2d';
      fitText(x, txt, W * 0.86, H * 0.3);
      x.fillText(txt, ex, H * 0.64);
    }), 2.2 + (i % 2) * 1.65, 3.8 - Math.floor(i / 2) * 0.88, 0.4));

    const hover = { x: 0.95, y: 1.9, z: 0.3 };
    S.loop((t) => {
      sam.tick(t);
      nvIn.position.y = Math.sin(t * 3) * 0.07;
      nvIn.rotation.z = Math.sin(t * 2.2) * 0.15;
    });

    return [
      {
        cam: [-5.9, 3.0, -4.3, ...at(0.0, 2.2, 0)],
        shot: 'nova-1',
        screen: R.smart,
        run() {
          R.yas.pose = 'raise';
          S.pop(qb, 0.3);
          S.pop(nv, 0.7);
          S.fly(nv, [hover.x, hover.y, hover.z], 1.5, { delay: 0.7, arc: 0.5 });
        },
      },
      {
        cam: [...CAM, ...at(0.5, 2.2, 0)],
        run() {
          S.pop(sam, 0.2, 1.25);
          S.pop(baton, 0.7);
          S.fly(baton, [2.3, 1.45, 0.75], 0.9, { delay: 1.0, arc: 0.6 });
          S.to(baton.rotation, { z: 0.2 }, 0.9, { delay: 1.0 });
          S.to(sam, { work: 1 }, 0.3, { delay: 1.9 });
          S.pop(relay, 1.5);
        },
      },
      {
        cam: [...CAM, ...at(0.5, 2.3, 0)],
        run() {
          R.yas.pose = 'idle';
          S.hide(relay);
          S.hide(baton);
          S.to(sam, { work: 0 }, 0.3, { delay: 0.6 });
          S.pop(ans, 0.4);
          pages.forEach((p, i) => S.pop(p, 0.9 + i * 0.2));
          threads.forEach((m, i) => { m.scale.x = 0.0001; m.visible = true; S.to(m.scale, { x: 1 }, 0.4, { delay: 1.5 + i * 0.15 }); });
          // the citation that is not in the course snaps off and falls
          S.hide(threads[2], 2.7, 0.15);
          S.to(pages[2].rotation, { z: -1.3 }, 0.9, { delay: 2.8, ease: ease.in });
          S.fly(pages[2], [4.25, 1.75, 0.9], 0.9, { delay: 2.8, arc: 0, ease: ease.in });
        },
      },
      {
        cam: [...CAM, ...at(0.5, 2.2, 0)],
        shot: 'nova-2',
        screen: R.smart,
        run() {
          R.smart.setShot('nova-2');
          [ans, ...pages, ...threads].forEach((m) => S.hide(m, 0, 0.2));
          qb.setText(Q2);
          R.yas.pose = 'raise';
          S.pop(nic, 0.7);
          S.to(sam.parts.arm.rotation, { z: -0.9 }, 0.4, { delay: 0.7, ease: ease.back });
          S.to(sam.parts.head.rotation, { z: 0.28 }, 0.4, { delay: 0.7 });
        },
      },
      {
        cam: [...CAM, ...at(0.5, 2.3, 0)],
        run() {
          S.hide(nic);
          S.hide(qb);
          R.yas.pose = 'type';
          S.to(sam.parts.arm.rotation, { z: 0 }, 0.3);
          S.to(sam.parts.head.rotation, { z: 0 }, 0.3);
          S.pop(dial, 0.3);
          MODES.forEach((_, i) => S.call(0.9 + i * 0.6, () => dial.redraw(i)));
        },
      },
      {
        cam: [...CAM, ...at(0.5, 2.35, 0)],
        shot: 'lang-ar',
        screen: R.smart,
        run() {
          R.smart.setShot('lang-ar');
          S.hide(dial);
          says.forEach((m, i) => S.pop(m, 0.4 + i * 0.3));
        },
      },
    ];
  },
};
