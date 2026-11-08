import { pct } from '../core/text.js';

const TAU = Math.PI * 2;
// One unit is about this many pixels on the card, which sets how many points
// a circle needs and where it becomes too small to draw.
const PX = 120;

// Integral gaskets, named by the curvatures of the outer circle and the first
// three circles inside it.
const INTEGRAL = [
  [-1, 2, 2, 3],
  [-2, 3, 6, 7],
  [-3, 5, 8, 8],
  [-6, 11, 14, 15],
  [-4, 8, 9, 9],
];

// Smallest radius drawn, in units of the outer radius.
const cutoffFor = (detail) => Math.max(0.0065, 0.045 * 0.8 ** (detail - 1));
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Points for a circle that reaches radius r at its largest.
const pointsFor = (r) => Math.max(10, Math.min(96, Math.ceil(Math.PI * Math.sqrt((r * PX) / 0.22))));

// The image of the circle (cx, cy, r) under z -> (αz + β) / (γz + δ), with each
// coefficient given as [re, im]. A Möbius map sends circles to circles, and the
// image's centre and radius follow exactly from the four coefficients.
function mapCircle([a, b, c, d], cx, cy, r) {
  // u = γ·centre + δ
  const ux = c[0] * cx - c[1] * cy + d[0];
  const uy = c[0] * cy + c[1] * cx + d[1];
  // v = α·centre + β
  const vx = a[0] * cx - a[1] * cy + b[0];
  const vy = a[0] * cy + a[1] * cx + b[1];
  const g2 = c[0] * c[0] + c[1] * c[1];
  const den = ux * ux + uy * uy - g2 * r * r;
  // centre = (v·conj(u) − α·conj(γ)·r²) / den
  const nx = vx * ux + vy * uy - (a[0] * c[0] + a[1] * c[1]) * r * r;
  const ny = vy * ux - vx * uy - (a[1] * c[0] - a[0] * c[1]) * r * r;
  const detx = a[0] * d[0] - a[1] * d[1] - (b[0] * c[0] - b[1] * c[1]);
  const dety = a[0] * d[1] + a[1] * d[0] - (b[0] * c[1] + b[1] * c[0]);
  return [nx / den, ny / den, (r * Math.hypot(detx, dety)) / Math.abs(den)];
}

const ring = (cx, cy, r, n, g) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * TAU;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return { g, r: false, open: true, p };
};

// The four starting circles: the outer unit circle and three mutually tangent
// circles inside it, each as [curvature, x, y].
function startCircles(k1, k2, spin) {
  const r1 = 1 / k1;
  const r2 = 1 / k2;
  const d1 = 1 - r1;
  const d2 = 1 - r2;
  // The second circle sits where it touches the outer circle and the first.
  const cos = (d1 * d1 + d2 * d2 - (r1 + r2) ** 2) / (2 * d1 * d2 || 1);
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  const c1 = [k1, d1 * Math.cos(spin), d1 * Math.sin(spin)];
  const c2 = [k2, d2 * Math.cos(spin + ang), d2 * Math.sin(spin + ang)];
  const c0 = [-1, 0, 0];
  // Descartes' theorem for the curvature, and its complex form for the centre.
  const k3 = -1 + k1 + k2 + 2 * Math.sqrt(Math.max(0, -k1 - k2 + k1 * k2));
  // The outer centre is 0, so only the pair k1 k2 z1 z2 is left under the root.
  const zx = k1 * k2 * (c1[1] * c2[1] - c1[2] * c2[2]);
  const zy = k1 * k2 * (c1[1] * c2[2] + c1[2] * c2[1]);
  // sqrt of (zx, zy)
  const m = Math.hypot(zx, zy);
  const sx = Math.sqrt((m + zx) / 2);
  const sy = Math.sign(zy) * Math.sqrt(Math.max(0, (m - zx) / 2)) || 0;
  const bx = k1 * c1[1] + k2 * c2[1];
  const by = k1 * c1[2] + k2 * c2[2];
  let best;
  for (const s of [1, -1]) {
    const x = (bx + 2 * s * sx) / k3;
    const y = (by + 2 * s * sy) / k3;
    const r3 = 1 / k3;
    const err =
      Math.abs(Math.hypot(x, y) - (1 - r3)) +
      Math.abs(Math.hypot(x - c1[1], y - c1[2]) - (r1 + r3)) +
      Math.abs(Math.hypot(x - c2[1], y - c2[2]) - (r2 + r3));
    if (!best || err < best.err) best = { err, c: [k3, x, y] };
  }
  return [c0, c1, c2, best.c];
}

// Fills every curved-triangle gap with the circle tangent to its three sides,
// keeping the circles that `keep` accepts. Every gap is filled down to the
// size cutoff: stopping after a few generations leaves open gaps that the
// flow would swell into holes.
// The new circle in the gap of a, b, c, opposite d, is the reflection of d:
// k = 2(ka + kb + kc) − kd, and the same for k·z.
function fillGasket(start, keep) {
  const circles = start.map((c) => [...c, 0]);
  const stack = [];
  const [A, B, C, D] = start;
  stack.push([A, B, C, D, 1], [A, B, D, C, 1], [A, C, D, B, 1], [B, C, D, A, 1]);
  while (stack.length) {
    const [a, b, c, d, gen] = stack.pop();
    const k = 2 * (a[0] + b[0] + c[0]) - d[0];
    if (k <= 0) continue;
    const x = (2 * (a[0] * a[1] + b[0] * b[1] + c[0] * c[1]) - d[0] * d[1]) / k;
    const y = (2 * (a[0] * a[2] + b[0] * b[2] + c[0] * c[2]) - d[0] * d[2]) / k;
    const e = [k, x, y];
    if (!keep(x, y, 1 / k)) continue;
    circles.push([k, x, y, gen]);
    stack.push([a, b, e, c, gen + 1], [a, c, e, b, gen + 1], [b, c, e, a, gen + 1]);
  }
  return circles;
}

