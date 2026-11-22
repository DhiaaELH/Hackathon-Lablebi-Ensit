// Places shared by several scenes. Scenes that use the same place are built
// at the same origin with the same builder, so the cut between them is invisible.
import * as THREE from 'three';
import { B, C, F, G, part, person, yasmine, karim, screen, label, ground, city, glow, instanced, reseed } from './kit.js';

// ---------------------------------------------------------------- classroom
// Room: x -8..8, z -6..6, open on the right (+x) and front (+z). Students face -z.
// Back wall (z = -6): chalkboard on the left (it can swing open), smartboard on the right.
export const DESKS = [];
for (const z of [-0.8, 1.4, 3.6]) for (const x of [-4.5, -1.5, 1.5, 4.5]) DESKS.push([x, z]);
export const YAS_DESK = 1; // Yasmine: front row, second desk from the left
export const SMART = [2.4, 2.5, -5.86]; // smartboard screen centre
export const CHALK = [-4.6, 2.3, -5.9]; // chalkboard centre

/**
 * opts: shot (smartboard screenshot), chalk (text on the chalkboard), empty (desk indexes without student),
 *       laptops (true: glowing laptop on every desk), teacher (false to leave Mr. Karim out), city (false to skip)
 * Returns refs: { students[], yas, karim, smart, chalk (pivot group, rotate .y to open), chalkText, people[] }
 */
export function classroom(S, o = {}) {
  reseed(11);
  const R = { students: [], people: [] };
  S.add(ground(C.sand));
  if (o.city !== false) S.add(city(22, 60, 54));

  S.add(part((b) => {
    b.box(16, 0.3, 12, C.floor, 0, -0.15, 0);
    for (let i = -7; i <= 7; i += 2) b.box(0.04, 0.01, 12, 0xcaa77f, i, 0.005, 0);
    b.box(16.3, 5, 0.3, C.wall, -0.15, 2.5, -6.15);
    b.box(16.3, 0.25, 0.34, 0xe2d3b8, -0.15, 0.125, -6.13);
    // left wall with three windows
    b.box(0.3, 1.2, 12, C.wall, -8.15, 0.6, 0).box(0.3, 1.4, 12, C.wall, -8.15, 4.3, 0);
    for (const [z, w] of [[-5.35, 1.3], [-1.75, 1.1], [1.75, 1.1], [5.35, 1.3]]) b.box(0.3, 2.4, w, C.wall, -8.15, 2.4, z);
    for (const z of [-3.5, 0, 3.5]) b.box(0.12, 2.4, 0.08, C.white, -8.1, 2.4, z).box(0.12, 0.08, 2.4, C.white, -8.1, 2.4, z).box(0.5, 0.08, 2.6, C.white, -7.95, 1.22, z);
    // dark doorway hidden behind the chalkboard + smartboard frame + clock
    b.box(3.1, 1.75, 0.06, 0x16181d, CHALK[0], CHALK[1], -5.985);
    b.box(4.8, 3.0, 0.12, C.dark, SMART[0], SMART[1], -5.93).box(1.2, 0.08, 0.2, C.dark, SMART[0], 0.95, -5.9);
    b.use(F.clock, -0.4, 4.1, -5.95);
    b.box(0.03, 0.26, 0.02, C.ink, -0.4, 4.2, -5.9).box(0.2, 0.03, 0.02, C.ink, -0.32, 4.1, -5.9);
    // teacher's desk, plants, bookshelf
    b.use(F.desk, 6.2, 0, -3.6, -0.5, 1.15).use((x) => F.book(x, C.tunisBlue), 6.2, 0.9, -3.6, 0.4);
    b.use(F.plant, -7.3, 0, -5.3, 0, 1.4).use(F.plant, 7.2, 0, -5.3, 1, 1.2);
    b.box(1.6, 2.2, 0.4, C.woodDark, -7.5, 1.1, 5.2, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) b.box(0.3, 0.5, 0.28, [C.red, C.blue, C.yellow, C.green][i], -7.45, 0.55 + (i % 2) * 0.75, 4.7 + i * 0.3);
    // desks, chairs, laptops
    DESKS.forEach(([x, z]) => {
      b.use(F.desk, x, 0, z).use(F.chair, x, 0, z + 0.66);
      if (o.laptops !== false) b.use(F.laptopBase, x - 0.2, 0.795, z - 0.05);
    });
  }));
  // window glass + laptop screens (unlit, so they glow)
  S.add(instanced(G.plane(2.4, 2.4), [-3.5, 0, 3.5].map((z) => ({ p: [-8.16, 2.4, z], r: [0, Math.PI / 2, 0], c: 0xe6f6ff })), { basic: true, fade: true, opacity: 0.45, side: true }));
  if (o.laptops !== false) S.add(instanced(G.plane(0.46, 0.3), DESKS.map(([x, z]) => ({ p: [x - 0.2, 0.99, z - 0.2], r: [-0.2, 0, 0], c: 0xcfe8ff })), { basic: true }));

  // chalkboard on a hinge (pivot = its left edge)
  const pivot = new THREE.Group();
  pivot.position.set(CHALK[0] - 1.7, CHALK[1], CHALK[2]);
  pivot.add(part((b) => b.box(3.4, 1.9, 0.1, C.board, 1.7, 0, 0).box(3.6, 0.1, 0.14, C.wood, 1.7, 0.98, 0).box(3.6, 0.1, 0.2, C.wood, 1.7, -0.98, 0.03)
    .box(0.1, 2.06, 0.14, C.wood, -0.05, 0, 0).box(0.1, 2.06, 0.14, C.wood, 3.45, 0, 0).box(0.2, 0.05, 0.06, C.white, 2.6, -0.92, 0.1)));
  R.chalkText = label(o.chalk ?? '', { w: 3.2, h: 1.6, bg: null, fg: '#fdfbf7', font: 'Kalam', size: 0.42, bold: true });
  R.chalkText.position.set(1.7, 0, 0.06);
  pivot.add(R.chalkText);
  S.add(pivot);
  R.chalk = pivot;

  R.smart = screen(4.5, 2.7, o.shot || null);
  R.smart.position.set(...SMART);
  S.add(R.smart);

  const empty = new Set(o.empty || [7]);
  DESKS.forEach(([x, z], i) => {
    if (empty.has(i)) return;
    const p = i === YAS_DESK ? yasmine({ seated: true }) : person({ seated: true, pack: undefined });
    p.position.set(x, 0, z + 0.7);
    p.rotation.y = Math.PI;
    S.add(p);
    R.people.push(p);
    if (i === YAS_DESK) R.yas = p; else R.students.push(p);
  });
  if (o.teacher !== false) {
    R.karim = karim();
    R.karim.position.set(5.3, 0, -4.6);
    R.karim.rotation.y = -0.25;
    S.add(R.karim);
    R.people.push(R.karim);
  }
  S.loop((t) => { for (const p of R.people) p.tick(t); });
  S.refs.room = R;
  return R;
}

