import { clipPolyline } from '../core/frame.js';
import { plural } from '../core/text.js';

const TAU = Math.PI * 2;
// Wraps a value into [-π, π).
const wrap = (v) => v - TAU * Math.floor((v + Math.PI) / TAU);

// Views of the torus: mostly the whole of it, sometimes the main island with
// its nearest chains, rarely the island of the period-2 orbit alone.
const VIEWS = [
  { cx: Math.PI, cy: 0, w: Math.PI, h: Math.PI, where: 'Over the whole torus' },
  { cx: Math.PI, cy: 0, w: 2.75, h: 2.32, where: 'Around the main island' },
  { cx: 0, cy: Math.PI, w: 1.75, h: 1.48, where: 'Around the island of the period-2 orbit' },
];
const pickView = (u) => VIEWS[u < 0.74 ? 0 : u < 0.93 ? 1 : 2];

// m steps of the map from (θ, p), with p left unwrapped, and the product of
// the step Jacobians in (θ, p): [a, b, c, d].
function iterate(K, t, p, m) {
  let a = 1;
  let b = 0;
  let c = 0;
  let d = 1;
  for (let k = 0; k < m; k++) {
    const kc = K * Math.cos(t);
    // Each step has Jacobian [[1 + kc, 1], [kc, 1]].
    const na = (1 + kc) * a + c;
    const nb = (1 + kc) * b + d;
    const nc = kc * a + c;
    const nd = kc * b + d;
    a = na;
    b = nb;
    c = nc;
    d = nd;
    p += K * Math.sin(t);
    t += p;
  }
  return [t, p, a, b, c, d];
}

