// Tiny tween engine. Every tween is "time-boxed" so a whole beat can be
// fast-forwarded with flush() when the presenter steps backward or deep-links.

export const ease = {
  lin: (t) => t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  /** Low-level: update(k) is called with eased progress 0..1. */
  add({ dur = 1, delay = 0, ease: e = ease.io, update, done }) {
    const tw = { dur: Math.max(dur, 1e-4), delay, e, update, done, t: 0, started: false };
    this.list.push(tw);
    return tw;
  }

  /** Tween numeric properties of `target` to the given values. */
  to(target, props, dur = 1, opts = {}) {
    let from = null;
    return this.add({
      dur,
      delay: opts.delay || 0,
      ease: opts.ease || ease.io,
      done: opts.done,
      update: (k) => {
        if (!from) {
          from = {};
          for (const p in props) from[p] = target[p];
        }
        for (const p in props) target[p] = from[p] + (props[p] - from[p]) * k;
        if (opts.update) opts.update(k);
      },
    });
  }

  call(delay, fn) {
    return this.add({ dur: 1e-4, delay, update: () => {}, done: fn });
  }

  tick(dt) {
    const l = this.list;
    for (let i = 0; i < l.length; i++) {
      const tw = l[i];
      if (tw.dead) continue;
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
        tw.t = -tw.delay;
      } else tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.update(tw.e(k));
      if (k >= 1) {
        tw.dead = true;
        if (tw.done) tw.done();
      }
    }
    this.list = this.list.filter((t) => !t.dead);
  }

  /** Finish everything now, in start-time order (tweens may spawn tweens). */
  flush() {
    let guard = 0;
    while (this.list.length && guard++ < 200) {
      const batch = this.list.slice().sort((a, b) => a.delay - b.delay);
      this.list = [];
      for (const tw of batch) {
        if (tw.dead) continue;
        tw.update(tw.e(1));
        tw.dead = true;
        if (tw.done) tw.done();
      }
    }
  }

  clear() {
    this.list = [];
  }
}
