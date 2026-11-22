// Scene 10 — the gym: challenges, AI grading past the 60% line, XP,
// three attempts, level steps and a privacy-friendly leaderboard.
import * as THREE from 'three';
import { C, G, part, person, yasmine, karim, robot, label, screen, ground, city, glow, instanced, reseed } from '../models/kit.js';
import { ease } from '../anim.js';

const look = (x, y, z, d = 7.5, h = 3.2) => [x - 4.4, h, z + d, x - 2.4, y, z];

export default {
  place: 'gym',
  origin: [80, 0, -45],
  mood: { sky: 0xbfe3ff, hemi: 1.7, sun: 2.0, sunColor: 0xfff2d8 },
  build(S) {
    reseed(31);
    const people = [];
    S.add(ground(C.sand));
    S.add(city(26, 60, 40, 5));

    // ---- hall: court floor, back wall, left wall, bleachers, hoop
    S.add(part((b) => {
      b.box(22, 0.3, 14, 0xd9a86a, 0, -0.15, 0);
      b.box(18, 0.01, 0.08, C.white, 0, 0.006, 5).box(18, 0.01, 0.08, C.white, 0, 0.006, -5).box(0.08, 0.01, 10, C.white, -9, 0.006, 0).box(0.08, 0.01, 10, C.white, 9, 0.006, 0).box(0.08, 0.01, 10, C.white, 0, 0.006, 0);
      b.cyl(1.8, 1.8, 0.012, 0xc9965a, 0, 0.004, 0, 0, 0, 0, 20);
      b.box(22.3, 7, 0.3, 0xf0e6d2, -0.15, 3.5, -7.15).box(22.3, 1.2, 0.34, C.tunisBlue, -0.15, 0.6, -7.13);
      b.box(0.3, 7, 14, 0xe8dcc6, -11.15, 3.5, 0);
      for (let i = 0; i < 3; i++) b.box(0.9, 0.45, 10, i % 2 ? C.blue : C.tunisBlue, -10.4 + i * 0.9, 0.22 + i * 0.45, 0);
      // scoreboard frame
      b.box(4.9, 3.1, 0.2, C.dark, 3.2, 4.6, -6.9);
      // hoop on the left wall
      b.box(0.1, 1.2, 1.8, C.white, -10.9, 4.2, 0).cyl(0.4, 0.4, 0.05, C.red, -10.3, 3.8, 0, 0, 0, 0, 10);
      // cork board for the challenge card
      b.box(2.2, 1.7, 0.1, C.wood, -0.6, 2.4, -6.95).box(2.0, 1.5, 0.1, 0xd9b991, -0.6, 2.4, -6.92);
      // gauge frame next to the grader
      b.box(0.7, 3.3, 0.2, C.dark, 7.2, 1.75, -2.2).box(0.5, 3.0, 0.1, C.paper, 7.2, 1.75, -2.08).box(1.0, 0.2, 0.6, C.dark, 7.2, 0.1, -2.2);
      // level steps
      [100, 300, 600, 1000].forEach((v, i) => b.box(1.3, 0.5 + i * 0.5, 1.4, [0xcfe8ff, 0xbfe0c0, 0xffe7a3, 0xffc9c9][i], 2.2 + i * 1.3, (0.5 + i * 0.5) / 2, -4.8));
      // podium
      b.box(1.3, 1.0, 1.2, C.yellow, 4.2, 0.5, 2.6).box(1.3, 0.7, 1.2, C.metal, 2.9, 0.35, 2.6).box(1.3, 0.45, 1.2, C.orange, 5.5, 0.225, 2.6);
    }));
    const stepLabels = [100, 300, 600, 1000].map((v, i) => {
      const l = label(`${v} XP`, { w: 1.1, h: 0.34, bg: '#fdfbf7', size: 0.62 });
      l.position.set(2.2 + i * 1.3, 0.24 + i * 0.5, -4.08);
      l.visible = false;
      S.add(l);
      return l;
    });

    const board = screen(4.6, 2.8, 'challenges');
    board.position.set(3.2, 4.6, -6.78);
    S.add(board);

    // ---- cast
    const K = karim();
    K.position.set(0.9, 0, -6.2);
    K.rotation.y = -0.5;
    S.add(K);
    const Y = yasmine();
    Y.position.set(4.4, 0, -1.8);
    Y.rotation.y = 0.5;
    S.add(Y);
    const bot = robot('grader');
    bot.position.set(6.1, 0.25, -2.0);
    bot.rotation.y = -0.4;
    bot.scale.setScalar(1.25);
    S.add(bot);
    people.push(K, Y);

    const mk = (m, x, y, z, ry = -0.3) => { m.position.set(x, y, z); m.rotation.y = ry; m.visible = false; S.add(m); return m; };

    // ---- beat 0: the challenge card
    const card = mk(label(S.L('DÉFI\nDécouper un /24\n★ 100 XP · vendredi', 'CHALLENGE\nSplit a /24\n★ 100 XP · Friday'), { w: 1.7, h: 1.25, bg: '#fff9c4', size: 0.62 }), -0.6, 2.4, -6.84, 0);
    const crit = mk(label(S.L('Critères ✓ ✓ ✓', 'Criteria ✓ ✓ ✓'), { w: 1.5, h: 0.36, bg: '#dcf5dc', size: 0.62 }), -0.6, 3.5, -6.84, 0);

    // ---- beat 1: submission sheet, gauge, XP orbs
    const work = mk(label(S.L('Ma copie', 'My work'), { w: 0.5, h: 0.64, bg: '#fdfbf7', size: 0.3 }), 4.6, 1.3, -1.6, -0.3);
    const fill = glow(G.box(0.44, 1, 0.06), 0x5cb85c);
    fill.position.set(7.2, 0.25, -2.0);
    fill.scale.y = 0.001;
    S.add(fill);
    const line = glow(G.box(1.0, 0.06, 0.08), 0xff4d4d);
    line.position.set(7.2, 0.25 + 3.0 * 0.6, -1.98);
    S.add(line);
    const l60 = label('60 %', { w: 0.7, h: 0.32, bg: '#ff4d4d', fg: '#ffffff', size: 0.68 });
    l60.position.set(8.05, 0.25 + 3.0 * 0.6, -1.98);
    l60.rotation.y = -0.3;
    S.add(l60);
    const score = mk(label('82 %', { w: 0.9, h: 0.42, bg: '#5cb85c', fg: '#ffffff', font: 'Kalam', size: 0.72, bold: true }), 7.2, 3.75, -2.0);
    const gst = { v: 0, xp: 0 };
    const NORB = 14;
    const orbs = instanced(G.sph(0.09, 1), Array.from({ length: NORB }, () => ({ p: [0, -5, 0], c: 0xffd166 })), { basic: true });
    S.add(orbs);
    const xpTag = mk(label('+82 XP', { w: 1.0, h: 0.42, bg: '#ffd166', font: 'Kalam', size: 0.7, bold: true }), 4.4, 2.6, -1.8);

    // ---- beat 2: three attempt tokens
    const tokens = [0, 1, 2].map((i) => {
      const m = label(['54 %', '71 %', '82 %'][i], { w: 0.62, h: 0.62, bg: ['#e2e2e2', '#e2e2e2', '#ffd166'][i], size: 0.42 });
      return mk(m, 3.7 + i * 0.72, 2.75 + (i === 2 ? 0.12 : 0), -1.8);
    });
    const best = mk(label(S.L('le meilleur compte', 'best one counts'), { w: 1.8, h: 0.34, bg: '#fdfbf7', size: 0.62 }), 4.5, 3.4, -1.8);

    // ---- beat 3: level up
    const star = mk(label(S.L('★ Niveau 2', '★ Level 2'), { w: 1.5, h: 0.5, bg: '#ff4d4d', fg: '#ffffff', font: 'Kalam', size: 0.66, bold: true }), 3.5, 3.7, -4.8, 0);

    // ---- beat 4: podium, one hidden name, manual grading
    const p2 = person({ top: 0x4a90d9 }), p3 = person({ style: 'hijab', top: 0x9b6bd6 });
    p2.position.set(2.9, 0.7, 2.6);
    p3.position.set(5.5, 0.45, 2.6);
    [p2, p3].forEach((p) => { p.userData.baseY = p.position.y; p.visible = false; S.add(p); people.push(p); });
    const names = [
      mk(label('Yasmine', { w: 1.2, h: 0.32, bg: '#fff9c4', size: 0.66 }), 4.2, 0.6, 3.22, 0),
      mk(label('▒▒▒▒▒▒', { w: 1.2, h: 0.32, bg: '#e2e2e2', fg: '#9aa3ad', size: 0.66 }), 2.9, 0.4, 3.22, 0),
      mk(label('Youssef', { w: 1.2, h: 0.32, bg: '#fff9c4', size: 0.66 }), 5.5, 0.25, 3.22, 0),
    ];
    const hidden = mk(label(S.L('profil non public', 'non-public profile'), { w: 1.7, h: 0.34, bg: '#fdfbf7', size: 0.6 }), 2.6, 3.0, 2.6, 0);
    const manual = mk(label(S.L('✎ Note du professeur : 90 %', '✎ Teacher’s grade: 90%'), { w: 2.7, h: 0.4, bg: '#d9ecff', size: 0.58 }), 7.4, 2.6, 2.4, -0.2);

    S.loop((t) => {
      for (const p of people) p.tick(t);
      bot.tick(t);
      fill.scale.y = Math.max(0.001, gst.v * 3.0);
      fill.position.y = 0.25 + (gst.v * 3.0) / 2;
      for (let i = 0; i < NORB; i++) {
        const u = gst.xp * 1.6 - i / NORB * 0.6;
        if (u <= 0 || u >= 1) { orbs.set(i, 0, -5, 0); continue; }
        const e = ease.io(u);
        orbs.set(i, 6.1 + (4.4 - 6.1) * e + Math.sin(i * 2.1) * 0.15, 1.4 + Math.sin(u * Math.PI) * 1.2 + Math.cos(i) * 0.1, -2.0 + 0.2 * e, 0, 0, 0, 1 - u * 0.4);
      }
    });

    return [
      {
        cam: look(1.6, 3.2, -6.6, 9.0, 3.6),
        shot: 'challenges',
        screen: board,
        run() {
          K.pose = 'point';
          S.pop(card, 0.5);
          S.pop(crit, 1.3);
        },
      },
      {
        cam: look(6.2, 2.0, -2.0, 7.2, 3.0),
        run() {
          S.hide(crit);
          K.pose = 'idle';
          Y.pose = 'point';
          S.pop(work, 0.2);
          S.fly(work, [6.1, 1.4, -1.7], 0.9, { delay: 0.7, arc: 0.6 });
          S.hide(work, 1.6, 0.2);
          S.to(bot, { work: 1 }, 0.3, { delay: 1.5 });
          S.to(gst, { v: 0.82 }, 2.2, { delay: 1.8, ease: ease.out });
          S.to(bot, { work: 0 }, 0.3, { delay: 4.0 });
          S.pop(score, 4.0);
          S.to(gst, { xp: 1 }, 2.0, { delay: 4.3, ease: ease.lin });
          S.pop(xpTag, 5.6);
          S.call(5.6, () => { Y.pose = 'cheer'; });
        },
      },
      {
        cam: look(5.0, 2.4, -1.8, 6.4, 3.0),
        run() {
          S.hide(xpTag);
          Y.pose = 'idle';
          Y.position.y = 0;
          tokens.forEach((m, i) => S.pop(m, 0.3 + i * 0.5, i === 2 ? 1.25 : 0.9));
          S.pop(best, 2.0);
        },
      },
      {
        cam: look(4.6, 2.2, -4.8, 8.2, 3.6),
        run() {
          tokens.forEach((m) => S.hide(m));
          S.hide(best);
          S.hide(score);
          stepLabels.forEach((l, i) => S.pop(l, 0.2 + i * 0.2));
          Y.pose = 'walk';
          S.call(0, () => { Y.rotation.y = 0; });
          S.fly(Y, [2.2, 0.5, -4.8], 1.3, { delay: 0.9, arc: 1.0 });
          S.fly(Y, [3.5, 1.0, -4.8], 0.8, { delay: 2.4, arc: 0.9 });
          S.call(3.2, () => { Y.userData.baseY = 1.0; Y.pose = 'cheer'; });
          S.pop(star, 3.3);
        },
      },
      {
        cam: look(5.0, 2.6, 2.6, 7.6, 3.4),
        shot: 'leaderboard',
        screen: board,
        run() {
          S.hide(star);
          stepLabels.forEach((l) => S.hide(l));
          S.call(0, () => {
            board.setShot('leaderboard');
            Y.pose = 'cheer';
            Y.rotation.y = 0;
            Y.position.set(4.2, 1.0, 2.6);
            Y.userData.baseY = 1.0;
            p2.visible = p3.visible = true;
            p3.pose = 'cheer';
            K.position.set(7.6, 0, 1.6);
            K.rotation.y = -0.9;
            K.pose = 'write';
          });
          names.forEach((m, i) => S.pop(m, 0.4 + i * 0.25));
          S.pop(hidden, 1.4);
          S.pop(manual, 2.2);
        },
      },
    ];
  },
};