// Newton's method for an orbit of period m that turns n times in θ: after m
// steps it is back where it started, 2πn further along. Returns the point and
// the trace of its m-step Jacobian (below 2 in size when it is stable).
function periodic(K, t, p, n, m, rounds = 30) {
  for (let r = 0; r < rounds; r++) {
    const [tm, pm, a, b, c, d] = iterate(K, t, p, m);
    const gx = tm - t - TAU * n;
    const gy = pm - p;
    if (Math.abs(gx) + Math.abs(gy) < 1e-11) return { t, p, trace: a + d };
    const A = a - 1;
    const D = d - 1;
    const det = A * D - b * c;
    if (Math.abs(det) < 1e-12) return null;
    t -= (D * gx - b * gy) / det;
    p -= (A * gy - c * gx) / det;
    if (!Number.isFinite(t + p) || Math.abs(p) > 8) return null;
  }
  const [tm, pm, a, , , d] = iterate(K, t, p, m);
  return Math.abs(tm - t - TAU * n) + Math.abs(pm - p) < 1e-8 ? { t, p, trace: a + d } : null;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const cache = new Map();

// Scratch space shared by the orbit tests.
const MAX = 1200;
const XS = new Float64Array(MAX);
const YS = new Float64Array(MAX);
const ANG = new Float64Array(MAX);
const UX = new Float64Array(MAX);
const UY = new Float64Array(MAX);
const BIN = 32;
const LO = new Float64Array(BIN);
const HI = new Float64Array(BIN);

// Points along an orbit visit a smooth closed curve in no particular order.
// Sorted by angle around their centre they join into that curve only when the
// orbit is regular: then every pair of neighbours is close. Returns the curve
// resampled to `count` points (unwrapped near its centre), or null.
function islandLoop(th, pp, sn, cs, sq, cq, start, step, count) {
  const n = Math.floor((th.length - start + step - 1) / step);
  if (n < 24) return null;
  let sc = 0;
  let cc = 0;
  let sp = 0;
  let cp = 0;
  for (let i = start; i < th.length; i += step) {
    sc += sn[i];
    cc += cs[i];
    sp += sq[i];
    cp += cq[i];
  }
  const mt = Math.atan2(sc, cc);
  const mp = Math.atan2(sp, cp);
  let ax = 0;
  let ay = 0;
  for (let i = start, k = 0; i < th.length; i += step, k++) {
    const x = mt + wrap(th[i] - mt);
    const y = mp + wrap(pp[i] - mp);
    XS[k] = x;
    YS[k] = y;
    ax += x;
    ay += y;
  }
  ax /= n;
  ay /= n;
  // Islands are often long thin ovals. Measured in units of their own spread
  // (whitened by the covariance), a regular orbit lies on a near circle.
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let k = 0; k < n; k++) {
    const dx = XS[k] - ax;
    const dy = YS[k] - ay;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  sxx /= n;
  sxy /= n;
  syy /= n;
  if (sxx + syy > 4) return null;
  const l11 = Math.sqrt(sxx);
  const l21 = sxy / (l11 || 1);
  const l22 = Math.sqrt(Math.max(0, syy - l21 * l21));
  if (l11 < 1e-6 || l22 < 1e-6) return null;
  // A quick test before sorting: within each slice of angle, a curve has
  // nearly one radius, while a scatter has many.
  LO.fill(Infinity);
  HI.fill(-Infinity);
  for (let k = 0; k < n; k++) {
    const u = (XS[k] - ax) / l11;
    const v = (YS[k] - ay - l21 * u) / l22;
    UX[k] = u;
    UY[k] = v;
    const a = Math.atan2(v, u);
    const rr = Math.sqrt(u * u + v * v);
    ANG[k] = a;
    const b = Math.min(BIN - 1, Math.floor(((a + Math.PI) / TAU) * BIN));
    if (rr < LO[b]) LO[b] = rr;
    if (rr > HI[b]) HI[b] = rr;
  }
  // Whitened, the curve's radius is about √2.
  for (let b = 0; b < BIN; b++) if (HI[b] > LO[b] && HI[b] - LO[b] > 0.4) return null;
  const order = Array.from({ length: n }, (_, k) => k).sort((i, j) => ANG[i] - ANG[j]);
  let maxGap = 0;
  let maxReal = 0;
  let maxTurn = 0;
  const gaps = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const j = order[(k + 1) % n];
    const gu = UX[j] - UX[i];
    const gv = UY[j] - UY[i];
    const g = Math.sqrt(gu * gu + gv * gv);
    gaps[k] = g;
    if (g > maxGap) maxGap = g;
    const gx = XS[j] - XS[i];
    const gy = YS[j] - YS[i];
    maxReal = Math.max(maxReal, gx * gx + gy * gy);
    const turn = k + 1 < n ? ANG[j] - ANG[i] : ANG[j] + TAU - ANG[i];
    if (turn > maxTurn) maxTurn = turn;
  }
  // A thin chaotic layer can pass the other tests yet jitter in and out;
  // a smooth oval's radius only rises and falls a few times.
  let wobble = 0;
  let rlo = Infinity;
  let rhi = 0;
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const j = order[(k + 1) % n];
    const ri = Math.hypot(UX[i], UY[i]);
    wobble += Math.abs(Math.hypot(UX[j], UY[j]) - ri);
    rlo = Math.min(rlo, ri);
    rhi = Math.max(rhi, ri);
  }
  if (wobble > 6 * (rhi - rlo) + 0.3) return null;
  gaps.sort();
  const median = gaps[n >> 1];
  if (maxTurn > 0.75 || maxGap > 0.6 || maxReal > 0.45 * 0.45 || maxGap > 12 * median + 0.01) return null;
  const pts = order.map((i) => [XS[i], YS[i]]);
  pts.push(pts[0]);
  return { p: resample(pts, count), cx: ax, cy: ay };
}