const gasketCache = new Map();

function drawGasket(out, R, detail, time, seed) {
  const pick = R();
  const integral = pick < 0.5;
  const which = INTEGRAL[Math.floor(R() * INTEGRAL.length)];
  const u1 = R();
  const u2 = R();
  const spin = R() * TAU;
  const pull = 0.22 + R() * 0.16;
  const pullAngle = R() * TAU;
  const turns = R() < 0.5 ? 1 : -1;

  let k1, k2;
  if (integral) {
    k1 = which[1] / -which[0];
    k2 = which[2] / -which[0];
  } else {
    // Two radii that fit side by side inside the outer circle.
    const r1 = 0.28 + u1 * 0.44;
    const r2 = 0.12 + u2 * (Math.min(r1, 1 - r1) - 0.12);
    k1 = 1 / r1;
    k2 = 1 / r2;
  }
  const cut = cutoffFor(detail);
  // The flow is an elliptic Möbius map that keeps the unit disc: conjugate a
  // rotation by φ(z) = (z − a)/(1 − āz), which moves a to the centre. It turns
  // the disc about a, with its mirror point 1/ā outside the disc held too.
  const ax = pull * Math.cos(pullAngle);
  const ay = pull * Math.sin(pullAngle);
  const a2 = pull * pull;

  const key = `${seed}|${detail}`;
  let base = gasketCache.get(key);
  if (!base) {
    const start = startCircles(k1, k2, spin);
    // The largest a circle gets over the loop: in φ coordinates it turns about
    // the centre, and comes out largest when it passes nearest to −a.
    const largest = (x, y, r) => {
      const [wx, wy, rho] = mapCircle([[1, 0], [-ax, -ay], [-ax, ay], [1, 0]], x, y, r);
      const w = Math.hypot(wx, wy);
      return (rho * (1 - a2)) / ((1 - pull * w) ** 2 - a2 * rho * rho);
    };
    // Keep every circle that is big enough at some moment of the loop, so the
    // set of circles stays the same all the way round.
    const circles = fillGasket(start, (x, y, r) => largest(x, y, r) >= cut);
    base = circles.map(([k, x, y, gen]) => {
      const r = Math.abs(1 / k);
      const big = k < 0 ? 1 : largest(x, y, r);
      return { k, x, y, r, gen, n: pointsFor(big) };
    });
    if (gasketCache.size > 40) gasketCache.clear();
    gasketCache.set(key, base);
  }

  const th = turns * time;
  const ex = Math.cos(th);
  const ey = Math.sin(th);
  // M = φ⁻¹ ∘ rotate(θ) ∘ φ, multiplied out as 2 × 2 complex matrices.
  // φ = [[1, −a], [−ā, 1]], rotate = [[e^iθ, 0], [0, 1]], φ⁻¹ = [[1, a], [ā, 1]].
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const e = [ex, ey];
  const a = [ax, ay];
  const ab = [ax, -ay];
  const na = [-ax, -ay];
  const nab = [-ax, ay];
  // rotate ∘ φ = [[e, −e a], [−ā, 1]]
  const r11 = e;
  const r12 = mul(e, na);
  const r21 = nab;
  const r22 = [1, 0];
  const M = [
    add(r11, mul(a, r21)),
    add(r12, mul(a, r22)),
    add(mul(ab, r11), r21),
    add(mul(ab, r12), r22),
  ];

  // The counts describe the still drawing, so they are the same at every time.
  let deepest = 0;
  let shown = 0;
  for (const c of base) {
    if (c.r >= cut) {
      shown++;
      deepest = Math.max(deepest, c.gen);
    }
  }
  for (const c of base) {
    if (c.k < 0) {
      out.push(ring(0, 0, 1, c.n, 0));
      continue;
    }
    const [x, y, r] = mapCircle(M, c.x, c.y, c.r);
    // Circles below the cutoff shrink away to nothing instead of vanishing.
    const s = smooth(cut * 0.45, cut, r);
    out.push(ring(x, y, r * s, c.n, Math.min(9, c.gen + 1)));
  }
  const curv = integral ? which : null;
  return {
    curv,
    k1,
    k2,
    k3: base[3]?.k,
    shown,
    deepest,
    pull,
    swell: ((1 + pull) / (1 - pull)) ** 2,
  };
}

export default {
  id: 'apollonian',
  kind: 'line',
  loopSeconds: 32,

  name: () => 'Apollonian gasket',

  describe(f) {
    const start = f.curv
      ? `An integral gasket with curvatures (${f.curv.join(', ').replace(/-/g, '−')})`
      : `A gasket with inner curvatures ${f.k1.toFixed(2)}, ${f.k2.toFixed(2)} and ${f.k3.toFixed(2)}`;
    return `${start} shows ${f.shown} circles over ${f.deepest} generations. A Möbius rotation about a point ${pct(f.pull)}% of the way out swells circles up to ${f.swell.toFixed(1)} times as they pass.`;
  },

  draw(out, R, detail, time = 0, seed = 0) {
    return drawGasket(out, R, detail, time, seed);
  },
};