// ---------------------------------------------------------------- dorm room
// Small bedroom: x -3..3, z -2.5..2.5. Yasmine sits in profile at a desk, facing -x.
// The laptop screen faces +x (towards her), so a camera at (+x, +z) can read it.
export const DORM_CAM = [4.2, 2.7, 5.2, -0.2, 1.15, -0.2];

/**
 * opts: tidy (no paper towers: calm night), shot (laptop screenshot), headphones
 * Returns refs: { yas, lampGlow, laptop (screen mesh), clockHand, towers:{mesh, sheets[{x,y,z,ry,tower}]}, moon }
 */
export function dorm(S, o = {}) {
  reseed(5);
  const R = {};
  S.add(ground(0x30364a, 40));
  S.add(part((b) => {
    b.box(6.2, 0.3, 5.2, 0xb99873, 0, -0.15, 0);
    b.box(6.2, 4, 0.25, 0xd9cdbb, 0, 2, -2.6).box(0.25, 4, 5.2, 0xcfc3b1, -3.1, 2, 0);
    b.box(3, 0.02, 2, C.red, 0.3, 0.012, 0.6).box(2.6, 0.022, 1.6, 0xe9d8a6, 0.3, 0.013, 0.6); // rug
    // window frame on the back wall
    b.box(1.7, 1.7, 0.1, C.white, -1.5, 2.3, -2.5).box(1.9, 0.1, 0.3, C.white, -1.5, 1.42, -2.42);
    // bed along the right
    b.box(1.5, 0.45, 2.6, C.woodDark, 2.1, 0.225, -1.1).box(1.4, 0.2, 2.5, C.paper, 2.1, 0.55, -1.1).box(1.42, 0.22, 1.5, C.tunisBlue, 2.1, 0.57, -0.55)
      .box(0.9, 0.16, 0.5, C.white, 2.1, 0.72, -2.0).box(1.5, 1.0, 0.12, C.woodDark, 2.1, 0.7, -2.42);
    // desk (long side along z), chair, lamp, mug
    b.use(F.desk, -1.1, 0, 0, Math.PI / 2, 1.1).use(F.chair, -0.3, 0, 0, Math.PI / 2);
    b.use(F.lamp, -1.3, 0.88, -0.6).use(F.mug, -1.0, 0.88, 0.6);
    b.use(F.laptopBase, -1.25, 0.875, 0, Math.PI / 2);
    // shelf on the back wall + clock
    b.box(1.6, 0.06, 0.3, C.woodDark, 0.6, 2.2, -2.35);
    b.use(F.clock, 0.6, 3.1, -2.45);
    if (o.tidy) {
      for (let i = 0; i < 6; i++) b.box(0.12, 0.42, 0.26, [C.red, C.blue, C.yellow, C.green, C.purple, C.teal][i], 0.05 + i * 0.16, 2.44, -2.35);
      b.use(F.plant, 1.2, 2.23, -2.35, 0, 0.5);
      b.box(0.5, 0.6, 0.3, C.yellow, -0.4, 0.3, 1.3).box(0.4, 0.3, 0.1, 0xe9b949, -0.4, 0.28, 1.47); // backpack
    } else {
      b.use(F.mug, -1.2, 0.88, 0.85).use(F.mug, -0.9, 0.88, -0.35);
    }
  }));
  // night window + moon
  const night = glow(G.plane(1.5, 1.5), 0x1b2a57);
  night.position.set(-1.5, 2.3, -2.44);
  S.add(night);
  R.moon = glow(G.sph(0.22), 0xfff6d6);
  R.moon.position.set(-1.15, 2.65, -2.42);
  R.moon.scale.z = 0.2;
  S.add(R.moon);
  // warm lamp cone
  R.lampGlow = glow(G.cone(0.9, 1.1, 12), 0xffd98a, 0.22);
  R.lampGlow.position.set(-1.3, 0.95, -0.6);
  S.add(R.lampGlow);
  // clock hands: 02:00
  S.add(part((b) => b.box(0.03, 0.3, 0.02, C.ink, 0.6, 3.25, -2.4).box(0.03, 0.2, 0.02, C.ink, 0.6 + 0.087, 3.15, -2.4, 0, 0, -Math.PI / 3)));
  R.clockHand = part((b) => b.box(0.012, 0.32, 0.02, C.red, 0, 0.14, 0));
  R.clockHand.position.set(0.6, 3.1, -2.38);
  S.add(R.clockHand);
  S.loop((t) => { R.clockHand.rotation.z = -Math.floor(t) * (Math.PI / 30); });

  R.laptop = screen(0.5, 0.33, o.shot || null, { color: 0xcfe8ff });
  R.laptop.position.set(-1.43, 1.085, 0);
  R.laptop.rotation.set(0, Math.PI / 2, 0);
  R.laptop.rotateX(-0.2);
  S.add(R.laptop);

  R.yas = yasmine({ seated: true, headphones: !!o.headphones, pack: undefined });
  R.yas.position.set(-0.3, 0, 0);
  R.yas.rotation.y = -Math.PI / 2;
  R.yas.pose = 'type';
  S.add(R.yas);
  S.loop((t) => R.yas.tick(t));

  if (!o.tidy) {
    // paper towers: one instanced mesh, every sheet can move on its own
    const sheets = [];
    const towers = [[-1.0, 0.875, 0.38, 26], [-1.3, 0.875, 0.75, 34], [-1.2, 0.875, -0.3, 18], [0.6, 0, 0.9, 44], [1.0, 0, 0.2, 30], [-0.2, 0, 1.5, 38], [0.2, 0, -1.2, 26], [-2.2, 0, 1.4, 34], [1.4, 0, 1.6, 22]];
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
    towers.forEach(([x, y, z, n], ti) => {
      for (let i = 0; i < n; i++) sheets.push({ x: x + (r() - 0.5) * 0.05, y: y + 0.012 + i * 0.024, z: z + (r() - 0.5) * 0.05, ry: (r() - 0.5) * 0.5, tower: ti, i, c: [0xfdfbf7, 0xfdfbf7, 0xfff9c4, 0xe8f1fb, 0xfdfbf7, 0xffe3e3][Math.floor(r() * 6)] });
    });
    const mesh = instanced(G.box(0.3, 0.022, 0.42), sheets.map((q) => ({ p: [q.x, q.y, q.z], r: [0, q.ry, 0], c: q.c })));
    S.add(mesh);
    R.towers = { mesh, sheets };
  }
  S.refs.dorm = R;
  return R;
}