// A curve that runs once around the torus in θ: sorted by θ it must be a smooth
// graph of p. Returns it over one turn, closed onto its own copy 2π along.
function rotationalLoop(th, pp, sq, cq, count) {
  const n = th.length;
  // Quick test: each slice of θ holds points of nearly one height.
  const bins = 48;
  const s = new Float64Array(bins);
  const c = new Float64Array(bins);
  const m = new Float64Array(bins);
  for (let i = 0; i < n; i++) {
    const b = Math.min(bins - 1, Math.floor((th[i] / TAU) * bins));
    s[b] += sq[i];
    c[b] += cq[i];
    m[b]++;
  }
  // The mean resultant of the heights in a slice is near 1 when they agree.
  for (let b = 0; b < bins; b++) if (!m[b] || Math.hypot(s[b], c[b]) < 0.97 * m[b]) return null;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => th[a] - th[b]);
  let maxDx = 0;
  let steep = 0;
  const pts = [];
  let y = pp[order[0]];
  for (let k = 0; k < n; k++) {
    const i = order[k];
    if (k) {
      const dy = wrap(pp[i] - pp[order[k - 1]]);
      const dx = th[i] - th[order[k - 1]];
      maxDx = Math.max(maxDx, dx);
      steep = Math.max(steep, Math.abs(dy) - 4 * dx);
      y += dy;
    }
    pts.push([th[i], y]);
  }
  const [x0, y0] = pts[0];
  const closeDy = wrap(y0 - pts[n - 1][1]);
  const closeDx = x0 + TAU - pts[n - 1][0];
  maxDx = Math.max(maxDx, closeDx);
  steep = Math.max(steep, Math.abs(closeDy) - 4 * closeDx);
  // The curve must also come back to its start height after one turn.
  const drift = Math.abs(pts[n - 1][1] + closeDy - y0);
  if (maxDx > 0.12 || steep > 0.025 || drift > 0.05) return null;
  pts.push([x0 + TAU, y0]);
  return { p: resample(pts, count) };
}

// Evenly spaced points along a polyline, by arc length.
function resample(pts, count) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const s = (k / (count - 1)) * total;
    while (j < pts.length - 1 && len[j] < s) j++;
    const t = len[j] > len[j - 1] ? (s - len[j - 1]) / (len[j] - len[j - 1]) : 0;
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}

// Traces one orbit on the torus into the shared buffers.
function trace(K, t, p, steps, buf) {
  const { th, pp, sn, cs, sq, cq } = buf;
  t -= TAU * Math.floor(t / TAU);
  p = wrap(p);
  for (let k = 0; k < steps; k++) {
    p += K * Math.sin(t);
    t += p;
    t -= TAU * Math.floor(t / TAU);
    p = wrap(p);
    th[k] = t;
    pp[k] = p;
    sn[k] = Math.sin(t);
    cs[k] = Math.cos(t);
    sq[k] = Math.sin(p);
    cq[k] = Math.cos(p);
  }
}
const view = (buf, steps) => {
  const o = {};
  for (const k of Object.keys(buf)) o[k] = buf[k].subarray(0, steps);
  return o;
};
const BUF = Object.fromEntries(['th', 'pp', 'sn', 'cs', 'sq', 'cq'].map((k) => [k, new Float64Array(MAX)]));

// The m islands of a regular orbit around an m-island chain, or null.
function chainParts(K, t, p, m, steps, count) {
  trace(K, t, p, steps, BUF);
  const b = view(BUF, steps);
  const parts = [];
  for (let s = 0; s < m; s++) {
    const loop = islandLoop(b.th, b.pp, b.sn, b.cs, b.sq, b.cq, s, m, count);
    if (!loop) return null;
    parts.push(loop);
  }
  return parts;
}
const stepsFor = (m, base) => Math.min(MAX, Math.max(base, 90 * m));

