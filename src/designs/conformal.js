// A square grid, or a polar one, pushed through a complex function. Conformal
// maps keep right angles, so the grid lines bend into flowing curves that
// still cross square on. The grid lives in a plane of its own (ζ); each kind
// of map turns ζ into the drawing plane w, which is cropped to a fixed window.
//
// Where the map squeezes the grid, lines would pack into a grey smudge, so
// every line has a rank (how many times its index halves) and stops where
// its neighbours come closer than a few pixels for that rank: towards a
// critical point every other line ends, then every fourth, then all of them.
// The ends slide smoothly as the map flexes, because the cut is interpolated.

import { contourLines } from '../core/marching.js';

const TAU = Math.PI * 2;
// Pixels per unit is worked out for the card's drawable area (320 × 270 less
// the renderer's padding), so the density cut is in real pixels.
const DRAW_W = 264;
const DRAW_H = 214;
const ASPECT = DRAW_W / DRAW_H;
const MIN_PX = 4;
const RANK_CAP = 6;

const KINDS = ['joukowski', 'exp', 'rational', 'power', 'sine', 'mobius'];
const NAMES = {
  joukowski: () => 'Joukowski map',
  exp: () => 'Exponential map',
  rational: () => 'Rational map',
  power: ({ n }) => `Power map z${['', '', '²', '³', '⁴', '⁵'][n]}`,
  sine: () => 'Sine map',
  mobius: () => 'Möbius map',
};

// How many times a grid index halves before it is odd, up to the cap.
const rank = (j) => {
  j = Math.abs(j);
  if (j === 0) return RANK_CAP;
  let n = 0;
  while (!(j & 1) && n < RANK_CAP) {
    j >>= 1;
    n++;
  }
  return n;
};

const f2 = (v) => v.toFixed(2);
const cx = (x, y) => `${f2(x)} ${y < 0 ? '−' : '+'} ${f2(Math.abs(y))}i`;

// Traces every grid line of a spec through its map into faces.
// spec: { F(x, y) -> [u, v], keep(x, y) -> signed (≥ 0 keeps), win, lines }
// Each line is ζ(s) = base + dir·s for s = s0 + m·step, m = 0..n, crossing the
// other family at every step; perp is the spacing to its neighbours in ζ.
function trace(out, spec) {
  const { F, keep, win, lines } = spec;
  const minPx = spec.minPx ?? MIN_PX;
  const px = DRAW_H / (win.y1 - win.y0);
  const jump = (win.x1 - win.x0) * 0.35;
  let pieces = 0;
  let thinned = 0;
  for (const L of lines) {
    const { base, dir, s0, step, n, perp, g } = L;
    const boost = 2 ** L.rank;
    let run = null;
    let prev = null;
    let cutHere = false;
    const flush = () => {
      if (run && run.length > 1) {
        out.push({ g, r: false, open: true, p: run });
        pieces++;
      }
      run = null;
    };
    const visit = (w, score) => {
      if (prev && Math.hypot(w[0] - prev.w[0], w[1] - prev.w[1]) > jump) {
        flush();
        prev = null;
      }
      if (!prev) {
        if (score >= 0) run = [[w[0], -w[1]]];
      } else if (prev.score >= 0 && score >= 0) {
        run.push([w[0], -w[1]]);
      } else if (prev.score >= 0 || score >= 0) {
        const t = prev.score / (prev.score - score);
        const q = [prev.w[0] + (w[0] - prev.w[0]) * t, -(prev.w[1] + (w[1] - prev.w[1]) * t)];
        if (score < 0) {
          run.push(q);
          flush();
        } else run = [q, [w[0], -w[1]]];
      }
      prev = { w, score };
    };
    const at = (s) => [base[0] + dir[0] * s, base[1] + dir[1] * s];
    const rect = (w) => Math.min(w[0] - win.x0, win.x1 - w[0], w[1] - win.y0, win.y1 - w[1]) * px;
    // A crossing: its point, its spacing to the neighbours in pixels and the
    // log of how far that clears the line's density limit.
    const cross = (s) => {
      const [x, y] = at(s);
      const w = F(x, y);
      const e = 1e-6 * (1 + Math.abs(x) + Math.abs(y));
      const w2 = F(x + dir[0] * e, y + dir[1] * e);
      const d = Math.hypot(w2[0] - w[0], w2[1] - w[1]) / e;
      const len = d * step * px;
      const dens = L.keepAll ? 1e3 : Math.log2((d * perp * px * boost) / minPx) * 6;
      return { s, x, y, w, len, dens };
    };
    let A = cross(s0);
    visit(A.w, Math.min(A.dens, keep ? keep(A.x, A.y) : Infinity, rect(A.w)));
    for (let m = 1; m <= n; m++) {
      const B = cross(s0 + m * step);
      if (B.dens < 0 && A.dens >= 0) cutHere = true;
      const sB = Math.min(B.dens, keep ? keep(B.x, B.y) : Infinity, rect(B.w));
      const far = prev && prev.score < -40 && sB < -40;
      const S = far ? 1 : Math.max(1, Math.min(24, Math.ceil(Math.max(A.len, B.len) / 3)));
      for (let i = 1; i < S; i++) {
        const u = i / S;
        const [x, y] = at(A.s + step * u);
        const w = F(x, y);
        visit(w, Math.min(A.dens + (B.dens - A.dens) * u, keep ? keep(x, y) : Infinity, rect(w)));
      }
      visit(B.w, sB);
      A = B;
    }
    flush();
    if (cutHere) thinned++;
  }
  return { pieces, thinned };
}

