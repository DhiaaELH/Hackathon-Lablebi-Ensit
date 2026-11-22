// Scene 13 — finale: the school rooftop at golden hour over Tunis.
// Everyone throws paper airplanes; they settle into a real, scannable QR code.
import { C, F, G, part, label, glow, instanced, ground, city, person, yasmine, karim, robot, planeGeo, plane, reseed } from '../models/kit.js';
import { ease } from '../anim.js';
import qrcode from '../vendor/qrcode.js';

const URL = 'https://lablebi.nerio.dev';
const QR = { x: 7.6, y: 6.6, z: -3, size: 5.0, quiet: 4 };
const clamp = (v) => Math.max(0, Math.min(1, v));

function qrModules(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const dark = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) dark.push([c, r]);
  return { n, dark };
}

export default {
  place: 'roof',
  origin: [0, 18, -30],
  mood: { sky: 0xffb880, hemi: 1.35, sun: 2.3, sunColor: 0xffa666, hemiColor: 0xffe0c2, fog: [45, 150] },
  flight: 3.6,
  build(S) {
    reseed(31);
    // ---- the city far below, the school building, the roof
    const low = ground(0xe2c497, 80);
    low.position.y = -18.02;
    S.add(low);
    const town = city(18, 62, 60, 5);
    town.position.y = -18;
    S.add(town);
    S.add(part((b) => {
      b.box(22, 18, 11, C.white, 6, -9.25, -1).box(22.4, 0.5, 11.4, 0xe9e1d2, 6, -0.25, -1);
      b.box(22.4, 0.7, 0.3, C.white, 6, 0.35, -6.55).box(0.3, 0.7, 11.4, C.white, -5.05, 0.35, -1).box(0.3, 0.7, 11.4, C.white, 17.05, 0.35, -1);
      b.box(22.4, 0.08, 0.36, C.tunisBlue, 6, 0.74, -6.55).box(0.36, 0.08, 11.4, C.tunisBlue, -5.05, 0.74, -1).box(0.36, 0.08, 11.4, C.tunisBlue, 17.05, 0.74, -1);
      // stair house with a blue door, water tank, plants, a bench
      b.box(3, 2.6, 2.6, C.white, -2.6, 1.3, -4.6).box(0.9, 1.8, 0.08, C.tunisBlue, -2.6, 0.9, -3.27).sph(1.2, C.white, -2.6, 2.6, -4.6, 1, 0.6, 1);
      b.cyl(0.8, 0.8, 1.3, 0xd0d6dd, 15, 1.4, -5, 0, 0, 0, 10).box(0.1, 0.8, 0.1, C.dark, 14.5, 0.4, -5).box(0.1, 0.8, 0.1, C.dark, 15.5, 0.4, -5);
      b.use(F.plant, 1.2, 0, -5.4, 0, 1.4).use(F.plant, 12.6, 0, -5.4, 1, 1.2).use(F.plant, 16, 0, 2.8, 2, 1.3);
      b.box(2, 0.1, 0.5, C.wood, 13.4, 0.5, 1.4, 0, -0.5).box(0.1, 0.5, 0.4, C.dark, 12.7, 0.25, 1.0).box(0.1, 0.5, 0.4, C.dark, 14.1, 0.25, 1.8);
      // washing line of little flags
      for (let i = 0; i < 9; i++) b.box(0.28, 0.3, 0.02, [C.red, C.postit, C.tunisBlue][i % 3], 0.2 + i * 0.55, 2.35 - Math.sin((i / 8) * Math.PI) * 0.25, -5.9);
    }));
    const sunDisc = glow(G.sph(7, 2), 0xfff1b8);
    sunDisc.material.fog = false;
    sunDisc.position.set(-14, -1, -95);
    S.add(sunDisc);

    // ---- the cast
    const cast = [];
    const put = (m, x, z, ry = 0) => { m.position.set(x, 0, z); m.rotation.y = ry; S.add(m); cast.push(m); return m; };
    const Y = put(yasmine(), 6.4, 0.6, -0.1);
    const K = put(karim(), 8.0, 0.2, -0.2);
    put(person({ pack: C.blue }), 4.9, 0.2, 0.15);
    put(person({ pack: C.green, style: 'hijab', skirt: false }), 9.6, 0.5, -0.3);
    put(person({ glasses: true }), 11.0, 0.0, -0.4);
    const bots = ['sam', 'clara', 'jordan', 'riley', 'quinn'].map((n, i) => {
      const r = robot(n);
      r.position.set([3.7, 5.6, 7.2, 8.8, 10.3][i], 0, -1.5 - (i % 2) * 0.4);
      r.rotation.y = 0.1 - i * 0.08;
      S.add(r);
      return r;
    });
    const novaS = plane(0xfff1a8, 0.9);
    novaS.material.emissive?.set(0x554400);
    S.add(novaS);
    S.loop((t) => {
      cast.forEach((p) => p.tick(t));
      bots.forEach((r) => r.tick(t));
      novaS.position.set(7.2 + Math.cos(t * 0.9) * 4.2, 2.9 + Math.sin(t * 1.7) * 0.4, -0.6 + Math.sin(t * 0.9) * 1.6);
      novaS.rotation.y = -t * 0.9;
    });

    // ---- the QR code: light panel + one square tile per dark module
    const { n, dark } = qrModules(URL);
    const cells = n + QR.quiet * 2;
    const cs = QR.size / cells;
    const N = dark.length;
    const target = dark.map(([c, r]) => [QR.x + (c + QR.quiet + 0.5 - cells / 2) * cs, QR.y - (r + QR.quiet + 0.5 - cells / 2) * cs]);
    const panel = glow(G.plane(QR.size, QR.size), 0xffffff, 0.999);
    panel.material.fog = false;
    panel.material.opacity = 0;
    panel.position.set(QR.x, QR.y, QR.z - 0.03);
    panel.visible = false;
    S.add(panel);
    const frame = part((b) => {
      const h = QR.size / 2 + 0.09;
      b.box(QR.size + 0.36, 0.18, 0.06, C.ink, 0, h, 0).box(QR.size + 0.36, 0.18, 0.06, C.ink, 0, -h, 0).box(0.18, QR.size + 0.36, 0.06, C.ink, -h, 0, 0).box(0.18, QR.size + 0.36, 0.06, C.ink, h, 0, 0);
    }, { basic: true });
    frame.position.set(QR.x, QR.y, QR.z - 0.03);
    frame.visible = false;
    S.add(frame);
    const tiles = instanced(G.plane(cs, cs), target.map(([x, y]) => ({ p: [x, y, QR.z], s: 0.0001, c: 0x111111 })), { basic: true });
    tiles.material.fog = false;
    S.add(tiles);
    const url = label('lablebi.nerio.dev', { w: 5.4, h: 0.9, bg: '#fff9c4', size: 0.62, bold: true, font: 'Kalam' });
    url.position.set(QR.x, QR.y - QR.size / 2 - 0.85, QR.z);
    url.visible = false;
    S.add(url);

    // ---- the swarm of paper airplanes (one per dark module)
    const throwers = [Y, K, ...cast.slice(2), ...bots];
    const start = target.map((_, k) => {
      const p = throwers[k % throwers.length].position;
      return [p.x + ((k * 37) % 11) * 0.05 - 0.25, 1.5 + ((k * 13) % 7) * 0.05, p.z + 0.3];
    });
    const swarm = instanced(planeGeo(), start.map((p) => ({ p, s: 0.0001, c: [0xfdfbf7, 0xfff9c4, 0xffe3e3, 0xe8f1fb][0] })), { side: true });
    swarm.material.color.set(0xfdfbf7);
    S.add(swarm);
    const st = { fly: 0, morph: 0 };
    S.loop((t) => {
      for (let k = 0; k < N; k++) {
        const f = clamp((st.fly - (k / N) * 0.45) / 0.55);
        const [sx, sy, sz] = start[k];
        const [tx, ty] = target[k];
        const e = ease.io(f);
        const swirl = Math.sin(f * Math.PI);
        const a = k * 2.4 + f * 6;
        const x = sx + (tx - sx) * e + Math.cos(a) * swirl * 1.6;
        const y = sy + (ty - sy) * e + swirl * (1.2 + (k % 5) * 0.25);
        const z = sz + (QR.z + 0.05 - sz) * e + Math.sin(a) * swirl * 1.6;
        const s = f <= 0 ? 0.0001 : (0.5 + 0.2 * swirl) * (1 - st.morph) + 0.0001;
        swarm.set(k, x, y, z, -0.9 * (1 - e) + Math.sin(t * 3 + k) * 0.08 * swirl, a * (1 - e), Math.sin(a) * 0.4 * swirl, s);
        tiles.set(k, tx, ty, QR.z, 0, 0, 0, Math.max(st.morph, 0.0001));
      }
    });

    return [
      { cam: [5.4, 4.6, 9.6, 6.2, 0.5, 0] },
      {
        cam: [6.4, 4.6, 13.2, 6.7, 4.9, -3],
        dur: 1.8,
        run() {
          throwers.forEach((p) => { if (p.pose !== undefined) p.pose = 'throw'; });
          S.call(1.2, () => { cast.forEach((p) => { p.pose = 'idle'; }); });
          S.to(st, { fly: 1 }, 4.2, { delay: 0.5, ease: ease.lin });
          S.call(4.3, () => { panel.visible = true; frame.visible = true; });
          S.to(panel.material, { opacity: 1 }, 0.7, { delay: 4.3 });
          S.to(st, { morph: 1 }, 0.8, { delay: 4.6 });
          S.pop(url, 5.2);
        },
      },
      {
        cam: [7.4, 3.2, 19.5, 7.4, 1.7, -1.5],
        dur: 1.6,
        run() {
          cast.forEach((p) => { p.userData.baseY = 0; p.pose = 'cheer'; });
          bots.forEach((r) => S.to(r, { work: 1 }, 0.4));
        },
      },
    ];
  },
};