// The stable periodic orbits for this K range, found once per seed: the main
// island (period 1) and each chain p/q with q up to 8 in the upper half of the
// torus (the lower half is its mirror image). Each comes with how far its
// island reaches across, measured at both ends of the K range.
function findIslands(K0, a) {
  const found = [];
  const same = (o, m) => {
    for (const f of found) {
      if (f.m !== m) continue;
      let t = f.t;
      let p = f.p;
      for (let k = 0; k < m; k++) {
        if (Math.abs(wrap(t - o.t)) + Math.abs(wrap(p - o.p)) < 1e-5) return true;
        p += K0 * Math.sin(t);
        t += p;
      }
    }
    return false;
  };
  for (let m = 1; m <= 8; m++) {
    for (let n = m === 1 ? 0 : 1; n <= m / 2; n++) {
      if (m > 1 && gcd(n, m) !== 1) continue;
      // Guesses along the symmetry lines θ = 0 and θ = π, near the height
      // where the orbit turns n times in m steps.
      for (const t0 of [0, Math.PI]) {
        for (let g = -4; g <= 4; g++) {
          const o = periodic(K0, t0, (TAU * n) / m + g * 0.12, n, m);
          if (!o || Math.abs(o.trace) >= 1.98 || same(o, m)) continue;
          found.push({ ...o, n, m });
        }
      }
    }
  }
  // Half-width of each island along θ, by bisection on where nested orbits
  // stop being regular, taken as the smaller over the K range.
  const islands = [];
  for (const f of found) {
    let width = Infinity;
    for (const K of [K0 - a, K0 + a]) {
      const o = periodic(K, f.t, f.p, f.n, f.m);
      if (!o || Math.abs(o.trace) >= 2) {
        width = 0;
        break;
      }
      // Step outward and keep the farthest nested orbit that is still
      // regular; misses on the way are thin chaotic layers or smaller chains.
      const hi = f.m === 1 ? 3 : Math.min(2, 3.2 / f.m);
      let lo = 0;
      for (let i = 1; i <= 16; i++) {
        const d = (hi * i) / 16;
        if (chainParts(K, o.t + d, o.p, f.m, stepsFor(f.m, 360), 24)) lo = d;
      }
      width = Math.min(width, lo);
    }
    if (width > 0.02) islands.push({ ...f, width });
  }
  return islands;
}