// Douglas–Peucker: drops points within tol of the line through their
// neighbours, so traced contours stay small in the export.
function thin(line, tol) {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const a = line[i0];
    const b = line[i1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const p = line[i];
      const d = len ? Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([i0, at], [at, i1]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

// Grid lines of a square ζ-grid turned by angle rot and shifted by off,
// covering a disc of radius reach about the ζ point (cx0, cy0).
function squareGrid(h, rot, off, c0, reach, extra = {}) {
  const lines = [];
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const k = Math.ceil(reach / h);
  // Lines are indexed from the grid line nearest the centre, so ranks stay
  // put as the grid drifts.
  for (const fam of [0, 1]) {
    // Along u (fam 0, v fixed) or along v (fam 1, u fixed), in grid coordinates.
    const dir = fam ? [-sa, ca] : [ca, sa];
    const nrm = fam ? [ca, sa] : [-sa, ca];
    for (let j = -k; j <= k; j++) {
      const c = j * h;
      // A point on the line: offset along the normal, then back along the line.
      const bx = c0[0] + off[0] + nrm[0] * c - dir[0] * k * h;
      const by = c0[1] + off[1] + nrm[1] * c - dir[1] * k * h;
      lines.push({ base: [bx, by], dir, s0: 0, step: h, n: 2 * k, perp: h, g: fam, rank: rank(j), ...extra });
    }
  }
  return lines;
}

const window = (cxw, cyw, hw) => ({ x0: cxw - hw, x1: cxw + hw, y0: cyw - hw / ASPECT, y1: cyw + hw / ASPECT });

export default {
  id: 'conformal',
  kind: 'line',
  loopSeconds: 30,

  name: (facts) => NAMES[facts.kind](facts),

  describe(f) {
    const tail = ` ${f.pieces} line pieces fill the window, and ${f.thinned} lines stop early where the grid packs tight.`;
    switch (f.kind) {
      case 'joukowski':
        return `A polar grid of ${f.rings} circles and ${f.rays} rays about ${cx(f.c[0], f.c[1])}, pushed through z + 1/z, wraps an aerofoil ${f2(f.chord)} units long and ${Math.round(f.thick * 100)}% as thick, tilted ${f.attack}°. The centre circles ${f2(f.amp)} units, so the camber swells and settles.${tail}`;
      case 'exp':
        return `The exponential of a ${f.p} by ${f.q} grid wound on a cylinder gives ${f.p} spirals one way and ${f.q} the other, crossing square. The grid's cells stretch up to ${f2(f.stretch)} to 1 and back, winding the arms tighter and looser.${tail}`;
      case 'rational':
        return `The polar grid of w pulled back through a rational function with ${f.n} zeros and ${f.n} poles: circles of |w| wrap each point and ${f.rays} rays of arg w run from every zero to the poles, crossing them square. The points drift on circles of ${f2(f.amp)}.${tail}`;
      case 'power':
        return `A square grid turned ${f.turn}° and raised to the power ${f.n} fans out from the corner, where angles grow ${f.n} times. The grid slides ${f2(f.amp)} cells round a circle, so the fan bends.${tail}`;
      case 'sine':
        return `sin z turns a square grid of ${f.across} lines across the strip into ellipses and hyperbolas sharing the foci ±1, tilted ${f.tilt}°. A touch of sin 3z squares them off and back, and the upright lines slide ${f2(f.amp)} cells.${tail}`;
      default:
        return `A square grid pushed through 1/(z − p) folds into two families of circles meeting at the image of infinity, with the pole ${f2(f.near)} cells from the nearest crossing. The pole circles ${f2(f.amp)} cells, so the circles swell and shrink.${tail}`;
    }
  },

  draw(out, R, detail, time = 0) {
    const kind = KINDS[Math.floor(R() * KINDS.length)];
    // The same number of draws for every kind, so the stream stays aligned.
    const r = Array.from({ length: 16 }, () => R());
    const st = Math.sin(time);
    const ct = Math.cos(time);
    const facts = { kind };
    let spec;

    if (kind === 'joukowski') {
      // A circle through z = 1 around a centre a little left of and above 0
      // maps to a cambered aerofoil with its cusp at w = 2.
      const c0 = [-(0.06 + r[0] * 0.08), 0.03 + r[1] * 0.13];
      const amp = 0.035 + r[2] * 0.02;
      const ph = r[3] * TAU;
      const c = [c0[0] + amp * Math.cos(time + ph), c0[1] + amp * Math.sin(time + ph)];
      const R0 = Math.hypot(1 - c[0], -c[1]);
      const th = Math.atan2(-c[1], 1 - c[0]);
      const attack = (r[4] - 0.5) * 0.35;
      const ca = Math.cos(-attack);
      const sa = Math.sin(-attack);
      const rays = 8 * (2 + Math.floor(detail / 2));
      const h = TAU / rays;
      const hw = 3.0 + r[5] * 0.5;
      const win = window(-0.1 + (r[6] - 0.5) * 0.4, 0.15 + (r[7] - 0.5) * 0.3, hw);
      const rings = Math.ceil(Math.log((hw * 1.7) / 1.0) / h);
      const F = (s, a) => {
        const e = 1.0 * Math.exp(s);
        const zx = c[0] + R0 * e * Math.cos(a + th);
        const zy = c[1] + R0 * e * Math.sin(a + th);
        const d = zx * zx + zy * zy;
        const wx = zx + zx / d;
        const wy = zy - zy / d;
        return [wx * ca - wy * sa, wx * sa + wy * ca];
      };
      const lines = [];
      for (let j = 0; j <= rings; j++) lines.push({ base: [j * h, 0], dir: [0, 1], s0: 0, step: h, n: rays, perp: h, g: 0, rank: rank(j), keepAll: j === 0 });
      for (let k = 0; k < rays; k++) lines.push({ base: [0, k * h], dir: [1, 0], s0: 0, step: h, n: rings, perp: h, g: 1, rank: rank(k) });
      spec = { F, win, lines };
      // The aerofoil's chord and thickness, from the still shape.
      let lo = Infinity;
      let hi = -Infinity;
      let top = -Infinity;
      let bot = Infinity;
      for (let i = 0; i < 180; i++) {
        const [x, y] = F(0, (i / 180) * TAU);
        const u = x * Math.cos(attack) - y * Math.sin(attack);
        lo = Math.min(lo, u);
        hi = Math.max(hi, u);
      }
      for (let i = 0; i < 180; i++) {
        const [x, y] = F(0, (i / 180) * TAU);
        const u = x * Math.cos(attack) - y * Math.sin(attack);
        const v = x * Math.sin(attack) + y * Math.cos(attack);
        if (Math.abs(u - (lo * 0.7 + hi * 0.3)) < 0.12) {
          top = Math.max(top, v);
          bot = Math.min(bot, v);
        }
      }
      Object.assign(facts, { rings: rings + 1, rays, c: c0, amp, chord: hi - lo, thick: (top - bot) / (hi - lo), attack: Math.round((attack * 180) / Math.PI) });
    } else if (kind === 'exp') {
      // A p by q lattice on the cylinder: exp(λζ) with λP = 2πi wraps the
      // grid so that both families close up into whole spirals.
      const size = 34 + detail * 7;
      const phi = 0.3 + r[0] * 0.95;
      const p = Math.max(3, Math.round(size * Math.cos(phi)));
      const q = Math.max(3, Math.round(size * Math.sin(phi))) * (r[1] < 0.5 ? -1 : 1);
      const stretch = 1.4 + r[2] * 0.5;
      const a = Math.exp(Math.log(stretch) * Math.sin(time + r[3] * TAU));
      const h1 = 1 / Math.sqrt(a);
      const h2 = Math.sqrt(a);
      const Px = p * h1;
      const Py = q * h2;
      const P2 = Px * Px + Py * Py;
      // λ = 2πi / P
      const lx = (TAU * Py) / P2;
      const ly = (TAU * Px) / P2;
      const hw = 1.25;
      const win = window((r[4] - 0.5) * 0.9, (r[5] - 0.5) * 0.6, hw);
      const spin = r[6] * TAU;
      const F = (x, y) => {
        const m = Math.exp(lx * x - ly * y);
        const t = lx * y + ly * x + spin;
        return [m * Math.cos(t), m * Math.sin(t)];
      };
      const Lmax = Math.log(hw * 2.4);
      const Lmin = Math.log(hw * 0.004);
      const lines = [];
      // Family A: Re ζ = j·h1; log|w| = lx·j·h1 − ly·s.
      for (let j = 0; j < p; j++) {
        const sA = (lx * j * h1 - Lmax) / ly;
        const sB = (lx * j * h1 - Lmin) / ly;
        const m0 = Math.floor(Math.min(sA, sB) / h2);
        const m1 = Math.ceil(Math.max(sA, sB) / h2);
        lines.push({ base: [j * h1, 0], dir: [0, 1], s0: m0 * h2, step: h2, n: m1 - m0, perp: h1, g: 0, rank: rank(j) });
      }
      // Family B: Im ζ = k·h2; log|w| = lx·s − ly·k·h2.
      for (let k = 0; k < Math.abs(q); k++) {
        const sA = (Lmax + ly * k * h2) / lx;
        const sB = (Lmin + ly * k * h2) / lx;
        const m0 = Math.floor(Math.min(sA, sB) / h1);
        const m1 = Math.ceil(Math.max(sA, sB) / h1);
        lines.push({ base: [0, k * h2], dir: [1, 0], s0: m0 * h1, step: h1, n: m1 - m0, perp: h2, g: 1, rank: rank(k) });
      }
      spec = { F, win, lines };
      Object.assign(facts, { p, q: Math.abs(q), stretch });
    } else if (kind === 'rational') {
      // The polar grid of the w-plane pulled back through a rational function
      // f = Π(z − aᵢ) / Π(z − cᵢ): the levels of log|f| and of arg f, which
      // cross at right angles everywhere except at the zeros and poles they
      // wrap. Both are traced with marching squares; arg f is traced as the
      // zero set of sin(arg f − φ), which has no branch cut. Both families
      // are spaced π/K apart in log f, so the cells are square, and each line
      // gives way, ruler-fashion, where the cells shrink below a few pixels.
      const n = 2 + Math.floor(r[0] * 2);
      const hw = 1.6;
      const win = window(0, 0, hw);
      const amp = 0.08 + r[1] * 0.06;
      const turn0 = r[2] * TAU;
      const pts = [];
      for (let i = 0; i < 2 * n; i++) {
        // Zeros and poles alternate round a ring, so each zero sits between poles.
        const a = turn0 + (i / (2 * n)) * TAU + (r[3 + i] - 0.5) * 0.5;
        const rad = (0.45 + r[9 + (i % 6)] * 0.5) * hw * 0.75 * (i % 2 ? 1 : 0.85);
        const ph = r[(i * 5 + 2) % 16] * TAU;
        const dir = i % 2 ? -1 : 1;
        pts.push({
          x: rad * Math.cos(a) + amp * Math.cos(dir * time + ph),
          y: (rad * Math.sin(a) + amp * Math.sin(dir * time + ph)) / 1.1,
          s: i % 2 ? -1 : 1,
        });
      }
      const K = 8 * (1 + Math.floor((detail + 3) / 6));
      const step = Math.PI / K;
      const W = 66 + detail * 12;
      const H = Math.round(W / ASPECT);
      const px = DRAW_H / (win.y1 - win.y0);
      const gx = (i) => win.x0 + ((win.x1 - win.x0) * i) / (W - 1);
      const gy = (j) => win.y0 + ((win.y1 - win.y0) * j) / (H - 1);
      // log|f|, the unit vector f/|f|, and |(log f)'| on the grid.
      const lg = new Float32Array(W * H);
      const ux = new Float32Array(W * H);
      const uy = new Float32Array(W * H);
      const slopeAt = (x, y) => {
        let dx = 0;
        let dy = 0;
        for (const q of pts) {
          const ex = x - q.x;
          const ey = y - q.y;
          const d = ex * ex + ey * ey || 1e-12;
          dx += (q.s * ex) / d;
          dy -= (q.s * ey) / d;
        }
        return Math.hypot(dx, dy);
      };
      for (let j = 0; j < H; j++) {
        const y = gy(j);
        for (let i = 0; i < W; i++) {
          const x = gx(i);
          let l = 0;
          let a = 0;
          for (const q of pts) {
            const ex = x - q.x;
            const ey = y - q.y;
            l += 0.5 * q.s * Math.log(ex * ex + ey * ey || 1e-12);
            a += q.s * Math.atan2(ey, ex);
          }
          const k = j * W + i;
          lg[k] = Math.max(-12, Math.min(12, l));
          ux[k] = Math.cos(a);
          uy[k] = Math.sin(a);
        }
      }
      let pieces = 0;
      let thinned = 0;
      const toW = ([i, j]) => [gx(i), gy(j)];
      const tol = 0.3 / px;
      // Keeps the parts of a traced line whose cells are wide enough for
      // its rank, with ends interpolated so they slide smoothly.
      const emit = (line, rk, g) => {
        const boost = 2 ** rk;
        const ps = line.map(toW);
        const sc = ps.map(([x, y]) => Math.log2((step * px * boost) / (slopeAt(x, y) * MIN_PX)));
        let run = null;
        let cut = false;
        const lerp = (q) => {
          const t = sc[q - 1] / (sc[q - 1] - sc[q]);
          return [ps[q - 1][0] + (ps[q][0] - ps[q - 1][0]) * t, -(ps[q - 1][1] + (ps[q][1] - ps[q - 1][1]) * t)];
        };
        const flush = () => {
          if (run && run.length > 1) {
            out.push({ g, r: false, open: true, p: thin(run, tol) });
            pieces++;
          }
          run = null;
        };
        for (let q = 0; q < ps.length; q++) {
          if (sc[q] >= 0) {
            if (!run) run = q ? [lerp(q)] : [];
            run.push([ps[q][0], -ps[q][1]]);
          } else {
            cut = true;
            if (run) {
              run.push(lerp(q));
              flush();
            }
          }
        }
        flush();
        if (cut) thinned++;
      };
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of lg) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      // Deep levels hug the points so closely that only the high-ranked ones
      // can show, so the rest are not traced at all.
      for (let m = Math.ceil(lo / step); m <= Math.floor(hi / step); m++) {
        if (Math.abs(m * step) > 2.2 + 0.7 * rank(m)) continue;
        for (const line of contourLines(lg, W, H, m * step)) if (line.length > 2) emit(line, rank(m), 0);
      }
      const field = new Float32Array(W * H);
      for (let k = 0; k < K; k++) {
        const c = Math.cos(k * step);
        const sn = Math.sin(k * step);
        for (let q = 0; q < W * H; q++) field[q] = uy[q] * c - ux[q] * sn;
        for (const line of contourLines(field, W, H, 0)) if (line.length > 2) emit(line, rank(k), 1);
      }
      Object.assign(facts, { n, amp, rays: 2 * K, pieces, thinned });
      return facts;
    } else if (kind === 'power') {
      // z^n on a sector of angle 2π/n, which covers the plane once; the
      // window sits with the critical point 0 near its corner and the seam
      // pointing out through that corner.
      const n = 2 + Math.floor(r[0] * 3);
      const amp = 0.8 + r[1] * 0.8;
      const turn = r[2] * (Math.PI / 2) + 0.06 * st;
      const wh = 1;
      const e = 0.04 * wh;
      const ww = wh * ASPECT;
      const win = { x0: -e, x1: ww - e, y0: -e, y1: wh - e };
      const reach = Math.hypot(ww, wh) ** (1 / n) * 1.02;
      const px = DRAW_H / wh;
      const h = 18 / (px * n * Math.hypot(ww, wh) ** ((n - 1) / n)) * (10 / (5 + detail));
      const mid = Math.PI / (4 * n);
      const half = Math.PI / n;
      const off = [amp * h * Math.cos(time + r[3] * TAU), amp * h * Math.sin(time + r[3] * TAU)];
      const F = (x, y) => {
        const m = Math.hypot(x, y) ** n;
        const a = Math.atan2(y, x) * n;
        return [m * Math.cos(a), m * Math.sin(a)];
      };
      const keep = (x, y) => {
        let d = Math.atan2(y, x) - mid;
        if (d > Math.PI) d -= TAU;
        if (d < -Math.PI) d += TAU;
        const rr = Math.hypot(x, y);
        return Math.min(half - Math.abs(d) - 0.01, reach - rr) * 30;
      };
      const lines = squareGrid(h, turn, off, [reach / 2 * Math.cos(mid), reach / 2 * Math.sin(mid)], reach * 0.75);
      spec = { F, keep, win, lines };
      Object.assign(facts, { n, amp, turn: Math.round((r[2] * 90)) });
    } else if (kind === 'sine') {
      // sin z maps the strip |Re z| < π/2 once onto the plane, cut along the
      // rays beyond the foci ±1. Lines that leave the strip on one side of a
      // cut come back as their mirror image on the other, so the horizontal
      // lines are kept in mirror pairs to join up into whole ellipses. Over
      // the loop a little sin 3z, which keeps those symmetries, squares the
      // ellipses off one way and the other, and the upright lines slide.
      const across = 16 + detail * 3;
      const h = Math.PI / across;
      const half = r[0] < 0.5 ? 0 : 0.5;
      const eps = 0.012 * Math.sin(time);
      const amp = 0.5 + r[1] * 0.5;
      const dx = amp * h * Math.sin(time + r[2] * TAU);
      const hw = 1.3 + r[3] * 0.25;
      const win = window((r[4] - 0.5) * 0.3, (r[5] - 0.5) * 0.3, hw);
      const spin = (r[6] - 0.5) * 0.4;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const F = (x, y) => {
        const u = Math.sin(x) * Math.cosh(y) + eps * Math.sin(3 * x) * Math.cosh(3 * y);
        const v = Math.cos(x) * Math.sinh(y) + eps * Math.cos(3 * x) * Math.sinh(3 * y);
        return [u * cs - v * sn, u * sn + v * cs];
      };
      const keep = (x) => (Math.PI / 2 - Math.abs(x)) * 30;
      const Y = Math.asinh(hw * 1.6);
      const mTop = Math.ceil(Y / h);
      const kSide = Math.ceil(Math.PI / 2 / h) + 2;
      const lines = [];
      for (let k = -kSide; k <= kSide; k++) {
        const x = dx + k * h;
        if (Math.abs(x) >= Math.PI / 2) continue;
        lines.push({ base: [x, 0], dir: [0, 1], s0: (-mTop + half) * h, step: h, n: 2 * mTop, perp: h, g: 0, rank: rank(k) });
      }
      for (let m = -mTop; m < mTop; m++) {
        const y = (m + half) * h;
        // Mirror pairs share a rank, so their halves end together.
        const i = half && m < 0 ? -m - 1 : Math.abs(m);
        lines.push({ base: [0, y], dir: [1, 0], s0: dx - kSide * h, step: h, n: 2 * kSide, perp: h, g: 1, rank: rank(i) });
      }
      spec = { F, keep, win, lines };
      Object.assign(facts, { across, amp, tilt: Math.round((spin * 180) / Math.PI), span: hw });
    } else {
      // 1/(z − p): lines near the pole swing out into wide circles, and far
      // ones shrink into 0, the image of infinity. Each line only reaches as
      // far out as its rank lets it show, so the work stays the same per rank.
      const hw = 0.06 + 0.012 * (10 - detail) + r[0] * 0.03;
      const win = window((r[1] - 0.5) * hw * 0.8, (r[2] - 0.5) * hw * 0.6, hw);
      const p0 = [r[3] - 0.5, r[4] - 0.5];
      const amp = 0.25 + r[5] * 0.2;
      const pz = [p0[0] + amp * Math.cos(time + r[6] * TAU), p0[1] + amp * Math.sin(time + r[6] * TAU)];
      const spin = r[7] * TAU;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const F = (x, y) => {
        const dx = x - pz[0];
        const dy = y - pz[1];
        const d = dx * dx + dy * dy;
        const u = dx / d;
        const v = -dy / d;
        return [u * cs - v * sn, u * sn + v * cs];
      };
      const px = DRAW_H / ((2 * hw) / ASPECT);
      // The star at the image of infinity is the densest spot of any kind, so
      // its lines give way at a wider gap.
      const minPx = MIN_PX * 1.6;
      const ext = (k) => 1.2 * Math.sqrt((px * 2 ** k) / minPx) + 1.5;
      const J = Math.ceil(ext(RANK_CAP));
      const lines = [];
      for (const fam of [0, 1]) {
        for (let j = -J; j <= J; j++) {
          const rj = ext(rank(j));
          const d = j - p0[fam ? 0 : 1];
          if (Math.abs(d) > rj) continue;
          const c = p0[fam ? 1 : 0];
          const reachAlong = Math.sqrt(rj * rj - d * d);
          const m0 = Math.floor(c - reachAlong);
          const m1 = Math.ceil(c + reachAlong);
          lines.push(fam
            ? { base: [j, 0], dir: [0, 1], s0: m0, step: 1, n: m1 - m0, perp: 1, g: 1, rank: rank(j) }
            : { base: [0, j], dir: [1, 0], s0: m0, step: 1, n: m1 - m0, perp: 1, g: 0, rank: rank(j) });
        }
      }
      spec = { F, win, lines, minPx };
      const fx = p0[0] - Math.round(p0[0]);
      const fy = p0[1] - Math.round(p0[1]);
      Object.assign(facts, { amp, near: Math.min(Math.abs(fx), Math.abs(fy)) });
    }

    Object.assign(facts, trace(out, spec));
    return facts;
  },
};
