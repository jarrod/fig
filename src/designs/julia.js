// Equipotentials of a filled Julia set: level curves of the Green's function
// G(z) = lim log|zₙ| / 2ⁿ, which is 0 on the set and grows outward like
// log|z|. The levels are spaced geometrically, so they close in on the set
// and wrap into its fjords, and external rays (the field lines of G, at right
// angles to every level) run in from outside at angles k / 2ᵐ of a turn.
// c circles a point near the edge of the Mandelbrot set, so the set pinches
// and blooms and comes back at 2π.
import { contourLines, isClosed } from '../core/marching.js';

const TAU = Math.PI * 2;
// The card's drawable area is 264 × 214 pixels.
const ASPECT = 264 / 214;
const BAIL = 1e4;
const LOG_BAIL = Math.log(BAIL);
// The narrowest gap, in card pixels, kept between neighbouring levels.
const GAP_PX = 3.2;

// Bulbs of the Mandelbrot set: the centre (where the cycle is
// superattracting) and the root where the bulb meets its parent. Inside a
// bulb of period q the Julia set is connected, with q blobs meeting at each
// pinch point. c sits part way from the centre to the bulb's edge.
const BULBS = [
  { q: 2, name: 'the period-2 bulb', centre: [-1, 0], root: [-0.75, 0] },
  { q: 3, name: 'the 1/3 bulb', centre: [-0.122561, 0.744862], root: [-0.125, 0.649519] },
  { q: 4, name: 'the 1/4 bulb', centre: [0.282271, 0.530061], root: [0.25, 0.5] },
  { q: 5, name: 'the 1/5 bulb', centre: [0.379513, 0.334932], root: [0.356763, 0.328582] },
  { q: 5, name: 'the 2/5 bulb', centre: [-0.50434, 0.562765], root: [-0.481763, 0.531657] },
  { q: 4, name: 'the period-4 bulb on the real axis', centre: [-1.310703, 0], root: [-1.25, 0] },
];

// Escape from z under z² + c. Returns G(z), and the step −(G − target)/Φ'(z)
// that moves z straight down the field line to the level target (Φ = log of
// the Böttcher map, whose real part is G and whose argument is the angle).
function green(x, y, cx, cy, maxIter) {
  let dx = 1;
  let dy = 0;
  for (let n = 0; n < maxIter; n++) {
    const r2 = x * x + y * y;
    if (r2 > BAIL * BAIL) {
      const lr = 0.5 * Math.log(r2);
      return { G: lr / 2 ** n, x, y, dx, dy, lr, n };
    }
    const ndx = 2 * (x * dx - y * dy);
    const ndy = 2 * (x * dy + y * dx);
    dx = ndx;
    dy = ndy;
    const nx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nx;
  }
  return { G: 0 };
}

// The view (seed-only): the set's long axis turned level and the window
// fitted round it, measured once per seed from a coarse grid.
const views = new Map();
function viewFor(seed, cx, cy) {
  const key = `${seed}:${cx}:${cy}`;
  if (views.has(key)) return views.get(key);
  const pts = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -2 + (4 * (i + 0.5)) / N;
      const y = -2 + (4 * (j + 0.5)) / N;
      if (green(x, y, cx, cy, 60).G < 0.002) pts.push([x, y]);
    }
  }
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  let u = 0.3;
  let v = 0.3;
  for (const [x, y] of pts) {
    u = Math.max(u, Math.abs(x * ca + y * sa));
    v = Math.max(v, Math.abs(-x * sa + y * ca));
  }
  const view = { angle, hw: Math.max(u * 1.08, v * 1.08 * ASPECT), area: pts.length * (16 / (N * N)) };
  if (views.size > 64) views.clear();
  views.set(key, view);
  return view;
}