export default {
  id: 'standardmap',
  kind: 'line',
  loopSeconds: 30,

  name: () => 'Chirikov standard map',

  describe({ K, a, periods, ovals, rotational, where }) {
    const list = periods.length > 1 ? `${periods.slice(0, -1).join(', ')} and ${periods[periods.length - 1]}` : periods[0];
    const rot = rotational ? `, with ${plural(rotational, 'unbroken circle')} weaving between them` : '';
    return `${where}, the kick strength K = ${K.toFixed(2)} swings by ${a.toFixed(2)}. The islands around stable orbits of period ${list} are drawn as ${ovals} nested ovals${rot}. Chaotic orbits are left blank.`;
  },

  draw(out, R, detail, time = 0, seed = 0) {
    const vw = pickView(R());
    const K0 = 0.7 + R() * 0.3;
    const a = 0.04 + R() * 0.05;
    const K = K0 + a * Math.sin(time);
    const { cx, cy, w, h } = vw;
    const key = `${seed}:${K0}:${a}`;
    let islands = cache.get(key);
    if (!islands) {
      islands = findIslands(K0, a);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
      cache.set(key, islands);
    }

    const base = 300 + detail * 30;
    const count = 90 + detail * 8;
    const x0 = cx - w;
    const x1 = cx + w;
    const y0 = cy - h;
    const y1 = cy + h;
    const inside = (a, b) => {
      // Clip to the view rectangle, in (θ, p).
      let t0 = 0;
      let t1 = 1;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      for (const [d, lo, hi, s] of [[dx, x0, x1, a[0]], [dy, y0, y1, a[1]]]) {
        if (Math.abs(d) < 1e-12) {
          if (s < lo || s > hi) return null;
          continue;
        }
        let ta = (lo - s) / d;
        let tb = (hi - s) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 >= t1) return null;
      }
      return [t0, t1];
    };
    // A loop on the torus is drawn at each whole-turn shift that reaches the view.
    const place = (p, g) => {
      let bx0 = Infinity;
      let bx1 = -Infinity;
      let by0 = Infinity;
      let by1 = -Infinity;
      for (const [x, y] of p) {
        bx0 = Math.min(bx0, x);
        bx1 = Math.max(bx1, x);
        by0 = Math.min(by0, y);
        by1 = Math.max(by1, y);
      }
      for (let i = -2; i <= 2; i++) {
        const ox = i * TAU;
        if (bx1 + ox < x0 || bx0 + ox > x1) continue;
        for (let j = -2; j <= 2; j++) {
          const oy = j * TAU;
          if (by1 + oy < y0 || by0 + oy > y1) continue;
          const moved = p.map(([x, y]) => [x + ox, y + oy]);
          for (const run of clipPolyline(moved, inside)) out.push({ g, r: false, open: true, p: run.map(([x, y]) => [x, -y]) });
        }
      }
    };
    // The map is unchanged by (θ, p) → (−θ, −p), so each curve in the upper
    // half has a mirror image in the lower half.
    const mirror = (p) => p.map(([x, y]) => [TAU - x, -y]);

    // Curves that would run too close to ones already drawn are left out, so
    // nested curves stay visibly apart.
    const G = 80;
    const cell = (2 * w) / G;
    const GY = Math.ceil((2 * h) / cell);
    const taken = new Uint8Array(G * GY);
    const cellsOf = (parts) => {
      const ids = [];
      for (const p of parts) {
        for (const [x, y] of p) {
          const i = Math.floor(((((x - x0) % TAU) + TAU) % TAU) / cell);
          const j = Math.floor(((((y - y0) % TAU) + TAU) % TAU) / cell);
          if (i < G && j < GY) ids.push(j * G + i);
        }
      }
      return ids;
    };
    const room = (parts) => {
      const ids = cellsOf(parts);
      let hit = 0;
      for (const id of ids) hit += taken[id];
      if (hit > 0.35 * ids.length) return false;
      for (const id of ids) taken[id] = 1;
      return true;
    };
    // Draws a set of curves and, unless it is its own mirror image, its mirror.
    const draw = (parts, g, self) => {
      const all = self ? parts : [...parts, ...parts.map(mirror)];
      if (!room(all)) return false;
      for (const p of all) place(p, g);
      return true;
    };

    const tiny = 0.1 * (w / Math.PI);
    const extent = (p) => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of p) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      return Math.hypot(x1 - x0, y1 - y0);
    };
    // How wide an oval is across its length: from its area, as for an ellipse.
    const breadth = (p) => {
      let area = 0;
      for (let i = 1; i < p.length; i++) area += p[i - 1][0] * p[i][1] - p[i][0] * p[i - 1][1];
      return (2 * Math.abs(area)) / (Math.PI * extent(p));
    };
    // Nested ovals around each stable orbit, followed to the current K.
    const periods = new Set();
    let ovals = 0;
    const rings = 3 + Math.floor(detail / 6);
    for (const isl of islands) {
      const o = periodic(K, isl.t, isl.p, isl.n, isl.m, 6);
      if (!o || Math.abs(o.trace) >= 2) continue;
      const self = isl.m === 1 || 2 * isl.n === isl.m;
      const many = isl.m === 1 ? rings + 4 : isl.m === 2 ? rings + 1 : rings;
      const steps = stepsFor(isl.m, base);
      const per = Math.max(24, Math.round(count / Math.sqrt(isl.m)));
      for (let r = 1; r <= many; r++) {
        // A ring that lands on a thin chaotic layer or a smaller chain inside
        // the island is nudged in or out a little.
        let parts = null;
        for (const nudge of [1, 0.95, 1.05]) {
          parts = chainParts(K, o.t + (isl.width * 0.95 * r * nudge) / many, o.p, isl.m, steps, per);
          if (parts) break;
        }
        // Ovals only a few pixels across would read as specks, not islands.
        if (!parts || extent(parts[0].p) < tiny || breadth(parts[0].p) < tiny * 0.45) continue;
        if (!draw(parts.map((q) => q.p), isl.m === 1 ? 0 : 1, self)) continue;
        ovals += self ? isl.m : 2 * isl.m;
        periods.add(isl.m);
      }
    }

    // Unbroken circles, started along θ = 0 across the upper half.
    let rotational = 0;
    const lanes = 6 + detail;
    for (let l = 0; l < lanes; l++) {
      const p = (Math.PI * (l + 0.5)) / lanes;
      trace(K, 0, p, base, BUF);
      const b = view(BUF, base);
      const rot = rotationalLoop(b.th, b.pp, b.sq, b.cq, count);
      if (rot && draw([rot.p], 2, false)) rotational += 2;
    }
    return { K: K0, a, periods: [...periods].sort((x, y) => x - y), ovals, rotational, where: vw.where };
  },
};
