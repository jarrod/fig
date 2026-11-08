const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const FIB = [3, 5, 8, 13, 21, 34, 55, 89, 144];
const deg = (a) => (a * 180) / Math.PI;

// Seed n of a Vogel head: radius √n, angle n·α.
const seedAt = (n, alpha, turn) => {
  const r = Math.sqrt(n);
  const a = n * alpha + turn;
  return [r * Math.cos(a), r * Math.sin(a)];
};
const gap = (n, f, alpha) => {
  const p = seedAt(n, alpha, 0);
  const q = seedAt(n + f, alpha, 0);
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
};

export default {
  id: 'phyllotaxis',
  kind: 'line',
  loopSeconds: 30,

  name: () => 'Vogel phyllotaxis',

  describe({ count, angle, families, core, mode }) {
    const arms = families.map((f) => `${f.f} arms`);
    const lines =
      mode === 'relay'
        ? `The spiral arms are traced in rings that hand over from ${arms.slice(0, -1).join(', ')} to ${arms.at(-1)} going outward`
        : families.length === 2
          ? `Two families of spiral arms cross, ${arms[0]} one way and ${arms[1]} the other`
          : `One family of ${arms[0]} is traced`;
    const middle = core > 4 ? `, with the inner ${core} seeds drawn as small rings` : '';
    return `${count} seeds placed ${angle.toFixed(2)} degrees apart, each farther out by the square root of its number. ${lines}${middle}.`;
  },

  draw(out, R, detail, time = 0) {
    const count = Math.round((260 + detail * 75) * (0.8 + R() * 0.45));
    const offset = (R() - 0.5) * 0.004;
    const pick = R();
    const mode = pick < 0.4 ? 'pair' : pick < 0.75 ? 'relay' : 'single';
    const shift = R() < 0.35 ? 1 : 0;
    const spin = R() < 0.5 ? 1 : -1;
    const rolls = R() < 0.6;
    const ringSize = 0.32 + R() * 0.2;
    const sides = 5 + Math.floor(R() * 4);
    const lower = R() < 0.5 ? 1 : 0;

    const alpha0 = GOLDEN + offset;
    // The angle sways around its starting value, and the head may turn once per loop.
    const fibAtRim = FIB.reduce((best, f) => (gap(count - f - 1, f, alpha0) < gap(count - best - 1, best, alpha0) ? f : best), FIB[0]);
    const sway = 1.6 / (fibAtRim * Math.sqrt(count));
    const alpha = alpha0 + sway * Math.sin(time);
    const turn = rolls ? spin * time : 0;

    // Which families to trace, and over which range of seeds each is clean (at
    // time 0, so the structure stays fixed as the angle sways).
    const rimIndex = FIB.indexOf(fibAtRim);
    const limit = 2.5;
    const span = (f, from = 1) => {
      let a = from;
      while (a + f < count && gap(a, f, alpha0) > limit) a++;
      return a;
    };
    let families;
    if (mode === 'relay') {
      // Each family is drawn where it is one of the two shortest steps.
      families = [];
      const usable = FIB.filter((f) => f <= fibAtRim && f >= 5);
      for (let i = 0; i < usable.length; i++) {
        const f = usable[i];
        let a = null;
        let b = count;
        for (let n = 1; n + f < count; n++) {
          const mine = gap(n, f, alpha0);
          const shorter = FIB.filter((g) => g !== f && gap(n, g, alpha0) < mine).length;
          if (shorter < 2) {
            if (a === null) a = n;
            b = n + f;
          }
        }
        if (a !== null && b - a > f * 3) families.push({ f, a, b });
      }
      if (families.length < 2) families = families.map((x) => ({ ...x, b: count }));
      if (!families.length) families.push({ f: fibAtRim, a: span(fibAtRim), b: count });
      families.at(-1).b = count;
    } else {
      const top = Math.max(1, rimIndex - shift);
      const chosen = mode === 'pair' ? [FIB[top - 1], FIB[top]] : [FIB[top - lower]];
      families = chosen.map((f) => ({ f, a: span(f), b: count }));
    }

    // Seeds inside the first traced arm are drawn as small rings.
    const start = Math.min(...families.map((x) => x.a));
    const core = start;
    for (let n = 1; n < core; n++) {
      const [x, y] = seedAt(n, alpha, turn);
      const r = ringSize * Math.min(1, 0.4 + n / 20);
      const p = [];
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2 + n;
        p.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
      }
      out.push({ g: 0, r: false, open: true, p });
    }

    families.forEach(({ f, a, b }, k) => {
      for (let s = a; s < a + f; s++) {
        const p = [];
        for (let n = s; n < b; n += f) p.push(seedAt(n, alpha, turn));
        if (p.length > 1) out.push({ g: 1 + k, r: false, open: true, p });
      }
    });

    return { count, angle: deg(alpha0), families, core: core > 1 ? core - 1 : 0, mode };
  },
};