// Drops points that lie within tol of the line through their neighbours,
// which keeps the export small without changing what is drawn.
function thin(line, tol) {
  if (line.length < 3) return line;
  // Douglas–Peucker, with a stack instead of recursion.
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

// Clips a polyline to a rectangle, keeping the pieces inside.
function clip(line, x0, x1, y0, y1) {
  const inside = ([x, y]) => Math.min(x - x0, x1 - x, y - y0, y1 - y);
  const pieces = [];
  let run = null;
  let prev = null;
  let ps = 0;
  for (const p of line) {
    const s = inside(p);
    if (!prev) {
      if (s >= 0) run = [p];
    } else if (ps >= 0 && s >= 0) run.push(p);
    else if (ps >= 0 || s >= 0) {
      const t = ps / (ps - s);
      const q = [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t];
      if (s < 0) {
        run.push(q);
        if (run.length > 1) pieces.push(run);
        run = null;
      } else run = [q, p];
    }
    prev = p;
    ps = s;
  }
  if (run && run.length > 1) pieces.push(run);
  return pieces;
}

export default {
  id: 'julia',
  kind: 'line',
  loopSeconds: 36,

  name: () => 'Julia set field lines',

  describe({ c, r, where, q, out, levels, power, depth, rays, inner }) {
    const sign = c[1] < 0 ? '−' : '+';
    const raysText = rays ? ` ${rays} external rays, at angles k/${rays} of a turn, cross them at right angles.` : '';
    return `c = ${c[0].toFixed(3)} ${sign} ${Math.abs(c[1]).toFixed(3)}i lies in ${where} of the Mandelbrot set, ${Math.round(out * 100)}% of the way out from its centre, so ${q} blobs meet at every pinch; it circles ${r.toFixed(3)} round. ${levels} levels of the Green's function fall ${depth} octaves in steps growing as the ${power.toFixed(2)} power, and the innermost is in ${inner} ${inner === 1 ? 'piece' : 'pieces'}.${raysText}`;
  },

  draw(out, R, detail, time = 0, seed = 0) {
    const bulb = BULBS[Math.floor(R() * BULBS.length)];
    const size = Math.hypot(bulb.centre[0] - bulb.root[0], bulb.centre[1] - bulb.root[1]);
    const out0 = (0.45 + R() * 0.35) * size;
    const beta = R() * TAU;
    // Each loop a mirror image: half the seeds take the conjugate bulb.
    const flip = R() < 0.5 ? -1 : 1;
    const r = (0.12 + R() * 0.1) * size;
    const ph = R() * TAU;
    const m = R() < 0.3 ? 0 : 3 + Math.floor(detail / 4) + (R() < 0.5 ? 0 : 1);
    const power = 1.3 + R() * 0.4;
    const spread = R();
    const c0 = [bulb.centre[0] + out0 * Math.cos(beta), flip * (bulb.centre[1] + out0 * Math.sin(beta))];
    // c starts at c0 and goes once round a circle of radius r through it.
    const cx = c0[0] + r * (Math.cos(time + ph) - Math.cos(ph));
    const cy = c0[1] + r * (Math.sin(time + ph) - Math.sin(ph));

    const view = viewFor(seed, c0[0], c0[1]);
    const ca = Math.cos(view.angle);
    const sa = Math.sin(view.angle);
    const hw = view.hw;
    const hh = hw / ASPECT;
    const W = 50 + detail * 14;
    const H = Math.round(W / ASPECT);
    const levels = 8 + Math.ceil(detail * 0.7);
    // Levels of log₂ G, from just inside the window's corners down to depth
    // octaves below that. Escape slows sharply near the set, so G falls by
    // many octaves across a short distance there: the steps between levels
    // grow as a power of their index, close together outside and further
    // apart (in G) near the set, which keeps them apart on the card.
    const top = Math.log2(Math.log(Math.hypot(hw, hh)) * 0.9);
    const depth = 26 + detail * 2 + Math.round(spread * 8);
    const levelAt = (k) => top - depth * (k / (levels - 1)) ** power;
    // Points still bounded after maxIter steps lie inside the deepest level.
    const maxIter = Math.ceil(depth - top + Math.log2(LOG_BAIL)) + 4;

    const field = new Float32Array(W * H);
    const floor = top - depth - 4;
    for (let j = 0; j < H; j++) {
      const v = -hh + (2 * hh * j) / (H - 1);
      for (let i = 0; i < W; i++) {
        const u = -hw + (2 * hw * i) / (W - 1);
        const e = green(u * ca - v * sa, u * sa + v * ca, cx, cy, maxIter);
        field[j * W + i] = e.G > 0 ? Math.max(floor, Math.log2(e.lr) - e.n) : floor;
      }
    }
    const toDraw = ([i, j]) => [-hw + (2 * hw * i) / (W - 1), -(-hh + (2 * hh * j) / (H - 1))];
    // Where the levels would crowd, a line gives way: at each point the gap
    // to the neighbouring levels is the step in log₂ G over the slope of the
    // field. Levels counted from the innermost halve, like a ruler: odd ones
    // stop at a wider gap than even ones, and the innermost never stops.
    const cellPx = 264 / (W - 1);
    // A quarter of a card pixel, in drawing units.
    const tol = (2 * hw) / 264 / 4;
    const slope = (gx, gy) => {
      const i = Math.min(W - 2, Math.max(1, Math.round(gx)));
      const j = Math.min(H - 2, Math.max(1, Math.round(gy)));
      const at = (a, b) => (field[b * W + a] > floor ? field[b * W + a] : field[j * W + i]);
      const dx = (at(i + 1, j) - at(i - 1, j)) / 2;
      const dy = (at(i, j + 1) - at(i, j - 1)) / 2;
      return Math.hypot(dx, dy) / cellPx;
    };
    let inner = 0;
    for (let k = 0; k < levels; k++) {
      const level = levelAt(k);
      const fromInner = levels - 1 - k;
      let rank = 0;
      while (fromInner && rank < 3 && !((fromInner >> rank) & 1)) rank++;
      const step = Math.min(k > 0 ? levelAt(k - 1) - level : Infinity, k < levels - 1 ? level - levelAt(k + 1) : Infinity);
      const need = GAP_PX / 2 ** rank;
      for (const line of contourLines(field, W, H, level)) {
        if (line.length < 4) continue;
        // Tiny closed loops are below what the grid can draw well.
        if (isClosed(line) && line.length < 7) continue;
        if (!fromInner) {
          inner++;
          out.push({ g: 0, r: false, open: true, p: thin(line.map(toDraw), tol) });
          continue;
        }
        const score = line.map(([gx, gy]) => Math.log2(step / (slope(gx, gy) || 1e-9) / need));
        let run = null;
        for (let q = 0; q < line.length; q++) {
          const sc = score[q];
          if (sc >= 0) {
            if (!run) {
              run = [];
              if (q > 0) {
                const t = score[q - 1] / (score[q - 1] - sc);
                run.push(toDraw([line[q - 1][0] + (line[q][0] - line[q - 1][0]) * t, line[q - 1][1] + (line[q][1] - line[q - 1][1]) * t]));
              }
            }
            run.push(toDraw(line[q]));
          } else if (run) {
            const t = score[q - 1] / (score[q - 1] - sc);
            run.push(toDraw([line[q - 1][0] + (line[q][0] - line[q - 1][0]) * t, line[q - 1][1] + (line[q][1] - line[q - 1][1]) * t]));
            if (run.length > 2) out.push({ g: 0, r: false, open: true, p: thin(run, tol) });
            run = null;
          }
        }
        if (run && run.length > 2) out.push({ g: 0, r: false, open: true, p: thin(run, tol) });
      }
    }
    const Gmin = 2 ** levelAt(levels - 1);

    // External rays: start far out at angle θ, where the Böttcher map is
    // nearly the identity, and step down the field line, level by level.
    const rays = m ? 2 ** m : 0;
    const steps = 56;
    const Gs = Math.log(12);
    for (let k = 0; k < rays; k++) {
      const a = (k / rays) * TAU;
      let x = 12 * Math.cos(a);
      let y = 12 * Math.sin(a);
      const pts = [];
      let lost = false;
      for (let s = 0; s <= steps && !lost; s++) {
        const target = Gs * (Gmin / Gs) ** (s / steps);
        for (let it = 0; it < 3; it++) {
          const e = green(x, y, cx, cy, maxIter);
          if (!e.G) {
            lost = true;
            break;
          }
          // −(G − target)/Φ', with Φ' = d / (z · 2ⁿ).
          const amt = (e.G - target) * 2 ** e.n;
          const d2 = e.dx * e.dx + e.dy * e.dy;
          // z / d
          const qx = (e.x * e.dx + e.y * e.dy) / d2;
          const qy = (e.y * e.dx - e.x * e.dy) / d2;
          let sx = -amt * qx;
          let sy = -amt * qy;
          const len = Math.hypot(sx, sy);
          const cap = 0.25 * Math.max(0.05, Math.hypot(x, y) * 0.5);
          if (len > cap) {
            sx *= cap / len;
            sy *= cap / len;
          }
          x += sx;
          y += sy;
          if (Math.abs(e.G - target) < target * 0.02) break;
        }
        if (!lost) {
          const u = x * ca + y * sa;
          const v = -x * sa + y * ca;
          pts.push([u, -v]);
        }
      }
      for (const piece of clip(pts, -hw, hw, -hh, hh)) out.push({ g: 1, r: false, open: true, p: piece });
    }

    return { c: c0, r, where: bulb.name, q: bulb.q, out: out0 / size, levels, power, depth, rays, inner };
  },
};
