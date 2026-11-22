// Scene 11 — the teachers' room at dusk: "See the class, not the student".
// Anonymous silhouettes, the rule of five, the teacher's answer, the 24 h hourglass → senior queue.
import { C, F, G, part, label, glow, screen, ground, karim, person, bubble, reseed } from '../models/kit.js';
import { ease } from '../anim.js';

const GREY = 0x8e959e;
const SIL_X = (i) => 3.3 + i * 0.64;
const SIL_Z = -2.4;

export default {
  place: 'staff',
  origin: [-70, 0, -50],
  mood: { sky: 0xf6b98a, hemi: 1.25, sun: 1.9, sunColor: 0xffb070, hemiColor: 0xffe2c4, fog: [35, 120] },
  build(S) {
    reseed(23);
    S.add(ground(0xcfa77e, 50));

    // ---- room: x -2..14.5, z -4..4, open at the front and on the right
    S.add(part((b) => {
      b.box(16.5, 0.3, 8, 0xc7a37a, 6.25, -0.15, 0);
      for (let x = -1; x <= 14; x += 1.5) b.box(0.04, 0.01, 8, 0xb48f66, x, 0.005, 0);
      b.box(16.8, 5, 0.3, 0xefe2cc, 6.1, 2.5, -4.15).box(16.8, 0.25, 0.34, 0xdccbae, 6.1, 0.125, -4.13);
      // left wall with a window
      b.box(0.3, 1.3, 8, 0xe9dcc6, -2.15, 0.65, 0).box(0.3, 1.3, 8, 0xe9dcc6, -2.15, 4.35, 0);
      b.box(0.3, 2.4, 2.4, 0xe9dcc6, -2.15, 2.5, -2.8).box(0.3, 2.4, 2.4, 0xe9dcc6, -2.15, 2.5, 2.8);
      b.box(0.1, 2.4, 0.08, C.white, -2.1, 2.5, 0).box(0.1, 0.08, 3.2, C.white, -2.1, 2.5, 0);
      // rug, bookshelf, plant, coffee corner
      b.box(7, 0.02, 3.2, 0xb8574a, 5, 0.012, -1.6).box(6.6, 0.022, 2.8, 0xe6c79a, 5, 0.013, -1.6);
      b.box(2.2, 2.6, 0.45, C.woodDark, 0.2, 1.3, -3.75);
      for (let i = 0; i < 10; i++) b.box(0.16, 0.5, 0.3, [C.red, C.blue, C.yellow, C.green, C.purple][i % 5], -0.65 + (i % 5) * 0.42, 0.75 + Math.floor(i / 5) * 0.95, -3.62);
      b.use(F.plant, -1.3, 0, 3.0, 0, 1.5).use(F.plant, 13.8, 0, -3.3, 1, 1.3);
      // chart frame on the back wall (empty paper inside)
      b.box(3.0, 2.1, 0.08, C.woodDark, 4.6, 3.0, -3.97).box(2.76, 1.86, 0.02, C.paper, 4.6, 3.0, -3.92);
      b.box(2.4, 0.03, 0.01, C.ink, 4.6, 2.28, -3.9);
      // wall monitor (teacher dashboard) and the senior's queue screen
      b.box(2.4, 1.55, 0.1, C.dark, 7.9, 3.0, -3.95).box(2.4, 1.55, 0.1, C.dark, 13.1, 3.2, -3.95);
      // teacher's desk (long side along z), chair, lamp, mug, tablet stand
      b.use(F.desk, 7.9, 0, -0.5, Math.PI / 2, 1.15).use(F.chair, 8.75, 0, -0.5, -Math.PI / 2);
      b.use(F.lamp, 7.75, 0.92, -1.1).use(F.mug, 8.05, 0.92, 0.15);
      b.box(0.05, 0.36, 0.5, C.dark, 7.62, 1.1, -0.5, 0, 0, 0.25);
      // hourglass pedestal + hourglass frame
      b.box(0.9, 0.8, 0.9, 0xd9c7a6, 10.3, 0.4, -2.6);
      b.cyl(0.42, 0.42, 0.06, C.woodDark, 10.3, 0.83, -2.6, 0, 0, 0, 12).cyl(0.42, 0.42, 0.06, C.woodDark, 10.3, 2.17, -2.6, 0, 0, 0, 12);
      for (const [dx, dz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) b.cyl(0.025, 0.025, 1.3, C.woodDark, 10.3 + dx, 1.5, -2.6 + dz);
    }));
    const dusk = glow(G.plane(3.2, 2.4), 0xffc58f, 0.7);
    dusk.position.set(-2.16, 2.5, 0);
    dusk.rotation.y = Math.PI / 2;
    dusk.material.side = 2;
    S.add(dusk);
    const tablet = glow(G.plane(0.46, 0.32), 0xd8ecff);
    tablet.position.set(7.66, 1.11, -0.5);
    tablet.rotation.set(0, Math.PI / 2, 0);
    tablet.rotateX(-0.25);
    S.add(tablet);

    // ---- Mr. Karim
    const K = karim({ seated: true });
    K.position.set(8.75, 0, -0.5);
    K.rotation.y = -Math.PI / 2;
    K.pose = 'type';
    S.add(K);

    // ---- screens showing the real site
    const monitor = screen(2.2, 1.375, 'insights');
    monitor.position.set(7.9, 3.0, -3.89);
    S.add(monitor);
    const queue = screen(2.2, 1.375, 'queue');
    queue.position.set(13.1, 3.2, -3.89);
    S.add(queue);

    // ---- anonymous silhouettes (no face, no name: only a date stamp)
    const sil = [0, 1, 2, 3, 4].map((i) => {
      const m = part((b) => b.cyl(0.22, 0.28, 1.0, GREY, 0, 0.52, 0, 0, 0, 0, 10).sph(0.23, GREY, 0, 1.28, 0));
      m.position.set(17 + i * 0.9, 0, SIL_Z + (i % 2) * 0.25);
      m.visible = false;
      const stamp = label(S.L('12 mars', '12 March'), { w: 0.62, h: 0.22, bg: '#fdfbf7', size: 0.6 });
      stamp.position.set(0, 1.72, 0);
      m.add(stamp);
      S.add(m);
      return m;
    });
    const arrive = (i, delay) => {
      S.call(delay, () => { sil[i].visible = true; });
      S.to(sil[i].position, { x: SIL_X(i) }, 1.8, { delay, ease: ease.out });
    };

    const stuck = bubble(S.L('« Je bloque sur la 2.3 »', '“I’m stuck on 2.3”'), { w: 2.3, h: 0.46, size: 0.52 });
    stuck.position.set(4.3, 2.15, SIL_Z + 0.3);
    stuck.visible = false;
    S.add(stuck);

    // ---- the frame: lock, counter, bars
    const lock = part((b) => b.box(0.5, 0.4, 0.12, C.yellow, 0, 0, 0).box(0.08, 0.3, 0.08, C.dark, -0.15, 0.3, 0).box(0.08, 0.3, 0.08, C.dark, 0.15, 0.3, 0).box(0.38, 0.08, 0.08, C.dark, 0, 0.46, 0).box(0.08, 0.14, 0.02, C.ink, 0, 0, 0.07));
    lock.position.set(4.6, 2.95, -3.84);
    S.add(lock);
    const counter = label('3 / 5', { w: 1.3, h: 0.5, bg: '#fff9c4', size: 0.7, bold: true, font: 'Kalam' });
    counter.position.set(4.6, 4.42, -3.9);
    S.add(counter);
    const bars = part((b) => {
      [[0.95, C.red], [0.7, C.orange], [0.72, C.blue], [0.45, C.teal]].forEach(([h, c], i) => b.box(0.42, h * 1.5, 0.06, c, -0.9 + i * 0.6, h * 0.75, 0));
    });
    bars.position.set(4.6, 2.3, -3.86);
    bars.scale.y = 0.0001;
    bars.visible = false;
    S.add(bars);

    // ---- announcement, question, hourglass sand, senior
    const news = label(S.L('Annonce : rappel sur la 2.3 jeudi', 'Announcement: recap of 2.3 on Thursday'), { w: 3.1, h: 0.5, bg: '#dcf5dc', size: 0.5 });
    news.position.set(7.6, 1.5, -0.5);
    news.visible = false;
    S.add(news);
    const question = label('?', { w: 0.55, h: 0.55, bg: '#ffd6d6', size: 0.85, bold: true, font: 'Kalam' });
    question.position.set(5.3, 2.3, SIL_Z + 0.3);
    question.visible = false;
    S.add(question);

    const sandTop = part((b) => b.cone(0.34, 0.6, C.yellow, 0, 0.3, 0, Math.PI, 0, 0, 10));
    sandTop.position.set(10.3, 1.5, -2.6);
    const sandBot = part((b) => b.cone(0.34, 0.6, C.yellow, 0, 0.3, 0, 0, 0, 0, 10));
    sandBot.position.set(10.3, 0.86, -2.6);
    sandBot.scale.y = 0.0001;
    S.add(sandTop, sandBot);
    const h24 = label('24 h', { w: 0.8, h: 0.42, bg: '#fff9c4', size: 0.7, bold: true, font: 'Kalam' });
    h24.position.set(10.3, 0.42, -2.14);
    S.add(h24);

    const senior = person({ skin: 0xc68642, top: C.teal, bottom: 0x34495e, hair: 0x1a1a1a, style: 'curly', tall: 1.05, pack: C.orange });
    senior.position.set(12.3, 0, -1.5);
    senior.rotation.y = -0.45;
    senior.add(part((b) => b.cyl(0.1, 0.1, 0.03, C.yellow, 0.14, 1.26, 0.17, Math.PI / 2, 0, 0, 5).cyl(0.05, 0.05, 0.035, C.red, 0.14, 1.26, 0.172, Math.PI / 2, 0, 0, 5)));
    S.add(senior);
    const seniorTag = label(S.L('Étudiant senior', 'Senior student'), { w: 1.7, h: 0.4, bg: '#fff9c4', size: 0.56 });
    seniorTag.position.set(12.3, 2.25, -1.5);
    S.add(seniorTag);

    S.loop((t) => {
      K.tick(t);
      senior.tick(t);
      sil.forEach((m, i) => { if (m.visible) m.position.y = 0.06 + Math.sin(t * 1.6 + i * 1.3) * 0.05; });
      lock.rotation.z = Math.sin(t * 2.2) * 0.05;
    });

    const CAM_A = [3.9, 3.0, 8.6, 3.6, 2.1, -4];
    return [
      {
        cam: CAM_A,
        shot: 'insights',
        screen: monitor,
        run() {
          [0, 1, 2].forEach((i) => arrive(i, 0.3 + i * 0.5));
          S.pop(stuck, 2.4);
        },
      },
      {
        cam: [3.3, 3.1, 7.4, 3.1, 2.5, -4],
        run() {
          S.hide(stuck);
          arrive(3, 0.2);
          S.call(1.9, () => counter.setText('4 / 5'));
          arrive(4, 3.0);
          S.call(4.7, () => counter.setText('5 / 5'));
          S.hide(lock, 4.7);
          S.call(4.9, () => { bars.visible = true; });
          S.to(bars.scale, { y: 1 }, 0.9, { delay: 4.9, ease: ease.back });
        },
      },
      {
        cam: [5.2, 3.0, 8.2, 5.2, 2.1, -4],
        shot: 'class',
        screen: monitor,
        run() {
          monitor.setShot('class');
          K.pose = 'write';
          S.pop(news, 0.5);
          S.fly(news, [4.6, 2.2, SIL_Z + 0.4], 1.3, { delay: 1.2, arc: 0.8 });
          S.call(2.6, () => { K.pose = 'type'; });
        },
      },
      {
        cam: [9.9, 3.0, 8.0, 10.1, 2.0, -4],
        shot: 'queue',
        screen: queue,
        run() {
          S.hide(news);
          S.pop(question, 0.2);
          S.fly(question, [10.3, 2.75, -2.6], 1.2, { delay: 0.9, arc: 0.7 });
          S.to(sandTop.scale, { y: 0.0001 }, 2.2, { delay: 2.0, ease: ease.lin });
          S.to(sandBot.scale, { y: 1 }, 2.2, { delay: 2.0, ease: ease.lin });
          S.fly(question, [11.45, 1.75, -1.4], 1.1, { delay: 4.4, arc: 0.5 });
          S.call(5.4, () => { senior.pose = 'raise'; });
        },
      },
    ];
  },
};
